import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * La file de relecture du moteur est réservée à Actero.
 *
 * CE QUE CE FICHIER EXISTE POUR ARRÊTER — 14 septembre 2026
 *
 * `api/engine/reviews.js` vérifiait seulement qu'un jeton était valide. Or
 * n'importe qui obtient un jeton en dix secondes : inscription Google, compte
 * créé côté navigateur. Ce compte pouvait alors :
 *
 *   GET   lire les 50 dernières réponses en attente de relecture, TOUS
 *         marchands confondus, avec l'événement d'origine (message du client,
 *         coordonnées) et l'exécution du moteur ;
 *
 *   POST  « approuver en modifiant » n'importe laquelle : `modified_response`
 *         part tel quel dans `runExecutor`, qui l'envoie au client final par le
 *         canal du marchand — son adresse de support, sa bulle. Un inconnu
 *         pouvait écrire au client d'une boutique, au nom de cette boutique.
 *
 * Signalé par l'audit multi-agents du 11 septembre, confirmé à la lecture le
 * 14. Seul l'écran admin `AdminManualReviewView` appelle cette route : la
 * réserver aux admins ne retire rien à personne.
 */

const journal = vi.hoisted(() => ({ lectures: [], ecritures: [], executions: [], compte: null }))

vi.mock('@supabase/supabase-js', () => {
  function requete(table) {
    const q = {
      select: () => { journal.lectures.push(table); return q },
      eq: () => q,
      order: () => q,
      limit: () => q,
      maybeSingle: async () => ({ data: null, error: null }),
      single: async () => ({
        data: {
          id: 'relecture-autre-marchand',
          client_id: 'client-autre-marchand',
          event_id: 'evenement-1',
          engine_events: { id: 'evenement-1', normalized: {} },
          proposed_action: { ai_response: 'réponse prévue', action_plan: ['send_reply'] },
        },
        error: null,
      }),
      update: (valeur) => { journal.ecritures.push({ table, valeur }); return q },
      then: (resoudre) => resoudre({ data: [{ id: 'relecture-autre-marchand' }], error: null }),
    }
    return q
  }
  return {
    createClient: () => ({
      auth: { getUser: async () => ({ data: { user: journal.compte }, error: null }) },
      from: (table) => requete(table),
    }),
  }
})

vi.mock('./executor.js', () => ({
  runExecutor: async (_supabase, args) => {
    journal.executions.push(args)
    return { steps: [] }
  },
}))

vi.mock('./logger.js', () => ({ logRun: async () => {} }))

const ENV = { ...process.env }

beforeEach(() => {
  vi.resetModules()
  journal.lectures = []
  journal.ecritures = []
  journal.executions = []
  process.env.SUPABASE_URL = 'https://exemple.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-test'
})

afterEach(() => {
  process.env = { ...ENV }
})

function reponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this },
    json(corps) { this.body = corps; return this },
    setHeader() {},
    end() { return this },
  }
}

/** Un compte ordinaire : inscrit par Google, aucun rôle. */
const INCONNU = { id: 'compte-inscrit-par-google', app_metadata: {}, user_metadata: {} }
const ADMIN = { id: 'compte-admin', app_metadata: { role: 'admin' }, user_metadata: {} }

describe('/api/engine/reviews — réservée aux admins', () => {
  it('un compte ordinaire ne lit pas la file de relecture des autres marchands', async () => {
    journal.compte = INCONNU
    const { default: handler } = await import('./reviews.js')
    const res = reponse()

    await handler({ method: 'GET', headers: { authorization: 'Bearer jeton-valide' }, query: {} }, res)

    expect(res.statusCode, 'un compte sans rôle admin obtient encore la file').toBe(403)
    expect(
      journal.lectures,
      'la route lit encore engine_reviews_v2 pour un compte qui n’est pas admin',
    ).not.toContain('engine_reviews_v2')
  })

  it('un compte ordinaire ne fait rien envoyer au client d’un autre marchand', async () => {
    journal.compte = INCONNU
    const { default: handler } = await import('./reviews.js')
    const res = reponse()

    await handler(
      {
        method: 'POST',
        headers: { authorization: 'Bearer jeton-valide' },
        body: {
          review_id: 'relecture-autre-marchand',
          action: 'modified',
          modified_response: 'Votre commande est bloquée, réglez ici : https://exemple.invalid',
        },
      },
      res,
    )

    expect(res.statusCode, 'un compte sans rôle admin peut encore trancher une relecture').toBe(403)
    expect(
      journal.executions,
      'le texte d’un inconnu part encore au client final par le canal du marchand',
    ).toEqual([])
    expect(journal.ecritures, 'la relecture d’un autre marchand est encore modifiée').toEqual([])
  })

  it('l’admin garde sa file de relecture', async () => {
    journal.compte = ADMIN
    const { default: handler } = await import('./reviews.js')
    const res = reponse()

    await handler({ method: 'GET', headers: { authorization: 'Bearer jeton-admin' }, query: {} }, res)

    expect(res.statusCode).toBe(200)
    expect(res.body.reviews).toHaveLength(1)
  })
})
