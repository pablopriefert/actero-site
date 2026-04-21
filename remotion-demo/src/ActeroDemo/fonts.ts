import { loadFont as loadInstrumentSerif } from '@remotion/google-fonts/InstrumentSerif'
import { loadFont as loadInter } from '@remotion/google-fonts/Inter'
import { loadFont as loadJetBrainsMono } from '@remotion/google-fonts/JetBrainsMono'

/**
 * Charge les fonts utilisées dans la démo. Appelé une seule fois depuis
 * Root.tsx avant tout rendu — Remotion gère le preload automatiquement.
 */
export function loadFonts() {
  loadInstrumentSerif()
  loadInter('normal', { weights: ['400', '500', '600', '700'] })
  loadJetBrainsMono('normal', { weights: ['400', '500'] })
}
