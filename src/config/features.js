/**
 * Feature registry — the single source of truth for which product surfaces are
 * live. Flip a flag to make a surface (dashboard tab or public route) appear or
 * disappear everywhere it's gated. The code behind a disabled flag stays in the
 * repo — it just becomes unreachable, which shrinks the attack surface and the
 * maintenance load (fewer half-built paths silently rotting into bugs).
 *
 * Pre-launch posture (0 paying clients): only the core SAV wedge — Shopify chat
 * + email — and the GTM lead-gen surfaces are on. Everything aspirational is off
 * until it's real. This replaces the old ad-hoc `LEAN_NAV` flag in
 * ClientDashboard so all gating lives in one place.
 *
 * NOTE: this is a build-time (shipped) flag, not a per-tenant/remote flag. It's
 * deliberately simple — turning something on is a one-line change + deploy.
 */
export const FEATURES = {
  // ── Client dashboard advanced surfaces (formerly LEAN_NAV) ──
  emailAgent: false,      // "Agent Email" tab
  voiceAgent: false,      // "Agent vocal" + "Appels vocaux" tabs
  multiChannelHub: false, // "Tous les canaux" hub (includes WhatsApp)
  portalSav: false,       // "Portail SAV" tab
  analyticsHub: false,    // "Insights" + "Heures de pic" group

  // ── Public marketing surfaces for not-yet-live programs ──
  marketplace: false,     // /marketplace
  academy: false,         // /academy

  // ── Intentionally live ──
  referrals: true,        // /r/:code
  partners: true,         // /partners, /partners/apply (agency GTM)
  startups: true,         // /startups (startup discount GTM)
}

/** Convenience predicate. */
export const isFeatureEnabled = (key) => FEATURES[key] === true
