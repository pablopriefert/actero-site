/**
 * Lightfield CRM webhook helper.
 *
 * Pushes signup / OAuth-completed / Stripe-paid events to Lightfield workflows
 * so the CRM stays in sync with what's happening on actero.fr.
 *
 * Each event maps to a specific webhook URL configured in Vercel ENV:
 *   - LIGHTFIELD_WEBHOOK_SIGNUP   → "Signup → Trial Activated" workflow
 *   - LIGHTFIELD_WEBHOOK_STRIPE   → "Stripe paid → Closed Won" workflow (Phase 4B)
 *   - LIGHTFIELD_WEBHOOK_SHOPIFY  → "Shopify connected" workflow (optional)
 *
 * Design rules:
 *   - **Fire-and-forget** : a Lightfield outage MUST NOT break the user's
 *     signup or callback flow. We catch + log, never throw.
 *   - **Short timeout** : 3 seconds max per call (Vercel functions have 60s,
 *     we don't want to eat the whole budget if Lightfield is slow).
 *   - **Disabled gracefully** : if the env var is missing, we skip silently.
 *     This lets the code ship to dev/preview without env config.
 */

import { captureError } from './sentry.js'

const TIMEOUT_MS = 3000

/**
 * Push an event to a Lightfield webhook.
 *
 * @param {string} envKey   — name of the ENV var holding the webhook URL
 *                            (e.g. 'LIGHTFIELD_WEBHOOK_SIGNUP')
 * @param {Object} payload  — JSON-serialisable event body
 * @returns {Promise<void>} — resolves once posted (or skipped). Never throws.
 */
export async function pushLightfieldEvent(envKey, payload) {
  const url = process.env[envKey]
  if (!url) {
    // Silent skip in dev/preview where the env isn't configured.
    return
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.warn(
        `[lightfield] ${envKey} returned ${res.status}: ${body.slice(0, 200)}`,
      )
      // Non-2xx isn't a Sentry-worthy event — Lightfield can be down briefly.
      // We log and move on.
      return
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      console.warn(`[lightfield] ${envKey} timed out after ${TIMEOUT_MS}ms`)
      return
    }
    // Catch everything: this MUST NOT propagate to the user-facing endpoint.
    console.error(`[lightfield] ${envKey} push failed:`, err.message)
    captureError(err, { context: 'lightfield.pushEvent', envKey })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Convenience: push a "client.signup" event to LIGHTFIELD_WEBHOOK_SIGNUP.
 *
 * @param {Object} args
 * @param {string} args.client_id    — UUID of the freshly-created client
 * @param {string} args.email        — contact email (becomes the Contact in Lightfield)
 * @param {string} args.name         — full contact name
 * @param {string} [args.shop_domain]— myshopify.com domain if known
 * @param {string} [args.company_name]— brand name (defaults to shop_domain root)
 * @param {string} [args.utm_source] — acquisition channel ('linkedin', 'cold_email', 'seo'…)
 * @param {string} [args.utm_campaign]
 */
export function pushSignupToLightfield(args) {
  const payload = {
    event: 'client.signup',
    client_id: args.client_id,
    email: args.email,
    name: args.name,
    shop_domain: args.shop_domain || '',
    company_name: args.company_name || args.name || '',
    utm_source: args.utm_source || 'direct',
    utm_campaign: args.utm_campaign || '',
    signup_at: new Date().toISOString(),
  }

  // Fire-and-forget: don't await in the calling endpoint.
  pushLightfieldEvent('LIGHTFIELD_WEBHOOK_SIGNUP', payload).catch(() => {})
}

/**
 * Plan → monthly EUR price (matches PLAN_MRR in api/stripe-webhook.js).
 * Used to compute ARR for the Lightfield Opportunity update.
 */
const PLAN_MONTHLY_EUR = { free: 0, starter: 99, pro: 399, enterprise: 999 }

function planLabel(plan) {
  if (!plan) return 'Free'
  return plan.charAt(0).toUpperCase() + plan.slice(1).toLowerCase()
}

/**
 * Push a "subscription.created" event to LIGHTFIELD_WEBHOOK_STRIPE.
 *
 * Triggered when a trial converts to a paid plan. The Lightfield workflow
 * "Stripe paid → Closed Won" matches the existing Trial Activated opportunity
 * (by Contact email or Account domain) and updates the stage to Paid.
 *
 * @param {Object} args
 * @param {string} args.client_id              — Actero client UUID
 * @param {string} args.email                  — contact email
 * @param {string} [args.shop_domain]          — myshopify.com domain
 * @param {string} [args.company_name]         — brand name
 * @param {'free'|'starter'|'pro'|'enterprise'} args.plan
 * @param {string} [args.stripe_customer_id]
 * @param {string} [args.stripe_subscription_id]
 * @param {Date|string} [args.subscribed_at]   — defaults to now
 */
export function pushSubscriptionToLightfield(args) {
  const monthly = PLAN_MONTHLY_EUR[args.plan] ?? 0
  const annual = monthly * 12

  const payload = {
    event: 'subscription.created',
    client_id: args.client_id,
    email: args.email,
    shop_domain: args.shop_domain || '',
    company_name: args.company_name || args.email || '',
    plan: planLabel(args.plan),
    monthly_amount_eur: monthly,
    annual_arr_eur: annual,
    stripe_customer_id: args.stripe_customer_id || '',
    stripe_subscription_id: args.stripe_subscription_id || '',
    subscribed_at:
      args.subscribed_at instanceof Date
        ? args.subscribed_at.toISOString()
        : args.subscribed_at || new Date().toISOString(),
  }

  pushLightfieldEvent('LIGHTFIELD_WEBHOOK_STRIPE', payload).catch(() => {})
}
