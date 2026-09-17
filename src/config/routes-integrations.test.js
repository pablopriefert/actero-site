import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Un bouton « Connecter » doit mener quelque part.
 *
 * CE QUE CE FICHIER EXISTE POUR ARRÊTER
 *
 * Le 11 septembre 2026, un audit a trouvé que HUIT boutons « Connecter » sur
 * neuf pointaient vers `/api/intégrations/…` — avec un accent. Le dossier
 * s'appelle `api/integrations`, sans accent, et aucune réécriture ne rattrape.
 *
 * Le navigateur encode l'accent (`/api/int%C3%A9grations/…`), Vercel n'a aucune
 * fonction à ce chemin, et le marchand reçoit un 404. Gorgias, Zendesk,
 * Webflow, WooCommerce, Slack, Linear, Google Docs, Notion : aucune de ces
 * huit intégrations ne pouvait être connectée. Seul Shopify marchait, parce
 * que sa route vit ailleurs.
 *
 * `ClientIntegrationsView.jsx` portait la même faute sur « Déconnecter » — et
 * pire, il ne regardait pas la réponse : la fenêtre se fermait comme si la
 * déconnexion avait réussi, en laissant la connexion active.
 *
 * POURQUOI RIEN NE L'AVAIT VU
 *
 * C'est la forme exacte que ce dépôt produit à répétition : rien n'échoue au
 * build, rien n'échoue aux tests, le code est syntaxiquement parfait et le
 * bouton s'affiche normalement. Le défaut ne vit ni dans le code appelant ni
 * dans le code appelé, mais dans la CHAÎNE entre les deux — et personne ne
 * regarde une chaîne.
 *
 * Un accent dans une chaîne de caractères ne se voit pas à la relecture. Cette
 * garde le voit.
 */

/**
 * Retire les commentaires : une garde qui lit du code doit lire du code.
 *
 * Sans ça, cette garde a signalé son propre correctif — le commentaire qui
 * explique le défaut cite forcément l'URL fautive. Quatrième fois cette
 * semaine qu'une garde se laisse berner par du texte.
 *
 * Les chaînes d'une ligne sont lues AVANT les commentaires, et gardées. La
 * première version retirait d'abord tout ce qui allait de `/*` à `*\/` : dans
 * ClientIntegrationsView.jsx, le commentaire `// … /api/integrations/*\/callback`
 * ouvrait un faux bloc qui avalait soixante-dix lignes de vrai code, un
 * `fetch` compris. Une chaîne comme `accept="image/*"` faisait de même.
 */
function sansCommentaires(src) {
  return src.replace(
    /(['"`])(?:\\.|(?!\1)[^\\\n])*\1|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,
    (jeton, guillemet) => (guillemet ? jeton : ''),
  )
}

const CONFIG = sansCommentaires(readFileSync('src/config/integrations.js', 'utf8'))

/** Les routes servies par Vercel, déduites de l'arborescence de api/. */
function routesApi(dir = 'api', prefixe = '/api', acc = new Set()) {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e.startsWith('.')) continue
    const chemin = join(dir, e)
    if (statSync(chemin).isDirectory()) routesApi(chemin, `${prefixe}/${e}`, acc)
    else if (e.endsWith('.js') && !e.includes('.test.')) acc.add(`${prefixe}/${e.replace(/\.js$/, '')}`)
  }
  return acc
}

