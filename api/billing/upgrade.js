import { withSentry } from '../lib/sentry.js'
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { isActeroAdmin } from '../lib/admin-auth.js'
import { getOrCreateStripeCustomer, resolveCustomerCard, OPTIONS_REQUETE_COURTE } from '../lib/stripe-customer.js'
import { offreDeBienvenue, peutAvoirUneOffreDeBienvenue } from '../lib/essai-gratuit.js';
import { refuserFacturationStripe } from '../lib/facturation-shopify.js';
import { formulePour, periodeDepuisApi } from '../lib/formules.js';
import { prixDeLaFormule, lireHistoriqueAbonnements } from '../lib/formules-stripe.js';
import { parametresCheckout } from '../lib/checkout-formule.js';

/**
 * POST /api/billing/upgrade — la seule route de paiement Stripe self-serve.
 *
 * Depuis le 14 septembre 2026, tout paiement doit passer par la page Stripe
 * Checkout hébergée. Elle remplace le formulaire intégré (create-subscription +
 * PaymentModal), encore en place : sa suppression viendra dans une tâche
 * ultérieure. Deux chemins de paiement avaient fait dériver l'essai à 30, 7 ou
 * 0 jours selon le bouton.
 *
 * Deux chemins, et aucun n'écrit le plan — le webhook l'accorde :
 *   - un abonné `active` ou `trialing` qui a une carte change de prix tout de
 *     suite, la différence facturée et payée avant d'être appliquée ;
 *   - sinon, une page Stripe Checkout.
 *
 * Corps : { client_id, target_plan: 'starter'|'pro', billing_period:
 *           'monthly'|'quarterly'|'annual' (monthly par défaut), promo_code? }
 *
 * CONTRAT DE RÉPONSE
 *
 * Le front doit décider sur des codes, pas sur des phrases : toute réponse 200
 * porte un `statut`, toute erreur renvoyée par la route porte `error` (un code
 * stable) et `message` (une phrase française, affichable telle quelle).
 * `checkout_url`, `success` et `instant` restent : le front actuel les lit.
 *
 * | HTTP | statut / error           | champs en plus                          | quand |
 * |------|--------------------------|-----------------------------------------|-------|
 * | 200  | checkout                 | checkout_url                            | page Stripe Checkout ouverte |
 * | 200  | change_applique          | success, instant, plan_attendu, message | prix changé : différence prélevée, rien à régler, ou essai en cours |
 * | 200  | paiement_a_valider       | facture_url, message                    | la différence attend une action sur la page de la facture (3-D Secure, règlement) |
 * | 200  | paiement_en_cours        | message, facture_url?                   | le paiement de la différence est en traitement |
 * | 400  | requete_invalide         | message                                 | client_id ou target_plan manquant, période ou plan inconnu, formule hors catalogue |
 * | 400  | enterprise_contact       | message, calendly_url                   | plan Enterprise demandé |
 * | 400  | downgrade_non_self_serve | message                                 | plan visé inférieur au plan actuel |
 * | 400  | code_promo_refuse        | message                                 | Stripe refuse la session sur `discounts`, un code promo étant appliqué |
 * | 401  | non_authentifie          | message                                 | jeton absent ou refusé |
 * | 402  | paiement_refuse          | message, facture_url?                   | paiement de la différence refusé ; la page si la facture est ouverte |
 * | 403  | acces_refuse             | message                                 | utilisateur non rattaché au compte (un admin Actero passe) |
 * | 403  | role_non_autorise        | message                                 | rôle autre que owner ou manager |
 * | 404  | client_introuvable       | message                                 | aucune fiche `clients` pour client_id |
 * | 405  | methode_non_autorisee    | message                                 | méthode autre que POST |
 * | 409  | deja_sur_ce_plan         | message                                 | plan en base, ou prix de l'abonnement, déjà celui demandé |
 * | 409  | changement_de_formule    | message                                 | abonné avec carte vers une autre périodicité |
 * | 409  | paiement_en_attente      | message                                 | un abonnement vivant est `past_due` |
 * | 409  | abonnement_en_cours      | message                                 | un autre abonnement vivant ; `unpaid` ou `paused` : message « suspendu » |
 * | 503  | Stripe not configured    | message                                 | clé Stripe absente, ou prix du catalogue introuvable — chaîne exacte, le front la compare |
 * | 503  | indisponible             | message                                 | base illisible, carte ou historique Stripe illisible, essai remplacé non neutralisé |
 * | 500  | erreur_interne           | message                                 | toute autre erreur, Stripe compris |
 *
 * Hors contrat : `refuserFacturationStripe` répond elle-même (409
 * shopify_billing_required, 503 billing_origin_unknown).
 */

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PLAN_ORDER = ['free', 'starter', 'pro', 'enterprise'];

