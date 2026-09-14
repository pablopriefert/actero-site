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
  // Ouvert le 10 septembre 2026. Il n'y avait rien à construire : les routes
  // existent, le cron `poll-inbound-emails` tourne toutes les 5 minutes en
  // production, et un client Enterprise a l'agent email ACTIF avec réponse
  // automatique. La fonctionnalité est vendue « Agent Email natif Actero » sur
  // Pro et Enterprise, et son PlanGate correspond exactement à ce qui est
  // facturé. Seul l'onglet était caché : un marchand Pro payait pour une
  // fonctionnalité qu'il ne pouvait pas voir.
  emailAgent: true,       // "Agent Email" tab
  multiChannelHub: false, // "Tous les canaux" hub (includes WhatsApp)
  // Ouvert le 10 septembre 2026 : le portail a été vérifié de bout en bout en
  // production (lien magique reçu, connexion, commandes, tickets) et il est
  // vendu sur Pro et Enterprise. Le laisser à false rendait l'onglet invisible
  // — donc le marchand qui paie pour le portail n'avait aucun moyen de
  // l'activer. C'était le quatrième verrou de la chaîne, après le drapeau de
  // plan, l'adresse manquante et la navigation absente.
  portalSav: true,        // "Portail SAV" tab
  analyticsHub: false,    // "Insights" + "Heures de pic" group

  // ── Refonte visuelle ──
  // Remplace l'accueil narratif (OverviewHome) par l'écran « Aujourd'hui »,
  // direction « La nuit imprimée ». Styles cantonnés dans un CSS Module : la
  // bascule ne touche ni les tokens globaux ni les autres vues, et un false
  // ici restaure l'ancien écran sans rien d'autre à défaire.
  aujourdhuiHome: true,

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
