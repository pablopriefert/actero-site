import { describe, it, expect } from 'vitest'
import { signauxCommission, SIGNAUX_COMMISSION, LIBELLES_SIGNAUX, MESSAGERIES_GRAND_PUBLIC, DELAI_IBAN_RECENT_HEURES } from './signaux-closer.js'

/**
 * Les signaux d'une commission dans la file de validation : ce qui doit faire
 * regarder de plus près avant de valider ou de payer (auto-parrainage, compte
 * de closer détourné, closer suspendu). Un signal n'empêche rien : Actero décide.
 */

const MAINTENANT = new Date('2026-09-17T12:00:00Z')
const HEURE = 3_600_000

const closer = (over = {}) => ({ id: 'k1', email: 'alice@closers.fr', statut: 'actif', iban_modifie_le: '2026-08-01T10:00:00Z', ...over })
const client = (over = {}) => ({ id: 'c1', contact_email: 'contact@boutique.fr', ...over })
const signaux = (k, c, maintenant = MAINTENANT) => signauxCommission({ closer: k, client: c, maintenant })

describe('signauxCommission', () => {
  it('rien à signaler : un tableau vide', () => {
    expect(signaux(closer(), client())).toEqual([])
  })

  it('même e-mail, sans tenir compte de la casse ni des espaces', () => {
    expect(signaux(closer({ email: 'Alice@Gmail.com' }), client({ contact_email: ' alice@gmail.COM ' }))).toEqual(['meme_email'])
    expect(signaux(closer({ email: 'alice@gmail.com' }), client({ contact_email: 'alice2@gmail.com' }))).toEqual([])
  })

  it('même domaine professionnel', () => {
    expect(signaux(closer({ email: 'alice@acme.fr' }), client({ contact_email: 'Boutique@ACME.fr' }))).toEqual(['meme_domaine'])
    // Un sous-domaine n'est pas le même domaine.
    expect(signaux(closer({ email: 'alice@acme.fr' }), client({ contact_email: 'shop@mail.acme.fr' }))).toEqual([])
  })

  it('même e-mail sur un domaine professionnel : les deux signaux, chacun selon sa définition', () => {
    expect(signaux(closer({ email: 'alice@acme.fr' }), client({ contact_email: 'alice@acme.fr' }))).toEqual(['meme_email', 'meme_domaine'])
  })

  it.each([...MESSAGERIES_GRAND_PUBLIC])('%s est une messagerie grand public : pas de signal de domaine', (domaine) => {
    expect(signaux(closer({ email: `alice@${domaine}` }), client({ contact_email: `boutique@${domaine.toUpperCase()}` }))).toEqual([])
  })

  it('la liste des messageries grand public est celle validée', () => {
    expect([...MESSAGERIES_GRAND_PUBLIC].sort()).toEqual([
      'aol.com', 'bbox.fr', 'free.fr', 'gmail.com', 'gmx.com', 'gmx.fr', 'googlemail.com', 'hotmail.com', 'hotmail.fr',
      'icloud.com', 'laposte.net', 'live.com', 'live.fr', 'me.com', 'msn.com', 'neuf.fr', 'numericable.fr', 'orange.fr',
      'outlook.com', 'outlook.fr', 'proton.me', 'protonmail.com', 'sfr.fr', 'wanadoo.fr', 'yahoo.com', 'yahoo.fr',
    ])
    expect(() => MESSAGERIES_GRAND_PUBLIC.push('acme.fr')).toThrow()
  })

  it('e-mails absents ou mal formés : pas de signal d’e-mail', () => {
    for (const [k, c] of [
      [null, client()],
      [closer(), null],
      [closer({ email: null }), client({ contact_email: null })],
      [closer({ email: '' }), client({ contact_email: '' })],
      [closer({ email: 'sans-arobase' }), client({ contact_email: 'sans-arobase' })],
      [closer({ email: 'alice@' }), client({ contact_email: 'boutique@' })],
    ]) {
      const s = signaux(k, c)
      expect(s, JSON.stringify([k?.email, c?.contact_email])).not.toContain('meme_email')
      expect(s, JSON.stringify([k?.email, c?.contact_email])).not.toContain('meme_domaine')
    }
  })

  it(`IBAN modifié il y a moins de ${DELAI_IBAN_RECENT_HEURES} heures`, () => {
    const il_y_a = (heures) => new Date(MAINTENANT.getTime() - heures * HEURE).toISOString()
    expect(signaux(closer({ iban_modifie_le: il_y_a(1) }), client())).toEqual(['iban_recent'])
    expect(signaux(closer({ iban_modifie_le: new Date(MAINTENANT.getTime() - 72 * HEURE + 1).toISOString() }), client())).toEqual(['iban_recent'])
    expect(signaux(closer({ iban_modifie_le: il_y_a(72) }), client())).toEqual([])
    expect(signaux(closer({ iban_modifie_le: il_y_a(24 * 30) }), client())).toEqual([])
    // Une date dans le futur (horloges décalées) reste récente.
    expect(signaux(closer({ iban_modifie_le: il_y_a(-2) }), client())).toEqual(['iban_recent'])
    for (const iban_modifie_le of [null, undefined, '', 'pas une date']) {
      expect(signaux(closer({ iban_modifie_le }), client()), String(iban_modifie_le)).toEqual([])
    }
  })

  it('le délai se compte depuis `maintenant`, maintenant par défaut', () => {
    const recent = closer({ iban_modifie_le: new Date(Date.now() - HEURE).toISOString() })
    expect(signauxCommission({ closer: recent, client: client() })).toEqual(['iban_recent'])
  })

  it('closer suspendu', () => {
    expect(signaux(closer({ statut: 'suspendu' }), client())).toEqual(['closer_suspendu'])
    expect(signaux(closer({ statut: 'actif' }), client())).toEqual([])
  })

  it('tous les signaux, toujours dans le même ordre', () => {
    const k = closer({ email: 'alice@acme.fr', statut: 'suspendu', iban_modifie_le: MAINTENANT.toISOString() })
    expect(signaux(k, client({ contact_email: 'alice@acme.fr' }))).toEqual(['meme_email', 'meme_domaine', 'iban_recent', 'closer_suspendu'])
    expect(SIGNAUX_COMMISSION).toEqual(['meme_email', 'meme_domaine', 'iban_recent', 'closer_suspendu'])
  })

  it('chaque signal a son libellé', () => {
    for (const s of SIGNAUX_COMMISSION) expect(LIBELLES_SIGNAUX[s], s).toBeTruthy()
    expect(() => { LIBELLES_SIGNAUX.meme_email = 'x' }).toThrow()
  })
})
