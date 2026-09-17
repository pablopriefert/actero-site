import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { creerFauxSupabase, appeler } from './faux-supabase.js'

/**
 * Codes à 6 chiffres envoyés par e-mail — les défenses communes aux deux
 * inscriptions, marchand (api/auth/) et closer (api/closer/).
 *
 * Six chiffres, c'est un million de possibilités : tout ce qui permet d'en
 * essayer plus que prévu (plusieurs IP, plusieurs essais simultanés, un code
 * masqué par ceux de l'autre parcours) rapproche un inconnu d'un compte créé
 * au nom d'une adresse qui n'est pas la sienne.
 */

const h = vi.hoisted(() => ({ supabase: null, courriels: [] }))

vi.mock('./sentry.js', () => ({ withSentry: (fn) => fn, captureError: () => {} }))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => new Proxy({}, { get: (_, cle) => h.supabase[cle] }),
}))
vi.mock('resend', () => ({
  Resend: function Resend() { return { emails: { send: async (courriel) => { h.courriels.push(courriel); return { id: 'e1' } } } } },
}))
// Chargés par la route marchand APRÈS la création du compte.
vi.mock('./welcome-email.js', () => ({ sendWelcomeEmail: async () => ({ sent: true }) }))
vi.mock('./notify-signup.js', () => ({ notifySignup: async () => {} }))
vi.mock('./lightfield.js', () => ({ pushSignupToLightfield: async () => {} }))

// La route marchand lit la clé Resend au chargement, pas à l'appel.
process.env.RESEND_API_KEY = 're_test'
const routes = {
  closer: {
    envoyer: (await import('../closer/envoyer-code.js')).default,
    verifier: (await import('../closer/verifier-code.js')).default,
  },
  marchand: {
    envoyer: (await import('../auth/send-verification-code.js')).default,
    verifier: (await import('../auth/verify-code.js')).default,
  },
}

const EMAIL = 'cible@ex.com'
const corpsEnvoi = {
  closer: { prenom: 'Jeanne', nom: 'Martin', email: ' Cible@Ex.com ', password: 'motdepasse-closer' },
  marchand: { email: 'Cible@Ex.com', password: 'motdepasse-marchand', brand_name: 'Boutique Jeanne' },
}

function monde({ codes = [] } = {}) {
  h.supabase = creerFauxSupabase({
    tables: { email_verification_codes: codes, closers: [], clients: [], client_users: [], client_settings: [] },
    uniques: { closers: ['user_id', 'code'] },
  })
  return h.supabase
}

/** Remplace le compteur partagé du faux (qui autorise tout) par un vrai compteur. */
function compteurPartage(sb) {
  const seaux = new Map()
  sb.rpc = async (nom, { p_key: cle, p_limit: limite }) => {
    const coups = (seaux.get(cle) ?? 0) + 1
    seaux.set(cle, coups)
    return {
      data: [{ allowed: coups <= limite, remaining: Math.max(0, limite - coups), reset_at: new Date(Date.now() + 3600_000).toISOString() }],
      error: null,
    }
  }
  return seaux
}

const lecturesDeCodes = (sb) => sb.journal.filter((j) => j.table === 'email_verification_codes' && j.operation === 'select')

beforeEach(() => {
  h.courriels = []
  process.env.RESEND_API_KEY = 're_test'
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe.each(['closer', 'marchand'])('limites par adresse — parcours %s', (parcours) => {
  it('au plus 5 codes par heure vers une même adresse, même depuis des IP différentes', async () => {
    const sb = monde()
    const seaux = compteurPartage(sb)
    const statuts = []
    for (let i = 0; i < 7; i++) {
      const res = await appeler(routes[parcours].envoyer, { methode: 'POST', corps: corpsEnvoi[parcours], ip: `198.51.100.${i}` })
      statuts.push(res.statusCode)
    }
    expect(statuts).toEqual([200, 200, 200, 200, 200, 429, 429])
    expect(h.courriels).toHaveLength(5)
    expect(sb.base.email_verification_codes).toHaveLength(5)
    // Adresse normalisée : « Cible@Ex.com » et « cible@ex.com » partagent le quota.
    expect(seaux.get(`code:${EMAIL}`)).toBe(7)
  })

  it('le refus par adresse est la réponse du refus par IP, mot pour mot', async () => {
    const parIp = monde()
    compteurPartage(parIp)
    let refusParIp
    for (let i = 0; i < 6; i++) {
      refusParIp = await appeler(routes[parcours].envoyer, {
        methode: 'POST', corps: { ...corpsEnvoi[parcours], email: `autre-${i}@ex.com` }, ip: '198.51.100.1',
      })
    }
    expect(refusParIp.statusCode).toBe(429)

    const parAdresse = monde()
    compteurPartage(parAdresse)
    let refusParAdresse
    for (let i = 0; i < 6; i++) {
      refusParAdresse = await appeler(routes[parcours].envoyer, { methode: 'POST', corps: corpsEnvoi[parcours], ip: `198.51.100.${i}` })
    }
    expect(refusParAdresse.statusCode).toBe(429)
    expect(refusParAdresse.body).toEqual(refusParIp.body)
  })

  it('au plus 10 vérifications par heure pour une même adresse, même depuis des IP différentes', async () => {
    const sb = monde()
    const seaux = compteurPartage(sb)
    const refusParIp = await (async () => {
      let res
      for (let i = 0; i < 16; i++) {
        res = await appeler(routes[parcours].verifier, { methode: 'POST', corps: { email: `x${i}@ex.com`, code: '123456' }, ip: '192.0.2.1' })
      }
      return res
    })()
    expect(refusParIp.statusCode).toBe(429)

    const lecturesAvant = lecturesDeCodes(sb).length
    const statuts = []
    let dernier
    for (let i = 0; i < 12; i++) {
      dernier = await appeler(routes[parcours].verifier, { methode: 'POST', corps: { email: ' Cible@Ex.com ', code: '123456' }, ip: `198.51.100.${i}` })
      statuts.push(dernier.statusCode)
    }
    expect(statuts.slice(0, 10).every((s) => s === 400)).toBe(true)
    expect(statuts.slice(10)).toEqual([429, 429])
    expect(dernier.body).toEqual(refusParIp.body)
    // Refusée avant toute lecture en base.
    expect(lecturesDeCodes(sb).length - lecturesAvant).toBe(10)
    expect(seaux.get(`verif:${EMAIL}`)).toBe(12)
  })
})
