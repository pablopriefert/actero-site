import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * ACT-20 — le rate limiting ne survivait pas au serverless.
 *
 * `api/lib/rate-limit.js` comptait dans une `Map` de process. Sur Vercel
 * chaque instance a sa propre mémoire, donc la limite appliquée n'était pas
 * celle annoncée : c'était celle-là **multipliée par le nombre d'instances
 * ouvertes**. Et une plateforme ouvre des instances précisément quand le
 * trafic monte — c'est-à-dire pendant une attaque.
 *
 * 17 endpoints en dépendaient. Le plus exposé était
 * `api/auth/send-verification-code.js`, qui n'ajoutait aucune garde durable :
 * on pouvait donc déclencher un nombre arbitraire d'emails vers une adresse
 * arbitraire. (`api/auth/verify-code.js` tenait, lui : son compteur d'essais
 * vit sur la ligne du code en base.)
 *
 * Deux implémentations durables existaient déjà dans le dépôt
 * (`api/engine/lib/rate-limiter.js`, `api/portal/lib/rate-limit.js`) : le
 * helper partagé était le seul à ne pas l'être.
 */

const ENV = { ...process.env }
let appelsRpc = []
let reponseRpc

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    rpc: async (nom, args) => {
      appelsRpc.push({ nom, args })
      return reponseRpc
    },
  }),
}))

beforeEach(() => {
  vi.resetModules()
  appelsRpc = []
  process.env.SUPABASE_URL = 'https://exemple.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-test'
})
afterEach(() => {
  process.env = { ...ENV }
})

describe('checkRateLimit — compteur partagé', () => {
  it('délègue à consume_rate_limit avec la clé, la limite et la fenêtre', async () => {
    reponseRpc = { data: [{ allowed: true, remaining: 4, reset_at: '2026-09-09T18:00:00Z' }], error: null }
    const { checkRateLimit } = await import('./rate-limit.js')

    const r = await checkRateLimit('signup:1.2.3.4', 5, 3_600_000)

    expect(appelsRpc).toHaveLength(1)
    expect(appelsRpc[0].nom).toBe('consume_rate_limit')
    expect(appelsRpc[0].args).toEqual({
      p_key: 'signup:1.2.3.4',
      p_limit: 5,
      p_window_ms: 3_600_000,
    })
    expect(r.allowed).toBe(true)
    expect(r.remaining).toBe(4)
    expect(r.durable).toBe(true)
  })

  it('refuse quand la base dit que le seau est vide', async () => {
    reponseRpc = { data: [{ allowed: false, remaining: 0, reset_at: '2026-09-09T18:00:00Z' }], error: null }
    const { checkRateLimit } = await import('./rate-limit.js')

    const r = await checkRateLimit('signup:1.2.3.4', 5, 3_600_000)
    expect(r.allowed).toBe(false)
    expect(r.durable).toBe(true)
  })

  it('retombe sur le compteur local si la base répond une erreur', async () => {
    // Refuser tout le trafic transformerait un incident de base en panne du
    // site. Le repli rend la protection d'avant, pas moins.
    reponseRpc = { data: null, error: { message: 'connexion refusée' } }
    const { checkRateLimit } = await import('./rate-limit.js')

    const premier = await checkRateLimit('repli:1.2.3.4', 2, 60_000)
    expect(premier.allowed).toBe(true)
    expect(premier.durable).toBe(false)

    await checkRateLimit('repli:1.2.3.4', 2, 60_000)
    const troisieme = await checkRateLimit('repli:1.2.3.4', 2, 60_000)
    expect(troisieme.allowed).toBe(false)
  })

  it('retombe sur le compteur local sans clé service_role', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    const { checkRateLimit } = await import('./rate-limit.js')

    const r = await checkRateLimit('sans-cle:1.2.3.4', 5, 60_000)
    expect(r.durable).toBe(false)
    expect(appelsRpc).toHaveLength(0)
  })

  it('traite une réponse malformée comme une panne, pas comme une autorisation', async () => {
    reponseRpc = { data: [{}], error: null }
    const { checkRateLimit } = await import('./rate-limit.js')

    const r = await checkRateLimit('malforme:1.2.3.4', 1, 60_000)
    expect(r.durable).toBe(false)
  })
})

describe('getClientIp', () => {
  it('prend la première adresse de x-forwarded-for', async () => {
    const { getClientIp } = await import('./rate-limit.js')
    expect(getClientIp({ headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' } })).toBe('1.2.3.4')
  })

  it('ne renvoie jamais undefined', async () => {
    const { getClientIp } = await import('./rate-limit.js')
    expect(getClientIp({ headers: {} })).toBe('unknown')
  })
})

/* -------------------------------------------------------------------------- */
/*  Garde : un appel sans await refuserait tout le trafic                     */
/* -------------------------------------------------------------------------- */

function fichiersApi(dir, acc = []) {
  for (const entree of readdirSync(dir)) {
    if (entree === 'node_modules' || entree.startsWith('.')) continue
    const chemin = join(dir, entree)
    if (statSync(chemin).isDirectory()) fichiersApi(chemin, acc)
    else if (entree.endsWith('.js') && !entree.endsWith('.test.js')) acc.push(chemin)
  }
  return acc
}

describe('garde — tout appel est attendu', () => {
  it('aucun checkRateLimit sans await', () => {
    // `checkRateLimit` est asynchrone. Sans `await`, l'appel renvoie une
    // Promise dont `.allowed` vaut `undefined`, donc `if (!rl.allowed)` est
    // toujours vrai : l'endpoint répondrait 429 à tout le monde. Le défaut
    // est silencieux à l'écriture et total à l'exécution.
    const fautifs = []
    for (const f of fichiersApi('api')) {
      const src = readFileSync(f, 'utf8')
      for (const ligne of src.split('\n')) {
        if (!ligne.includes('checkRateLimit(')) continue
        if (/function checkRateLimit|import |export /.test(ligne)) continue
        if (!ligne.includes('await checkRateLimit(')) fautifs.push(`${f} → ${ligne.trim()}`)
      }
    }
    expect(fautifs, `Appels non attendus :\n${fautifs.join('\n')}`).toEqual([])
  })
})
