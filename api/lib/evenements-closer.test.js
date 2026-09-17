import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { creerFauxSupabase } from './faux-supabase.js'
import { enregistrerEvenementCloser, filtrerDetails } from './evenements-closer.js'
import { TYPES_EVENEMENT } from './familles-evenements.js'

/**
 * L'écriture du fil d'activité des closers.
 *
 * Ce qui est protégé : un montant ou une adresse n'entre jamais dans le fil,
 * un client sans closer n'y laisse rien, un doublon n'écrit rien, et surtout
 * une panne ne lève pas — le paiement ou le webhook qui l'appelle continue.
 */

const monde = ({ clients = [], erreurs } = {}) => creerFauxSupabase({
  tables: { clients, closer_evenements: [] },
  uniques: { closer_evenements: ['source_key'] },
  erreurs,
})

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('filtrerDetails', () => {
  it('ne garde que plan, formule, plateforme et partiel, avec des valeurs connues', () => {
    expect(filtrerDetails({
      plan: 'pro', formule: 'annuel', plateforme: 'stripe', partiel: true,
      montant: 39900, email: 'client@boutique.fr', plan_libre: 'x',
    })).toEqual({ plan: 'pro', formule: 'annuel', plateforme: 'stripe', partiel: true })
  })

  it('écarte une valeur inconnue et tout ce qui n’est pas un objet', () => {
    expect(filtrerDetails({ plan: 'platine', formule: 'hebdo', plateforme: 'amazon', partiel: 'oui' })).toEqual({})
    expect(filtrerDetails(null)).toEqual({})
    expect(filtrerDetails(['pro'])).toEqual({})
  })
})

describe('enregistrerEvenementCloser', () => {
  it('écrit l’étape d’un client rattaché, avec le closer lu sur le client', async () => {
    const sb = monde({ clients: [{ id: 'c1', closer_id: 'k1' }] })
    const r = await enregistrerEvenementCloser(sb, {
      clientId: 'c1', type: 'paiement_ouvert', details: { plan: 'pro', formule: 'annuel', montant: 39900 }, sourceKey: 'paiement_ouvert:cs_1',
    })
    expect(r).toEqual({ enregistre: true })
    expect(sb.base.closer_evenements).toHaveLength(1)
    expect(sb.base.closer_evenements[0]).toMatchObject({
      closer_id: 'k1', client_id: 'c1', type: 'paiement_ouvert', details: { plan: 'pro', formule: 'annuel' }, source_key: 'paiement_ouvert:cs_1',
    })
    expect(JSON.stringify(sb.base.closer_evenements)).not.toContain('39900')
  })

  it('un client sans closer ne laisse rien', async () => {
    const sb = monde({ clients: [{ id: 'c1', closer_id: null }] })
    expect(await enregistrerEvenementCloser(sb, { clientId: 'c1', type: 'inscription', sourceKey: 'inscription:c1' }))
      .toEqual({ enregistre: false, raison: 'sans_closer' })
    expect(sb.base.closer_evenements).toHaveLength(0)
  })

  it('une ouverture de lien s’écrit pour le closer du code, sans client', async () => {
    const sb = monde()
    const r = await enregistrerEvenementCloser(sb, {
      closerId: 'k1', visiteId: 'v1', type: 'lien_ouvert', sourceKey: 'clic:ACT-AB12C:v1:2026-09-17',
    })
    expect(r).toEqual({ enregistre: true })
    expect(sb.base.closer_evenements[0]).toMatchObject({ closer_id: 'k1', client_id: null, visite_id: 'v1', type: 'lien_ouvert' })
    expect(sb.journal.some((j) => j.table === 'clients')).toBe(false)
  })

  it('un doublon n’écrit rien et le dit', async () => {
    const sb = monde({ clients: [{ id: 'c1', closer_id: 'k1' }] })
    const etape = { clientId: 'c1', type: 'abonnement_demarre', sourceKey: 'stripe:evt_1' }
    await enregistrerEvenementCloser(sb, etape)
    expect(await enregistrerEvenementCloser(sb, etape)).toEqual({ enregistre: false, raison: 'deja_enregistre' })
    expect(sb.base.closer_evenements).toHaveLength(1)
  })

  it.each([
    ['la lecture du client', { clients: { message: 'panne' } }],
    ['l’écriture du fil', { closer_evenements: { code: '08006', message: 'panne' } }],
  ])('une panne de %s ne lève pas, et le journal ne cite que des identifiants', async (_, erreurs) => {
    const sb = monde({ clients: [{ id: 'c1', closer_id: 'k1', contact_email: 'client@boutique.fr' }], erreurs })
    const r = await enregistrerEvenementCloser(sb, { clientId: 'c1', type: 'paiement_echoue', sourceKey: 'stripe:evt_2' })
    expect(r).toEqual({ enregistre: false, raison: 'erreur' })
    const journal = console.warn.mock.calls.flat().map((x) => JSON.stringify(x)).join(' ')
    expect(journal).toContain('c1')
    expect(journal).not.toContain('@')
  })

  it('un type inconnu ou une clé absente n’écrivent rien', async () => {
    const sb = monde({ clients: [{ id: 'c1', closer_id: 'k1' }] })
    expect(await enregistrerEvenementCloser(sb, { clientId: 'c1', type: 'achat', sourceKey: 'x' }))
      .toEqual({ enregistre: false, raison: 'type_inconnu' })
    expect(await enregistrerEvenementCloser(sb, { clientId: 'c1', type: 'inscription' }))
      .toEqual({ enregistre: false, raison: 'cle_manquante' })
    expect(sb.base.closer_evenements).toHaveLength(0)
  })

  it('la date d’un événement Stripe (en secondes) devient une date ISO', async () => {
    const sb = monde({ clients: [{ id: 'c1', closer_id: 'k1' }] })
    await enregistrerEvenementCloser(sb, { clientId: 'c1', type: 'renouvellement_paye', sourceKey: 'stripe:evt_3', survenuLe: 1789660800 })
    expect(sb.base.closer_evenements[0].survenu_le).toBe('2026-09-17T16:00:00.000Z')
  })

  it('connaît tous les types de la spec', () => {
    expect(TYPES_EVENEMENT).toHaveLength(17)
  })
})
