import crypto from 'node:crypto'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { creerFauxSupabase, appeler } from './faux-supabase.js'
import { encryptToken } from './crypto.js'
import { empreinteCode, codeCorrespond, TYPE_CODE_CLOSER, ESSAIS_MAX } from './code-verification.js'

/**
 * Codes à 6 chiffres envoyés par e-mail — les défenses communes aux deux
 * inscriptions, marchand (api/auth/) et closer (api/closer/).
 *
 * Six chiffres, c'est un million de possibilités : tout ce qui permet d'en
 * essayer plus que prévu (plusieurs IP, plusieurs essais simultanés, un code
 * masqué par ceux de l'autre parcours) rapproche un inconnu d'un compte créé
 * au nom d'une adresse qui n'est pas la sienne.
 */

const h = vi.hoisted(() => ({ supabase: null, courriels: [], resend: null }))

vi.mock('./sentry.js', () => ({ withSentry: (fn) => fn, captureError: () => {} }))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => new Proxy({}, { get: (_, cle) => h.supabase[cle] }),
}))
vi.mock('resend', () => ({
  Resend: function Resend() {
    return {
      emails: {
        send: async (courriel) => {
          // Resend 6 rend `{ data, error }` sans lever ; une coupure réseau, elle, lève.
          if (h.resend === 'exception') throw new Error('coupure réseau')
          if (h.resend === 'erreur') return { data: null, error: { name: 'validation_error', message: 'adresse refusée' } }
          h.courriels.push(courriel)
          return { data: { id: 'e1' }, error: null }
        },
      },
    }
  },
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

function monde({ codes = [], erreurs, comptes } = {}) {
  h.supabase = creerFauxSupabase({
    tables: { email_verification_codes: codes, closers: [], clients: [], client_users: [], client_settings: [] },
    uniques: { closers: ['user_id', 'code'] },
    erreurs,
    comptes,
  })
  return h.supabase
}

/** La réponse d'un mauvais code, sur chaque parcours, quand `lu` essais étaient déjà comptés. */
const echecHabituel = (parcours, lu = 0) => (parcours === 'closer'
  ? { error: 'code_incorrect', message: 'Code incorrect.', essais_restants: ESSAIS_MAX - lu - 1 }
  : { error: 'Code incorrect.', attempts_left: ESSAIS_MAX - lu - 1 })

const comptesCrees = (sb) => sb.journal.filter((j) => j.operation === 'createUser')

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
  h.resend = null
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
    // (Le compteur de comparaisons des tests « atomique » ci-dessous repose sur cet appel.)
    monde({ codes: [ligneDeCode({ id: 'v', parcours })] })
    const espion = vi.spyOn(crypto, 'timingSafeEqual')
    const res = await appeler(routes[parcours].verifier, { methode: 'POST', corps: { email: EMAIL, code: '999999' } })
    expect(res.statusCode).toBe(400)
    expect(espion).toHaveBeenCalledTimes(1)
  })
})

describe.each(['closer', 'marchand'])('compteur d’essais atomique — parcours %s', (parcours) => {
  const verifier = (code, i = 0) => appeler(routes[parcours].verifier, {
    methode: 'POST', corps: { email: EMAIL, code }, ip: `198.51.100.${i}`,
  })

  it('des vérifications simultanées ne comparent jamais plus de codes que le plafond', async () => {
    const sb = monde({ codes: [ligneDeCode({ id: 'v', parcours, code: '123456' })] })
    const comparaisons = vi.spyOn(crypto, 'timingSafeEqual')
    // Huit vagues de dix essais simultanés, tous faux : 80 codes tentés.
    for (let vague = 0; vague < 8; vague++) {
      await Promise.all(Array.from({ length: 10 }, (_, i) => verifier(String(200000 + vague * 10 + i), i)))
    }
    expect(comparaisons.mock.calls.length).toBeGreaterThan(0)
    expect(comparaisons.mock.calls.length).toBeLessThanOrEqual(ESSAIS_MAX)
    expect(sb.base.email_verification_codes[0].attempts).toBe(ESSAIS_MAX)
  })

  it('un essai devancé par un autre reçoit la réponse d’échec habituelle — et un seul compte naît', async () => {
    const sb = monde({ codes: [ligneDeCode({ id: 'v', parcours, code: '123456' })] })
    const reponses = await Promise.all([0, 1, 2].map((i) => verifier('123456', i)))
    expect(reponses.map((r) => r.statusCode)).toEqual([200, 400, 400])
    expect(reponses[1].body).toEqual(echecHabituel(parcours))
    expect(reponses[2].body).toEqual(echecHabituel(parcours))
    expect(comptesCrees(sb)).toHaveLength(1)
  })

  it('un code consommé entre la comparaison et l’écriture ne crée pas de compte', async () => {
    const sb = monde({
      codes: [ligneDeCode({ id: 'v', parcours, code: '123456' })],
      erreurs: {
        // Juste avant que la route marque le code utilisé, une autre requête vient de le faire.
        email_verification_codes: ({ operation, charge }) => {
          if (operation === 'update' && charge?.used_at) sb.base.email_verification_codes[0].used_at ??= '2026-09-17T10:00:00Z'
          return null
        },
      },
    })
    const res = await verifier('123456')
    expect(res.statusCode).toBe(400)
    expect(comptesCrees(sb)).toEqual([])
  })
})

