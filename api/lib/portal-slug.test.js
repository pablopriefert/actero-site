import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { slugifier, assurerSlugPortail } from './portal-slug.js'

/**
 * ACT-35 — le portail doit avoir une adresse.
 *
 * Le défaut d'origine : `clients.slug` porte le sous-domaine du portail, et
 * **aucune ligne du dépôt ne l'écrivait**. Deux comptes sur cinq en avaient
 * un, posés à la main. Un marchand qui activait son portail lisait « Aucun
 * slug configuré. Contactez le support. » : la fonctionnalité était ouverte,
 * et sans adresse.
 */

function supabaseFactice({ clientRow = {}, slugsPris = [], erreurUpdate = null } = {}) {
  const ecritures = []
  const pris = new Set(slugsPris)
  return {
    ecritures,
    from() {
      const b = {
        _filtreSlug: undefined,
        select() { return b },
        eq(colonne, valeur) { if (colonne === 'slug') b._filtreSlug = valeur; return b },
        maybeSingle() {
          if (b._filtreSlug !== undefined) {
            return Promise.resolve({ data: pris.has(b._filtreSlug) ? { id: 'autre' } : null })
          }
          return Promise.resolve({ data: clientRow })
        },
        update(valeurs) {
          ecritures.push(valeurs)
          if (erreurUpdate) return { eq: () => Promise.resolve({ error: erreurUpdate }) }
          if (valeurs.slug) pris.add(valeurs.slug)
          return { eq: () => Promise.resolve({ error: null }) }
        },
      }
      return b
    },
  }
}

describe('slugifier', () => {
  it('retire les accents sans perdre la lettre', () => {
    expect(slugifier('Café Crème & Co')).toBe('cafe-creme-co')
  })

  it('ne laisse jamais de tiret en fin de chaîne, même après la coupe', () => {
    // La troncature à 40 caractères peut tomber pile sur un tiret, et
    // `boutique-.portal.actero.fr` n'est pas une adresse valide.
    const long = slugifier('Ma Boutique Absolument Extraordinaire A Paris Nord')
    expect(long.endsWith('-')).toBe(false)
    expect(long.length).toBeLessThanOrEqual(40)
  })

  it('renvoie une chaîne vide quand le nom ne laisse rien d\'utilisable', () => {
    expect(slugifier('日本語だけ')).toBe('')
    expect(slugifier('   ')).toBe('')
    expect(slugifier(null)).toBe('')
  })
})

describe('assurerSlugPortail', () => {
  it('fabrique un slug à partir du nom de marque', async () => {
    const sb = supabaseFactice({ clientRow: { slug: null } })
    const r = await assurerSlugPortail(sb, 'c1', 'BoutiqueMode.fr')
    expect(r.slug).toBe('boutiquemode-fr')
    expect(sb.ecritures).toEqual([{ slug: 'boutiquemode-fr' }])
  })

  it('ne touche pas à un slug déjà attribué', async () => {
    // Changer le slug d'un marchand casserait tous les liens déjà envoyés à
    // ses clients — un lien magique reçu par email pointe sur ce sous-domaine.
    const sb = supabaseFactice({ clientRow: { slug: 'deja-la' } })
    const r = await assurerSlugPortail(sb, 'c1', 'Autre Nom')
    expect(r.slug).toBe('deja-la')
    expect(sb.ecritures).toEqual([])
  })

  it('contourne un slug déjà pris par un autre marchand', async () => {
    const sb = supabaseFactice({ clientRow: { slug: null }, slugsPris: ['maboutique'] })
    const r = await assurerSlugPortail(sb, 'c1', 'MaBoutique')
    expect(r.slug).toBe('maboutique-2')
  })

  it('n\'attribue jamais un sous-domaine réservé', async () => {
    // Un marchand nommé « Admin » ne doit pas hériter de
    // admin.portal.actero.fr : ça ressemble à une adresse de service.
    const sb = supabaseFactice({ clientRow: { slug: null } })
    const r = await assurerSlugPortail(sb, 'abcd1234-ffff', 'Admin')
    expect(r.slug).not.toBe('admin')
    expect(r.slug).toBe('boutique-abcd1234')
  })

  it('se rabat sur l\'identifiant quand le nom ne donne rien', async () => {
    const sb = supabaseFactice({ clientRow: { slug: null } })
    const r = await assurerSlugPortail(sb, 'abcd1234-ffff', '日本語だけ')
    expect(r.slug).toBe('boutique-abcd1234')
  })

  it('signale l\'échec au lieu de lever', async () => {
    // Appelée en plein milieu de l'activation du portail : une exception
    // laisserait le marchand avec un portail activé et aucun message.
    const sb = supabaseFactice({ clientRow: { slug: null }, erreurUpdate: { code: '42501', message: 'permission denied' } })
    const r = await assurerSlugPortail(sb, 'c1', 'Boutique')
    expect(r.slug).toBeUndefined()
    expect(r.erreur).toMatch(/permission denied/)
  })
})

describe('activation du portail', () => {
  it('l\'activation fabrique le slug, sinon le portail n\'a pas d\'adresse', () => {
    const src = readFileSync('api/client/toggle-portal.js', 'utf8')
    expect(src, 'toggle-portal.js n\'appelle plus assurerSlugPortail')
      .toMatch(/assurerSlugPortail\(\s*supabase,\s*clientId/)
    expect(src, 'la réponse doit porter le slug, c\'est ce que l\'interface affiche')
      .toMatch(/portal_enabled: enabled, slug/)
  })
})
