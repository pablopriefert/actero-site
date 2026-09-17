import crypto from 'node:crypto'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { creerFauxSupabase, appeler } from './faux-supabase.js'
import { encryptToken } from './crypto.js'
import { empreinteCode, codeCorrespond, TYPE_CODE_CLOSER } from './code-verification.js'

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

const DANS_UNE_HEURE = () => new Date(Date.now() + 3600_000).toISOString()

function ligneDeCode({ id, parcours, code = '123456', cree = '2026-09-17T10:00:00Z', attempts = 0 }) {
  const payload = parcours === 'closer'
    ? { kind: TYPE_CODE_CLOSER, prenom: 'Jeanne', nom: 'Martin', password_enc: encryptToken('motdepasse-closer') }
    : { password_enc: encryptToken('motdepasse-marchand'), brand_name: 'Boutique Jeanne', shopify_url: null, referral_code: null, acquisition_source: null }
  return { id, email: EMAIL, code_hash: empreinteCode(code), payload, expires_at: DANS_UNE_HEURE(), attempts, used_at: null, created_at: cree }
}

const autre = (parcours) => (parcours === 'closer' ? 'marchand' : 'closer')

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

describe.each(['closer', 'marchand'])('le type du code est filtré par la base — parcours %s', (parcours) => {
  it('cinq codes plus récents de l’autre parcours ne masquent pas le bon', async () => {
    const sb = monde({
      codes: [
        ligneDeCode({ id: 'bon', parcours, code: '654321', cree: '2026-09-17T10:00:00Z' }),
        ...[1, 2, 3, 4, 5].map((i) => ligneDeCode({ id: `autre-${i}`, parcours: autre(parcours), code: '111111', cree: `2026-09-17T10:0${i}:00Z` })),
      ],
    })
    const res = await appeler(routes[parcours].verifier, { methode: 'POST', corps: { email: EMAIL, code: '654321' } })
    expect(res.statusCode).toBe(200)
    expect(sb.base.email_verification_codes.find((l) => l.id === 'bon').used_at).not.toBeNull()
    expect(sb.base.email_verification_codes.filter((l) => l.id !== 'bon').every((l) => l.used_at === null && l.attempts === 0)).toBe(true)
  })

  it('le filtre est dans la requête, pas dans le code qui lit sa réponse', async () => {
    const sb = monde({ codes: [ligneDeCode({ id: 'bon', parcours })] })
    await appeler(routes[parcours].verifier, { methode: 'POST', corps: { email: EMAIL, code: '123456' } })
    const [lecture] = lecturesDeCodes(sb)
    const filtreType = lecture.filtres.find(([, colonne]) => colonne === 'payload->>kind')
    // Closer : le type vaut « closer ». Marchand : pas de type — ces codes n'en ont jamais eu.
    expect(filtreType).toEqual(parcours === 'closer' ? ['eq', 'payload->>kind', TYPE_CODE_CLOSER] : ['is', 'payload->>kind', null])
  })

  it('un code de l’autre parcours reste refusé, sans essai compté', async () => {
    const sb = monde({ codes: [ligneDeCode({ id: 'autre', parcours: autre(parcours) })] })
    const res = await appeler(routes[parcours].verifier, { methode: 'POST', corps: { email: EMAIL, code: '123456' } })
    expect(res.statusCode).toBe(400)
    expect(sb.base.email_verification_codes[0]).toMatchObject({ attempts: 0, used_at: null })
    expect(sb.journal.filter((j) => j.operation === 'createUser')).toEqual([])
  })
})

describe('comparaison du code en temps constant', () => {
  it('compare les empreintes avec crypto.timingSafeEqual, sur des tampons de même longueur', () => {
    const espion = vi.spyOn(crypto, 'timingSafeEqual')
    expect(codeCorrespond('123456', empreinteCode('123456'))).toBe(true)
    expect(codeCorrespond('123457', empreinteCode('123456'))).toBe(false)
    expect(espion).toHaveBeenCalledTimes(2)
    for (const [a, b] of espion.mock.calls) expect(a.length).toBe(b.length)
  })

  it('une empreinte de longueur différente vaut un échec, sans lever', () => {
    const espion = vi.spyOn(crypto, 'timingSafeEqual')
    for (const empreinte of ['abcd', '', null, undefined, `${empreinteCode('123456')}00`]) {
      expect(codeCorrespond('123456', empreinte), String(empreinte)).toBe(false)
    }
    expect(espion).not.toHaveBeenCalled()
  })

  it.each(['closer', 'marchand'])('la route %s compare en temps constant', async (parcours) => {
    monde({ codes: [ligneDeCode({ id: 'v', parcours })] })
    const espion = vi.spyOn(crypto, 'timingSafeEqual')
    const res = await appeler(routes[parcours].verifier, { methode: 'POST', corps: { email: EMAIL, code: '999999' } })
    expect(res.statusCode).toBe(400)
    expect(espion).toHaveBeenCalledTimes(1)
  })
})
