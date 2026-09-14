import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * ACT-25 — révoquer chez le fournisseur avant d'effacer.
 *
 * Supprimer notre copie d'un secret nous empêche de nous en servir. Ça
 * n'annule pas l'autorisation côté fournisseur : le marchand continuerait de
 * voir Actero dans ses applications connectées Slack ou Zendesk, et l'app
 * resterait installée sur sa boutique Shopify.
 *
 * Le mode de panne à éviter n'est pas l'échec — c'est le **faux succès**. Un
 * rapport qui annonce « révoqué » alors que rien ne l'a été est pire que pas
 * de rapport : personne ne va vérifier.
 *
 * Slack en est l'exemple parfait : il répond **HTTP 200 même quand il
 * refuse**, et c'est le champ `ok` du corps qui fait foi. Lire le seul code
 * HTTP produirait exactement ce faux succès.
 */

const ENV = { ...process.env }
let appelsFetch = []
let reponses = {}

function stubSupabase(integrations, shopify) {
  return {
    from(table) {
      const chaine = {
        select: () => chaine,
        eq: () => chaine,
        maybeSingle: async () => ({ data: shopify || null }),
        then: undefined,
      }
      if (table === 'client_integrations') {
        return {
          select: () => ({ eq: async () => ({ data: integrations }) }),
        }
      }
      return chaine
    },
  }
}

beforeEach(() => {
  appelsFetch = []
  reponses = {}
  process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'x'.repeat(64)
  vi.stubGlobal('fetch', async (url, init) => {
    appelsFetch.push({ url: String(url), methode: init?.method })
    const cle = Object.keys(reponses).find((k) => String(url).includes(k))
    if (!cle) return { ok: false, status: 500, json: async () => ({}) }
    return reponses[cle]
  })
})
afterEach(() => {
  vi.unstubAllGlobals()
  process.env = { ...ENV }
})

describe('révocation — ne jamais annoncer un succès qui n\'a pas eu lieu', () => {
  it('Slack qui répond HTTP 200 mais ok:false est un ÉCHEC', async () => {
    // Le piège : Slack ne renvoie pas un code d'erreur HTTP.
    reponses['slack.com/api/auth.revoke'] = {
      ok: true, status: 200,
      json: async () => ({ ok: false, error: 'invalid_auth' }),
    }
    const { revokeClientAccess } = await import('./revoke-integrations.js')
    const rapport = await revokeClientAccess(
      stubSupabase([{ provider: 'slack', access_token: 'jeton-en-clair', extra_config: {} }]),
      'c1',
    )
    const slack = rapport.find((r) => r.fournisseur === 'slack')
    expect(slack.resultat).toBe('echec')
    expect(slack.detail).toContain('invalid_auth')
  })

  it('Slack qui confirme est un succès', async () => {
    reponses['slack.com/api/auth.revoke'] = {
      ok: true, status: 200,
      json: async () => ({ ok: true, revoked: true }),
    }
    const { revokeClientAccess } = await import('./revoke-integrations.js')
    const rapport = await revokeClientAccess(
      stubSupabase([{ provider: 'slack', access_token: 'jeton-en-clair', extra_config: {} }]),
      'c1',
    )
    expect(rapport.find((r) => r.fournisseur === 'slack').resultat).toBe('revoque')
  })

  it('un fournisseur sans API de révocation est « manuel », pas « révoqué »', async () => {
    const { revokeClientAccess } = await import('./revoke-integrations.js')
    const rapport = await revokeClientAccess(
      stubSupabase([
        { provider: 'notion', access_token: 'x', extra_config: {} },
        { provider: 'smtp_imap', api_key: 'x', extra_config: {} },
        { provider: 'resend', api_key: 'x', extra_config: {} },
      ]),
      'c1',
    )
    for (const f of ['notion', 'smtp_imap', 'resend']) {
      const r = rapport.find((x) => x.fournisseur === f)
      expect(r.resultat, `${f} devrait être manuel`).toBe('manuel')
      expect(r.detail.length, `${f} doit dire quoi faire`).toBeGreaterThan(30)
    }
    // Le mot de passe email doit dire « changer », pas « supprimer » : un
    // secret qui a séjourné ailleurs ne se range pas, il se remplace.
    expect(rapport.find((x) => x.fournisseur === 'smtp_imap').detail).toMatch(/CHANGER/i)
  })

  it('un fournisseur inconnu ne passe pas silencieusement', async () => {
    const { revokeClientAccess } = await import('./revoke-integrations.js')
    const rapport = await revokeClientAccess(
      stubSupabase([{ provider: 'un_truc_nouveau', access_token: 'x', extra_config: {} }]),
      'c1',
    )
    expect(rapport).toHaveLength(1)
    expect(rapport[0].resultat).toBe('manuel')
  })

  it('un fournisseur injoignable n\'interrompt pas le rapport', async () => {
    // Le réseau tombe sur Slack : les autres doivent quand même être traités.
    vi.stubGlobal('fetch', async () => { throw new Error('réseau indisponible') })
    const { revokeClientAccess } = await import('./revoke-integrations.js')
    const rapport = await revokeClientAccess(
      stubSupabase([
        { provider: 'slack', access_token: 'x', extra_config: {} },
        { provider: 'notion', access_token: 'x', extra_config: {} },
      ]),
      'c1',
    )
    expect(rapport).toHaveLength(2)
    expect(rapport.find((r) => r.fournisseur === 'slack').resultat).toBe('echec')
    expect(rapport.find((r) => r.fournisseur === 'notion').resultat).toBe('manuel')
  })
})

describe('garde — l\'ordre des opérations', () => {
  it('la révocation précède la suppression dans l\'endpoint admin', () => {
    // Une fois la ligne supprimée, les jetons ont disparu : révoquer après ne
    // peut plus fonctionner. L'ordre est la seule chose qui rend ce module
    // utile, et rien dans le code ne l'impose structurellement.
    const src = readFileSync('api/admin/client-actions.js', 'utf8')
    const iRevoke = src.indexOf('revokeClientAccess(supabaseAdmin')
    const iDelete = src.indexOf("rpc('delete_client_data'")
    expect(iRevoke, 'revokeClientAccess doit être appelé').toBeGreaterThan(-1)
    expect(iDelete, 'delete_client_data doit être appelé').toBeGreaterThan(-1)
    expect(iRevoke, 'la révocation doit précéder la suppression').toBeLessThan(iDelete)
  })
})
