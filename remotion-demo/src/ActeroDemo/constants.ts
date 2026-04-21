/**
 * Actero Demo — timeline constants.
 *
 * Total : ~40 secondes @ 30fps = 1200 frames
 *
 * Scenes (sequential via Series) :
 *   Hook       →  4s  = 120 frames   → pain point
 *   Solution   →  6s  = 180 frames   → Actero introduction
 *   Setup      →  6s  = 180 frames   → Shopify OAuth 1-click
 *   Agent      →  8s  = 240 frames   → chat conversation + résolutions
 *   Results    →  8s  = 240 frames   → 3 KPIs animés
 *   CTA        →  8s  = 240 frames   → "Essai gratuit — cal.com/actero/demo"
 */
export const FPS = 30
export const WIDTH = 1920
export const HEIGHT = 1080

export const SCENE_FRAMES = {
  hook: 120,
  solution: 180,
  setup: 180,
  agent: 240,
  results: 240,
  cta: 240,
}

export const DURATION_FRAMES =
  SCENE_FRAMES.hook +
  SCENE_FRAMES.solution +
  SCENE_FRAMES.setup +
  SCENE_FRAMES.agent +
  SCENE_FRAMES.results +
  SCENE_FRAMES.cta

/**
 * Brand tokens — identiques aux variables CSS exposées par le reste du
 * site Actero (src/index.css, skills/actero-branding). Utiliser `COLORS`
 * dans les styles inline quand Tailwind n'est pas la bonne solution
 * (dégradés calculés, box-shadows, animations de couleur).
 */
export const COLORS = {
  cream: '#F9F7F1',
  creamDeep: '#F4F0E6',
  creamBorder: '#E8DFC9',
  ink: '#1A1A1A',
  ink2: '#3A3A3A',
  ink3: '#5A5A5A',
  inkMuted: '#716D5C',
  forest: '#003725',
  forest2: '#0A4F2C',
  forestCta: '#0E653A',
  leaf: '#A8C490',
  success: '#10B981',
  white: '#FFFFFF',
} as const
