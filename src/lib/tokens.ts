/**
 * Actero design tokens — single source of truth.
 *
 * Import from anywhere in the app : `import { tokens } from '@/lib/tokens'`.
 * Kept in sync with `src/index.css` @theme block (which exposes them as
 * Tailwind v4 utility classes) and with the `actero-branding` skill.
 *
 * Usage:
 *   // Tailwind class:  className="bg-cta text-surface"
 *   // JS/TS literal :  style={{ background: tokens.cta }}
 *
 * Rule : NEVER introduce a new primary color, radius, or font outside this
 * file without updating the actero-branding skill in parallel.
 */

export const tokens = {
  // ── Greens (primary brand) ──────────────────────────────────
  /** Canonical CTA color — all buttons, primary links, checkboxes. */
  cta: '#0E653A',
  /** CTA hover / pressed state — darker. */
  ctaHover: '#0A4F2C',
  /** Forest primary — accent bars, dividers, editorial accents. */
  primary: '#1F3A12',
  /** Deeper primary — sidebar logo filled, chart greens. */
  primaryDeep: '#0B4B2C',
  /** Soft sage — labels on green bg, subtle accents. */
  primarySoft: '#A8C490',
  /** Very light mint — active nav pill bg, success chips bg. */
  primaryTint: '#E8F5EC',

  // ── Backgrounds ─────────────────────────────────────────────
  /** Cream canvas — editorial emails, soft info callouts. */
  bgCream: '#F4F0E6',
  /** Off-white app background — dashboard main area. */
  bgApp: '#FAFAFA',
  /** Pure white — cards, surfaces. */
  surface: '#FFFFFF',

  // ── Gold (editorial accent) ─────────────────────────────────
  /** Muted olive-gold — eyebrows, hero accent phrases, footer links. */
  gold: '#8B7A50',
  /** Softer gold for secondary footer text. */
  goldSoft: '#B0A899',

  // ── Ink (text) ──────────────────────────────────────────────
  /** Primary ink — headlines, strong text, logo on light bg. */
  ink: '#1A1A1A',
  /** Body ink. */
  ink2: '#3A3A3A',
  /** Secondary body. */
  ink3: '#5A5A5A',
  /** Muted meta / captions. */
  ink4: '#8B8070',

  // ── Semantic (status) ───────────────────────────────────────
  /** Warn / plan badge — ENTERPRISE pill bg. */
  warn: '#F59E0B',
  /** Warn softer bg. */
  warnBg: '#FEF3C7',
  /** Success / positive delta. */
  success: '#10B981',
  /** Danger / destructive. */
  danger: '#EF4444',

  // ── Structural ──────────────────────────────────────────────
  /** Hairline borders inside cards. */
  border: 'rgba(0,0,0,0.06)',
  /** Cream-compatible border (for cream-backed sections). */
  borderCream: '#E8DFC9',
} as const

/** Radius scale — pill for buttons/badges, 16 for cards, 12 for inner panels. */
export const radii = {
  pill: '9999px',
  card: '16px',
  panel: '12px',
  button: '8px', // email clients only — web/product uses pill
  chip: '12px',
} as const

/** Font families — match src/index.css @theme (loaded from Google Fonts). */
export const fonts = {
  sans: 'DM Sans, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  display: '"Instrument Serif", Georgia, serif',
  mono: '"DM Mono", ui-monospace, monospace',
} as const

/** Spacing scale — 4pt base per ui-ux-pro-max priority 5 (`spacing-scale`). */
export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  '2xl': '32px',
  '3xl': '48px',
  '4xl': '64px',
  '5xl': '96px',
} as const

export type Tokens = typeof tokens
export type Radii = typeof radii
export type Fonts = typeof fonts
export type Spacing = typeof spacing