// Payer engage la carte de l'entreprise. Un membre « Support » ou « Finance »
// voit la facturation, mais ne décide pas de passer le compte en Pro.
const ROLES_PAYEURS = ['owner', 'manager'];

// Au-delà, ce n'est pas un code saisi par un marchand : inutile d'interroger
// Stripe avec, ni de le recopier dans les métadonnées de la session.
const LONGUEUR_MAX_CODE_PROMO = 64;

const INDISPONIBLE = 'Paiement indisponible pour le moment, réessayez dans un instant.';

// Le marchand n'a rien à configurer : la consigne d'admin part dans les
// journaux, jamais dans la réponse.
const PAS_ENCORE_DISPONIBLE = 'Le paiement n’est pas encore disponible. Écrivez-nous à support@actero.fr.';

const NON_AUTHENTIFIE = 'Session absente ou expirée : reconnectez-vous pour modifier votre abonnement.';

const DEJA_SUR_CE_PLAN = 'Vous êtes déjà sur ce plan. Pour changer de formule, écrivez-nous à support@actero.fr.';

/**
 * Une erreur de la route : un code stable que le front compare, une phrase
 * qu'il affiche — voir le contrat en tête de fichier.
 */
function erreur(res, statut, code, message, champs = {}) {
  return res.status(statut).json({ error: code, message, ...champs });
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    return erreur(res, 405, 'methode_non_autorisee', 'Seule la méthode POST est acceptée.');
  }

  // Tout sous un seul try : une exception imprévue répond encore dans le
  // contrat (erreur_interne), pas avec la réponse générique de withSentry.
  try {
    // --- Auth ---
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return erreur(res, 401, 'non_authentifie', NON_AUTHENTIFIE);

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return erreur(res, 401, 'non_authentifie', NON_AUTHENTIFIE);

    const { client_id, target_plan, billing_period = 'monthly', promo_code } = req.body || {};
    const codePromo = typeof promo_code === 'string' && promo_code.length <= LONGUEUR_MAX_CODE_PROMO
      ? promo_code
      : null;

    if (!client_id || !target_plan) {
      return erreur(res, 400, 'requete_invalide', 'Requête incomplète : client_id et target_plan sont obligatoires.');
    }

    const periode = periodeDepuisApi(billing_period);
    if (!periode) {
      return erreur(res, 400, 'requete_invalide', 'Période de facturation inconnue : choisissez monthly, quarterly ou annual.');
    }

    // --- Qui peut payer ---
    const isAdmin = await isActeroAdmin(user, supabaseAdmin);
    if (!isAdmin) {
      const { data: link, error: linkErr } = await supabaseAdmin
        .from('client_users')
        .select('client_id, role')
        .eq('user_id', user.id)
        .eq('client_id', client_id)
        .maybeSingle();
      // Une base illisible ne dit pas que l'utilisateur n'a pas accès : un 403
      // lui annoncerait des droits retirés, et il ne réessaierait pas.
      if (linkErr) {
        console.error('[billing/upgrade] rattachement au compte illisible :', linkErr.message);
        return erreur(res, 503, 'indisponible', INDISPONIBLE);
      }
      if (!link) return erreur(res, 403, 'acces_refuse', 'Vous n’avez pas accès à ce compte.');
      if (!ROLES_PAYEURS.includes(link.role)) {
        return erreur(res, 403, 'role_non_autorise', 'Seuls le propriétaire du compte ou un manager peuvent modifier l’abonnement.');
      }
    }

    // `.maybeSingle()` : une fiche absente n'est pas une erreur, et une erreur
    // n'est pas une fiche absente. `.single()` confondait les deux en 404.
    const { data: client, error: clientErr } = await supabaseAdmin
      .from('clients')
      .select('id, plan, stripe_customer_id, stripe_subscription_id, contact_email, brand_name, trial_ends_at, billing_provider, referral_first_month_free, campaign_first_month_free, referred_by_client_id')
      .eq('id', client_id)
      .maybeSingle();
    if (clientErr) {
      console.error('[billing/upgrade] fiche client illisible :', clientErr.message);
      return erreur(res, 503, 'indisponible', INDISPONIBLE);
    }
    if (!client) return erreur(res, 404, 'client_introuvable', 'Ce compte est introuvable.');

    // App Store 1.2.1 — un marchand venu de Shopify se facture chez Shopify.
    if (await refuserFacturationStripe(supabaseAdmin, client_id, res)) return;

    const currentPlan = client.plan || 'free';

    if (target_plan === 'enterprise') {
      return erreur(res, 400, 'enterprise_contact', 'Le plan Enterprise nécessite un contact commercial.', {
        calendly_url: 'https://calendly.com/actero-fr/30min',
      });
    }

    const currentIndex = PLAN_ORDER.indexOf(currentPlan);
    const targetIndex = PLAN_ORDER.indexOf(target_plan);
    if (targetIndex < 0) {
      return erreur(res, 400, 'requete_invalide', 'Plan inconnu : choisissez Starter ou Pro.');
    }
    if (targetIndex === currentIndex) {
      return erreur(res, 409, 'deja_sur_ce_plan', DEJA_SUR_CE_PLAN);
    }
    if (targetIndex < currentIndex) {
      return erreur(res, 400, 'downgrade_non_self_serve', 'Passer à un plan inférieur ne se fait pas en ligne : écrivez-nous à support@actero.fr.');
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      console.error('[billing/upgrade] STRIPE_SECRET_KEY absente : renseignez-la dans Vercel, aucun paiement Stripe n’est possible sans elle.');
      return erreur(res, 503, 'Stripe not configured', PAS_ENCORE_DISPONIBLE);
    }

    const formule = formulePour(target_plan, periode);
    if (!formule) {
      return erreur(res, 400, 'requete_invalide', 'Cette formule n’existe pas au catalogue.');
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const prix = await prixDeLaFormule(stripe, formule);
    if (!prix) {
      console.error(`[billing/upgrade] prix introuvable pour ${formule.lookupKey} : lancez « Configurer Stripe » dans l'admin.`);
      return erreur(res, 503, 'Stripe not configured', PAS_ENCORE_DISPONIBLE);
    }

    // --- Get or create Stripe customer (heals orphaned ids on key/mode change) ---
    let candidateId = client.stripe_customer_id;
    if (!candidateId) {
      const { data: funnel, error: funnelErr } = await supabaseAdmin
        .from('funnel_clients')
        .select('stripe_customer_id')
        .eq('onboarded_client_id', client_id)
        .not('stripe_customer_id', 'is', null)
        .limit(1)
        .maybeSingle();
      // Une panne ne vaut pas « aucun client Stripe connu » : on en créerait un
      // second pour le même compte (ACT-39).
      if (funnelErr) {
        console.error('[billing/upgrade] client Stripe du tunnel illisible :', funnelErr.message);
        return erreur(res, 503, 'indisponible', INDISPONIBLE);
      }
      candidateId = funnel?.stripe_customer_id || null;
    }
    const stripeCustomerId = await getOrCreateStripeCustomer(stripe, supabaseAdmin, {
      clientId: client_id,
      currentId: candidateId,
      email: client.contact_email || user.email,
      name: client.brand_name,
    });

    // --- Abonné existant ---
    const existingSubId = client.stripe_subscription_id;
    let subscription = null;
    if (existingSubId) {
      try {
        subscription = await stripe.subscriptions.retrieve(existingSubId);
      } catch (subErr) {
        if (subErr?.code !== 'resource_missing' && subErr?.statusCode !== 404) throw subErr;
      }
    }

    // Le client Stripe qui PORTE l'abonnement enregistré, quel que soit son
    // statut. `stripeCustomerId` peut en désigner un autre (identifiant
    // remplacé, client venu du tunnel) : c'est chez celui-ci que se trouvent la
    // carte de l'abonnement, et peut-être d'autres abonnements.
    const clientDeLAbonnement = typeof subscription?.customer === 'string'
      ? subscription.customer
      : (subscription?.customer?.id ?? null);

    // Le seul abonnement vivant qui laisse ouvrir Checkout : un essai sans carte
    // laissé par l'ancien formulaire intégré. Il est neutralisé juste avant la
    // création de la session.
    let essaiSansCarteId = null;

    if (subscription && ['active', 'trialing'].includes(subscription.status)) {
      const item = subscription.items?.data?.[0];

      // 1. Déjà sur le prix demandé : Stripe a basculé l'abonnement, le webhook
      //    n'a pas encore réécrit `plan`. Refaire le changement annoncerait un
      //    passage qui a déjà eu lieu : on s'arrête avant toute écriture Stripe.
      if (item?.price?.id === prix.id) {
        return erreur(res, 409, 'deja_sur_ce_plan', DEJA_SUR_CE_PLAN);
      }

      // 2. La carte, chez le client Stripe de l'abonnement : Stripe refuserait
      //    celle d'un autre client. Mode strict : une panne ne vaut pas « pas de
      //    carte ». Repasser par Checkout créerait un second abonnement pendant
      //    que le premier continue de facturer.
      let carte;
      try {
        carte = await resolveCustomerCard(stripe, subscription, clientDeLAbonnement, { strict: true });
      } catch (err) {
        console.error('[billing/upgrade] moyen de paiement illisible :', err.message);
        return erreur(res, 503, 'indisponible', INDISPONIBLE);
      }

      if (carte) {
        // 3. Avec carte : changement immédiat, à périodicité égale seulement.
        //    La périodicité RÉELLE du prix, pas sa `lookup_key` : un ancien prix
        //    sans clé n'est rattaché à aucune formule, et laissait un annuel
        //    basculer en mensuel sans passer par le support. Cette garde ne
        //    concerne que le changement immédiat : sans carte, c'est Checkout
        //    qui remplace l'abonnement, quelle que soit sa périodicité.
        const recurrence = item?.price?.recurring;
        if (!recurrence
          || recurrence.interval !== formule.recurring.interval
          || (recurrence.interval_count || 1) !== formule.recurring.interval_count) {
          return erreur(res, 409, 'changement_de_formule', 'Pour passer à une autre formule, écrivez-nous à support@actero.fr : on s’en occupe.');
        }

        // La carte, dans un appel à part : Stripe refuse `default_payment_method`
        // dans une mise à jour en attente — il ne figure pas parmi les attributs
        // qu'accepte `pending_if_incomplete` (docs.stripe.com/billing/
        // subscriptions/pending-updates-reference). Avec elle, rien que
        // l'identité du compte : la formule ne s'écrit qu'une fois le changement
        // appliqué, plus bas.
        await stripe.subscriptions.update(existingSubId, {
          default_payment_method: carte,
          metadata: { client_id, actero_client_id: client_id },
        });

        // Le prix. `create_prorations` accordait le plan tout de suite mais
        // reportait la différence au renouvellement : 150 € sur un mensuel,
        // près de 2 700 € sur un annuel, jamais payés si ce renouvellement
        // échouait. `always_invoice` la facture maintenant, et
        // `pending_if_incomplete` n'applique le nouveau prix qu'une fois
        // cette facture payée.
        const changement = await stripe.subscriptions.update(existingSubId, {
          items: [{ id: item.id, price: prix.id }],
          proration_behavior: 'always_invoice',
          payment_behavior: 'pending_if_incomplete',
          expand: ['latest_invoice.payments'],
        });

        // LE PLAN N'EST PAS ÉCRIT ICI. Il l'était, avant toute confirmation
        // de Stripe (audit du 11 septembre). customer.subscription.updated
        // l'accorde d'après le prix réellement appliqué, carte vérifiée — voir
        // api/lib/subscription-plan.js.
        const issue = await issueDuChangement(stripe, changement);

        if (issue.issue === 'applique') {
          // La formule, seulement maintenant : écrite avec la carte, elle restait
          // sur l'abonnement même quand le paiement de la différence échouait,
          // et annonçait une formule que Stripe n'avait pas appliquée. Sans
          // bloquer : le changement est fait chez Stripe, le marchand doit
          // l'apprendre même si ce détail ne s'écrit pas.
          try {
            await stripe.subscriptions.update(existingSubId, {
              metadata: {
                formule: `${formule.plan}_${formule.periode}`,
                upgrade_from: currentPlan,
                upgrade_to: target_plan,
              },
            }, OPTIONS_REQUETE_COURTE);
          } catch (err) {
            console.warn('[billing/upgrade] formule non écrite sur l’abonnement', existingSubId, ':', err.message);
          }

          const enEssai = (changement?.status ?? subscription.status) === 'trialing';
          const facture = changement?.latest_invoice && typeof changement.latest_invoice === 'object'
            ? changement.latest_invoice
            : null;
          // « Prélevée » seulement sur preuve : une différence couverte par un
          // avoir ou une remise ne prélève rien.
          const preleve = (facture?.amount_paid ?? 0) > 0;
          return res.status(200).json({
            statut: 'change_applique',
            success: true,
            instant: true,
            plan_attendu: target_plan,
            message: enEssai
              ? `Passage au plan ${target_plan} confirmé. Rien à prélever pendant votre essai : le nouveau tarif s’appliquera à sa fin.`
              : (preleve
                ? `Passage au plan ${target_plan} confirmé : la différence a été prélevée.`
                : `Passage au plan ${target_plan} confirmé : aucun montant à régler aujourd’hui.`),
          });
        }
        if (issue.issue === 'a_valider') {
          return res.status(200).json({
            statut: 'paiement_a_valider',
            facture_url: issue.factureUrl,
            message: `Le paiement de la différence reste à valider sur la page Stripe : le plan ${target_plan} s’appliquera dès qu’il sera réglé.`,
          });
        }
        if (issue.issue === 'en_cours') {
          return res.status(200).json({
            statut: 'paiement_en_cours',
            message: `Le paiement de la différence est en cours de traitement : le plan ${target_plan} s’appliquera dès sa confirmation.`,
            ...(issue.factureUrl ? { facture_url: issue.factureUrl } : {}),
          });
        }
        // Refusé. Une facture encore ouverte se règle sur sa page Stripe, avec
        // une autre carte : c'est le chemin le plus court.
        if (issue.factureUrl) {
          return erreur(res, 402, 'paiement_refuse',
            'Le paiement de la différence a été refusé. Réglez-la avec une autre carte sur la page Stripe, ou mettez à jour votre carte depuis « Gérer mon abonnement ».',
            { facture_url: issue.factureUrl });
        }
        return erreur(res, 402, 'paiement_refuse', 'Le paiement de la différence a été refusé : mettez à jour votre carte depuis « Gérer mon abonnement ».');
      }

      // 4. Sans carte, en essai : l'essai de l'ancien formulaire intégré.
      //    Checkout le remplace, et il sera neutralisé juste avant la session.
      // 5. Sans carte et actif : rien ici. Il reste vivant, et la vérification
      //    ci-dessous répond 409 abonnement_en_cours.
      if (subscription.status === 'trialing') essaiSansCarteId = subscription.id;
    }

    // --- Un seul relevé Stripe, sur tous les clients Stripe du compte ---
    // Il sert deux fois : l'avantage de bienvenue (`dejaAbonne`) et les
    // abonnements en cours (`vivants`). Le client de l'abonnement enregistré y
    // est, quel que soit le statut de cet abonnement : résilié chez un ancien
    // client Stripe, il n'empêche pas ce client-là d'en porter un autre qui
    // facture encore — et que la liste du client de la session ne voit pas.
    let historique;
    try {
      historique = await lireHistoriqueAbonnements(stripe, [stripeCustomerId, clientDeLAbonnement]);
    } catch (err) {
      console.error('[billing/upgrade] historique des abonnements illisible :', err.message);
      return erreur(res, 503, 'indisponible', INDISPONIBLE);
    }
    const { dejaAbonne, vivants } = historique;

    // --- Jamais deux abonnements vivants ---
    // Un abonné `past_due` qui cliquait « Pro » payait un second abonnement
    // pendant que le premier continuait ses relances.
    const enCours = vivants.filter((s) => s.id !== essaiSansCarteId);
    if (enCours.some((s) => s.status === 'past_due')) {
      return erreur(res, 409, 'paiement_en_attente', 'Un paiement est en attente sur votre abonnement actuel : mettez à jour votre carte depuis « Gérer mon abonnement », puis réessayez.');
    }
    // Stripe ne relance plus un `unpaid`, et un `paused` ne reprend pas seul :
    // changer de carte ne débloque ni l'un ni l'autre, seul le support le peut.
    if (enCours.some((s) => s.status === 'unpaid' || s.status === 'paused')) {
      return erreur(res, 409, 'abonnement_en_cours', 'Votre abonnement actuel est suspendu faute de paiement : écrivez-nous à support@actero.fr, on s’en occupe.');
    }
    if (enCours.length > 0) {
      return erreur(res, 409, 'abonnement_en_cours', 'Un abonnement est déjà en cours sur ce compte. Écrivez-nous à support@actero.fr : on s’en occupe.');
    }

    // --- Avantage de bienvenue : une seule fois par client ---
    const offre = offreDeBienvenue({ client, formule, dejaAbonne });

    // Le parrain n'est signalé que pour le PREMIER abonnement de son filleul :
    // /api/referral/validate crédite le parrain à chaque session qui porte
    // referral_code, donc un filleul qui résilie puis revient le ferait créditer
    // à chaque retour.
    let parrainage = null;
    if (!dejaAbonne && peutAvoirUneOffreDeBienvenue(client) && client.referral_first_month_free && client.referred_by_client_id) {
      const { data: referrerRow, error: referrerErr } = await supabaseAdmin
        .from('clients')
        .select('referral_code')
        .eq('id', client.referred_by_client_id)
        .maybeSingle();
      // Une panne ne vaut pas « parrain sans code » : la session partirait sans
      // referral_code, et le parrain ne serait jamais récompensé.
      if (referrerErr) {
        console.error('[billing/upgrade] fiche du parrain illisible :', referrerErr.message);
        return erreur(res, 503, 'indisponible', INDISPONIBLE);
      }
      parrainage = { parrainId: client.referred_by_client_id, code: referrerRow?.referral_code || null };
    }

    let promotionCodeId = null;
    if (codePromo) {
      try {
        const promoList = await stripe.promotionCodes.list({ code: codePromo, active: true, limit: 1 });
        promotionCodeId = promoList.data[0]?.id || null;
      } catch (e) {
        console.warn('[billing/upgrade] could not resolve promo code', codePromo, e.message);
      }
    }

    // --- Une seule page Stripe payable ---
    // Un double clic, ou un nouveau clic avant le webhook, laissait plusieurs
    // sessions payables : autant d'abonnements. Les pages d'abonnement encore
    // ouvertes pour ce client sont fermées avant d'en ouvrir une ; un achat
    // ponctuel (crédits) ouvert ailleurs n'est pas touché. Sans bloquer : ne
    // pas pouvoir les fermer ne doit pas empêcher de payer.
    //
    // Reste une course, et on la garde : deux requêtes simultanées lisent
    // chacune « aucune page ouverte » et en ouvrent une chacune. « Expirer puis
    // créer » ne la ferme pas ; c'est au front de l'éviter, en désactivant les
    // boutons de paiement pendant une requête.
    try {
      const { data: ouvertes } = await stripe.checkout.sessions.list({ customer: stripeCustomerId, status: 'open', limit: 10 });
      const expirations = await Promise.allSettled(
        ouvertes.filter((s) => s.mode === 'subscription').map((s) => stripe.checkout.sessions.expire(s.id)),
      );
      for (const e of expirations) {
        if (e.status === 'rejected') console.warn('[billing/upgrade] session Checkout non expirée :', e.reason?.message);
      }
    } catch (err) {
      console.warn('[billing/upgrade] sessions Checkout ouvertes illisibles :', err.message);
    }

    // `customer` : toute session Checkout dit à qui elle appartient (garde ACT-39,
    // api/lib/client-stripe-unique.test.js). Les paramètres sont calculés avant
    // de toucher à l'essai : s'ils lèvent, l'essai n'a pas été neutralisé pour rien.
    const parametres = parametresCheckout({
      clientId: client_id,
      customer: stripeCustomerId,
      prix,
      formule,
      offre,
      promotionCodeId,
      planActuel: currentPlan,
      parrainage,
      promoCode: codePromo,
      siteUrl: process.env.SITE_URL || 'https://actero.fr',
    });

    // --- L'essai remplacé ne doit jamais démarrer ---
    // Checkout pose la carte sur le NOUVEL abonnement. Si le marchand ajoute
    // ensuite une carte à son client Stripe, l'ancien essai la trouve à sa fin,
    // démarre, et facture Starter en plus du Pro. Résilié en fin de période, il
    // s'éteint à la fin de l'essai quoi qu'il arrive — et le webhook n'envoie
    // plus l'email « ajoutez une carte » (annoncerLaFinDEssai).
    //
    // C'est sans perte : un essai sans carte n'accorde aucun plan
    // (planUpdateFromSubscription exige une carte), le marchand n'a donc rien à
    // y perdre, même s'il referme la page Stripe sans payer. C'est bloquant :
    // sans neutralisation, pas de session.
    if (essaiSansCarteId) {
      try {
        await stripe.subscriptions.update(essaiSansCarteId, { cancel_at_period_end: true }, OPTIONS_REQUETE_COURTE);
      } catch (err) {
        console.error('[billing/upgrade] essai sans carte non neutralisé :', essaiSansCarteId, err.message);
        return erreur(res, 503, 'indisponible', INDISPONIBLE);
      }
    }

    let session;
    try {
      session = await stripe.checkout.sessions.create(parametres);
    } catch (err) {
      // Un code promo peut être refusé par Stripe à la création (première
      // commande exigée, montant minimum, produit exclu…). On ne l'annonce
      // qu'avec les trois preuves : un code appliqué, une requête refusée, et
      // le paramètre fautif sous `discounts`. Sans code, `discounts` porte le
      // coupon trimestriel, auquel le marchand n'a rien à renoncer ; et une
      // panne, ou un refus sur un autre paramètre, annoncée « code refusé »
      // ferait abandonner à tort un code valable.
      const refusDuCode = Boolean(promotionCodeId)
        && err?.type === 'StripeInvalidRequestError'
        && typeof err.param === 'string'
        && err.param.startsWith('discounts');
      if (refusDuCode) {
        console.warn('[billing/upgrade] session refusée avec le code promo', codePromo, err.message);
        return erreur(res, 400, 'code_promo_refuse', 'Ce code promo ne peut pas être appliqué à cet abonnement.');
      }
      throw err;
    }

    // ON NE CONSOMME RIEN ICI — ET C'EST DÉLIBÉRÉ.
    //
    // Les drapeaux de mois offert ne sont pas remis à false à la création de la
    // session : fermer la page Stripe sans payer brûlait le mois (constaté le
    // 10 septembre). Ce qui empêche d'en réclamer un second est ailleurs :
    // l'avantage de bienvenue refuse tout client déjà abonné ou ayant eu un essai.

    return res.status(200).json({ statut: 'checkout', checkout_url: session.url });
  } catch (error) {
    console.error('[billing/upgrade] erreur imprévue :', error);
    return erreur(res, 500, 'erreur_interne', 'Erreur interne. Réessayez, ou écrivez-nous à support@actero.fr.');
  }
}