describe.each(['closer', 'marchand'])('compteur d’essais absent ou NULL — parcours %s', (parcours) => {
  // Les routes d'envoi n'écrivent pas `attempts` : la valeur vient de la base.
  it.each([['NULL', null], ['absent', undefined]])('compteur %s : le premier essai est compté, puis le bon code passe', async (_, attempts) => {
    const ligne = ligneDeCode({ id: 'v', parcours })
    if (attempts === undefined) delete ligne.attempts
    else ligne.attempts = attempts
    const sb = monde({ codes: [ligne] })

    const faux = await appeler(routes[parcours].verifier, { methode: 'POST', corps: { email: EMAIL, code: '999999' } })
    expect(faux.body).toEqual(echecHabituel(parcours))
    expect(sb.base.email_verification_codes[0].attempts).toBe(1)
    // PostgREST ne compare pas à NULL avec `eq` : c'est `is`.
    const [compteur] = sb.journal.filter((j) => j.operation === 'update' && 'attempts' in j.charge)
    expect(compteur.filtres).toContainEqual(['is', 'attempts', null])

    const bon = await appeler(routes[parcours].verifier, { methode: 'POST', corps: { email: EMAIL, code: '123456' } })
    expect(bon.statusCode).toBe(200)
  })
})

describe.each(['closer', 'marchand'])('le mot de passe chiffré ne survit pas au code — parcours %s', (parcours) => {
  const MOT_DE_PASSE = parcours === 'closer' ? 'motdepasse-closer' : 'motdepasse-marchand'
  const RESTE = parcours === 'closer'
    ? { kind: TYPE_CODE_CLOSER, prenom: 'Jeanne', nom: 'Martin' }
    : { brand_name: 'Boutique Jeanne', shopify_url: null, referral_code: null, acquisition_source: null }
  const ecrituresDUsage = (sb) => sb.journal.filter((j) => j.table === 'email_verification_codes' && j.operation === 'update' && j.charge.used_at)

  it('password_enc quitte le payload dans l’écriture qui marque le code utilisé', async () => {
    const sb = monde({ codes: [ligneDeCode({ id: 'v', parcours })] })
    const res = await appeler(routes[parcours].verifier, { methode: 'POST', corps: { email: EMAIL, code: '123456' } })
    expect(res.statusCode).toBe(200)
    const [ecriture] = ecrituresDUsage(sb)
    expect(ecriture.charge).toEqual({ used_at: expect.any(String), payload: RESTE })
    expect(sb.base.email_verification_codes[0].payload).toEqual(RESTE)
    // Le compte a bien reçu le mot de passe, lu avant l'écriture.
    expect(comptesCrees(sb)[0].attributs.password).toBe(MOT_DE_PASSE)
  })

  it('même quand la création du compte échoue ensuite', async () => {
    const sb = monde({ codes: [ligneDeCode({ id: 'v', parcours })], comptes: { x: { id: 'u-existant', email: EMAIL } } })
    const res = await appeler(routes[parcours].verifier, { methode: 'POST', corps: { email: EMAIL, code: '123456' } })
    expect(res.statusCode).toBe(409)
    expect(sb.base.email_verification_codes[0].payload).toEqual(RESTE)
    expect(JSON.stringify(sb.base.email_verification_codes)).not.toContain('enc:v1:')
  })

  it('un mauvais code laisse le payload intact', async () => {
    const sb = monde({ codes: [ligneDeCode({ id: 'v', parcours })] })
    await appeler(routes[parcours].verifier, { methode: 'POST', corps: { email: EMAIL, code: '999999' } })
    expect(sb.base.email_verification_codes[0].payload.password_enc).toMatch(/^enc:v1:/)
  })
})

