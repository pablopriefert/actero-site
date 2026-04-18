/**
 * Actero analytics — Amplitude helper (client-side).
 *
 * Built on `@amplitude/unified` (already installed: analytics + session replay
 * bundled). We intentionally do NOT add a second SDK (`@amplitude/analytics-browser`)
 * to avoid duplicate init / double-counting. `unified` re-exports the same
 * `track`, `setUserId`, `identify`, `reset`, `Identify` surface.
 *
 * Init is done in src/main.jsx BEFORE React mounts, via `initAnalytics()` here.
 * The key comes from `VITE_AMPLITUDE_API_KEY` (see .env.example). If the env
 * var is absent, we fall back to the production key so dev parity stays intact.
 *
 * ─── Rules ─────────────────────────────────────────────────────────────
 * - NEVER send PII (email, full name, Shopify customer email, etc.) as event
 *   properties. Use client_id / shop_domain / plan only.
 * - All helpers are non-throwing — analytics failures must not break product
 *   flows. We log to console.error (picked up by Sentry) and move on.
 * - Call signature mirrors the spec in prompt:
 *     trackEvent(name, props?)
 *     identifyUser(userId, userProperties)
 *     resetUser()
 */
import * as amplitude from '@amplitude/unified'

// Fallback key = the key that was already inline in main.jsx before this refactor.
// Kept so that missing .env in a dev checkout still produces events against the
// prod Amplitude workspace (matches what was happening before).
const FALLBACK_KEY = '19e42a5d2488202ad9d13fa8b5d6545'
const API_KEY = (import.meta.env.VITE_AMPLITUDE_API_KEY as string | undefined) || FALLBACK_KEY

/**
 * Coarse bot detection from the User-Agent string. Used to opt-out of
 * Amplitude tracking for crawlers / headless agents so we don't pollute
 * dashboards with fake "San Jose" traffic (Googlebot + search crawlers
 * typically egress from US west coast data centers and create a massive
 * ghost cohort in the geo breakdown).
 *
 * Regex is intentionally broad — false positives are cheap (we lose a real
 * user's events) while false negatives are expensive (bot data contaminates
 * product metrics). Common matches: Googlebot, bingbot, DuckDuckBot,
 * YandexBot, AhrefsBot, SemrushBot, Applebot, GPTBot, ClaudeBot, PerplexityBot.
 */
const IS_BOT = typeof navigator !== 'undefined'
  && /bot|crawler|spider/i.test(navigator.userAgent || '')

/**
 * Boots Amplitude. Idempotent-safe — if someone calls it twice the SDK logs
 * and no-ops; we don't fight it. Must run ONCE, before React mount.
 *
 * Bot traffic is excluded via `optOut: true` at init AND session replay is
 * force-disabled (`sampleRate: 0`) — session replay on a bot is pure storage
 * waste and can't surface UX insight.
 */
export function initAnalytics(): void {
  if (!API_KEY) {
    console.warn('[analytics] No Amplitude key available — tracking disabled')
    return
  }
  try {
    // `initAll` boots analytics (autocapture page views / clicks / attribution)
    // + session replay. EU serverZone matches the Actero workspace region.
    amplitude.initAll(API_KEY, {
      analytics: {
        autocapture: true,
        serverZone: 'EU',
        optOut: IS_BOT,
      },
      sessionReplay: {
        // Bots → 0 recording (storage waste); humans → 100% (tier-1 debug asset)
        sampleRate: IS_BOT ? 0 : 1,
      },
    })
  } catch (err) {
    console.error('[analytics] init failed:', err)
  }
}

/**
 * Back-compat alias matching the prompt spec wording (`initAmplitude`).
 */
export const initAmplitude = initAnalytics

/**
 * Fire an analytics event. Silent-fail by design — tracking must never
 * interrupt a user flow.
 *
 * @param eventName Stable, Title-Cased verb phrase (e.g. "Signed Up",
 *                  "Playbook Enabled"). Matches the canonical taxonomy.
 * @param properties Free-form JSON. Keep it small, NO PII.
 */
export function trackEvent(
  eventName: string,
  properties?: Record<string, unknown>,
): void {
  try {
    amplitude.track(eventName, properties)
  } catch (err) {
    console.error('[analytics] track failed:', eventName, err)
  }
}

/**
 * Identify the current user + stamp user-level properties.
 *
 * Call after every successful login + whenever a user-property value changes
 * significantly (plan upgrade, playbook count bump). Amplitude de-dupes.
 */
export function identifyUser(
  userId: string,
  userProperties: Record<string, unknown>,
): void {
  try {
    amplitude.setUserId(userId)
    const identifyEvent = new amplitude.Identify()
    Object.entries(userProperties).forEach(([key, value]) => {
      // Amplitude's .set signature accepts string | number | boolean | array.
      // We coerce unknown → supported primitive; complex values get JSON-stringified.
      if (
        typeof value === 'string'
        || typeof value === 'number'
        || typeof value === 'boolean'
      ) {
        identifyEvent.set(key, value)
      } else if (value === null || value === undefined) {
        // skip — don't overwrite existing user property with null
      } else {
        identifyEvent.set(key, JSON.stringify(value))
      }
    })
    amplitude.identify(identifyEvent)
  } catch (err) {
    console.error('[analytics] identify failed:', err)
  }
}

/**
 * Clear the Amplitude user (new anonymous session). Call BEFORE supabase.signOut()
 * so the final events of the session are still attributed to the user who owned them.
 */
export function resetUser(): void {
  try {
    amplitude.reset()
  } catch (err) {
    console.error('[analytics] reset failed:', err)
  }
}
