import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { pathToRegexp } from 'path-to-regexp'

/**
 * Un audit SEO d'actero.fr (16 septembre 2026) a trouvé trois défauts
 * d'indexation qui ne se voient qu'en COMBINANT plusieurs fichiers — aucun
 * n'est faux tout seul :
 *
 *   robots.txt      Googlebot, Bingbot, GPTBot... avaient chacun leur propre
 *                    groupe "Allow: /". Un robot n'obéit qu'au groupe qui
 *                    porte SON nom (RFC 9309) : ils ignoraient donc en
 *                    silence tout le Disallow écrit pour "*", /admin inclus.
 *   vercel.json      la règle "/(.*)" posait X-Robots-Tag: index, follow
 *                    sur /admin, /client, /start/... comme sur le reste.
 *   sitemap.xml      listait des URLs qui redirigent en 308 (donc jamais
 *                    servies) et en oubliait d'autres qui sont bien
 *                    pré-rendues.
 *
 * Ces tests n'inspectent pas une chaîne de caractères au hasard : ils
 * REJOUENT les règles (groupes robots.txt selon RFC 9309, motifs `source`
 * de vercel.json) sur des cas concrets, pour que toute régression future se
 * voie ici plutôt qu'en Search Console trois semaines après coup.
 */

const ROBOTS_TXT = readFileSync('public/robots.txt', 'utf8')
const SITEMAP_XML = readFileSync('public/sitemap.xml', 'utf8')
const PRERENDER_SRC = readFileSync('scripts/prerender-routes.mjs', 'utf8')
const VERCEL = JSON.parse(readFileSync('vercel.json', 'utf8'))

const SITE = 'https://actero.fr'

// ── robots.txt : groupes RFC 9309 ──────────────────────────────────────
// « Plusieurs lignes User-agent consécutives forment un seul groupe » :
// un groupe se termine dès qu'une ligne Allow/Disallow est lue, et ne
// reprend qu'à la prochaine ligne User-agent. Les commentaires et lignes
// vides n'interrompent rien — ils disparaissent avant l'analyse.
function parseRobotsGroups(text) {
  const groups = []
  let current = null
  let collectingAgents = true
  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/#.*$/, '').trim()
    if (!line) continue

    const ua = line.match(/^user-agent:\s*(.+)$/i)
    if (ua) {
      if (!current || !collectingAgents) {
        current = { agents: [], rules: [] }
        groups.push(current)
        collectingAgents = true
      }
      current.agents.push(ua[1].trim())
      continue
    }

    const rule = line.match(/^(disallow|allow):\s*(.*)$/i)
    if (rule && current) {
      collectingAgents = false
      current.rules.push({ type: rule[1].toLowerCase(), value: rule[2].trim() })
    }
    // "Sitemap:" et toute autre ligne n'appartiennent à aucun groupe.
  }
  return groups
}

// Le groupe qui s'applique à un robot donné : un groupe le nommant
// explicitement (peu importe lequel — un product-token n'apparaît que dans
// UN groupe si robots.txt est bien formé), sinon le groupe "*".
function groupFor(groups, agent) {
  const named = groups.find((g) => g.agents.some((a) => a.toLowerCase() === agent.toLowerCase()))
  if (named) return named
  return groups.find((g) => g.agents.includes('*'))
}

// ── sitemap.xml / prerender-routes.mjs ─────────────────────────────────
function sitemapPaths(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, url]) => {
    if (!url.startsWith(SITE)) throw new Error(`URL hors domaine dans le sitemap : ${url}`)
    const path = url.slice(SITE.length)
    return path === '' ? '/' : path
  })
}

// prerender-routes.mjs s'exécute (et échoue) hors d'un `vite build` — il
// appelle process.exit(1) si dist/index.html n'existe pas. On ne peut donc
// pas l'importer ici : on lit les chemins directement dans le texte source,
// comme demandé.
function prerenderedPaths(source) {
  return [...source.matchAll(/path:\s*'([^']+)'/g)].map(([, path]) => path)
}

