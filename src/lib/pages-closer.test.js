import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Les pages closer — spec closers, familles de tests 7 et 8.
 *
 *   7. /closer/callback et l'inscription closer n'appellent jamais
 *      resolveOrCreateClientId : un closer n'est pas un marchand.
 *   8. noindex sur toutes les pages /closer, et aucune entrée dans la
 *      navigation publique (le sitemap et vercel.json sont gardés par
 *      api/lib/seo-indexation.test.js).
 *
 * Commentaires retirés avant l'analyse : les fichiers expliquent ce qu'ils ne
 * font pas, et une explication n'est pas un appel.
 */

const lire = (f) => readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const PAGES = readdirSync('src/pages/closer').filter((f) => f.endsWith('.jsx')).map((f) => join('src/pages/closer', f))
const COMPOSANTS = readdirSync('src/components/closer').filter((f) => f.endsWith('.jsx')).map((f) => join('src/components/closer', f))
const ESPACE = [...PAGES, ...COMPOSANTS, 'src/lib/espace-closer.js', 'src/lib/affichage-closer.js']

describe('pages closer — un closer n’est pas un marchand', () => {
  it('les quatre pages existent', () => {
    expect(PAGES.map((p) => p.split('/').pop()).sort()).toEqual([
      'CloserCallbackPage.jsx', 'CloserConnexionPage.jsx', 'CloserEspacePage.jsx', 'CloserInscriptionPage.jsx',
    ])
  })

  it.each(ESPACE)('%s ne crée jamais de client marchand', (fichier) => {
    const code = lire(fichier)
    expect(code).not.toMatch(/resolveOrCreateClientId|resolve-client/)
    expect(code).not.toMatch(/from\(\s*['"`](clients|client_users|client_settings)['"`]/)
  })

  it.each(ESPACE)('%s ne lit rien directement en base : tout passe par /api/closer', (fichier) => {
    expect(lire(fichier)).not.toMatch(/supabase\s*\.\s*from\(/)
  })

  it('le retour Google closer revient sur /closer/callback, pas sur /auth/callback', () => {
    const code = lire('src/lib/espace-closer.js')
    expect(code).toMatch(/redirectTo: `\$\{window\.location\.origin\}\/closer\/callback`/)
    expect(code).not.toMatch(/auth\/callback/)
  })

  it('le retour Google crée la fiche seulement après une inscription', () => {
    const code = lire('src/pages/closer/CloserCallbackPage.jsx')
    expect(code).toMatch(/lireIntentionGoogle\(\) === 'inscription'[\s\S]*devenir-closer/)
    expect(code).toMatch(/onNavigate\('\/closer'\)/)
  })
})

describe('pages closer — ni indexées, ni listées', () => {
  it.each(PAGES)('%s porte noindex', (fichier) => {
    expect(lire(fichier)).toMatch(/<SEO\b[^>]*\bnoindex\b/)
  })

  it('aucun lien vers l’espace closer dans la navigation publique ni dans les palettes', () => {
    for (const fichier of [
      'src/components/layout/Navbar.jsx',
      'src/components/layout/Footer.jsx',
      'src/components/ui/command-palette.jsx',
      'src/components/CommandPalette.jsx',
      'src/components/layout/CommandKModal.jsx',
    ]) {
      expect(lire(fichier), fichier).not.toMatch(/['"`]\/(closer|c)(\/|['"`])/)
    }
  })
})
