// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

/**
 * Le fil d'activité de l'espace closer, monté pour de vrai.
 * Spec : docs/superpowers/specs/2026-09-17-closers-fil-activite-design.md
 *
 *   - l'onglet « Activité » suit « Accueil » ;
 *   - les trois compteurs, le fil groupé par jour, les filtres (aria-pressed),
 *     « Voir plus » avec le curseur, les états chargement, erreur et vide ;
 *   - la relecture chaque minute, jamais en arrière-plan ;
 *   - « Clients » : chaque ligne se déplie sur le parcours du client, chargé
 *     à l'ouverture, avec le badge de sa dernière étape.
 */

const h = vi.hoisted(() => ({ lireActivite: null, appelCloser: null, optionsFil: null }))

vi.mock('../../lib/espace-closer', () => ({
  appelCloser: (...args) => h.appelCloser(...args),
  lireActivite: (...args) => h.lireActivite(...args),
}))
vi.mock('../SEO', () => ({ SEO: () => null }))
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const original = await importOriginal()
  return {
    ...original,
    useInfiniteQuery: (options, client) => {
      h.optionsFil = options
      return original.useInfiniteQuery(options, client)
    },
  }
})

let ActiviteCloser
let ClientsCloser
let CloserEspacePage
let conteneur
let racine

const MAINTENANT = new Date('2026-09-17T12:00:00Z') // 14 h à Paris
const CLIENT_1 = '11111111-1111-4111-8111-111111111111'
const CLIENT_2 = '22222222-2222-4222-8222-222222222222'

const etape = (id, type, survenu_le, extra = {}) => ({
  id, type, survenu_le, famille: 'paiement', client_id: CLIENT_1, boutique: 'Maison Ambre', details: {}, ...extra,
})

const PAGE_1 = {
  evenements: [
    etape('e1', 'paiement_ouvert', '2026-09-17T11:55:00Z', { details: { plan: 'pro', formule: 'annuel', plateforme: 'stripe' } }),
    etape('e2', 'paiement_echoue', '2026-09-17T10:00:00Z', { client_id: CLIENT_2, boutique: 'Atelier Alma' }),
    etape('e3', 'lien_ouvert', '2026-09-16T12:05:00Z', { famille: 'lien', client_id: null, boutique: null }),
  ],
  suivant: '2026-09-16T12:05:00+00:00',
  resume: { visites_7j: 12, inscriptions_30j: 3, paiements_en_attente: 1 },
}
const PAGE_2 = {
  evenements: [etape('e4', 'inscription', '2026-09-14T08:00:00Z', { famille: 'inscription' })],
  suivant: null,
  resume: { visites_7j: 12, inscriptions_30j: 3, paiements_en_attente: 1 },
}

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  ;({ ActiviteCloser } = await import('./ActiviteCloser.jsx'))
  ;({ ClientsCloser } = await import('./ClientsCloser.jsx'))
  ;({ CloserEspacePage } = await import('../../pages/closer/CloserEspacePage.jsx'))
})

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(MAINTENANT)
  h.optionsFil = null
  h.appelCloser = vi.fn(async () => ({ clients: [] }))
  h.lireActivite = vi.fn(async ({ avant } = {}) => (avant ? PAGE_2 : PAGE_1))
  conteneur = document.createElement('div')
  document.body.appendChild(conteneur)
  racine = createRoot(conteneur)
})

afterEach(() => {
  act(() => racine.unmount())
  conteneur.remove()
  vi.useRealTimers()
})

const attendre = () => act(async () => {
  await new Promise((fin) => setTimeout(fin, 10))
})

async function monter(element) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await act(async () => {
    racine.render(React.createElement(QueryClientProvider, { client }, element))
  })
  await attendre()
}

const boutons = () => [...conteneur.querySelectorAll('button')]
const bouton = (texte) => boutons().find((b) => b.textContent.trim() === texte)

