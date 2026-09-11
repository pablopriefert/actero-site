import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * ACT-30 — la garde qui manquait : une couleur de fond écrite en dur doit être
 * un choix, pas un oubli.
 *
 * CE QUE CE FICHIER EXISTE POUR ARRÊTER
 *
 * ACT-27 proposait une séquence en trois temps : (1) rapatrier les valeurs vers
 * les tokens, (2) poser une garde qui refuse un fond écrit en dur, (3) alors
 * seulement changer les tokens.
 *
 * Le 9 septembre, l'étape 3 a été faite sans l'étape 2. 562 occurrences de
 * beige sont devenues des occurrences de blanc et de gris froid — sur les mêmes
 * 118 fichiers, avec la même forme. Les couleurs étaient justes, et justes de
 * la même manière qu'avant : **écrites en dur**. Le prochain composant écrit
 * vite réintroduisait une valeur, et personne ne le voyait.
 *
 * `couleurs.test.js` garde l'autre moitié du problème : il refuse le RETOUR de
 * couleurs nommément abandonnées. Il ne dit rien d'une couleur neuve. Ce
 * fichier-ci prend le problème par l'autre bout : toute couleur de fond doit
 * être soit un token, soit une exemption qui porte sa raison.
 *
 * LES TROIS RÈGLES
 *
 *  1. Un fond dont l'hexadécimal vaut exactement un token échoue toujours.
 *     C'est la dérive qu'on paie : deux écritures pour une même couleur, dont
 *     une seule suit le thème sombre.
 *  2. Un fond hors de la liste ci-dessous échoue. Deux issues : le rapatrier
 *     vers un token, ou l'inscrire ici avec une raison.
 *  3. Une exemption dont la couleur n'apparaît plus échoue. Une exemption
 *     orpheline est une raison que plus personne ne relit — même règle que
 *     `tenant-guard.test.js` et `llm-provider.test.js`.
 *
 * CE QUE LA LISTE DIT DU PRODUIT
 *
 * En l'écrivant, deux choses sont apparues qu'aucune revue n'avait vues :
 *
 *  — **Douze verts foncés** vivent hors de l'échelle (`#0D5430`, `#0F5F35`,
 *    `#0A4A29`, `#002A1C`…). Le vert de marque n'a pas de rampe : chaque
 *    composant a choisi sa nuance. Ce n'est pas une faute par fichier, c'est un
 *    token manquant — `--color-primary` n'a ni palier clair ni palier sombre.
 *  — **Onze gris neutres** aussi, dont deux qui portent un vrai sens :
 *    `#D4D4D8` est l'état ÉTEINT d'un interrupteur et `#A1A1AA` son survol.
 *    Ça mérite un nom, pas un hexadécimal répété dans six fichiers.
 *
 * Ces deux manques sont notés ici plutôt que corrigés : créer une rampe de vert
 * est un arbitrage de marque, pas un nettoyage.
 */

const RACINE = 'src'

/**
 * Les tokens, lus depuis index.css — la source. Les réécrire ici créerait
 * exactement la duplication que ce fichier combat.
 */
const CSS = readFileSync('src/index.css', 'utf8')
const BLOC_THEME = CSS.match(/@theme\s*\{([\s\S]*?)\n\}/)?.[1] || ''
const TOKENS = Object.fromEntries(
  [...BLOC_THEME.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})\s*;/g)]
    .map((m) => [m[2].toUpperCase(), m[1]]),
)

/**
 * Fonds écrits en dur qu'on assume, chacun avec sa raison. Ajouter une entrée
 * est un choix explicite, et la raison est relue avec.
 */
