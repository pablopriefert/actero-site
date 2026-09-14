import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
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
 * ACT-30 (seconde moitié) : `bg-[#FFFFFF]` rapatrié vers `bg-surface`. 311
 * occurrences (casse indifférente — `bg-[#FFFFFF]` et `bg-[#ffffff]`
 * cohabitaient) sur 92 fichiers, car `--color-surface` vaut exactement
 * `#FFFFFF` (voir index.css). Le test ci-dessous interdit son retour.
 *
 * `bg-[#FAFAFA]` a depuis été rapatrié (commit `d219167`), après l'arbitrage
 * « on fait en blanc pur » : il n'en reste zéro occurrence dans `src/` hors
 * de ce fichier. Ce paragraphe disait le contraire jusqu'au 10 septembre — un
 * commentaire qui survit à la décision qu'il décrit est un piège de plus, pas
 * une trace.
 *
 * 10 septembre — « je veux que tout soit en blanc ». 118 fonds neutres et
 * très clairs (`#F5F5F5`, `#F0F0F0`, `#F7F8FA`, et les blancs cassés chauds
 * `#FAF9F4`, `#FDFCF7`, `#F7F5EF`…) sont passés à `bg-surface`, c'est-à-dire
 * au blanc pur, sur 48 fichiers. Trois garde-fous à cette bascule :
 *
 *  1. Les **variantes** (`hover:`, `dark:`, `group-hover:`) n'ont PAS été
 *     converties. Un survol blanc sur un fond blanc ne donne plus aucun
 *     retour visuel, et un `dark:` doit rester sombre. 30 occurrences.
 *  2. Les **teintes sémantiques** sont épargnées : jaune d'avertissement,
 *     vert de succès, rouge d'erreur portent une information, pas un style.
 *     `#FEF3C7` a été rapatrié vers `bg-warn-bg` plutôt que blanchi.
 *  3. Seuls les **fonds** ont bougé. Les bordures restent, donc les cartes
 *     gardent leur séparation visuelle sur fond blanc.
 *
 * 10 septembre, `#F4F5F7` et `#E8F5EC` rapatriés à leur tour (22 et 19
 * occurrences) : ils valent exactement `--color-cream` et
 * `--color-primary-tint`. Uniquement en contexte `bg-` — `text-[#F4F5F7]`
 * reste écrit en dur, et doit le rester : c'est un texte quasi blanc posé sur
 * un fond sombre, et `--color-cream` bascule au sombre en thème sombre. Le
 * convertir rendrait ce texte invisible. Une couleur identique ne veut pas
 * dire un rôle identique.
 *
 * Ce que ce fichier NE couvre TOUJOURS PAS, et pourquoi :
 * `src/` contient encore 234 `bg-[#XXXXXX]` écrits en dur sur 92
 * fichiers — dont 203 ne sont pas clairs du tout (fonds volontairement
 * sombres, couleurs de marque) (couleurs valides, pas du beige — `#FAFAFA` inclus — juste jamais
 * rapatriées vers un token). Un test qui interdirait tout `bg-[#...]`
 * échouerait sur ces 234 lignes dès aujourd'hui et ne garderait rien de plus
 * que ce que les tests ci-dessous gardent déjà : il serait juste rouge en
 * permanence, donc ignoré. Avant de pouvoir poser cette garde-là, il faut
 * d'abord rapatrier ces fonds vers `--color-app`, `--color-surface` ou
 * `--color-cream` (selon le cas) — ou créer le token qui manque — fichier
 * par fichier — ce n'est pas l'objet de ce ticket.
 */

const RACINE = 'src'

// Beige retiré le 9 septembre.
const BEIGE_ABANDONNE = [
  '#F9F7F1', '#F4F0E6', '#FAF8F3', '#E5E2D7', '#E8DFC9',
  '#E5E1D6', '#ECEAE2', '#F5F5F0', '#F7F5F0', '#EFE7D6',
  // 10 septembre : trois beiges avaient survécu au nettoyage du 9, dans le
  // téléchargeur de pièces jointes du portail. Ils échappaient à la liste
  // ci-dessus, tout simplement parce qu'ils n'y étaient pas — une liste de
  // couleurs interdites ne garde que ce qu'on a pensé à y écrire.
  '#EAE3D1', '#EEE7D4', '#C9BFA6',
  // Et un quatrième, planqué dans une variable CSS d'un module de vue.
  '#EFEBE1',
]
// 10 septembre — « je veux que tout soit en blanc ». La famille des blancs
// cassés, chauds comme froids, tous remplacés par du blanc pur. Aucun n'était
// dans la liste ci-dessus : pas assez beiges pour y figurer, assez beiges pour
// se voir. Quatre d'entre eux vivaient dans public/widget.js.
//
// #F5F5F5 n'est volontairement PAS banni : c'est le gris de survol, et un
// survol doit rester perceptible. Le blanc pur concerne les surfaces, pas les
// retours d'interaction.
const BLANCS_CASSES_ABANDONNES = [
  '#FBFAF7', '#F4F3EF', '#F0F0EC', '#E8E8E0', '#F7F8FA',
  '#FAF9F4', '#FDFCF7', '#F7F5EF', '#FAF7F2', '#FAFAF7', '#FAFAF8', '#F4F4F2',
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

// Les commentaires ont le droit de raconter l'histoire d'une bascule (ex. ce
// fichier lui-même). Suivre l'état des blocs /* … */, dont les lignes de
// continuation ne commencent par aucun marqueur (repris de typographie.test.js).
// Retourne les lignes de code utiles, brutes ET en version .trim() (`nu`).
function lignesDeCode(src) {
  const lignes = []
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

    lignes.push({ ligne, nu })
  }
  return lignes
}

