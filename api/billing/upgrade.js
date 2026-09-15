import { withSentry } from '../lib/sentry.js'
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { isActeroAdmin } from '../lib/admin-auth.js'
import { getOrCreateStripeCustomer, resolveCustomerCard } from '../lib/stripe-customer.js'
import { offreDeBienvenue, peutAvoirUneOffreDeBienvenue } from '../lib/essai-gratuit.js';
import { refuserFacturationStripe } from '../lib/facturation-shopify.js';
import { formulePour, periodeDepuisApi } from '../lib/formules.js';
import { prixDeLaFormule, aDejaEuUnAbonnement, abonnementsVivants, STATUTS_VIVANTS } from '../lib/formules-stripe.js';
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
 * Body : { client_id, target_plan: 'starter'|'pro', billing_period:
 *          'monthly'|'quarterly'|'annual', promo_code? }
 *
 * Réponses : { checkout_url } | { instant: true } | { facture_url } |
 *            402 paiement_refuse | 409 changement_de_formule |
 *            409 deja_sur_ce_plan | 409 paiement_en_attente |
 *            409 abonnement_en_cours | 400 | 401 | 403 | 503
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

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // --- Auth ---
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non autorise.' });

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Non autorise.' });

  const { client_id, target_plan, billing_period = 'monthly', promo_code } = req.body || {};
  const codePromo = typeof promo_code === 'string' && promo_code.length <= LONGUEUR_MAX_CODE_PROMO
    ? promo_code
    : null;

  if (!client_id || !target_plan) {
    return res.status(400).json({ error: 'Missing client_id or target_plan' });
  }

  const periode = periodeDepuisApi(billing_period);
  if (!periode) {
    return res.status(400).json({ error: 'billing_period must be monthly, quarterly or annual' });
  }

  // --- Qui peut payer ---
  const isAdmin = await isActeroAdmin(user, supabaseAdmin);
  if (!isAdmin) {
    const { data: link } = await supabaseAdmin
      .from('client_users')
      .select('client_id, role')
      .eq('user_id', user.id)
      .eq('client_id', client_id)
      .maybeSingle();
    if (!link) return res.status(403).json({ error: 'Acces refuse.' });
    if (!ROLES_PAYEURS.includes(link.role)) {
      return res.status(403).json({ error: 'Seuls le propriétaire du compte ou un manager peuvent modifier l’abonnement.' });
    }
  }

  try {
    const { data: client, error: clientErr } = await supabaseAdmin
      .from('clients')
      .select('id, plan, stripe_customer_id, stripe_subscription_id, contact_email, brand_name, trial_ends_at, billing_provider, referral_first_month_free, campaign_first_month_free, referred_by_client_id')
      .eq('id', client_id)
      .single();

    if (clientErr || !client) {
      return res.status(404).json({ error: 'Client introuvable.' });
    }

    // App Store 1.2.1 — un marchand venu de Shopify se facture chez Shopify.
    if (await refuserFacturationStripe(supabaseAdmin, client_id, res)) return;

    const currentPlan = client.plan || 'free';

    if (target_plan === 'enterprise') {
      return res.status(400).json({
        error: 'enterprise_contact',
        message: 'Le plan Enterprise necessite un contact commercial.',
        calendly_url: 'https://calendly.com/actero-fr/30min',
      });
    }

    const currentIndex = PLAN_ORDER.indexOf(currentPlan);
    const targetIndex = PLAN_ORDER.indexOf(target_plan);
    if (targetIndex < 0) {
      return res.status(400).json({ error: 'Plan cible invalide.' });
    }
    if (targetIndex === currentIndex) {
      return res.status(409).json({
        error: 'deja_sur_ce_plan',
        message: 'Vous êtes déjà sur ce plan. Pour changer de formule, écrivez-nous à support@actero.fr.',
      });
    }
    if (targetIndex < currentIndex) {
      return res.status(400).json({ error: 'Seuls les upgrades sont autorises. Pour un downgrade, contactez le support.' });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({ error: 'Stripe not configured', hint: 'Contact support at support@actero.fr' });
    }

    const formule = formulePour(target_plan, periode);
    if (!formule) {
      return res.status(400).json({ error: 'Formule invalide.' });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const prix = await prixDeLaFormule(stripe, formule);
    if (!prix) {
      return res.status(503).json({
        error: 'Stripe not configured',
        hint: `Prix introuvable pour ${formule.lookupKey}. Lancez « Configurer Stripe » dans l'admin.`,
      });
    }

    // --- Get or create Stripe customer (heals orphaned ids on key/mode change) ---
    let candidateId = client.stripe_customer_id;
    if (!candidateId) {
      const { data: funnel } = await supabaseAdmin
        .from('funnel_clients')
        .select('stripe_customer_id')
        .eq('onboarded_client_id', client_id)
        .not('stripe_customer_id', 'is', null)
        .limit(1)
        .maybeSingle();
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
    // Le seul abonnement vivant qui n'empêche pas d'ouvrir Checkout : un essai
    // sans carte laissé par l'ancien formulaire intégré, qui s'annule seul en
    // fin d'essai.
    let essaiSansCarteId = null;
    if (existingSubId) {
      try {
        subscription = await stripe.subscriptions.retrieve(existingSubId);
      } catch (subErr) {
        if (subErr?.code !== 'resource_missing' && subErr?.statusCode !== 404) throw subErr;
      }

      if (subscription && ['active', 'trialing'].includes(subscription.status)) {
        const item = subscription.items?.data?.[0];
        // La périodicité RÉELLE du prix, pas sa `lookup_key` : un ancien prix
        // sans clé n'est rattaché à aucune formule, et laissait un annuel
        // basculer en mensuel sans passer par le support.
        const recurrence = item?.price?.recurring;
        if (!recurrence
          || recurrence.interval !== formule.recurring.interval
          || (recurrence.interval_count || 1) !== formule.recurring.interval_count) {
          return res.status(409).json({
            error: 'changement_de_formule',
            message: 'Pour passer à une autre formule, écrivez-nous à support@actero.fr : on s’en occupe.',
          });
        }

        // La carte se cherche chez le client Stripe qui PORTE l'abonnement.
        // `stripeCustomerId` peut en désigner un autre (identifiant remplacé,
        // client venu du tunnel), dont Stripe refuserait la carte.
        const clientDeLAbonnement = typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer?.id;

        // Mode strict : une panne ne vaut pas « pas de carte ». Repasser par
        // Checkout créerait un second abonnement pendant que le premier continue
        // de facturer.
        let carte;
        try {
          carte = await resolveCustomerCard(stripe, subscription, clientDeLAbonnement, { strict: true });
        } catch (err) {
          console.error('[billing/upgrade] moyen de paiement illisible :', err.message);
          return res.status(503).json({ error: INDISPONIBLE });
        }

        if (carte) {
          // 1. La carte, dans un appel à part : une mise à jour en
          //    `pending_if_incomplete` n'accepte que ce qui touche au prix, à la
          //    proration ou à l'essai — pas `default_payment_method`.
          await stripe.subscriptions.update(existingSubId, {
            default_payment_method: carte,
            metadata: {
              client_id,
              actero_client_id: client_id,
              formule: `${formule.plan}_${formule.periode}`,
              upgrade_from: currentPlan,
              upgrade_to: target_plan,
            },
          });

          // 2. Le prix. `create_prorations` accordait le plan tout de suite mais
          //    reportait la différence au renouvellement : 150 € sur un mensuel,
          //    près de 2 700 € sur un annuel, jamais payés si ce renouvellement
          //    échouait. `always_invoice` la facture maintenant, et
          //    `pending_if_incomplete` n'applique le nouveau prix qu'une fois
          //    cette facture payée.
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
            const enEssai = (changement?.status ?? subscription.status) === 'trialing';
            return res.status(200).json({
              success: true,
              instant: true,
              plan_attendu: target_plan,
              message: enEssai
                ? `Passage au plan ${target_plan} confirmé. Rien à prélever pendant votre essai : le nouveau tarif s’appliquera à sa fin.`
                : `Passage au plan ${target_plan} confirmé : la différence a été prélevée.`,
            });
          }
          if (issue.issue === 'a_regler') {
            return res.status(200).json({
              facture_url: issue.factureUrl,
              message: `Le paiement de la différence reste à valider sur la page Stripe : le plan ${target_plan} s’appliquera dès qu’il sera réglé.`,
            });
          }
          return res.status(402).json({
            error: 'paiement_refuse',
            message: 'Le paiement de la différence a été refusé : mettez à jour votre carte depuis « Gérer mon abonnement ».',
          });
        }

        // Sans carte, un essai est celui de l'ancien formulaire intégré : on
        // passe par la page Stripe. Un abonnement actif sans carte, lui, reste
        // un abonnement en cours (voir plus bas).
        if (subscription.status === 'trialing') essaiSansCarteId = subscription.id;
      }
    }

    // --- Avantage de bienvenue : une seule fois par client ---
    let dejaAbonne;
    try {
      dejaAbonne = await aDejaEuUnAbonnement(stripe, stripeCustomerId);
    } catch (err) {
      console.error('[billing/upgrade] lecture des abonnements passés impossible :', err.message);
      return res.status(503).json({ error: INDISPONIBLE });
    }
    const offre = offreDeBienvenue({ client, formule, dejaAbonne });

    // Le parrain n'est signalé que pour le PREMIER abonnement de son filleul :
    // /api/referral/validate crédite le parrain à chaque session qui porte
    // referral_code, donc un filleul qui résilie puis revient le ferait créditer
    // à chaque retour.
    let parrainage = null;
    if (!dejaAbonne && peutAvoirUneOffreDeBienvenue(client) && client.referral_first_month_free && client.referred_by_client_id) {
      const { data: referrerRow } = await supabaseAdmin
        .from('clients')
        .select('referral_code')
        .eq('id', client.referred_by_client_id)
        .maybeSingle();
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

    // --- Jamais deux abonnements vivants ---
    // Un abonné `past_due` qui cliquait « Pro » payait un second abonnement
    // pendant que le premier continuait ses relances.
    let vivants;
    try {
      vivants = await abonnementsVivants(stripe, stripeCustomerId);
    } catch (err) {
      console.error('[billing/upgrade] abonnements en cours illisibles :', err.message);
      return res.status(503).json({ error: INDISPONIBLE });
    }
    // L'abonnement enregistré compte aussi quand il vit chez un autre client
    // Stripe que celui de la session : la liste ci-dessus ne le voit pas.
    if (subscription && STATUTS_VIVANTS.includes(subscription.status) && !vivants.some((s) => s.id === subscription.id)) {
      vivants = [...vivants, subscription];
    }
    const enCours = vivants.filter((s) => s.id !== essaiSansCarteId);
    if (enCours.some((s) => s.status === 'past_due' || s.status === 'unpaid')) {
      return res.status(409).json({
        error: 'paiement_en_attente',
        message: 'Un paiement est en attente sur votre abonnement actuel : mettez à jour votre carte depuis « Gérer mon abonnement », puis réessayez.',
      });
    }
    if (enCours.length > 0) {
      return res.status(409).json({
        error: 'abonnement_en_cours',
        message: 'Un abonnement est déjà en cours sur ce compte. Écrivez-nous à support@actero.fr : on s’en occupe.',
      });
    }

    // --- Une seule page Stripe payable ---
    // Un double clic, ou un nouveau clic avant le webhook, laissait plusieurs
    // sessions payables : autant d'abonnements. Les pages d'abonnement encore
    // ouvertes pour ce client sont fermées avant d'en ouvrir une ; un achat
    // ponctuel (crédits) ouvert ailleurs n'est pas touché. Sans bloquer : ne
    // pas pouvoir les fermer ne doit pas empêcher de payer.
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
    // api/lib/client-stripe-unique.test.js).
    let session;
    try {
      session = await stripe.checkout.sessions.create(parametresCheckout({
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
      }));
    } catch (err) {
      // Un code promo peut être refusé par Stripe à la création (première
      // commande exigée, montant minimum, produit exclu…). Seul un refus de la
      // requête peut venir du code : une panne annoncée « code refusé » ferait
      // abandonner à tort un code valable.
      const refusDeStripe = err?.type === 'StripeInvalidRequestError' || err?.statusCode === 400;
      if (promotionCodeId && refusDeStripe) {
        console.warn('[billing/upgrade] session refusée avec le code promo', codePromo, err.message);
        return res.status(400).json({
          error: 'code_promo_refuse',
          message: 'Ce code promo ne peut pas être appliqué à cet abonnement.',
        });
      }
      throw err;
    }

    // ON NE CONSOMME RIEN ICI — ET C'EST DÉLIBÉRÉ.
    //
    // Les drapeaux de mois offert ne sont pas remis à false à la création de la
    // session : fermer la page Stripe sans payer brûlait le mois (constaté le
    // 10 septembre). Ce qui empêche d'en réclamer un second est ailleurs :
    // l'avantage de bienvenue refuse tout client déjà abonné ou ayant eu un essai.

    return res.status(200).json({ checkout_url: session.url });
  } catch (error) {
    console.error('Billing upgrade error:', error);
    return res.status(500).json({ error: 'Erreur interne. Reessayez ou contactez le support.' });
  }
}

/**
 * Ce que Stripe a fait d'un changement de prix demandé en
 * `payment_behavior: 'pending_if_incomplete'`. Rien n'est annoncé payé sans
 * preuve.
 *
 * Sans `pending_update`, le nouveau prix est appliqué : Stripe ne le fait
 * qu'une fois la facture de la différence payée, ou s'il n'y avait rien à
 * payer. Avec, rien n'a changé, et il faut savoir pourquoi :
 *   - le paiement attend une authentification (3-D Secure) → la page Stripe
 *     de la facture, où le client la valide ;
 *   - le paiement est refusé → refus : il faut changer de carte ;
 *   - le paiement est illisible → la page de la facture si elle est ouverte
 *     (le client y voit ce qui manque, et peut payer), sinon refus.
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
 * @returns {Promise<{ issue: 'applique' } | { issue: 'a_regler', factureUrl: string } | { issue: 'refuse' }>}
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

  if (intention?.status === 'requires_action' && factureUrl) return { issue: 'a_regler', factureUrl };
  if (intention?.status === 'requires_payment_method' || intention?.last_payment_error) return { issue: 'refuse' };
  if (factureUrl) return { issue: 'a_regler', factureUrl };
  return { issue: 'refuse' };
}

export default withSentry(handler)
