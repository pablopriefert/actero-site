/**
 * Actero Design Tokens — Source of Truth
 * ----------------------------------------
 * Tous les composants de l'espace client (ClientDashboard + src/components/client)
 * DOIVENT consommer ces tokens au lieu de hardcoder des valeurs.
 *
 * Règle d'or : si une couleur / taille / radius n'est pas ici, elle ne devrait
 * pas apparaître dans le code applicatif. Les landing pages marketing
 * (LandingPage, glass-hero, etc.) conservent leur propre palette.
 */

export const tokens = {
  /**
   * COULEURS
   * --------
   * - `brand`      : identité Actero, utilisée pour CTA primaires, liens actifs,
   *                  focus ring, badges "pro".
   * - `text`       : hiérarchie typographique. Toujours choisir selon l'importance :
   *     • primary   → titres, KPI values, labels forts
   *     • secondary → body copy, descriptions, meta
   *     • muted     → hints, captions, placeholders
   *     • disabled  → états désactivés, skeleton
   * - `bg`         : surfaces. `page` = fond global, `surface` = carte, `hover`
   *                  = état hover tranquille, `border` = bordure discrète (≈ divider).
   * - `semantic`   : success/warning/danger/info — uniquement pour feedback système.
   */
  colors: {
    brand: {
      primary: '#0E653A',
      primaryHover: '#003725',
      primaryLight: '#0E653A/10', // Tailwind alpha notation (bg-cta/10)
    },
    text: {
      primary: '#1a1a1a',   // Titres, valeurs
      secondary: '#71717a', // Body, descriptions
      muted: '#9ca3af',     // Hints, captions
      disabled: '#c4c4c4',  // Disabled
    },
    bg: {
      page: '#fafafa',    // Fond global
      surface: '#ffffff', // Cards
      hover: '#f5f5f5',
      border: '#f0f0f0',  // Bordures cards
    },
    semantic: {
      success: '#10b981',
      warning: '#f59e0b',
      danger: '#ef4444',
      info: '#3b82f6',
    },
  },

  /**
   * TYPOGRAPHIE
   * -----------
   * Échelle resserrée — n'utiliser QUE ces tailles.
   *   xs (11px)  → captions, timestamps, hints en pied de card
   *   sm (12px)  → labels de form, sous-titres, tags
   *   base (13px)→ body par défaut
   *   md (14px)  → body emphasis, descriptions principales
   *   lg (15px)  → titres de section intra-card
   *   xl (18px)  → titres de card
   *   2xl (24px) → titres de page / modales
   *   3xl (30px) → hero dashboard
   */
  typography: {
    xs: '11px',
    sm: '12px',
    base: '13px',
    md: '14px',
    lg: '15px',
    xl: '18px',
    '2xl': '24px',
    '3xl': '30px',
  },

  /**
   * SPACING
   * -------
   * Échelle 4px-based. Respecter la gamme — pas de valeur custom.
   */
  spacing: {
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    5: '20px',
    6: '24px',
    8: '32px',
    10: '40px',
    12: '48px',
  },

  /**
   * RADIUS
   * ------
   * sm (8px)   → boutons, inputs, petits badges
   * md (12px)  → cards secondaires
   * lg (16px)  → cards principales
   * xl (20px)  → modales, sections hero
   * 2xl (24px) → containers marketing
   */
  radius: {
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
    '2xl': '24px',
  },

  /**
   * SHADOW
   * ------
   * sm  → cards (élévation par défaut)
   * md  → modales, popovers, menus
   * none→ variantes flat (ex. cards sur fond #fafafa)
   */
  shadow: {
    sm: '0 1px 3px rgba(0,0,0,0.08)',
    md: '0 4px 12px rgba(0,0,0,0.08)',
    none: 'none',
  },

  /**
   * ICON SIZE
   * ---------
   * sm (14) → inline avec texte base
   * md (16) → boutons, nav
   * lg (20) → titres de card, empty states
   */
  iconSize: {
    sm: 14,
    md: 16,
    lg: 20,
  },

  /**
   * BUTTONS
   * -------
   * Classes Tailwind prêtes à l'emploi pour uniformiser boutons transverses.
   *   primary   → action principale (1 par vue)
   *   secondary → action secondaire neutre
   *   ghost     → action tertiaire discrète (toolbar, nav)
   */
  button: {
    primary: 'bg-cta hover:bg-[#003725] text-white',
    secondary: 'bg-white hover:bg-[#fafafa] text-[#1a1a1a] border border-[#f0f0f0]',
    ghost: 'bg-transparent hover:bg-[#fafafa] text-[#71717a]',
  },
};

export default tokens;