// public/widget.js n'est pas dans src/, et c'est précisément le problème :
// c'est la bulle que voient les clients FINAUX des marchands — la surface la
// plus exposée du produit — et elle a traversé sans une égratignure le
// nettoyage du 9 septembre, qui ne balayait que src/. Elle portait encore
// quatre beiges le 10 septembre. Une garde ne protège que ce qu'elle regarde.
const FICHIERS = [...fichiersSources(RACINE), 'public/widget.js']
const CSS = readFileSync('src/index.css', 'utf8')
const TOKENS = readFileSync('src/lib/tokens.ts', 'utf8')

describe('couleurs — pas de retour du beige ni des anciens verts', () => {
  it('aucune couleur abandonnée ne subsiste, même en repli', () => {
    const fautifs = []
    for (const f of FICHIERS) {
      const src = readFileSync(f, 'utf8')
      for (const { ligne, nu } of lignesDeCode(src)) {
        const ligneMaj = ligne.toUpperCase()

        for (const abandonnee of [...BEIGE_ABANDONNE, ...BLANCS_CASSES_ABANDONNES]) {
          if (ligneMaj.includes(abandonnee)) fautifs.push(`${f} → ${nu.slice(0, 90)}`)
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

  // ACT-30 (seconde moitié). `bg-[#FFFFFF]` vient d'être rapatrié vers
  // `bg-surface` partout dans src/ (voir le commentaire d'en-tête) — ce test
  // empêche qu'un prochain composant écrit vite le réintroduise en dur sans
  // que personne ne le remarque, exactement le sort qu'a connu le beige.
  it('bg-[#FFFFFF] écrit en dur ne revient pas (rapatrié vers bg-surface)', () => {
    const fautifs = []
    for (const f of FICHIERS) {
      const src = readFileSync(f, 'utf8')
      for (const { nu } of lignesDeCode(src)) {
        if (/bg-\[#FFFFFF\]/i.test(nu)) fautifs.push(`${f} → ${nu.slice(0, 90)}`)
      }
    }
    expect(fautifs, `bg-[#FFFFFF] en dur détecté — utiliser bg-surface :\n${fautifs.join('\n')}`).toEqual([])
  })

  it('les couleurs qui ont un token exact ne se réécrivent pas en dur en fond', () => {
    // Rapatriées le 10 septembre. Volontairement limité au contexte `bg-` :
    // `text-[#F4F5F7]` est un texte clair sur fond sombre et doit rester en
    // dur, parce que le token bascule au sombre en thème sombre.
    const AVEC_TOKEN = [
      ['#F4F5F7', 'bg-cream'],
      ['#E8F5EC', 'bg-primary-tint'],
      ['#FAFAFA', 'bg-app'],
    ]
    const fautifs = []
    for (const f of FICHIERS) {
      const src = readFileSync(f, 'utf8')
      for (const { nu } of lignesDeCode(src)) {
        for (const [hex, token] of AVEC_TOKEN) {
          if (new RegExp(`bg-\\[${hex}\\]`, 'i').test(nu)) {
            fautifs.push(`${f} → ${nu.slice(0, 90)} (utiliser ${token})`)
          }
        }
      }
    }
    expect(fautifs, `Fond écrit en dur alors qu'un token exact existe :\n${fautifs.join('\n')}`).toEqual([])
  })

  it("il n'existe qu'une source de vérité pour les couleurs", () => {
    // `src/lib/design-tokens.js` s'annonçait « Source of Truth » et posait une
    // règle d'or — « si une couleur n'est pas ici, elle ne devrait pas
    // apparaître dans le code applicatif ». Huit composants l'importaient et
    // documentaient la consommer. Aucun ne lisait la moindre valeur : chacun
    // se terminait par un `export const __X_TOKENS__ = tokens` dont le seul
    // rôle était d'empêcher l'import de passer pour inutilisé. Le fichier
    // déclarait par ailleurs `page: '#fafafa'` quand `--color-app` valait
    // `#FFFFFF` — deux vérités contradictoires, dont une seule s'affichait.
    // Supprimé le 10 septembre. index.css est la source, tokens.ts son miroir
    // (test ci-dessous).
    expect(existsSync('src/lib/design-tokens.js'),
      'src/lib/design-tokens.js est revenu : une seconde source de couleurs que rien ne lit finit toujours par contredire index.css',
    ).toBe(false)

    const importateurs = FICHIERS.filter((f) => readFileSync(f, 'utf8').includes('design-tokens'))
    expect(importateurs, `Fichiers référençant design-tokens : ${importateurs.join(', ')}`).toEqual([])
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
