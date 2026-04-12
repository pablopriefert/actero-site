/**
 * Actero SaaS Plans — Single source of truth
 *
 * Used by:
 * - Frontend: PricingPage, usePlan hook, PlanGate component, BillingView
 * - Backend: api/lib/plan-limits.js (mirror), brain.js (enforcement)
 */

export const PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    tagline: 'Découvrir Actero sans engagement',
    price: { monthly: 0, annual: 0 },
    trial: false,
    limits: {
      tickets_per_month: 50,
      workflows_active: 1,
      integrations: 1, // Shopify only
      knowledge_entries: 10,
      team_members: 1,
      history_days: 7,
      voice_minutes: 0,
      whatsapp: false,
    },
    features: {
      brand_editor: false,
      guardrails: false,
      simulator: false,
      voice_agent: false,
      whatsapp_agent: false,
      specialized_agents: false, // general-agent only
      api_webhooks: false,
      pdf_report: false,
      multi_shop: false,
      white_label: false,
      roi_dashboard: 'basic', // 'basic' | 'full' | 'custom'
    },
    support: 'docs', // 'docs' | 'email_48h' | 'priority_24h' | 'account_manager'
    onboarding: 'self_service',
    overage_per_ticket: null, // blocked
    stripe: {
      price_id_monthly: null,
      price_id_annual: null,
    },
    cta: 'Commencer gratuitement',
    popular: false,
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    tagline: 'Automatiser les premières tâches',
    price: { monthly: 99, annual: 79 },
    trial: { days: 7, requires_card: true },
    limits: {
      tickets_per_month: 1000,
      workflows_active: 3,
      integrations: 3, // Shopify + 2
      knowledge_entries: 100,
      team_members: 2,
      history_days: 90,
      voice_minutes: 0,
      whatsapp: false,
    },
    features: {
      brand_editor: true,
      guardrails: true,
      simulator: false,
      voice_agent: false,
      whatsapp_agent: false,
      specialized_agents: true,
      api_webhooks: false,
      pdf_report: false,
      multi_shop: false,
      white_label: false,
      roi_dashboard: 'full',
    },
    support: 'email_48h',
    onboarding: 'guided',
    overage_per_ticket: 0.10,
    stripe: {
      price_id_monthly: null, // À remplir après création dans Stripe Dashboard
      price_id_annual: null,
    },
    cta: 'Essai gratuit 7 jours',
    popular: false,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    tagline: 'Automatisation complète + agent vocal',
    price: { monthly: 399, annual: 319 },
    trial: { days: 7, requires_card: true },
    limits: {
      tickets_per_month: 5000,
      workflows_active: Infinity,
      integrations: Infinity,
      knowledge_entries: Infinity,
      team_members: 5,
      history_days: Infinity,
      voice_minutes: 200,
      whatsapp: true,
    },
    features: {
      brand_editor: true,
      guardrails: true,
      simulator: true,
      voice_agent: true,
      whatsapp_agent: true,
      specialized_agents: true,
      api_webhooks: true,
      pdf_report: true,
      multi_shop: false,
      white_label: false,
      roi_dashboard: 'full',
    },
    support: 'priority_24h',
    onboarding: 'guided',
    overage_per_ticket: 0.10,
    stripe: {
      price_id_monthly: null,
      price_id_annual: null,
    },
    cta: 'Essai gratuit 7 jours',
    popular: true,
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'Sur mesure pour les grands comptes',
    price: { monthly: null, annual: null }, // sur devis
    trial: false,
    limits: {
      tickets_per_month: Infinity,
      workflows_active: Infinity,
      integrations: Infinity,
      knowledge_entries: Infinity,
      team_members: Infinity,
      history_days: Infinity,
      voice_minutes: Infinity,
      whatsapp: true,
    },
    features: {
      brand_editor: true,
      guardrails: true,
      simulator: true,
      voice_agent: true,
      whatsapp_agent: true,
      specialized_agents: true,
      api_webhooks: true,
      pdf_report: true,
      multi_shop: true,
      white_label: true,
      roi_dashboard: 'custom',
    },
    support: 'account_manager',
    onboarding: 'white_glove',
    overage_per_ticket: null, // included
    stripe: {
      price_id_monthly: null,
      price_id_annual: null,
    },
    cta: 'Contacter l\'équipe',
    popular: false,
  },
}

export const PLAN_ORDER = ['free', 'starter', 'pro', 'enterprise']

export function getPlanConfig(planId) {
  return PLANS[planId] || PLANS.free
}

export function canAccess(planId, feature) {
  const plan = getPlanConfig(planId)
  return plan.features[feature] === true || plan.features[feature] === 'full' || plan.features[feature] === 'custom'
}

export function getLimit(planId, limitKey) {
  const plan = getPlanConfig(planId)
  return plan.limits[limitKey] ?? 0
}

export function isInTrial(client) {
  if (!client?.trial_ends_at) return false
  return new Date(client.trial_ends_at) > new Date()
}

export function getTrialDaysLeft(client) {
  if (!client?.trial_ends_at) return 0
  const diff = new Date(client.trial_ends_at) - new Date()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}
