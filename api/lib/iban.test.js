import { describe, it, expect } from 'vitest'
import { ibanValide, ibanMasque, normaliserIban, siretValide, telephoneValide, titulaireValide } from './iban.js'

describe('coordonnées de paiement d’un closer', () => {
  it('IBAN : format et clé de contrôle modulo 97', () => {
    for (const iban of ['FR7630006000011234567890189', 'FR76 3000 6000 0112 3456 7890 189', 'DE89370400440532013000', 'gb82 west 1234 5698 7654 32']) {
      expect(ibanValide(iban), iban).toBe(true)
    }
    for (const iban of ['FR7630006000011234567890188', 'FR76', '', null, 'XX00123', 'FR76300060000112345678901891234567890']) {
      expect(ibanValide(iban), String(iban)).toBe(false)
    }
  })

  it('normalise sans espaces, en majuscules', () => {
    expect(normaliserIban(' fr76 3000 6000 0112 3456 7890 189 ')).toBe('FR7630006000011234567890189')
  })

  it('masque : seuls les quatre derniers caractères', () => {
    expect(ibanMasque('FR76 3000 6000 0112 3456 7890 189')).toBe('•••• 0189')
    expect(ibanMasque(null)).toBeNull()
    expect(ibanMasque('')).toBeNull()
  })

  it('SIRET : 14 chiffres', () => {
    expect(siretValide('732 829 320 00074')).toBe(true)
    expect(siretValide('7328293200007')).toBe(false)
    expect(siretValide('7328293200007A')).toBe(false)
  })

  it('téléphone : 6 à 20 caractères, comme la contrainte SQL', () => {
    expect(telephoneValide('+33 6 12 34 56 78')).toBe(true)
    expect(telephoneValide('06.12.34.56.78')).toBe(true)
    expect(telephoneValide('12345')).toBe(false)
    expect(telephoneValide('+33 6 12 34 56 78 90 12')).toBe(false)
    expect(telephoneValide('06 12 ab 56 78')).toBe(false)
  })

  it('titulaire : 2 à 120 caractères', () => {
    expect(titulaireValide('Jeanne Martin')).toBe(true)
    expect(titulaireValide(' J ')).toBe(false)
    expect(titulaireValide('x'.repeat(121))).toBe(false)
  })
})
