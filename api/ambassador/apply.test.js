import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * La candidature ambassadeur publique est fermée.
 *
 * CE QUE CE FICHIER EXISTE POUR ARRÊTER — 14 septembre 2026
 *
 * `POST /api/ambassador/apply` ne demandait aucun compte. Pour n'importe quelle
 * adresse e-mail reçue, la route :
 *
 *   1. retrouvait le compte existant et remplaçait son rôle par « ambassador »,
 *      dans Supabase Auth (`app_metadata.role`) ET dans `profiles.role` ;
 *   2. créait un compte pour une adresse inconnue ;
 *   3. envoyait à cette adresse un e-mail signé Actero, avec un code
 *      ambassadeur déjà actif.
 *
 * Le premier point suffisait à retirer l'accès admin : `api/lib/admin-auth.js`
 * reconnaît un admin à `app_metadata.role`, à `profiles.role` ou à une ligne
 * `admin_users`. En production, le seul compte admin tenait par les deux
 * premiers — et n'avait aucune ligne `admin_users`. Une requête anonyme portant
 * son adresse l'enfermait dehors.
 *
 * Aucune page n'appelait plus cette route depuis la suppression de l'espace
 * ambassadeurs, et aucune candidature n'a jamais été enregistrée : la faille
 * n'a pas servi. Elle attendait.
 */

const journal = vi.hoisted(() => ({ requetes: [], fetchs: [] }))

vi.mock('@supabase/supabase-js', () => {
  function requete(table) {
    const q = {
      select: () => q,
      eq: () => q,
      maybeSingle: async () => ({ data: null, error: null }),
      single: async () => ({ data: { id: 'ambassadeur-cree' }, error: null }),
      insert: (valeur) => { journal.requetes.push({ table, op: 'insert', valeur }); return q },
      upsert: async (valeur) => { journal.requetes.push({ table, op: 'upsert', valeur }); return { data: null, error: null } },
    }
    return q
  }
  return {
    createClient: () => ({
      from: (table) => requete(table),
      rpc: async () => ({ data: [{ allowed: true, remaining: 4, reset_at: new Date().toISOString() }], error: null }),
      auth: {
        admin: {
          createUser: async () => { journal.requetes.push({ op: 'createUser' }); return { data: { user: { id: 'compte-cree' } }, error: null } },
          generateLink: async () => { journal.requetes.push({ op: 'generateLink' }); return { data: {} } },
        },
      },
    }),
  }
})

const ENV = { ...process.env }
const FETCH = globalThis.fetch

beforeEach(() => {
  vi.resetModules()
  journal.requetes = []
  journal.fetchs = []
  process.env.SUPABASE_URL = 'https://exemple.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-test'
  process.env.RESEND_API_KEY = 'resend-de-test'

  // Le compte visé existe déjà : c'est exactement le cas du compte admin.
  globalThis.fetch = vi.fn(async (url, options = {}) => {
    journal.fetchs.push({ url: String(url), method: options.method || 'GET' })
    if (String(url).includes('/auth/v1/admin/users?')) {
      return { ok: true, json: async () => ({ users: [{ id: 'compte-admin', email: 'admin@actero.fr' }] }) }
    }
    return { ok: true, json: async () => ({}) }
  })
})

afterEach(() => {
  process.env = { ...ENV }
  globalThis.fetch = FETCH
})

function reponse() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    setHeader(nom, valeur) { this.headers[nom] = valeur },
    status(code) { this.statusCode = code; return this },
    json(corps) { this.body = corps; return this },
    end() { return this },
  }
}

describe('POST /api/ambassador/apply — fermée', () => {
  it('une requête anonyme portant l’adresse d’un compte existant ne touche à rien', async () => {
    const { default: handler } = await import('./apply.js')
    const res = reponse()

    await handler(
      {
        method: 'POST',
        headers: { 'x-forwarded-for': '203.0.113.7' },
        body: { first_name: 'Quel', last_name: 'Conque', email: 'admin@actero.fr' },
      },
      res,
    )

    expect(res.statusCode, 'la route répond encore autre chose que « fermée »').toBe(410)

    const ecrituresDeRole = journal.fetchs.filter((f) => f.url.includes('/auth/v1/admin/users'))
    expect(
      ecrituresDeRole,
      'la route interroge ou modifie encore les comptes Supabase Auth : un anonyme '
      + 'peut réécrire le rôle de n’importe quel compte, admin compris',
    ).toEqual([])

    expect(
      journal.requetes,
      'la route écrit encore en base ou crée des comptes pour une adresse reçue '
      + 'd’un inconnu',
    ).toEqual([])
  })
})
