// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'

/**
 * /signup/plan — l'offre convenue avec un closer est la carte mise en avant.
 *
 * Le prospect arrive avec `?plan=&formule=` (ou la formule mémorisée par le
 * lien /c/:code). La carte de ce plan porte « Offre convenue » à la place de
 * la carte « Le plus choisi », et la formule reste présélectionnée.
 *
 * La vraie page est montée ; Supabase (sans session) et la création de client
 * sont remplacés.
 */

vi.mock('../lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
}))
vi.mock('../lib/resolve-client', () => ({ resolveOrCreateClientId: async () => 'c-1' }))
vi.mock('../components/SEO', () => ({ SEO: () => null }))

let PlanSelectionPage
let memoriserFormuleChoisie
let conteneur
let racine

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  ;({ PlanSelectionPage } = await import('./PlanSelectionPage.jsx'))
  ;({ memoriserFormuleChoisie } = await import('../lib/affichage-formules.js'))
})

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  act(() => racine.unmount())
})

async function ouvrir(recherche = '') {
  window.history.replaceState({}, '', `/signup/plan${recherche}`)
  conteneur = document.createElement('div')
  racine = createRoot(conteneur)
  await act(async () => {
    racine.render(React.createElement(PlanSelectionPage, { onNavigate: () => {} }))
  })
  await act(async () => {
    await new Promise((fin) => setTimeout(fin, 20))
  })
}

/** Le plan de chaque carte portant ce badge. */
function plansAvecBadge(texte) {
  return [...conteneur.querySelectorAll('div')]
    .filter((d) => d.textContent.trim() === texte)
    .map((badge) => badge.parentElement.querySelector('h2')?.textContent)
}

const formuleActive = () => conteneur.querySelector('[aria-label="Formule de paiement"] [aria-pressed="true"]')?.textContent

describe('PlanSelectionPage — offre convenue', () => {
  it('le plan du lien est mis en avant à la place de la carte populaire, formule présélectionnée', async () => {
    await ouvrir('?plan=starter&formule=annuel')
    expect(plansAvecBadge('Offre convenue')).toEqual(['Starter'])
    expect(plansAvecBadge('Le plus choisi')).toEqual([])
    expect(formuleActive()).toMatch(/^Annuel/)
  })

  it('la formule mémorisée par le lien /c/:code suffit, sans paramètre d’URL', async () => {
    memoriserFormuleChoisie({ plan: 'pro', periode: 'trimestriel' })
    await ouvrir()
    expect(plansAvecBadge('Offre convenue')).toEqual(['Pro'])
    expect(plansAvecBadge('Le plus choisi')).toEqual([])
    expect(formuleActive()).toMatch(/^Trimestriel/)
  })

  it('sans offre convenue, la carte populaire garde son badge', async () => {
    await ouvrir()
    expect(plansAvecBadge('Le plus choisi')).toEqual(['Pro'])
    expect(plansAvecBadge('Offre convenue')).toEqual([])
    expect(formuleActive()).toMatch(/^Mensuel/)
  })

  it('un plan non payant dans l’URL ne remplace pas la carte populaire', async () => {
    await ouvrir('?plan=enterprise&formule=annuel')
    expect(plansAvecBadge('Offre convenue')).toEqual([])
    expect(plansAvecBadge('Le plus choisi')).toEqual(['Pro'])
    expect(formuleActive()).toMatch(/^Annuel/)
  })
})