const FONDS_ADMIS = {
  // ── Surfaces volontairement sombres ────────────────────────────────────
  // Maquettes produit, panneaux de code, fenêtres de démonstration. Elles ne
  // suivent pas le thème : elles SONT sombres, en clair comme en sombre.
  '#0E1424': 'bleu nuit des maquettes produit (before-after-slider, architecture-map, demo-dashboard)',
  '#0A0E1A': 'bleu nuit, seconde valeur de la même famille de maquettes',
  '#0A0A0A': 'panneaux sombres du tableau de bord (ActionLogsView, BenchmarksWidget, CopilotChat)',
  '#030303': 'presque noir des héros sombres (shape-landing-hero, ProspectDemoPage)',
  '#0E0E0E': 'panneau du journal d’actions',
  '#0B0B0B': 'fond de l’éditeur de prompt',
  '#0F1014': 'colonne sombre du comparateur de coûts',
  '#18181B': 'zinc-900 des vues admin et de la doc API',
  '#262626': 'neutral-800 de l’Academy et du comparateur',
  '#1A0F0F': 'rouge très sombre : le « avant » du before-after-slider',
  '#111': 'noir court, modale CommandK et maquettes',
  '#333': 'gris sombre court, écran de facturation',
  '#000': 'noir pur ponctuel, vue des migrations',

  // ── Une valeur de token, un autre rôle ─────────────────────────────────
  '#1A1A1A':
    'vaut --color-ink, mais sert ici de FOND sombre (VideoModal, panneaux). '
    + 'En thème sombre --ink passe au blanc : le rapatrier rendrait ces '
    + 'surfaces blanches. Même piège que text-[#F4F5F7] dans couleurs.test.js.',

  // ── Verts hors échelle ─────────────────────────────────────────────────
  // Douze nuances pour une seule couleur de marque. À remplacer par une rampe
  // (--primary-700/800/900…) le jour où l'arbitrage est fait — pas avant.
  '#162C0D': 'vert très sombre, survol des boutons du portail client',
  '#0D5430': 'vert moyen, bandeaux de mise à niveau et écran de succès Shopify',
  '#0D5030': 'vert moyen, vues admin — voisin d’un pixel de #0D5430',
  '#0F5F35': 'vert de l’écran d’installation du widget',
  '#0A4A29': 'vert sombre, listes admin et éditeur de garde-fous',
  '#0B4A29': 'vert sombre, bouton de marquage des runs',
  '#0A4528': 'vert sombre, écran de facturation',
  '#0C4D2A': 'vert sombre, visite guidée produit',
  '#002A1C': 'vert-noir du marketplace',
  '#00291C': 'vert-noir de l’Academy',
  '#14A85C': 'vert vif des barres de progression et du badge tarifaire',
  '#B8D2A0': 'sauge claire, bouton du comparateur de coûts',

  // ── Deux tokens non rapatriés, volontairement ──────────────────────────
  '#1F3A12':
    'vaut --color-primary. NON rapatrié : ces six boutons vivent dans le '
    + 'portail client (marque blanche) et --primary bascule en sauge #A8C490 '
    + 'en thème sombre — texte blanc sur sauge devient illisible. À convertir '
    + 'quand le portail sera rendu compatible avec le thème sombre.',
  '#A8C490':
    'vaut --color-primary-soft. NON rapatrié : fonds clairs de la landing et '
    + 'du tarif, avec du texte #003725 dessus. En sombre --primary-soft '
    + 'devient le forêt #14532D et le contraste s’inverse.',

  // ── Marques tierces : la valeur EST l’identification ───────────────────
  '#95BF47': 'vert Shopify — couleur de marque, ne peut pas suivre notre thème',
  '#635BFF': 'violet Stripe — couleur de marque',
  '#5E6AD2': 'bleu Linear — couleur de marque',
  '#FF7A59': 'orange HubSpot — couleur de marque',
  '#17494D': 'sarcelle Zendesk — couleur de marque',

  // ── Chrome de fenêtre macOS (décor d’aperçu) ───────────────────────────
  '#FF5F56': 'feu rouge d’une fenêtre macOS, aperçu du portail — décor fixe',
  '#FFBD2E': 'feu orange d’une fenêtre macOS, aperçu du portail — décor fixe',
  '#27C93F': 'feu vert d’une fenêtre macOS, aperçu du portail — décor fixe',

  // ── Gris neutres sans token ────────────────────────────────────────────
  '#D4D4D8': 'état ÉTEINT d’un interrupteur — mérite un token sémantique',
  '#A1A1AA': 'survol de l’interrupteur éteint — va avec #D4D4D8',
  '#EBEBEB': 'fond des onglets et boutons inactifs',
  '#ECECEC': 'fond inactif, seconde valeur de la même famille',
  '#EDEFF2': 'survol des puces claires du marketplace',
  '#F0F0F0': 'fond des champs de recherche et des lignes admin',
  '#F5F5F5': 'gris de survol — volontairement conservé : un survol blanc sur '
    + 'fond blanc ne donne aucun retour visuel (voir couleurs.test.js)',
  '#F9F9F9': 'fond très clair de la barre latérale',
  '#9CA3AF': 'pastille de statut « neutre » (StatusPill) et puces de liste',

  // ── Sémantique non tokenisée ───────────────────────────────────────────
  '#3B82F6': 'bleu d’information (blue-500) — pas de token d’info aujourd’hui',
  '#22C55E': 'vert clair d’un encart de la landing (green-500)',
  '#D4EDDA': 'vert pâle d’un bandeau de succès dans le portail',
  '#FEE2E2': 'rouge pâle d’un bandeau d’erreur du portail (red-100)',
  '#FFF389': 'jaune de la carte « chrono d’installation » sur la landing',
}