/** Le chemin appelé par chaque bouton, sans la chaîne de requête. */
function cheminsAppeles(src) {
  return [...src.matchAll(/['"`](\/api\/[^'"`?\s${]+)/g)].map((m) => m[1])
}

describe('les boutons d’intégration mènent à une route qui existe', () => {
  const ROUTES = routesApi()

  it('l’arborescence des routes a bien été lue', () => {
    // Sans ça, l'ensemble est vide, tout est déclaré introuvable, et le test
    // devient un bruit qu'on désactive. Ou l'inverse selon l'assertion — dans
    // les deux cas il ne garde plus rien.
    expect(ROUTES.size, 'aucune route API lue depuis api/').toBeGreaterThan(50)
    expect(ROUTES.has('/api/integrations/woocommerce/authorize')).toBe(true)
  })

  it('chaque oauthUrl du catalogue vise une fonction déployée', () => {
    const fautifs = cheminsAppeles(CONFIG)
      .filter((c) => !ROUTES.has(c))
      .map((c) => `${c} — aucune fonction à ce chemin`)
    expect(
      fautifs,
      'Bouton « Connecter » vers une route inexistante : le marchand clique et '
      + 'reçoit un 404, sans que rien d’autre ne le signale.\n  ' + fautifs.join('\n  '),
    ).toEqual([])
  })

  it('« Déconnecter » regarde la réponse avant de se déclarer satisfait', () => {
    // Le second défaut du même écran : la route était fausse ET la réponse
    // ignorée. La fenêtre se fermait, le marchand croyait avoir déconnecté, la
    // connexion restait active. Une erreur qu'on n'examine pas est une erreur
    // qu'on transforme en succès.
    // Le périmètre EXACT de la fonction, pas une fenêtre de N caractères.
    // Première version de ce test : une tranche de 700 caractères, et un motif
    // qui acceptait `status ===`. Elle passait au vert en attrapant
    // `i.status === 'active'` d'une ligne SITUÉE APRÈS la fonction. Un test
    // qui regarde à côté est pire qu'aucun test : il certifie.
    const vue = sansCommentaires(readFileSync('src/components/client/ClientIntegrationsView.jsx', 'utf8'))
    const debut = vue.indexOf('const handleDisconnect')
    expect(debut, 'handleDisconnect a disparu ou changé de nom').toBeGreaterThan(0)
    const fin = vue.indexOf('\n  };', debut)
    const corps = vue.slice(debut, fin)

    expect(
      corps,
      'la réponse de /api/integrations/disconnect n’est jamais examinée. '
      + '`fetch` ne rejette que sur une panne réseau : un 404 arrive comme une '
      + 'réponse normale, la fenêtre se ferme, et le marchand croit avoir '
      + 'déconnecté une intégration toujours active.',
    ).toMatch(/\bres\.ok\b|\bresponse\.ok\b/)
  })
})

/**
 * Chaque chemin d'API écrit en toutes lettres dans le code, sans sa chaîne de
 * requête ni ce qui suit un `${`.
 */
function cheminsLitteraux(src) {
  return [...sansCommentaires(src).matchAll(/(['"`])(\/api\/(?:(?!\1)[^\n])*)\1/g)]
    .map((m) => m[2].split(/[?#]|\$\{/)[0])
}

/** Ceux qui sortent de l'alphabet des dossiers de api/ : minuscules, chiffres, `/`, `_`, `-`. */
const horsCharte = (src) => cheminsLitteraux(src).filter((c) => !/^\/api\/[a-z0-9/_-]*$/.test(c))

function fichiersDuNavigateur(dir = 'src', acc = []) {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e.startsWith('.')) continue
    const chemin = join(dir, e)
    if (statSync(chemin).isDirectory()) fichiersDuNavigateur(chemin, acc)
    else if (/\.(jsx?|tsx?|mjs)$/.test(e) && !e.includes('.test.')) acc.push(chemin)
  }
  return acc
}

describe('aucun chemin d’API de src/ ne sort de [a-z0-9/_-]', () => {
  // La cause exacte du 11 septembre, revenue le 17 dans SignupPage.jsx :
  // « Renvoyer le code » appelait `send-vérification-code`, 404 en production.
  // Le dossier `api/` est en ASCII ; un accent (ou une espace) dans l'URL est
  // encodé par le navigateur et ne correspond plus à rien. La règle couvre
  // désormais tout `src/`, pas deux fichiers : la faute est revenue ailleurs.

  it('la règle attrape l’URL accentuée de « Renvoyer le code », et elle seule', () => {
    const exemple = [
      'await fetch("/api/auth/send-vérification-code", { method: "POST" })',
      "fetch('/api/auth/send-verification-code')",
      'fetch(`/api/closer/${chemin}?id=${id}`)',
      "const url = '/api/admin/partner-tokens?id=' + id",
      "fetch('/api/mauvais chemin')",
      '// fetch("/api/commentaire-é") : un commentaire ne compte pas',
      '<input accept="image/*" /> {/* bloc */} fetch("/api/apres-le-bloc-é")',
    ].join('\n')
    expect(horsCharte(exemple)).toEqual([
      '/api/auth/send-vérification-code',
      '/api/mauvais chemin',
      '/api/apres-le-bloc-é',
    ])
  })

  it('tous les chemins littéraux de src/ respectent la règle', () => {
    const fichiers = fichiersDuNavigateur()
    let lus = 0
    const fautifs = []
    for (const f of fichiers) {
      const src = readFileSync(f, 'utf8')
      lus += cheminsLitteraux(src).length
      for (const c of horsCharte(src)) fautifs.push(`${f} → ${c}`)
    }
    // Sans ça, une lecture vide passerait pour un code propre.
    expect(lus, 'aucun chemin d’API lu dans src/').toBeGreaterThan(150)
    expect(
      fautifs,
      'Chemin d’API hors de [a-z0-9/_-] — il sera encodé par le navigateur et '
      + 'ne correspondra à aucune fonction :\n  ' + fautifs.join('\n  '),
    ).toEqual([])
  })
})