/**
 * Ce que Stripe a fait d'un changement de prix demandé en
 * `payment_behavior: 'pending_if_incomplete'`. Rien n'est annoncé payé sans
 * preuve.
 *
 * Sans `pending_update`, le nouveau prix est appliqué : Stripe ne le fait
 * qu'une fois la facture de la différence payée, ou s'il n'y avait rien à
 * payer. Avec, rien n'a changé, et il faut savoir pourquoi — dans cet ordre :
 *   1. le paiement attend une authentification (3-D Secure) et la facture est
 *      ouverte → `a_valider` : le client la valide sur la page de la facture.
 *      AVANT le refus : un premier essai raté laisse `last_payment_error` sur
 *      un paiement qu'on peut encore authentifier ;
 *   2. le paiement est en traitement → `en_cours` : ni payé ni refusé, certains
 *      moyens de paiement confirment en différé. La page de la facture si elle
 *      est ouverte ;
 *   3. le paiement est refusé → `refuse`, avec la page de la facture si elle
 *      est ouverte : le client peut y régler avec une autre carte ;
 *   4. le paiement est illisible, facture ouverte → `a_valider` : la page dit
 *      ce qui manque, et permet de payer ;
 *   5. rien de lisible → `refuse`.
 *
 * API 2026-02-25.clover, celle du SDK : depuis 2025-03-31.basil, la facture ne
 * porte plus `payment_intent`. Le paiement se lit dans `latest_invoice.payments`,
 * qui ne donne que l'identifiant du PaymentIntent. L'étendre dans le même
 * appel (`latest_invoice.payments.data.payment.payment_intent`) aligne cinq
 * propriétés, quand la doc Stripe limite une chaîne d'expand à quatre : un
 * refus ferait échouer le changement lui-même. On relit donc le PaymentIntent,
 * et seulement quand le changement n'est pas passé.
 *
 * @param {import('stripe').Stripe} stripe
 * @param {any} abonnement — réponse de subscriptions.update, `latest_invoice.payments` étendu
 * @returns {Promise<{ issue: 'applique' }
 *   | { issue: 'a_valider', factureUrl: string }
 *   | { issue: 'en_cours', factureUrl: string|null }
 *   | { issue: 'refuse', factureUrl: string|null }>}
 */
async function issueDuChangement(stripe, abonnement) {
  if (!abonnement?.pending_update) return { issue: 'applique' };

  const facture = abonnement.latest_invoice && typeof abonnement.latest_invoice === 'object'
    ? abonnement.latest_invoice
    : null;
  const factureUrl = facture?.status === 'open' && facture.hosted_invoice_url ? facture.hosted_invoice_url : null;

  const paiements = facture?.payments?.data || [];
  const paiement = paiements.find((p) => p.is_default) || paiements[0];
  let intention = paiement?.payment?.payment_intent || null;
  if (typeof intention === 'string') {
    try {
      intention = await stripe.paymentIntents.retrieve(intention);
    } catch (err) {
      console.error('[billing/upgrade] paiement de la différence illisible :', err.message);
      intention = null;
    }
  }

  if (intention?.status === 'requires_action' && factureUrl) return { issue: 'a_valider', factureUrl };
  if (intention?.status === 'processing') return { issue: 'en_cours', factureUrl };
  if (intention?.status === 'requires_payment_method' || intention?.last_payment_error) return { issue: 'refuse', factureUrl };
  if (factureUrl) return { issue: 'a_valider', factureUrl };
  return { issue: 'refuse', factureUrl: null };
}

export default withSentry(handler)