// ── vercel.json : motifs `source` ──────────────────────────────────────
// path-to-regexp 8.x (celui présent dans node_modules) a REÉCRIT sa
// grammaire et rejette désormais tout groupe regex brut de type "(.*)" ou
// "(?!...)" — y compris "/(.*)"/"/((?!api/).*)", déjà en production dans ce
// même vercel.json. Vérifié empiriquement (voir le test ci-dessous) : la
// librairie échoue même sur les motifs qui tournent déjà en prod.
//
// On essaie donc la vraie librairie d'abord (utile si node_modules change
// de version), et on retombe sur une conversion manuelle SEULEMENT pour nos
// propres motifs : ils n'utilisent aucun paramètre nommé ":x", uniquement
// des littéraux et des groupes regex bruts — donc traiter la chaîne comme
// un corps de regex, ancré ^...$, leur est fidèle.
function sourceToRegExp(source) {
  try {
    return pathToRegexp(source).regexp
  } catch {
    if (source.includes(':')) {
      throw new Error(`motif avec :paramètre nommé — conversion manuelle non fiable : ${source}`)
    }
    return new RegExp(`^${source}$`)
  }
}

function headerValuesForPath(path, headerKey) {
  const values = new Set()
  for (const rule of VERCEL.headers) {
    if (sourceToRegExp(rule.source).test(path)) {
      for (const h of rule.headers) {
        if (h.key === headerKey) values.add(h.value)
      }
    }
  }
  return values
}

describe('robots.txt — un seul groupe pour "*" et les robots autorisés', () => {
  it('path-to-regexp 8.x rejette bien la syntaxe déjà utilisée en prod (preuve du commentaire ci-dessus)', () => {
    expect(() => pathToRegexp('/((?!api/).*)')).toThrow()
  })

  it('le groupe qui s\'applique à Googlebot contient Disallow: /admin, et regroupe aussi GPTBot et Bingbot', () => {
    const groups = parseRobotsGroups(ROBOTS_TXT)
    const googleGroup = groupFor(groups, 'Googlebot')
    expect(googleGroup, 'aucun groupe ne s\'applique à Googlebot').toBeTruthy()

    const disallows = googleGroup.rules.filter((r) => r.type === 'disallow').map((r) => r.value)
    expect(disallows, `Disallow du groupe Googlebot : ${disallows.join(', ') || '(aucun)'}`).toContain('/admin')

    const agents = googleGroup.agents.map((a) => a.toLowerCase())
    expect(agents, `agents du groupe Googlebot : ${googleGroup.agents.join(', ')}`).toContain('gptbot')
    expect(agents, `agents du groupe Googlebot : ${googleGroup.agents.join(', ')}`).toContain('bingbot')
  })
})

describe('sitemap.xml — seulement des pages réellement servies', () => {
  it('chaque URL du sitemap est / ou une route pré-rendue', () => {
    const routes = new Set(prerenderedPaths(PRERENDER_SRC))
    const sansPrerender = sitemapPaths(SITEMAP_XML).filter((p) => p !== '/' && !routes.has(p))
    expect(sansPrerender, `Dans le sitemap sans pré-rendu : ${sansPrerender.join(', ')}`).toEqual([])
  })

  it('aucune URL du sitemap n\'est la source d\'une redirection de vercel.json', () => {
    const redirectSources = new Set(VERCEL.redirects.map((r) => r.source))
    const redirigees = sitemapPaths(SITEMAP_XML).filter((p) => redirectSources.has(p))
    expect(redirigees, `Dans le sitemap ET redirigées (jamais servies) : ${redirigees.join(', ')}`).toEqual([])
  })
})

describe('vercel.json — X-Robots-Tag suit le caractère privé de la route', () => {
  const PRIVEES = ['/admin/x', '/client', '/signup/plan', '/start/abc', '/shopify-success']
  const PUBLIQUES = ['/', '/tarifs', '/startups', '/produit']

  it.each(PRIVEES)('%s ne reçoit que noindex', (path) => {
    const values = headerValuesForPath(path, 'X-Robots-Tag')
    expect([...values], `X-Robots-Tag pour ${path}`).toEqual(['noindex, nofollow'])
  })

  it.each(PUBLIQUES)('%s ne reçoit que index', (path) => {
    const values = headerValuesForPath(path, 'X-Robots-Tag')
    expect([...values], `X-Robots-Tag pour ${path}`).toEqual(['index, follow'])
  })
})
