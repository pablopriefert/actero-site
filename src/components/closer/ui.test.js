// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

/**
 * Les briques de l'espace closer, montées pour de vrai.
 *
 *   - le lien à copier : presse-papiers refusé → texte sélectionné et
 *     consigne visible ; copie réussie → annoncée aux lecteurs d'écran ;
 *   - une lecture ratée : 401 → lien vers la connexion closer, panne
 *     passagère → « Réessayer » ;
 *   - la règle du rattachement dite exactement (même navigateur, 60 jours,
 *     recours par e-mail), sur l'accueil et sur la liste des clients.
 */

vi.mock('../../lib/espace-closer', () => ({ appelCloser: async () => ({ clients: [] }) }))

let ui
let AccueilCloser
let ClientsCloser
let conteneur
let racine

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  ui = await import('./ui.jsx')
  ;({ AccueilCloser } = await import('./AccueilCloser.jsx'))
  ;({ ClientsCloser } = await import('./ClientsCloser.jsx'))
})

beforeEach(() => {
  conteneur = document.createElement('div')
  document.body.appendChild(conteneur)
  racine = createRoot(conteneur)
})

afterEach(() => {
  act(() => racine.unmount())
  conteneur.remove()
  delete navigator.clipboard
})

async function monter(element) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await act(async () => {
    racine.render(React.createElement(QueryClientProvider, { client }, element))
  })
  await act(async () => {
    await new Promise((fin) => setTimeout(fin, 10))
  })
}

async function cliquer(texte) {
  const bouton = [...conteneur.querySelectorAll('button')].find((b) => b.textContent.trim() === texte)
  expect(bouton, `bouton « ${texte} » introuvable`).toBeTruthy()
  await act(async () => {
    bouton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

const LIEN = 'https://actero.fr/c/ACT-AAAAA'
const regionAnnoncee = () => conteneur.querySelector('[aria-live="polite"]')

describe('LienACopier', () => {
  it.each([
    ['absent (page hors HTTPS)', undefined],
    ['refusé par le navigateur', { writeText: async () => { throw new DOMException('refus', 'NotAllowedError') } }],
  ])('presse-papiers %s : le lien est sélectionné et la page dit de le copier à la main', async (_cas, pressePapiers) => {
    if (pressePapiers) Object.defineProperty(navigator, 'clipboard', { value: pressePapiers, configurable: true })
    await monter(React.createElement(ui.LienACopier, { lien: LIEN }))
    await cliquer('Copier')

    const champ = conteneur.querySelector('input')
    expect(document.activeElement).toBe(champ)
    expect([champ.selectionStart, champ.selectionEnd]).toEqual([0, LIEN.length])
    expect(regionAnnoncee().textContent).toBe('Copiez le lien à la main : il est sélectionné.')
    expect(regionAnnoncee().className).not.toContain('sr-only')
  })

  it('copie réussie : « Copié » sur le bouton, et annoncé aux lecteurs d’écran', async () => {
    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    await monter(React.createElement(ui.LienACopier, { lien: LIEN }))
    expect(regionAnnoncee().textContent).toBe('')
    await cliquer('Copier')

    expect(writeText).toHaveBeenCalledWith(LIEN)
    expect(conteneur.querySelector('button').textContent).toBe('Copié')
    expect(regionAnnoncee().textContent).toBe('Lien copié.')
    expect(regionAnnoncee().className).toBe('sr-only')
  })
})

describe('ErreurChargement', () => {
  const erreur = (status, message = 'Espace momentanément indisponible. Réessayez.') => Object.assign(new Error(message), { status })

  it('401 : un lien vers /closer/connexion, pas de « Réessayer »', async () => {
    await monter(React.createElement(ui.ErreurChargement, { erreur: erreur(401, 'Connectez-vous pour continuer.'), onReessayer: () => {} }))
    const lien = conteneur.querySelector('a')
    expect(lien.getAttribute('href')).toBe('/closer/connexion')
    expect(lien.textContent).toBe('Se reconnecter')
    expect(conteneur.querySelector('button')).toBeNull()
  })

  it.each([503, 500, 429, undefined])('panne passagère (%s) : « Réessayer » relance la lecture', async (status) => {
    const onReessayer = vi.fn()
    await monter(React.createElement(ui.ErreurChargement, { erreur: erreur(status), onReessayer }))
    expect(conteneur.textContent).toContain('Espace momentanément indisponible. Réessayez.')
    await cliquer('Réessayer')
    expect(onReessayer).toHaveBeenCalledTimes(1)
    expect(onReessayer.mock.calls[0]).toEqual([])
  })

  it('une erreur qu’un nouvel essai ne changerait pas (400) : pas de « Réessayer »', async () => {
    await monter(React.createElement(ui.ErreurChargement, { erreur: erreur(400, 'Requête invalide.'), onReessayer: () => {} }))
    expect(conteneur.querySelector('button')).toBeNull()
  })

  it('sans rechargement possible : pas de « Réessayer »', async () => {
    await monter(React.createElement(ui.ErreurChargement, { erreur: erreur(503) }))
    expect(conteneur.querySelector('button')).toBeNull()
  })
})

describe('la règle du rattachement, dite exactement', () => {
  const REGLE = /par votre lien, depuis le même navigateur et dans les 60 jours\. Sinon, écrivez à contact@actero\.fr : Actero peut la rattacher à la main\./

  function verifierLeRecours() {
    const mail = [...conteneur.querySelectorAll('a')].find((a) => a.textContent === 'contact@actero.fr')
    expect(mail?.getAttribute('href')).toBe('mailto:contact@actero.fr')
    expect(conteneur.textContent).not.toMatch(/Chaque boutique qui s’inscrit par votre lien/)
  }

  it('sur l’accueil', async () => {
    window.history.replaceState({}, '', '/closer')
    const fiche = { prenom: 'Léa', code: 'ACT-AAAAA', statut: 'actif', profil_complet: true }
    await monter(React.createElement(AccueilCloser, { fiche, totaux: {}, onNavigate: () => {} }))
    expect(conteneur.textContent).toMatch(new RegExp(`Une boutique vous est rattachée quand elle s’inscrit ${REGLE.source}`))
    verifierLeRecours()
  })

  it('sur la liste des clients, même vide', async () => {
    await monter(React.createElement(ClientsCloser))
    expect(conteneur.textContent).toMatch(new RegExp(`Une boutique apparaît ici quand elle s’inscrit ${REGLE.source}`))
    expect(conteneur.textContent).toContain('Aucun client pour l’instant.')
    verifierLeRecours()
  })
})
