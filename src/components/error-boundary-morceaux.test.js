import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { estMorceauPerime, rechargerPourMorceauPerime } from './ErrorBoundary.jsx'

/**
 * Le morceau de code périmé après un déploiement.
 *
 * Vite nomme chaque morceau chargé à la demande avec une empreinte. Après un
 * déploiement, l'ancien fichier n'existe plus, et un onglet resté ouvert garde
 * l'ancienne table des noms : le premier clic sur un onglet paresseux échoue.
 *
 * Constaté en vrai le 10 septembre, sur l'onglet Facturation, avec dix
 * déploiements dans la journée.
 *
 * La garde d'origine autorisait UN rechargement par session, tous morceaux
 * confondus — donc le deuxième morceau périmé de la journée affichait un écran
 * d'erreur, et le bouton « Réessayer » redemandait la même URL morte.
 */

function faireSessionStorage() {
  const m = new Map()
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    _taille: () => m.size,
  }
}

let rechargements

beforeEach(() => {
  rechargements = 0
  vi.stubGlobal('sessionStorage', faireSessionStorage())
  vi.stubGlobal('window', {
    location: { reload: () => { rechargements += 1 } },
    get sessionStorage() { return globalThis.sessionStorage },
  })
})
afterEach(() => vi.unstubAllGlobals())

const erreur = (url) => new Error(`Failed to fetch dynamically imported module: ${url}`)

describe('morceau de code périmé', () => {
  it('reconnaît les trois formulations des navigateurs', () => {
    expect(estMorceauPerime(erreur('https://actero.fr/assets/X-abc.js'))).toBe(true)
    expect(estMorceauPerime(new Error('Importing a module script failed'))).toBe(true)
    expect(estMorceauPerime(new Error('Loading chunk 42 failed'))).toBe(true)
  })

  it('ne confond pas une vraie erreur applicative avec un morceau périmé', () => {
    // Recharger sur une exception métier masquerait le défaut et ferait
    // tourner la page en rond.
    expect(estMorceauPerime(new Error('Cannot read properties of undefined'))).toBe(false)
    expect(estMorceauPerime(null)).toBe(false)
  })

  it('recharge une fois par morceau, pas une fois par session', () => {
    // C'est le correctif. Deux morceaux différents = deux rechargements.
    expect(rechargerPourMorceauPerime(erreur('https://actero.fr/assets/Billing-aaa.js'))).toBe(true)
    expect(rechargerPourMorceauPerime(erreur('https://actero.fr/assets/Tickets-bbb.js'))).toBe(true)
    expect(rechargements).toBe(2)
  })

  it('ne boucle pas sur le même morceau', () => {
    const e = erreur('https://actero.fr/assets/Billing-aaa.js')
    expect(rechargerPourMorceauPerime(e)).toBe(true)
    expect(rechargerPourMorceauPerime(e)).toBe(false)
    expect(rechargements).toBe(1)
  })

  it('s\'arrête au plafond, même avec des morceaux tous différents', () => {
    // Filet pour le cas où un déploiement servirait vraiment des fichiers
    // introuvables : mieux vaut un écran d'erreur qu'un onglet qui se
    // recharge sans fin.
    for (let i = 0; i < 10; i++) rechargerPourMorceauPerime(erreur(`https://actero.fr/assets/M-${i}.js`))
    expect(rechargements).toBeLessThanOrEqual(4)
    expect(rechargements).toBe(4)
  })
})
