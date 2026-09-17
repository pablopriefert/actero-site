import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { creerFauxSupabase, appeler } from './faux-supabase.js'
import { encryptToken, decryptToken } from './crypto.js'

/**
 * L'espace closer — spec closers, familles de tests 4 (étanchéité) et 9 (IBAN).
 *
 * Deux closers, A et B, et un marchand M. Chaque route de api/closer/ est
 * appelée par A — y compris avec l'identifiant de B glissé dans l'URL et le
 * corps — et la réponse ne doit rien contenir de B. Un marchand n'y lit rien.
 * L'IBAN n'est jamais écrit ni renvoyé en clair.
 */

const h = vi.hoisted(() => ({ supabase: null, courriels: [], envoi: null }))

vi.mock('./sentry.js', () => ({ withSentry: (fn) => fn, captureError: () => {} }))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => new Proxy({}, { get: (_, cle) => h.supabase[cle] }),
}))
// Resend 6 rend { data, error } ; `h.envoi` simule une panne.
vi.mock('resend', () => ({
  Resend: function Resend() {
    return {
      emails: {
        send: async (courriel) => {
          h.courriels.push(courriel)
          return h.envoi ? h.envoi(courriel) : { data: { id: 'e1' }, error: null }
        },
      },
    }
  },
}))

const ROUTES = {
  moi: (await import('../closer/moi.js')).default,
  clients: (await import('../closer/clients.js')).default,
  commissions: (await import('../closer/commissions.js')).default,
  profil: (await import('../closer/profil.js')).default,
}
const METHODE = { moi: 'GET', clients: 'GET', commissions: 'GET', profil: 'PATCH' }

const IBAN_A = 'FR7630006000011234567890189'
const IBAN_B = 'DE89370400440532013000'

const CLOSER_A = { id: 'k-a', user_id: 'u-a', prenom: 'Alice', nom: 'Aubert', email: 'alice@ex.com', telephone: null, siret: null, titulaire_iban: null, iban_chiffre: null, code: 'ACT-AAAAA', statut: 'actif', created_at: '2026-09-01T00:00:00Z' }
const CLOSER_B = { id: 'k-b', user_id: 'u-b', prenom: 'Bruno', nom: 'Bernard', email: 'bruno@ex.com', telephone: '0600000000', siret: '73282932000074', titulaire_iban: 'Bruno Bernard', iban_chiffre: null, code: 'ACT-BBBBB', statut: 'actif', created_at: '2026-09-02T00:00:00Z' }

function monde() {
  h.supabase = creerFauxSupabase({
    tables: {
      closers: [{ ...CLOSER_A }, { ...CLOSER_B, iban_chiffre: encryptToken(IBAN_B) }],
      clients: [
        { id: 'c-a', brand_name: 'Boutique d’Alice', plan: 'pro', billing_period: 'monthly', status: 'active', closer_id: 'k-a', closer_attribue_at: '2026-09-03T00:00:00Z', contact_email: 'contact@alice-shop.fr', stripe_customer_id: 'cus_secret_a' },
        { id: 'c-b', brand_name: 'Boutique de Bruno', plan: 'starter', billing_period: 'annual', status: 'active', closer_id: 'k-b', closer_attribue_at: '2026-09-04T00:00:00Z', contact_email: 'contact@bruno-shop.fr' },
        { id: 'c-m', brand_name: 'Boutique du marchand', plan: 'free', status: 'active', closer_id: null, owner_user_id: 'u-m' },
      ],
      closer_commissions: [
        { id: 'kc-a', closer_id: 'k-a', client_id: 'c-a', montant_centimes: 10000, plan: 'pro', formule: 'mensuel', type: 'mensuelle', statut: 'a_valider', note: 'note interne A', created_at: '2026-09-05T00:00:00Z' },
        { id: 'kc-a2', closer_id: 'k-a', client_id: 'c-a', montant_centimes: 10000, plan: 'pro', formule: 'mensuel', type: 'mensuelle', statut: 'refusee', note: 'Saisie de test\nDoublon de septembre', created_at: '2026-09-06T00:00:00Z' },
        { id: 'kc-b', closer_id: 'k-b', client_id: 'c-b', montant_centimes: 25000, plan: 'starter', formule: 'annuel', type: 'unique', statut: 'payee', note: 'note interne B', created_at: '2026-09-07T00:00:00Z' },
      ],
    },
    comptes: {
      'jeton-a': { id: 'u-a', email: 'alice@ex.com' },
      'jeton-b': { id: 'u-b', email: 'bruno@ex.com' },
      'jeton-m': { id: 'u-m', email: 'marchand@ex.com' },
    },
  })
  return h.supabase
}

