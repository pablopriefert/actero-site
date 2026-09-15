import { withSentry } from '../lib/sentry.js'
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { isActeroAdmin } from '../lib/admin-auth.js'
import { getOrCreateStripeCustomer, resolveCustomerCard } from '../lib/stripe-customer.js'
import { offreDeBienvenue, peutAvoirUneOffreDeBienvenue } from '../lib/essai-gratuit.js';
import { refuserFacturationStripe } from '../lib/facturation-shopify.js';
import { formulePour, formuleDuPrix, periodeDepuisApi } from '../lib/formules.js';
import { prixDeLaFormule, aDejaEuUnAbonnement } from '../lib/formules-stripe.js';
import { parametresCheckout } from '../lib/checkout-formule.js';

/**
 * POST /api/billing/upgrade — la seule route de paiement Stripe self-serve.
 *
 * Depuis le 14 septembre 2026, tout paiement passe par la page Stripe Checkout
 * hébergée : le formulaire intégré (create-subscription + PaymentModal) est
 * supprimé. Deux chemins de paiement avaient fait dériver l'essai à 30, 7 ou 0
 * jours selon le bouton.
 *
 * Body : { client_id, target_plan: 'starter'|'pro', billing_period:
 *          'monthly'|'quarterly'|'annual', promo_code? }
 *
 * Réponses : { checkout_url } | { instant: true } | 409 changement_de_formule |
 *            409 deja_sur_ce_plan | 400 | 401 | 403 | 503
 */

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PLAN_ORDER = ['free', 'starter', 'pro', 'enterprise'];

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

  if (!client_id || !target_plan) {
    return res.status(400).json({ error: 'Missing client_id or target_plan' });
  }

  const periode = periodeDepuisApi(billing_period);
  if (!periode) {
    return res.status(400).json({ error: 'billing_period must be monthly, quarterly or annual' });
  }

  // --- Verify user belongs to client ---
  const isAdmin = await isActeroAdmin(user, supabaseAdmin);
  if (!isAdmin) {
    const { data: link } = await supabaseAdmin
      .from('client_users')
      .select('client_id')
      .eq('user_id', user.id)
      .eq('client_id', client_id)
      .maybeSingle();
    if (!link) return res.status(403).json({ error: 'Acces refuse.' });
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
    if (existingSubId) {
      let subscription = null;
      try {
        subscription = await stripe.subscriptions.retrieve(existingSubId);
      } catch (subErr) {
        if (subErr?.code !== 'resource_missing' && subErr?.statusCode !== 404) throw subErr;
      }

      if (subscription && ['active', 'trialing'].includes(subscription.status)) {
        const item = subscription.items?.data?.[0];
        const actuelle = formuleDuPrix(item?.price);
        if (actuelle && actuelle.periode !== periode) {
          return res.status(409).json({
            error: 'changement_de_formule',
            message: 'Pour passer à une autre formule, écrivez-nous à support@actero.fr : on s’en occupe.',
          });
        }

        // Mode strict : une panne ne vaut pas « pas de carte ». Repasser par
        // Checkout créerait un second abonnement pendant que le premier continue
        // de facturer.
        let carte;
        try {
          carte = await resolveCustomerCard(stripe, subscription, stripeCustomerId, { strict: true });
        } catch (err) {
          console.error('[billing/upgrade] moyen de paiement illisible :', err.message);
          return res.status(503).json({ error: 'Paiement indisponible pour le moment, réessayez dans un instant.' });
        }
        if (item && carte) {
          await stripe.subscriptions.update(existingSubId, {
            items: [{ id: item.id, price: prix.id }],
            proration_behavior: 'create_prorations',
            default_payment_method: carte,
            metadata: {
              client_id,
              actero_client_id: client_id,
              formule: `${formule.plan}_${formule.periode}`,
              upgrade_from: currentPlan,
              upgrade_to: target_plan,
            },
          });

          // LE PLAN N'EST PAS ÉCRIT ICI. Il l'était, avant toute confirmation
          // de Stripe (audit du 11 septembre). customer.subscription.updated
          // l'accorde, carte vérifiée — voir api/lib/subscription-plan.js.
          return res.status(200).json({
            success: true,
            instant: true,
            plan_attendu: target_plan,
            message: `Passage au plan ${target_plan} en cours. La proration sera appliquée sur votre prochaine facture.`,
          });
        }
        // Sans carte : un essai laissé par l'ancien formulaire intégré. On passe
        // par la page Stripe ; l'ancien abonnement s'annule seul en fin d'essai.
      }
    }

    // --- Avantage de bienvenue : une seule fois par client ---
    let dejaAbonne;
    try {
      dejaAbonne = await aDejaEuUnAbonnement(stripe, stripeCustomerId);
    } catch (err) {
      console.error('[billing/upgrade] lecture des abonnements passés impossible :', err.message);
      return res.status(503).json({ error: 'Paiement indisponible pour le moment, réessayez dans un instant.' });
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
    if (promo_code) {
      try {
        const promoList = await stripe.promotionCodes.list({ code: promo_code, active: true, limit: 1 });
        promotionCodeId = promoList.data[0]?.id || null;
      } catch (e) {
        console.warn('[billing/upgrade] could not resolve promo code', promo_code, e.message);
      }
    }

    // `customer` : toute session Checkout dit à qui elle appartient (garde ACT-39,
    // api/lib/client-stripe-unique.test.js).
    const session = await stripe.checkout.sessions.create(parametresCheckout({
      clientId: client_id,
      customer: stripeCustomerId,
      prix,
      formule,
      offre,
      promotionCodeId,
      planActuel: currentPlan,
      parrainage,
      promoCode: promo_code || null,
      siteUrl: process.env.SITE_URL || 'https://actero.fr',
    }));

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

export default withSentry(handler)