describe.each(['closer', 'marchand'])('journaux sans adresse e-mail — parcours %s', (parcours) => {
  const journaux = () => [console.log, console.warn, console.error]
    .flatMap((f) => f.mock.calls)
    .map((args) => args.map((a) => (a instanceof Error ? `${a.message} ${a.stack}` : typeof a === 'string' ? a : JSON.stringify(a))).join(' '))
  const panne = { code: 'XX000', message: 'panne' }
  const scenarios = {
    'compte créé': { statut: 200 },
    'adresse déjà prise': { statut: 409, comptes: { x: { id: 'u-existant', email: EMAIL } } },
    'écriture impossible après le compte': {
      statut: 500,
      erreurs: parcours === 'closer'
        ? { closers: ({ operation }) => (operation === 'insert' ? panne : null) }
        : { clients: ({ operation }) => (operation === 'insert' ? panne : null) },
    },
  }

  it.each(Object.keys(scenarios))('%s : ni l’envoi ni la vérification n’écrivent l’adresse', async (scenario) => {
    const { statut, ...options } = scenarios[scenario]
    monde(options)
    expect((await appeler(routes[parcours].envoyer, { methode: 'POST', corps: corpsEnvoi[parcours] })).statusCode).toBe(200)
    const code = h.courriels[0].subject.slice(0, 6)
    const res = await appeler(routes[parcours].verifier, { methode: 'POST', corps: { email: EMAIL, code } })
    expect(res.statusCode).toBe(statut)
    // L'e-mail de bienvenue du parcours marchand part sans être attendu.
    await new Promise((r) => setTimeout(r, 0))
    expect(journaux().filter((ligne) => /cible@ex\.com/i.test(ligne))).toEqual([])
  })
})

describe('le mot de passe en clair d’un ancien code marchand ne survit pas non plus', () => {
  it('payload.password est retiré avec used_at', async () => {
    const ancien = ligneDeCode({ id: 'v', parcours: 'marchand' })
    delete ancien.payload.password_enc
    ancien.payload.password = 'ancien-motdepasse'
    const sb = monde({ codes: [ancien] })
    const res = await appeler(routes.marchand.verifier, { methode: 'POST', corps: { email: EMAIL, code: '123456' } })
    expect(res.statusCode).toBe(200)
    expect(comptesCrees(sb)[0].attributs.password).toBe('ancien-motdepasse')
    expect(sb.base.email_verification_codes[0].payload).not.toHaveProperty('password')
  })
})

describe.each(['closer', 'marchand'])('un e-mail que Resend n’a pas envoyé n’est pas annoncé comme parti — parcours %s', (parcours) => {
  it.each(['erreur', 'exception'])('Resend rend une %s : 502, jamais « code envoyé »', async (mode) => {
    monde()
    h.resend = mode
    const res = await appeler(routes[parcours].envoyer, { methode: 'POST', corps: corpsEnvoi[parcours] })
    expect(res.statusCode).toBe(502)
    expect(res.body.ok ?? res.body.success).toBeUndefined()
    expect(h.courriels).toHaveLength(0)
  })

  it('le journal ne cite pas l’adresse', async () => {
    monde()
    h.resend = 'erreur'
    await appeler(routes[parcours].envoyer, { methode: 'POST', corps: corpsEnvoi[parcours] })
    const lignes = console.error.mock.calls.flat().map(String).join(' ')
    expect(lignes).not.toMatch(/ex\.com/i)
  })
})