/** Tout ce qui désigne B ou ses données, et ne doit jamais apparaître dans une réponse faite à A. */
const TRACES_DE_B = ['k-b', 'u-b', 'Bruno', 'bruno@ex.com', 'ACT-BBBBB', 'c-b', 'Boutique de Bruno', 'kc-b', '0600000000', '73282932000074', IBAN_B, '•••• 3000']

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  h.courriels = []
  h.envoi = null
  process.env.RESEND_API_KEY = 're_test'
})

afterEach(() => {
  delete process.env.RESEND_API_KEY
})

describe('étanchéité — un closer ne lit rien d’un autre', () => {
  it.each(Object.keys(ROUTES))('/api/closer/%s ne rend rien de B à A, même avec l’identifiant de B dans la requête', async (nom) => {
    monde()
    const res = await appeler(ROUTES[nom], {
      methode: METHODE[nom],
      jeton: 'jeton-a',
      query: { closer_id: 'k-b', id: 'k-b', user_id: 'u-b' },
      corps: nom === 'profil' ? { telephone: '0611111111', closer_id: 'k-b', id: 'k-b', user_id: 'u-b' } : { closer_id: 'k-b' },
    })
    expect(res.statusCode, JSON.stringify(res.body)).toBe(200)
    const texte = JSON.stringify(res.body)
    for (const trace of TRACES_DE_B) expect(texte, `${nom} laisse passer « ${trace} »`).not.toContain(trace)
  })

  it('A voit bien ses propres données', async () => {
    monde()
    const moi = await appeler(ROUTES.moi, { jeton: 'jeton-a' })
    expect(moi.body.fiche).toMatchObject({ prenom: 'Alice', code: 'ACT-AAAAA', profil_complet: false, iban_masque: null })
    expect(moi.body.totaux).toEqual({ a_valider: 10000, validee: 0, payee: 0, refusee: 10000, annulee: 0 })

    const clients = await appeler(ROUTES.clients, { jeton: 'jeton-a' })
    expect(clients.body.clients).toEqual([{ id: 'c-a', boutique: 'Boutique d’Alice', plan: 'pro', formule: 'mensuel', rattache_le: '2026-09-03T00:00:00Z', etat: 'actif' }])

    const commissions = await appeler(ROUTES.commissions, { jeton: 'jeton-a' })
    expect(commissions.body.commissions.map((c) => c.id)).toEqual(['kc-a2', 'kc-a'])
    expect(commissions.body.commissions[0]).toMatchObject({ boutique: 'Boutique d’Alice', statut: 'refusee', motif: 'Doublon de septembre' })
    expect(commissions.body.commissions[1].motif).toBeNull()
  })

  it('ni coordonnées ni chiffre d’affaires d’un client', async () => {
    monde()
    const texte = JSON.stringify((await appeler(ROUTES.clients, { jeton: 'jeton-a' })).body)
    expect(texte).not.toContain('contact@alice-shop.fr')
    expect(texte).not.toContain('cus_secret_a')
  })

  it('un PATCH de A ne touche que la fiche de A', async () => {
    const sb = monde()
    await appeler(ROUTES.profil, { methode: 'PATCH', jeton: 'jeton-a', corps: { telephone: '0611111111', id: 'k-b' } })
    expect(sb.base.closers.find((c) => c.id === 'k-a').telephone).toBe('0611111111')
    expect(sb.base.closers.find((c) => c.id === 'k-b').telephone).toBe('0600000000')
  })

  it.each(Object.keys(ROUTES))('un marchand ne lit rien sur /api/closer/%s (404), un anonyme non plus (401)', async (nom) => {
    monde()
    const marchand = await appeler(ROUTES[nom], { methode: METHODE[nom], jeton: 'jeton-m', corps: { telephone: '0612121212' } })
    expect(marchand.statusCode).toBe(404)
    expect(Object.keys(marchand.body).sort()).toEqual(['error', 'message'])
    const anonyme = await appeler(ROUTES[nom], { methode: METHODE[nom], corps: {} })
    expect(anonyme.statusCode).toBe(401)
  })

  it('aucune route de l’espace ne lit un identifiant de closer dans la requête', () => {
    const dossier = 'api/closer'
    for (const fichier of readdirSync(dossier).filter((f) => f.endsWith('.js'))) {
      const source = readFileSync(`${dossier}/${fichier}`, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      expect(source, fichier).not.toMatch(/req\.(query|body)[^\n]*closer_id|closer_id[^\n]*=\s*req\.(query|body)/)
    }
  })
})

describe('IBAN — jamais écrit ni renvoyé en clair', () => {
  it('enregistré chiffré, rendu masqué', async () => {
    const sb = monde()
    const res = await appeler(ROUTES.profil, {
      methode: 'PATCH',
      jeton: 'jeton-a',
      corps: { telephone: '+33 6 11 11 11 11', siret: '732 829 320 00074', titulaire_iban: 'Alice Aubert', iban: 'fr76 3000 6000 0112 3456 7890 189' },
    })
    expect(res.statusCode).toBe(200)
    const fiche = sb.base.closers.find((c) => c.id === 'k-a')
    expect(fiche.iban_chiffre).toMatch(/^enc:v1:/)
    expect(fiche.iban_chiffre).not.toContain(IBAN_A)
    expect(decryptToken(fiche.iban_chiffre)).toBe(IBAN_A)
    expect(fiche).not.toHaveProperty('iban')
    expect(res.body.fiche).toMatchObject({ iban_masque: '•••• 0189', profil_complet: true, siret: '73282932000074' })
    const texte = JSON.stringify(res.body)
    expect(texte).not.toContain(IBAN_A)
    expect(texte).not.toContain('30006000011234567890')
    expect(texte).not.toContain('enc:v1:')
  })

  it('aucune écriture ne porte l’IBAN en clair', async () => {
    const sb = monde()
    await appeler(ROUTES.profil, { methode: 'PATCH', jeton: 'jeton-a', corps: { iban: IBAN_A } })
    const ecritures = JSON.stringify(sb.journal.filter((j) => j.operation === 'update' || j.operation === 'insert'))
    expect(ecritures).not.toContain(IBAN_A)
  })

  it('/moi ne rend que la fin de l’IBAN', async () => {
    monde()
    await appeler(ROUTES.profil, { methode: 'PATCH', jeton: 'jeton-a', corps: { iban: IBAN_A } })
    const res = await appeler(ROUTES.moi, { jeton: 'jeton-a' })
    const texte = JSON.stringify(res.body)
    expect(res.body.fiche.iban_masque).toBe('•••• 0189')
    expect(texte).not.toContain(IBAN_A)
    expect(texte).not.toContain('iban_chiffre')
    expect(texte).not.toContain('enc:v1:')
  })

  it('un IBAN invalide est refusé, rien n’est écrit', async () => {
    const sb = monde()
    const res = await appeler(ROUTES.profil, { methode: 'PATCH', jeton: 'jeton-a', corps: { iban: 'FR7630006000011234567890188', telephone: '0611111111' } })
    expect(res.statusCode).toBe(400)
    expect(res.body).toMatchObject({ error: 'champs_invalides', champs: ['iban'] })
    expect(sb.journal.filter((j) => j.operation === 'update')).toEqual([])
  })

  it('un IBAN vide laisse l’IBAN enregistré en place', async () => {
    const sb = monde()
    await appeler(ROUTES.profil, { methode: 'PATCH', jeton: 'jeton-a', corps: { iban: IBAN_A } })
    await appeler(ROUTES.profil, { methode: 'PATCH', jeton: 'jeton-a', corps: { iban: '  ', telephone: '0622222222' } })
    expect(decryptToken(sb.base.closers.find((c) => c.id === 'k-a').iban_chiffre)).toBe(IBAN_A)
  })

  it('dans api/closer/, l’IBAN ne s’écrit que chiffré et ne se déchiffre jamais', () => {
    const dossier = 'api/closer'
    for (const fichier of readdirSync(dossier).filter((f) => f.endsWith('.js'))) {
      const source = readFileSync(`${dossier}/${fichier}`, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      for (const ecriture of source.matchAll(/iban_chiffre\s*=\s*([^\n]+)/g)) {
        expect(ecriture[1], fichier).toMatch(/^encryptToken\(/)
      }
      expect(source, fichier).not.toMatch(/decryptToken\([^)]*iban/)
    }
  })
})

describe('IBAN modifié — la date est posée, et le closer prévenu', () => {
  const IBAN_NOUVEAU = 'GB82WEST12345698765432'
  const AVANT = '2026-09-01T00:00:00.000Z'
  const ficheA = (sb) => sb.base.closers.find((c) => c.id === 'k-a')
  const avecIban = (sb) => Object.assign(ficheA(sb), { iban_chiffre: encryptToken(IBAN_A), iban_modifie_le: AVANT })
  const changer = (iban, autres = {}) => appeler(ROUTES.profil, { methode: 'PATCH', jeton: 'jeton-a', corps: { iban, ...autres } })

  it('un premier IBAN : date posée, closer prévenu à son adresse', async () => {
    const sb = monde()
    const res = await changer(IBAN_A)
    expect(res.statusCode).toBe(200)
    const date = ficheA(sb).iban_modifie_le
    expect(Math.abs(Date.parse(date) - Date.now())).toBeLessThan(5_000)
    expect(res.body.fiche.iban_modifie_le).toBe(date)
    expect(h.courriels).toHaveLength(1)
    expect(h.courriels[0]).toMatchObject({ from: 'Actero <contact@actero.fr>', to: 'alice@ex.com', replyTo: 'contact@actero.fr' })
    expect(h.courriels[0].html).toContain('0189')
  })

  it('un autre IBAN : nouvelle date, et l’e-mail ne montre que ses 4 derniers caractères', async () => {
    const sb = monde()
    avecIban(sb)
    const res = await changer('gb82 west 1234 5698 7654 32')
    expect(res.statusCode).toBe(200)
    expect(decryptToken(ficheA(sb).iban_chiffre)).toBe(IBAN_NOUVEAU)
    expect(Date.parse(ficheA(sb).iban_modifie_le)).toBeGreaterThan(Date.parse(AVANT))
    expect(h.courriels).toHaveLength(1)
    const { subject, html } = h.courriels[0]
    expect(subject).toMatch(/IBAN/)
    expect(html).toMatch(/modifié/)
    expect(html).toContain('contact@actero.fr')
    expect(html).toContain('5432')
    // Rien d'autre de l'IBAN : ni le nouveau, ni l'ancien.
    const texte = `${subject} ${html}`.replace(/\s+/g, '')
    for (const morceau of ['GB82', 'WEST', '1234569876', IBAN_A.slice(0, 8), '0189']) expect(texte).not.toContain(morceau)
  })

  it('le même IBAN ressaisi : ni réécriture, ni nouvelle date, ni e-mail', async () => {
    const sb = monde()
    const chiffreAvant = avecIban(sb).iban_chiffre
    const res = await changer('fr76 3000 6000 0112 3456 7890 189', { telephone: '0611111111' })
    expect(res.statusCode).toBe(200)
    expect(ficheA(sb)).toMatchObject({ iban_chiffre: chiffreAvant, iban_modifie_le: AVANT, telephone: '0611111111' })
    const [ecriture] = sb.journal.filter((j) => j.table === 'closers' && j.operation === 'update')
    expect(ecriture.charge).not.toHaveProperty('iban_chiffre')
    expect(ecriture.charge).not.toHaveProperty('iban_modifie_le')
    expect(h.courriels).toEqual([])
    expect(res.body.fiche.iban_modifie_le).toBe(AVANT)
  })

  it.each([
    ['Resend lève', () => { throw new Error('connect ECONNREFUSED pour alice@ex.com') }],
    ['Resend rend une erreur', () => ({ data: null, error: { name: 'validation_error', message: 'Invalid `to` field: alice@ex.com' } })],
    ['pas de clé Resend', null],
  ])('e-mail impossible (%s) : profil enregistré, échec journalisé sans donnée personnelle', async (_, panne) => {
    const sb = monde()
    if (panne) h.envoi = panne
    else delete process.env.RESEND_API_KEY
    const res = await changer(IBAN_A, { titulaire_iban: 'Alice Aubert' })
    expect(res.statusCode).toBe(200)
    expect(decryptToken(ficheA(sb).iban_chiffre)).toBe(IBAN_A)
    expect(ficheA(sb).iban_modifie_le).not.toBeNull()
    expect(res.body.fiche).toMatchObject({ iban_masque: '•••• 0189', titulaire_iban: 'Alice Aubert' })
    const journal = console.error.mock.calls.map((args) => args.join(' ')).join('\n')
    expect(journal).toMatch(/IBAN/)
    for (const personnel of ['alice', 'Alice', 'Aubert', IBAN_A, '0189']) expect(journal).not.toContain(personnel)
  })

  it('/moi rend la date du changement, jamais l’IBAN', async () => {
    const sb = monde()
    avecIban(sb)
    const res = await appeler(ROUTES.moi, { jeton: 'jeton-a' })
    expect(res.body.fiche.iban_modifie_le).toBe(AVANT)
    expect(JSON.stringify(res.body)).not.toContain(IBAN_A)
  })
})
