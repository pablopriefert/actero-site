import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { creerFauxSupabase, appeler } from './faux-supabase.js'
import { encryptToken, decryptToken } from './crypto.js'
import { empreinteCode, TYPE_CODE_CLOSER } from './code-verification.js'
import { STATUT_CLOSER_A_L_INSCRIPTION, nomDuCompte } from './fiche-closer.js'

/**
 * Inscription closer — spec closers, famille de tests 5 (codes d'inscription).
 *
 * Un code closer ne crée pas de client marchand ; un code marchand ne crée pas
 * de fiche closer. Et aucun chemin d'inscription n'écrit le rôle d'un compte
 * (`app_metadata`, `profiles`) : c'est ce qui rendait api/ambassador/apply.js
 * dangereux.
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
vi.mock('./welcome-email.js', () => ({ sendWelcomeEmail: async () => ({ sent: false }) }))
vi.mock('./notify-signup.js', () => ({ notifySignup: async () => {} }))
vi.mock('./lightfield.js', () => ({ pushSignupToLightfield: async () => {} }))

const { default: envoyerCode } = await import('../closer/envoyer-code.js')
const { default: verifierCode } = await import('../closer/verifier-code.js')
const { default: devenirCloser } = await import('../closer/devenir-closer.js')
const { default: verifierCodeMarchand } = await import('../auth/verify-code.js')

const EMAIL = 'nouvelle@ex.com'
const DANS_UNE_HEURE = () => new Date(Date.now() + 3600_000).toISOString()

function ligneDeCode({ id, kind, code = '123456', cree = '2026-09-17T10:00:00Z', attempts = 0 }) {
  const payload = kind === TYPE_CODE_CLOSER
    ? { kind, prenom: 'Jeanne', nom: 'Martin', password_enc: encryptToken('motdepasse-closer') }
    : { password_enc: encryptToken('motdepasse-marchand'), brand_name: 'Boutique Jeanne', shopify_url: null, referral_code: null, acquisition_source: null }
  return { id, email: EMAIL, code_hash: empreinteCode(code), payload, expires_at: DANS_UNE_HEURE(), attempts, used_at: null, created_at: cree }
}

function monde({ codes = [], comptes = {}, erreurs } = {}) {
  h.supabase = creerFauxSupabase({
    tables: { email_verification_codes: codes, closers: [], clients: [], client_users: [], client_settings: [] },
    uniques: { closers: ['user_id', 'code'] },
    comptes,
    erreurs,
  })
  return h.supabase
}

const tablesEcrites = (sb) => [...new Set(sb.journal.filter((j) => j.operation === 'insert').map((j) => j.table))].sort()
const comptesCrees = (sb) => sb.journal.filter((j) => j.operation === 'createUser')

beforeEach(() => {
  h.courriels = []
  process.env.RESEND_API_KEY = 're_test'
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  delete process.env.RESEND_API_KEY
})

describe('un code closer ne crée pas de client marchand', () => {
  it('la route marchand refuse un code closer, sans rien créer ni consommer', async () => {
    const sb = monde({ codes: [ligneDeCode({ id: 'v-closer', kind: TYPE_CODE_CLOSER })] })
    const res = await appeler(verifierCodeMarchand, { methode: 'POST', corps: { email: EMAIL, code: '123456' } })
    expect(res.statusCode).toBe(400)
    expect(comptesCrees(sb)).toEqual([])
    expect(tablesEcrites(sb)).toEqual([])
    expect(sb.base.email_verification_codes[0].used_at).toBeNull()
  })

  it('la route closer crée le compte et la fiche — et rien d’autre', async () => {
    const sb = monde({ codes: [ligneDeCode({ id: 'v-closer', kind: TYPE_CODE_CLOSER })] })
    const res = await appeler(verifierCode, { methode: 'POST', corps: { email: EMAIL, code: '123456' } })
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ ok: true })
    expect(tablesEcrites(sb)).toEqual(['closers'])
    const [{ attributs }] = comptesCrees(sb)
    expect(attributs).toEqual({ email: EMAIL, password: 'motdepasse-closer', email_confirm: true, user_metadata: { prenom: 'Jeanne', nom: 'Martin' } })
    expect(sb.base.closers).toHaveLength(1)
    expect(sb.base.closers[0]).toMatchObject({ prenom: 'Jeanne', nom: 'Martin', email: EMAIL, statut: STATUT_CLOSER_A_L_INSCRIPTION })
    expect(sb.base.closers[0].code).toMatch(/^ACT-[A-Z0-9]{5}$/)
    expect(sb.base.email_verification_codes[0].used_at).not.toBeNull()
  })
})

describe('un code marchand ne crée pas de fiche closer', () => {
  it('la route closer refuse un code marchand, sans rien créer ni compter d’essai', async () => {
    const sb = monde({ codes: [ligneDeCode({ id: 'v-marchand', kind: undefined })] })
    const res = await appeler(verifierCode, { methode: 'POST', corps: { email: EMAIL, code: '123456' } })
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toBe('code_expire')
    expect(comptesCrees(sb)).toEqual([])
    expect(tablesEcrites(sb)).toEqual([])
    expect(sb.base.email_verification_codes[0]).toMatchObject({ attempts: 0, used_at: null })
  })

  it('la route marchand, elle, crée le client — et aucune fiche closer', async () => {
    const sb = monde({ codes: [ligneDeCode({ id: 'v-marchand', kind: undefined })] })
    const res = await appeler(verifierCodeMarchand, { methode: 'POST', corps: { email: EMAIL, code: '123456' } })
    expect(res.statusCode).toBe(200)
    expect(tablesEcrites(sb)).toEqual(['client_settings', 'client_users', 'clients'])
    expect(sb.base.closers).toEqual([])
  })

  it('deux codes en attente pour la même adresse : chaque route prend le sien', async () => {
    const codes = () => [
      ligneDeCode({ id: 'v-closer', kind: TYPE_CODE_CLOSER, code: '111111', cree: '2026-09-17T10:05:00Z' }),
      ligneDeCode({ id: 'v-marchand', kind: undefined, code: '222222', cree: '2026-09-17T10:00:00Z' }),
    ]
    const marchand = monde({ codes: codes() })
    expect((await appeler(verifierCodeMarchand, { methode: 'POST', corps: { email: EMAIL, code: '222222' } })).statusCode).toBe(200)
    expect(marchand.base.closers).toEqual([])

    const closer = monde({ codes: codes() })
    expect((await appeler(verifierCode, { methode: 'POST', corps: { email: EMAIL, code: '111111' } })).statusCode).toBe(200)
    expect(closer.base.clients).toEqual([])
  })
})

describe('vérification du code closer — cas d’erreur', () => {
  it('adresse déjà utilisée : 409, et la connexion comme recours', async () => {
    const sb = monde({ codes: [ligneDeCode({ id: 'v', kind: TYPE_CODE_CLOSER })], comptes: { x: { id: 'u-marchand', email: EMAIL } } })
    const res = await appeler(verifierCode, { methode: 'POST', corps: { email: EMAIL, code: '123456' } })
    expect(res.statusCode).toBe(409)
    expect(res.body.error).toBe('compte_existant')
    expect(res.body.message).toMatch(/Devenir closer/)
    expect(sb.base.closers).toEqual([])
  })

  it('mauvais code : 400, un essai de plus', async () => {
    const sb = monde({ codes: [ligneDeCode({ id: 'v', kind: TYPE_CODE_CLOSER })] })
    const res = await appeler(verifierCode, { methode: 'POST', corps: { email: EMAIL, code: '999999' } })
    expect(res.statusCode).toBe(400)
    expect(res.body).toMatchObject({ error: 'code_incorrect', essais_restants: 4 })
    expect(sb.base.email_verification_codes[0].attempts).toBe(1)
  })

  it('trop d’essais : 429, sans comparer le code', async () => {
    monde({ codes: [ligneDeCode({ id: 'v', kind: TYPE_CODE_CLOSER, attempts: 5 })] })
    expect((await appeler(verifierCode, { methode: 'POST', corps: { email: EMAIL, code: '123456' } })).statusCode).toBe(429)
  })

  it('fiche impossible à créer : le compte orphelin est retiré', async () => {
    const sb = monde({
      codes: [ligneDeCode({ id: 'v', kind: TYPE_CODE_CLOSER })],
      erreurs: { closers: ({ operation }) => (operation === 'insert' ? { code: 'XX000', message: 'panne' } : null) },
    })
    const res = await appeler(verifierCode, { methode: 'POST', corps: { email: EMAIL, code: '123456' } })
    expect(res.statusCode).toBe(500)
    expect(sb.journal.filter((j) => j.operation === 'deleteUser')).toHaveLength(1)
  })
})

describe('POST /api/closer/envoyer-code', () => {
  const corps = { prenom: ' Jeanne ', nom: 'Martin', email: ' Nouvelle@Ex.com ', password: 'motdepasse-closer' }

  it('enregistre un code de type closer, mot de passe chiffré, et l’envoie', async () => {
    const sb = monde()
    const res = await appeler(envoyerCode, { methode: 'POST', corps })
    expect(res.statusCode).toBe(200)
    const [ligne] = sb.base.email_verification_codes
    expect(ligne.email).toBe(EMAIL)
    expect(ligne.payload).toMatchObject({ kind: 'closer', prenom: 'Jeanne', nom: 'Martin' })
    expect(ligne.payload.password_enc).toMatch(/^enc:v1:/)
    expect(JSON.stringify(ligne.payload)).not.toContain('motdepasse-closer')
    expect(decryptToken(ligne.payload.password_enc)).toBe('motdepasse-closer')
    expect(h.courriels).toHaveLength(1)
    const code = h.courriels[0].subject.slice(0, 6)
    expect(code).toMatch(/^\d{6}$/)
    expect(empreinteCode(code)).toBe(ligne.code_hash)
    expect(JSON.stringify(ligne)).not.toContain(`"${code}"`)
  })

  it('refuse un formulaire incomplet, sans rien écrire', async () => {
    for (const manque of [{ prenom: '' }, { nom: '   ' }, { email: 'pas-une-adresse' }, { password: 'court' }]) {
      const sb = monde()
      const res = await appeler(envoyerCode, { methode: 'POST', corps: { ...corps, ...manque } })
      expect(res.statusCode, JSON.stringify(manque)).toBe(400)
      expect(sb.base.email_verification_codes, JSON.stringify(manque)).toEqual([])
    }
  })

  it('sans service d’e-mail : 503, aucun code enregistré', async () => {
    delete process.env.RESEND_API_KEY
    const sb = monde()
    expect((await appeler(envoyerCode, { methode: 'POST', corps })).statusCode).toBe(503)
    expect(sb.base.email_verification_codes).toEqual([])
  })
})

describe('POST /api/closer/devenir-closer', () => {
  const GOOGLE = { id: 'u-google', email: 'Jeanne@Gmail.com', user_metadata: { full_name: 'Jeanne Martin', given_name: 'Jeanne', family_name: 'Martin' }, app_metadata: { provider: 'google' } }
  const MARCHAND = { id: 'u-marchand', email: 'boutique@ex.com', user_metadata: {}, app_metadata: {} }

  it('crée la fiche d’un compte Google, puis la rend telle quelle', async () => {
    const sb = monde({ comptes: { 'jeton-google': GOOGLE } })
    const premier = await appeler(devenirCloser, { methode: 'POST', jeton: 'jeton-google', corps: {} })
    expect(premier.statusCode).toBe(201)
    expect(premier.body.fiche).toMatchObject({ prenom: 'Jeanne', nom: 'Martin', email: 'jeanne@gmail.com', statut: 'actif', iban_masque: null, profil_complet: false })
    const second = await appeler(devenirCloser, { methode: 'POST', jeton: 'jeton-google', corps: {} })
    expect(second.statusCode).toBe(200)
    expect(sb.base.closers).toHaveLength(1)
    expect(tablesEcrites(sb)).toEqual(['closers'])
  })

  it('un marchand connecté devient closer avec le nom qu’il saisit', async () => {
    const sb = monde({ comptes: { 'jeton-marchand': MARCHAND } })
    const res = await appeler(devenirCloser, { methode: 'POST', jeton: 'jeton-marchand', corps: { prenom: 'Paul', nom: 'Durand' } })
    expect(res.statusCode).toBe(201)
    expect(sb.base.closers[0]).toMatchObject({ user_id: 'u-marchand', prenom: 'Paul', nom: 'Durand' })
    expect(sb.base.clients).toEqual([])
  })

  it('sans nom connu : 400 ; sans jeton : 401', async () => {
    monde({ comptes: { 'jeton-marchand': MARCHAND } })
    expect((await appeler(devenirCloser, { methode: 'POST', jeton: 'jeton-marchand', corps: {} })).statusCode).toBe(400)
    expect((await appeler(devenirCloser, { methode: 'POST', corps: {} })).statusCode).toBe(401)
  })

  it('la réponse ne porte jamais l’identifiant interne ni l’IBAN chiffré', async () => {
    monde({ comptes: { 'jeton-google': GOOGLE } })
    const res = await appeler(devenirCloser, { methode: 'POST', jeton: 'jeton-google', corps: {} })
    expect(res.body.fiche).not.toHaveProperty('iban_chiffre')
    expect(res.body.fiche).not.toHaveProperty('user_id')
    expect(res.body.fiche).not.toHaveProperty('id')
  })
})

describe('le nom d’un compte', () => {
  it('saisi, puis Google, puis le nom complet', () => {
    expect(nomDuCompte({ user_metadata: { prenom: 'A', nom: 'B' } })).toEqual({ prenom: 'A', nom: 'B' })
    expect(nomDuCompte({ user_metadata: { given_name: 'C', family_name: 'D' } })).toEqual({ prenom: 'C', nom: 'D' })
    expect(nomDuCompte({ user_metadata: { name: 'Marie Claire Dupont' } })).toEqual({ prenom: 'Marie', nom: 'Claire Dupont' })
    expect(nomDuCompte({ user_metadata: { name: 'Cher' } })).toEqual({ prenom: 'Cher', nom: null })
    expect(nomDuCompte({})).toEqual({ prenom: null, nom: null })
  })
})
