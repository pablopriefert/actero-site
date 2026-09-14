import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Une seule famille de texte, déclarée à un seul endroit.
 *
 * Avant cette bascule, la police était nommée à trois niveaux qui ne
 * s'accordaient pas : `src/index.css` chargeait Spectral, `src/lib/tokens.ts`
 * annonçait « Instrument Serif », et **48 composants** répétaient la famille en
 * dur dans un attribut `style`, sous forme de repli
 * (`var(--font-display, "Spectral", Georgia, serif)`).
 *
 * Ce troisième niveau est le piège : le repli ne s'applique que si la variable
 * CSS est absente, donc changer le token semble fonctionner partout — jusqu'au
 * jour où un composant est rendu hors du contexte où la variable existe, et
 * lui seul repasse en serif. C'est le même défaut que la refonte typographique
 * précédente, où Instrument Serif était restée codée en dur à 40 endroits dont
 * 39 en repli.
 *
 * Ce test refuse qu'une famille abandonnée revienne par la porte du repli.
 */

const ABANDONNEES = ['Spectral', 'Instrument Serif', 'DM Sans', 'Cormorant', 'Geist']
const RACINE = 'src'

function fichiersSources(dir, acc = []) {
  for (const entree of readdirSync(dir)) {
    if (entree === 'node_modules' || entree.startsWith('.')) continue
    const chemin = join(dir, entree)
    if (statSync(chemin).isDirectory()) fichiersSources(chemin, acc)
    else if (/\.(jsx?|tsx?|css)$/.test(entree) && !entree.includes('.test.')) acc.push(chemin)
  }
  return acc
}

const FICHIERS = fichiersSources(RACINE)
const CSS = readFileSync('src/index.css', 'utf8')
const TOKENS = readFileSync('src/lib/tokens.ts', 'utf8')

describe('typographie — une famille, une déclaration', () => {
  it("aucune police abandonnée ne subsiste, même en repli", () => {
    const fautifs = []
    for (const f of FICHIERS) {
      const src = readFileSync(f, 'utf8')
      // Les commentaires ont le droit de raconter l'histoire de la bascule.
      // Il faut donc suivre l'état des blocs /* … */, dont les lignes de
      // continuation ne commencent par aucun marqueur.
      let dansBloc = false
      for (const ligne of src.split('\n')) {
        const nu = ligne.trim()
        const ouvre = ligne.lastIndexOf('/*')
        const ferme = ligne.lastIndexOf('*/')
        const etaitDansBloc = dansBloc
        if (!dansBloc && ouvre !== -1 && ferme < ouvre) dansBloc = true
        else if (dansBloc && ferme !== -1 && ferme > ouvre) dansBloc = false

        if (etaitDansBloc || dansBloc) continue
        if (nu.startsWith('//') || nu.startsWith('/*') || nu.startsWith('*')) continue
        for (const police of ABANDONNEES) {
          if (ligne.includes(police)) fautifs.push(`${f} → ${nu.slice(0, 90)}`)
        }
      }
    }
    expect(fautifs, `Polices abandonnées encore référencées :\n${fautifs.join('\n')}`).toEqual([])
  })

  it('index.css et tokens.ts nomment la même famille', () => {
    // Ces deux fichiers ont divergé sans que rien ne le signale : le CSS disait
    // Spectral, les tokens disaient Instrument Serif.
    const duCss = CSS.match(/--font-sans:\s*"([^"]+)"/)?.[1]
    const desTokens = TOKENS.match(/sans:\s*'([^,']+)/)?.[1]
    expect(duCss).toBe('Inter Tight')
    expect(desTokens).toBe('Inter Tight')
  })

  it('la famille de titrage est celle du texte courant', () => {
    // L'alternance serif/sans est exactement ce qui donnait au tableau de bord
    // son air de gabarit : une seule famille, c'est le choix qu'on tient.
    const sans = CSS.match(/--font-sans:\s*"([^"]+)"/)?.[1]
    const display = CSS.match(/--font-display:\s*"([^"]+)"/)?.[1]
    expect(display).toBe(sans)
  })

  it('les titres restent en poids normal', () => {
    // Un grand titre en 400 se lit comme une phrase, le même en 700 comme une
    // annonce. C'est le réglage relevé sur gorgias.com, et c'est lui qui porte
    // la sobriété — pas le choix de la police.
    const bloc = CSS.match(/h1,\s*h2\s*\{[^}]*\}/s)?.[0] || ''
    expect(bloc).toMatch(/font-weight:\s*400/)
    expect(bloc).not.toMatch(/font-weight:\s*(600|700|800)/)
  })

  it('la police est bien chargée', () => {
    expect(CSS).toMatch(/fonts\.googleapis\.com[^']*Inter\+Tight/)
  })
})
