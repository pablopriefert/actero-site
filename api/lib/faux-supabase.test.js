import { describe, it, expect } from 'vitest'
import { creerFauxSupabase } from './faux-supabase.js'

/**
 * Le faux Supabase des tests closers doit se comporter comme le vrai là où les
 * tests s'appuient sur lui : sinon ils restent verts pour de mauvaises raisons.
 */

describe('faux Supabase', () => {
  const faux = () => creerFauxSupabase({
    tables: {
      clients: [
        { id: 'c1', brand_name: 'Alpha', closer_id: 'k1', plan: 'pro' },
        { id: 'c2', brand_name: 'Beta', closer_id: 'k2', plan: 'free' },
        { id: 'c3', brand_name: 'Gamma', closer_id: null, plan: 'free' },
      ],
    },
    uniques: { closer_commissions: ['source_key'] },
    comptes: { 'jeton-a': { id: 'u-a', email: 'a@ex.com' } },
  })

  it('filtre et ne rend que les colonnes demandées', async () => {
    const sb = faux()
    const { data } = await sb.from('clients').select('id, brand_name').eq('closer_id', 'k1')
    expect(data).toEqual([{ id: 'c1', brand_name: 'Alpha' }])
  })

  it('is, not is, in', async () => {
    const sb = faux()
    expect((await sb.from('clients').select('id').is('closer_id', null)).data).toEqual([{ id: 'c3' }])
    expect((await sb.from('clients').select('id').not('closer_id', 'is', null)).data.map((c) => c.id)).toEqual(['c1', 'c2'])
    expect((await sb.from('clients').select('id').in('id', ['c2', 'c3'])).data.map((c) => c.id)).toEqual(['c2', 'c3'])
  })

  it('lit une clé JSON (`payload->>kind`) en texte, et filtre avant la limite', async () => {
    const sb = creerFauxSupabase({
      tables: {
        codes: [
          { id: 'a', payload: { kind: 'closer', n: 1 }, created_at: '3' },
          { id: 'b', payload: { brand_name: 'X' }, created_at: '2' },
          { id: 'c', payload: null, created_at: '1' },
        ],
      },
    })
    const tries = () => sb.from('codes').select('id').order('created_at', { ascending: false })
    expect((await tries().eq('payload->>kind', 'closer').limit(1)).data).toEqual([{ id: 'a' }])
    expect((await tries().is('payload->>kind', null).limit(1)).data).toEqual([{ id: 'b' }])
    expect((await tries().eq('payload->>n', '1')).data).toEqual([{ id: 'a' }])
  })

  it('maybeSingle : null sans ligne, erreur au-delà d’une', async () => {
    const sb = faux()
    expect((await sb.from('clients').select('id').eq('id', 'zz').maybeSingle()).data).toBeNull()
    expect((await sb.from('clients').select('id').eq('plan', 'free').maybeSingle()).error).toBeTruthy()
  })

  it('une mise à jour filtrée ne touche que ses lignes, et rend celles-ci', async () => {
    const sb = faux()
    const { data } = await sb.from('clients').update({ closer_id: 'k9' }).eq('id', 'c3').is('closer_id', null).select('id')
    expect(data).toEqual([{ id: 'c3' }])
    const rien = await sb.from('clients').update({ closer_id: 'k8' }).eq('id', 'c3').is('closer_id', null).select('id')
    expect(rien.data).toEqual([])
    expect(sb.base.clients.find((c) => c.id === 'c3').closer_id).toBe('k9')
  })

  it('une colonne unique refuse un doublon avec le code 23505', async () => {
    const sb = faux()
    expect((await sb.from('closer_commissions').insert({ source_key: 'stripe:in_1' })).error).toBeNull()
    expect((await sb.from('closer_commissions').insert({ source_key: 'stripe:in_1' })).error.code).toBe('23505')
    expect(sb.base.closer_commissions).toHaveLength(1)
  })

  it('auth : jeton inconnu refusé, adresse déjà prise refusée', async () => {
    const sb = faux()
    expect((await sb.auth.getUser('inconnu')).data.user).toBeNull()
    expect((await sb.auth.getUser('jeton-a')).data.user.id).toBe('u-a')
    expect((await sb.auth.admin.createUser({ email: 'A@ex.com', password: 'x' })).error.code).toBe('email_exists')
    expect((await sb.auth.admin.createUser({ email: 'b@ex.com', password: 'x' })).data.user.email).toBe('b@ex.com')
  })

  it('une erreur déclarée est rendue comme Supabase le fait, sans lever', async () => {
    const sb = creerFauxSupabase({ erreurs: { clients: { message: 'panne' } } })
    expect(await sb.from('clients').select('id')).toEqual({ data: null, error: { message: 'panne' } })
  })
})