function fichiersSources(dir, acc = []) {
  for (const entree of readdirSync(dir)) {
    if (entree === 'node_modules' || entree.startsWith('.')) continue
    const chemin = join(dir, entree)
    if (statSync(chemin).isDirectory()) fichiersSources(chemin, acc)
    else if (/\.(jsx?|tsx?|css)$/.test(entree) && !entree.includes('.test.')) acc.push(chemin)
  }
  return acc
}

// public/widget.js est hors de src/ et c'est la bulle que voient les clients
// FINAUX des marchands. Le nettoyage du 9 septembre ne balayait que src/ et l'a
// donc entièrement manquée. Une garde ne protège que ce qu'elle regarde.
const FICHIERS = [...fichiersSources(RACINE), 'public/widget.js']

/** Chaque `bg-[#XXXXXX]` du code, avec où il est. Commentaires exclus. */
function fondsEnDur() {
  const trouves = []
  for (const f of FICHIERS) {
    const src = readFileSync(f, 'utf8')
    let dansBloc = false
    src.split('\n').forEach((ligne, i) => {
      const nu = ligne.trim()
      const ouvre = ligne.lastIndexOf('/*')
      const ferme = ligne.lastIndexOf('*/')
      const etait = dansBloc
      if (!dansBloc && ouvre !== -1 && ferme < ouvre) dansBloc = true
      else if (dansBloc && ferme !== -1 && ferme > ouvre) dansBloc = false
      if (etait || dansBloc) return
      if (nu.startsWith('//') || nu.startsWith('/*') || nu.startsWith('*')) return

      for (const m of ligne.matchAll(/bg-\[(#[0-9A-Fa-f]{3,8})\]/g)) {
        trouves.push({ hexa: m[1].toUpperCase(), fichier: f, ligne: i + 1, texte: nu.slice(0, 80) })
      }
    })
  }
  return trouves
}

describe('ACT-30 — fonds écrits en dur', () => {
  it('un fond qui vaut exactement un token doit passer par le token', () => {
    // La règle qui compte. Deux écritures pour une même couleur, c'est une
    // seule qui suivra le thème sombre — et l'autre qui se remarquera six mois
    // plus tard, sur une capture d'écran.
    const fautifs = fondsEnDur()
      .filter(({ hexa }) => TOKENS[hexa] && !FONDS_ADMIS[hexa])
      .map(({ hexa, fichier, ligne, texte }) =>
        `${fichier}:${ligne} → bg-[${hexa}] (utiliser bg-${TOKENS[hexa]})\n    ${texte}`)

    expect(
      fautifs,
      'Fond écrit en dur alors qu’un token porte exactement cette valeur :\n' + fautifs.join('\n'),
    ).toEqual([])
  })

  it('tout autre fond en dur porte une raison écrite', () => {
    const inconnus = [...new Set(fondsEnDur().filter(({ hexa }) => !FONDS_ADMIS[hexa]).map((t) => t.hexa))]
    const détail = inconnus.map((h) => {
      const où = fondsEnDur().filter((t) => t.hexa === h).slice(0, 2)
      return `  ${h} — ${où.map((t) => `${t.fichier}:${t.ligne}`).join(', ')}`
    })
    expect(
      inconnus,
      'Couleur de fond neuve. Deux issues : la rapatrier vers un token, ou '
      + 'l’inscrire dans FONDS_ADMIS avec la raison de son existence.\n' + détail.join('\n'),
    ).toEqual([])
  })

  it('aucune exemption n’est orpheline', () => {
    // Une exemption dont la couleur a disparu est une raison que plus personne
    // ne relit — et qui autorise silencieusement son retour.
    const utilisees = new Set(fondsEnDur().map((t) => t.hexa))
    const orphelines = Object.keys(FONDS_ADMIS).filter((h) => !utilisees.has(h))
    expect(
      orphelines,
      'Exemptions à supprimer, ces couleurs n’apparaissent plus :\n  ' + orphelines.join('\n  '),
    ).toEqual([])
  })

  it('chaque exemption porte une raison lisible', () => {
    const sansRaison = Object.entries(FONDS_ADMIS)
      .filter(([, raison]) => !raison || raison.trim().length < 15)
      .map(([h]) => h)
    expect(sansRaison, 'une exemption sans raison est un contournement').toEqual([])
  })

  it('index.css a bien été lu — sinon la première garde ne garderait rien', () => {
    // Si le format du bloc @theme change, TOKENS devient vide et le premier
    // test passe au vert sans rien vérifier. Un test qui ne peut pas échouer
    // est pire qu'absent : il rassure.
    expect(Object.keys(TOKENS).length, 'aucun token lu depuis index.css').toBeGreaterThan(15)
    expect(TOKENS['#13804A'], '--color-cta introuvable dans le bloc @theme').toBe('cta')
  })
})