async function cliquer(element) {
  expect(element, 'élément à cliquer introuvable').toBeTruthy()
  await act(async () => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await attendre()
}

const lignes = () => [...conteneur.querySelectorAll('li')].map((li) => li.textContent)

describe('l’onglet Activité de /closer', () => {
  const moi = { fiche: { prenom: 'Léa', nom: 'Martin', code: 'ACT-AAAAA', statut: 'actif', profil_complet: true }, totaux: {} }

  it('suit « Accueil » dans la navigation, et ouvre le fil', async () => {
    h.appelCloser = vi.fn(async (chemin) => (chemin === 'moi' ? moi : { clients: [] }))
    await monter(React.createElement(CloserEspacePage, { currentRoute: '/closer/activite', onNavigate: () => {}, onLogout: () => {} }))
    const onglets = [...conteneur.querySelectorAll('nav button')]
    expect(onglets.map((b) => b.textContent)).toEqual(['Accueil', 'Activité', 'Clients', 'Commissions', 'Profil et paiement'])
    expect(onglets[1].getAttribute('aria-current')).toBe('page')
    expect(conteneur.querySelector('h1').textContent).toBe('Activité')
    expect(h.lireActivite).toHaveBeenCalled()
  })

  it('le fil n’est pas lu depuis un autre onglet', async () => {
    h.appelCloser = vi.fn(async (chemin) => (chemin === 'moi' ? moi : { clients: [] }))
    await monter(React.createElement(CloserEspacePage, { currentRoute: '/closer/clients', onNavigate: () => {}, onLogout: () => {} }))
    expect(h.lireActivite).not.toHaveBeenCalled()
  })
})

describe('ActiviteCloser', () => {
  it('chargement', async () => {
    h.lireActivite = vi.fn(() => new Promise(() => {}))
    await monter(React.createElement(ActiviteCloser))
    expect(conteneur.textContent).toContain('Chargement…')
  })

  it('les trois compteurs, puis le fil groupé par jour', async () => {
    await monter(React.createElement(ActiviteCloser))
    const chiffres = [...conteneur.querySelectorAll('.font-mono')].map((n) => n.textContent)
    expect(chiffres).toEqual(['12', '3', '1'])
    expect(conteneur.textContent).toContain('Visites de votre lien, sur 7 jours')
    expect(conteneur.textContent).toContain('Inscriptions, sur 30 jours')
    expect(conteneur.textContent).toContain('Paiements en attente')

    expect([...conteneur.querySelectorAll('h2')].map((t) => t.textContent)).toEqual(['Aujourd’hui', 'Hier'])
    expect(lignes()).toEqual([
      'A choisi Pro annuel et ouvert le paiementMaison Ambreil y a 5 min',
      'Paiement échouéAtelier Almail y a 2 h',
      'A ouvert votre lienVisiteur, pas encore inscrit14 h 05',
    ])
    const alertes = [...conteneur.querySelectorAll('li [data-alerte]')].map((n) => n.textContent)
    expect(alertes).toEqual(['Paiement échoué'])
    expect(conteneur.querySelector('li [data-alerte]').className).toContain('bg-warn-bg')
    expect(h.lireActivite).toHaveBeenCalledWith({ famille: null, avant: null })
  })

  it('les filtres par famille : pilules, aria-pressed, et une lecture par famille', async () => {
    await monter(React.createElement(ActiviteCloser))
    const groupe = conteneur.querySelector('[role="group"]')
    const filtres = [...groupe.querySelectorAll('button')]
    expect(filtres.map((b) => b.textContent)).toEqual(['Tout', 'Paiements', 'Abonnement', 'Inscriptions', 'Mise en route', 'Lien'])
    expect(filtres.map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false', 'false', 'false', 'false'])
    expect(filtres.every((b) => b.className.includes('rounded-full'))).toBe(true)
    expect(filtres[0].className).toContain('bg-cta')

    h.lireActivite = vi.fn(async () => ({ ...PAGE_2, evenements: [etape('p1', 'abonnement_demarre', '2026-09-17T11:00:00Z')] }))
    await cliquer(bouton('Paiements'))
    expect(h.lireActivite).toHaveBeenCalledWith({ famille: 'paiement', avant: null })
    expect(bouton('Paiements').getAttribute('aria-pressed')).toBe('true')
    expect(bouton('Tout').getAttribute('aria-pressed')).toBe('false')
    expect(lignes()).toEqual(['S’est abonnéMaison Ambreil y a 1 h'])
    expect(h.optionsFil.queryKey).toEqual(['closer-activite', 'paiement'])
  })

  it('« Voir plus » lit la page suivante avec le curseur, puis disparaît', async () => {
    await monter(React.createElement(ActiviteCloser))
    await cliquer(bouton('Voir plus'))
    expect(h.lireActivite).toHaveBeenLastCalledWith({ famille: null, avant: '2026-09-16T12:05:00+00:00' })
    expect(lignes()).toHaveLength(4)
    expect(lignes()[3]).toBe('S’est inscritMaison Ambre10 h 00')
    expect([...conteneur.querySelectorAll('h2')].map((t) => t.textContent)).toEqual(['Aujourd’hui', 'Hier', 'Lundi 14 septembre'])
    expect(bouton('Voir plus')).toBeUndefined()
  })

  it('fil vide : on invite à partager le lien', async () => {
    h.lireActivite = vi.fn(async () => ({ evenements: [], suivant: null, resume: { visites_7j: 0, inscriptions_30j: 0, paiements_en_attente: 0 } }))
    await monter(React.createElement(ActiviteCloser))
    expect(conteneur.textContent).toContain('Rien pour l’instant : partagez votre lien pour voir l’activité de vos prospects ici.')
    expect([...conteneur.querySelectorAll('.font-mono')].map((n) => n.textContent)).toEqual(['0', '0', '0'])
    expect(bouton('Voir plus')).toBeUndefined()
  })

  it('panne : le message du serveur et « Réessayer », qui relit le fil', async () => {
    h.lireActivite = vi.fn(async () => {
      throw Object.assign(new Error('Espace momentanément indisponible. Réessayez.'), { status: 503 })
    })
    await monter(React.createElement(ActiviteCloser))
    expect(conteneur.querySelector('[role="alert"]').textContent).toContain('Espace momentanément indisponible. Réessayez.')
    h.lireActivite = vi.fn(async () => PAGE_1)
    await cliquer(bouton('Réessayer'))
    expect(h.lireActivite).toHaveBeenCalledTimes(1)
    expect(lignes()).toHaveLength(3)
  })

  it('relu chaque minute, jamais en arrière-plan', async () => {
    await monter(React.createElement(ActiviteCloser))
    expect(h.optionsFil).toMatchObject({ refetchInterval: 60_000, refetchIntervalInBackground: false })
    expect(h.optionsFil.queryKey).toEqual(['closer-activite', 'tout'])
  })
})

describe('ClientsCloser — le parcours de chaque client', () => {
  const CLIENTS = [
    { id: CLIENT_1, boutique: 'Maison Ambre', plan: 'pro', formule: 'annuel', rattache_le: '2026-09-12T08:00:00Z', etat: 'actif' },
    { id: CLIENT_2, boutique: 'Atelier Alma', plan: 'starter', formule: 'mensuel', rattache_le: '2026-09-15T08:00:00Z', etat: 'inscrit' },
  ]
  const PARCOURS = {
    [CLIENT_1]: [
      etape('c1-3', 'abonnement_demarre', '2026-09-17T11:00:00Z', { details: { plan: 'pro', formule: 'annuel' } }),
      etape('c1-2', 'paiement_ouvert', '2026-09-16T12:05:00Z', { details: { plan: 'pro', formule: 'annuel' } }),
      etape('c1-1', 'inscription', '2026-09-12T08:00:00Z', { famille: 'inscription' }),
    ],
    [CLIENT_2]: [
      etape('c2-2', 'paiement_echoue', '2026-09-17T11:55:00Z', { client_id: CLIENT_2, boutique: 'Atelier Alma' }),
      etape('c2-1', 'inscription', '2026-09-15T08:00:00Z', { client_id: CLIENT_2, boutique: 'Atelier Alma', famille: 'inscription' }),
    ],
  }

  beforeEach(() => {
    h.appelCloser = vi.fn(async () => ({ clients: CLIENTS }))
    h.lireActivite = vi.fn(async ({ client }) => ({ evenements: PARCOURS[client] ?? [], suivant: null, resume: null }))
  })

  const depliants = () => [...conteneur.querySelectorAll('tbody button[aria-expanded]')]
  // La ligne du client, pas celle de son parcours (qui porte l'id visé par aria-controls).
  const badges = () => [...conteneur.querySelectorAll('tbody tr:not([id]) > td > div')].map((d) => d.textContent)

  it('replié par défaut : rien n’est lu, aucun badge', async () => {
    await monter(React.createElement(ClientsCloser))
    expect(depliants().map((b) => [b.textContent, b.getAttribute('aria-expanded')]))
      .toEqual([['Maison Ambre', 'false'], ['Atelier Alma', 'false']])
    expect(h.lireActivite).not.toHaveBeenCalled()
    expect(badges()).toEqual([])
    const parcours = document.getElementById(depliants()[0].getAttribute('aria-controls'))
    expect(parcours.hidden).toBe(true)
  })

  it('déplié : le parcours du plus ancien au plus récent, et le badge de la dernière étape', async () => {
    await monter(React.createElement(ClientsCloser))
    await cliquer(depliants()[0])
    expect(depliants()[0].getAttribute('aria-expanded')).toBe('true')
    expect(h.lireActivite).toHaveBeenCalledTimes(1)
    expect(h.lireActivite).toHaveBeenCalledWith({ client: CLIENT_1 })

    const parcours = document.getElementById(depliants()[0].getAttribute('aria-controls'))
    expect(parcours.hidden).toBe(false)
    expect([...parcours.querySelectorAll('li')].map((li) => li.textContent)).toEqual([
      'S’est inscritle 12 septembre',
      'A choisi Pro annuel et ouvert le paiementhier à 14 h 05',
      'S’est abonné (Pro annuel)il y a 1 h',
    ])
    expect(badges()).toEqual(['Dernière étape : S’est abonné (Pro annuel)'])
    const badge = conteneur.querySelector('tbody tr:not([id]) > td > div > span:not(.sr-only)')
    expect(badge.dataset.alerte).toBeUndefined()
    expect(badge.className).not.toContain('bg-warn')
  })

  it('le badge est orange quand la dernière étape est à surveiller', async () => {
    await monter(React.createElement(ClientsCloser))
    await cliquer(depliants()[1])
    expect(h.lireActivite).toHaveBeenCalledWith({ client: CLIENT_2 })
    expect(h.lireActivite).not.toHaveBeenCalledWith({ client: CLIENT_1 })
    expect(badges()).toEqual(['Dernière étape : Paiement échoué'])
    const badge = conteneur.querySelector('tbody tr:not([id]) > td > div > span[data-alerte]')
    expect(badge.textContent).toBe('Paiement échoué')
    expect(badge.className).toContain('bg-warn-bg')
    expect(badge.querySelector('span').className).toContain('bg-warn')
  })

  it('replié à nouveau : le parcours se cache, le badge reste', async () => {
    await monter(React.createElement(ClientsCloser))
    await cliquer(depliants()[0])
    await cliquer(depliants()[0])
    expect(depliants()[0].getAttribute('aria-expanded')).toBe('false')
    expect(document.getElementById(depliants()[0].getAttribute('aria-controls')).hidden).toBe(true)
    expect(badges()).toEqual(['Dernière étape : S’est abonné (Pro annuel)'])
  })

  it('un client sans étape enregistrée', async () => {
    h.lireActivite = vi.fn(async () => ({ evenements: [], suivant: null, resume: null }))
    await monter(React.createElement(ClientsCloser))
    await cliquer(depliants()[0])
    expect(conteneur.textContent).toContain('Aucune étape enregistrée : le suivi a commencé le 17 septembre 2026.')
    expect(badges()).toEqual([])
  })

  it('un parcours illisible : le message et « Réessayer »', async () => {
    h.lireActivite = vi.fn(async () => {
      throw Object.assign(new Error('Espace momentanément indisponible. Réessayez.'), { status: 503 })
    })
    await monter(React.createElement(ClientsCloser))
    await cliquer(depliants()[0])
    expect(conteneur.querySelector('[role="alert"]').textContent).toContain('Espace momentanément indisponible. Réessayez.')
    expect(bouton('Réessayer')).toBeTruthy()
  })
})
