import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Garde contre le retour du beige — et contre la dérive des tokens de couleur.
 *
 * Modèle : src/lib/typographie.test.js. Même défaut visé : un repli écrit en
 * dur (`style={{ background: '#F4F0E6' }}`, un commentaire de code mort qui
 * traîne une ancienne valeur, etc.) qui réintroduit une couleur abandonnée
 * sans que rien ne le remarque.
 *
 * Le 9 septembre, 562 occurrences de beige ont été remplacées par du blanc et
 * du gris froid sur 118 fichiers. La famille beige retirée ne doit plus
 * réapparaître, ni les deux anciens verts de CTA — sauf `#0E653A`, qui est
 * devenu `--color-cta-hover` : légitime en contexte de survol, pas ailleurs.
 *
 * Ce que ce fichier NE couvre PAS, et pourquoi :
 * `src/` contient environ 1022 `bg-[#XXXXXX]` écrits en dur sur 193 fichiers
 * (couleurs valides, pas du beige — juste jamais rapatriées vers un token).
 * Un test qui interdirait tout `bg-[#...]` échouerait sur ces 1022 lignes dès
 * aujourd'hui et ne garderait rien de plus que ce que le test ci-dessous
 * garde déjà : il serait juste rouge en permanence, donc ignoré. Avant de
 * pouvoir poser cette garde-là, il faut d'abord rapatrier ces fonds vers
 * `--color-app`, `--color-surface` ou `--color-cream` (selon le cas), fichier
 * par fichier — ce n'est pas l'objet de ce ticket.
 */

const RACINE = 'src'

// Beige retiré le 9 septembre.
const BEIGE_ABANDONNE = [
  '#F9F7F1', '#F4F0E6', '#FAF8F3', '#E5E2D7', '#E8DFC9',
  '#E5E1D6', '#ECEAE2', '#F5F5F0', '#F7F5F0', '#EFE7D6',
]
// Anciens verts de CTA. #0A4F2C est abandonné partout. #0E653A est devenu
// --color-cta-hover : on ne le bannit que hors d'un contexte de survol.
const VERT_ABANDONNE_PARTOUT = '#0A4F2C'
const VERT_HOVER_SEULEMENT = '#0E653A'

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

describe('couleurs — pas de retour du beige ni des anciens verts', () => {
  it('aucune couleur abandonnée ne subsiste, même en repli', () => {
    const fautifs = []
    for (const f of FICHIERS) {
      const src = readFileSync(f, 'utf8')
      // Les commentaires ont le droit de raconter l'histoire de la bascule.
      // Suivre l'état des blocs /* … */, dont les lignes de continuation ne
      // commencent par aucun marqueur (repris de typographie.test.js).
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

        const ligneMaj = ligne.toUpperCase()

        for (const beige of BEIGE_ABANDONNE) {
          if (ligneMaj.includes(beige)) fautifs.push(`${f} → ${nu.slice(0, 90)}`)
        }
        if (ligneMaj.includes(VERT_ABANDONNE_PARTOUT)) {
          fautifs.push(`${f} → ${nu.slice(0, 90)}`)
        }
        // #0E653A n'est fautif que hors contexte de survol.
        if (ligneMaj.includes(VERT_HOVER_SEULEMENT) && !/hover/i.test(ligne)) {
          fautifs.push(`${f} → ${nu.slice(0, 90)}`)
        }
      }
    }
    expect(fautifs, `Couleurs abandonnées encore référencées :\n${fautifs.join('\n')}`).toEqual([])
  })

  it('index.css et tokens.ts déclarent les mêmes couleurs', () => {
    // Ces deux fichiers avaient déjà divergé sur les polices sans que rien ne
    // le signale (Spectral vs Instrument Serif) — même risque ici, où les noms
    // diffèrent entre le kebab-case CSS et le camelCase JS.
    const blocClair = CSS.match(/@theme\s*\{([\s\S]*?)\n\}/)?.[1] || ''
    const blocTokens = TOKENS.match(/export const tokens = \{([\s\S]*?)\n\} as const/)?.[1] || ''

    const valeurCss = (nomVar) =>
      blocClair.match(new RegExp(`--color-${nomVar}:\\s*([^;]+);`))?.[1]?.trim()
    const valeurToken = (cle) =>
      blocTokens.match(new RegExp(`\\b${cle}:\\s*'([^']+)'`))?.[1]?.trim()
    const normalise = (v) => v?.replace(/\s+/g, '').toUpperCase()

    // Correspondance explicite --color-X (index.css) ↔ clé (tokens.ts) : les
    // deux nommages ne s'alignent pas mécaniquement (bgApp ↔ --color-app,
    // ink2 ↔ --color-ink-2…), donc pas de dérivation automatique possible.
    const CORRESPONDANCES = [
      ['cta', 'cta'],
      ['cta-hover', 'ctaHover'],
      ['primary', 'primary'],
      ['primary-deep', 'primaryDeep'],
      ['primary-soft', 'primarySoft'],
      ['primary-tint', 'primaryTint'],
      ['cream', 'bgCream'],
      ['app', 'bgApp'],
      ['surface', 'surface'],
      ['gold', 'gold'],
      ['gold-soft', 'goldSoft'],
      ['ink', 'ink'],
      ['ink-2', 'ink2'],
      ['ink-3', 'ink3'],
      ['ink-4', 'ink4'],
      ['warn', 'warn'],
      ['warn-bg', 'warnBg'],
      ['success', 'success'],
      ['danger', 'danger'],
      ['border', 'border'],
      ['border-cream', 'borderCream'],
    ]

    const divergences = []
    for (const [nomCss, cleToken] of CORRESPONDANCES) {
      const vCss = valeurCss(nomCss)
      const vToken = valeurToken(cleToken)
      if (normalise(vCss) !== normalise(vToken)) {
        divergences.push(`--color-${nomCss}: ${vCss ?? '(absent)'}  ≠  tokens.${cleToken}: ${vToken ?? '(absent)'}`)
      }
    }
    expect(divergences, `Tokens divergents entre index.css et tokens.ts :\n${divergences.join('\n')}`).toEqual([])
  })
})
