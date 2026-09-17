import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { FileCommissions } from '../components/admin/closers/FileCommissions'
import { CommissionsAPayer } from '../components/admin/closers/CommissionsAPayer'
import { Historique } from '../components/admin/closers/Historique'
import { Attributions, ResultatRejeu } from '../components/admin/closers/Attributions'
import {
  alerteRemboursement, appelAdmin, lignesDeNote, messageDErreur, moisLisible, rejouerFacturesStripe, resumeRejeu,
} from './admin-closers'

// supabase.js lit `window` dès l'import : l'environnement des tests n'en a pas.
vi.mock('./supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'jeton' } } }) } } }))

/**
 * La section « Closers » de l'admin — branchée, et fidèle aux principes du
 * chantier C : lecture par les routes serveur, jamais par supabase.from().
 */

const lire = (f) => readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const DOSSIER = 'src/components/admin/closers'
// Tout le dossier (vues, briques communes, crochets) ; les vues sont les composants en PascalCase.
const FICHIERS = readdirSync(DOSSIER).filter((f) => /\.jsx?$/.test(f)).map((f) => join(DOSSIER, f))
const VUES = FICHIERS.filter((f) => /^[A-Z].*\.jsx$/.test(f.split('/').pop()))

describe('section Closers de l’admin', () => {
  it('ses sept vues existent', () => {
    expect(VUES.map((f) => f.split('/').pop()).sort()).toEqual([
      'AdminClosersView.jsx', 'Attributions.jsx', 'CommissionsAPayer.jsx', 'FileCommissions.jsx', 'Historique.jsx', 'ListeClosers.jsx', 'SaisieManuelle.jsx',
    ])
  })

  it.each([...FICHIERS, 'src/lib/admin-closers.js'])('%s ne lit rien directement en base', (fichier) => {
    expect(lire(fichier)).not.toMatch(/\.from\(\s*['"`]/)
  })

  it.each(VUES)('%s passe par les routes /api/admin/closer*', (fichier) => {
    const code = lire(fichier)
    if (fichier.endsWith('AdminClosersView.jsx')) return
    expect(code).toMatch(/appelAdmin\('closer(s|-commissions|-attribution|-iban)'/)
  })

  it('l’IBAN n’est lu qu’à la demande, par la route journalisée', () => {
    const code = lire('src/components/admin/closers/CommissionsAPayer.jsx')
    expect(code).toMatch(/appelAdmin\('closer-iban', \{ query: \{ closer_id: closerId \} \}\)/)
    for (const fichier of FICHIERS.filter((f) => !f.endsWith('CommissionsAPayer.jsx'))) {
      expect(lire(fichier), fichier).not.toMatch(/closer-iban/)
    }
  })

  it('la section entière est masquée dans les enregistrements de session (Amplitude et Sentry)', () => {
    const vue = lire('src/components/admin/closers/AdminClosersView.jsx')
    expect(vue).toMatch(/return \(\s*<div className="amp-mask sentry-mask [^"]*" data-amp-mask="true" data-sentry-mask="true">/)
  })

  it('l’IBAN révélé porte son propre masque d’enregistrement', () => {
    const code = lire('src/components/admin/closers/CommissionsAPayer.jsx')
    expect(code).toMatch(/<p className="amp-mask sentry-mask [^"]*" data-amp-mask="true" data-sentry-mask="true">\s*\{iban\.iban\}/)
  })

  it.each(FICHIERS)('%s ne met aucune donnée personnelle dans un attribut (non masqué)', (fichier) => {
    expect(lire(fichier)).not.toMatch(/(title|aria-label|placeholder|alt)=\{[^}]*(email|iban|telephone|siret)/i)
  })

  it('aucune configuration globale ne démasque ce que la section masque', () => {
    expect(lire('src/main.jsx')).not.toMatch(/unmask/i)
    expect(lire('src/lib/analytics.ts')).not.toMatch(/unmask/i)
  })

  it('l’admin route /admin/closers et l’affiche dans la barre latérale', () => {
    const admin = lire('src/pages/AdminDashboard.jsx')
    expect(admin).toMatch(/if \(route === "\/admin\/closers"\) return "closers";/)
    expect(admin).toMatch(/\{ id: 'closers', label: 'Closers', icon: Handshake \}/)
    expect(admin).toMatch(/activeTab === "closers" && <div[^>]*><AdminClosersView \/><\/div>/)
  })

  it('la palette de commandes mène aux closers, plus aux ambassadeurs', () => {
    const palette = lire('src/components/CommandPalette.jsx')
    expect(palette).toMatch(/\{ id: 'closers',\s+label: 'Closers',\s+icon: Handshake \}/)
    expect(palette).not.toMatch(/Ambassador/i)
  })
})

describe('appelAdmin — des phrases, jamais un code brut', () => {
  const reponse = (status, corps) => ({ ok: status >= 200 && status < 300, status, json: async () => corps })
  beforeEach(() => fetch.mockReset())

  it('garde le message du serveur quand il y en a un', async () => {
    fetch.mockResolvedValueOnce(reponse(409, { error: 'client_sans_stripe', message: 'Ce client n’a ni abonnement ni compte client Stripe : aucune facture à relire.' }))
    await expect(appelAdmin('closer-commissions')).rejects.toMatchObject({
      message: 'Ce client n’a ni abonnement ni compte client Stripe : aucune facture à relire.',
      status: 409,
      code: 'client_sans_stripe',
    })
  })

  it.each([
    ['closer_requis', 400, 'Choisissez un closer.'],
    ['action_inconnue', 400, 'Action inconnue : rechargez la page.'],
    ['closer_introuvable', 404, 'Ce closer est introuvable : rechargez la page.'],
    ['Unauthorized', 401, 'Session expirée : reconnectez-vous.'],
  ])('traduit %s sans message', async (code, status, phrase) => {
    fetch.mockResolvedValueOnce(reponse(status, { error: code }))
    await expect(appelAdmin('closers')).rejects.toMatchObject({ message: phrase, code, status })
  })

  it('un code renvoyé en guise de message est traduit aussi', () => {
    expect(messageDErreur(400, { error: 'closer_requis', message: 'closer_requis' })).toBe('Choisissez un closer.')
  })

  it('sans code connu, le statut donne la phrase', () => {
    expect(messageDErreur(504, null)).toBe('Le serveur a mis trop de temps à répondre : réessayez.')
    expect(messageDErreur(418, { error: 'theiere' })).toBe('Erreur inattendue du serveur (418) : réessayez.')
    expect(messageDErreur(200, null)).toBe('Réponse illisible du serveur : réessayez.')
  })

  it('une coupure réseau se lit aussi', async () => {
    fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(appelAdmin('closers')).rejects.toMatchObject({ code: 'reseau', message: expect.stringMatching(/^Connexion au serveur impossible/) })
  })

  it('rejouerFacturesStripe poste l’action et le client, avec le jeton', async () => {
    fetch.mockResolvedValueOnce(reponse(200, { resultats: [] }))
    await expect(rejouerFacturesStripe('cli_1')).resolves.toEqual({ resultats: [] })
    const [url, options] = fetch.mock.calls[0]
    expect(url).toBe('/api/admin/closer-commissions')
    expect(options.method).toBe('POST')
    expect(JSON.parse(options.body)).toEqual({ action: 'rejouer_factures', client_id: 'cli_1' })
    expect(options.headers.Authorization).toBe('Bearer jeton')
  })
})

describe('affichage de l’admin closers', () => {
  it('résume un rejeu : créées, déjà créées, et le reste avec un libellé', () => {
    const resume = resumeRejeu([
      { facture: 'in_1', issue: 'creee' },
      { facture: 'in_2', issue: 'deja_creee' },
      { facture: 'in_3', issue: 'deja_creee' },
      { facture: 'in_4', issue: 'hors_grille' },
      { facture: 'in_5', issue: 'non_traitee' },
      { facture: 'in_6', issue: 'inedite' },
    ])
    expect(resume).toEqual({
      factures: 6,
      creees: 1,
      dejaCreees: 2,
      autres: [
        { issue: 'hors_grille', nombre: 1, libelle: 'Hors grille (facture, formule ou plan sans commission)', conseil: null },
        { issue: 'non_traitee', nombre: 1, libelle: 'Non traitées faute de temps', conseil: 'relancez pour continuer' },
        { issue: 'inedite', nombre: 1, libelle: 'Autre issue (inedite)', conseil: null },
      ],
    })
    expect(resumeRejeu([])).toEqual({ factures: 0, creees: 0, dejaCreees: 0, autres: [] })
  })

  it('chaque issue documentée du rejeu a son libellé', () => {
    for (const issue of ['creee', 'deja_creee', 'non_traitee', 'erreur', 'hors_grille', 'unique_deja_versee', 'devise',
      'client_ambigu', 'sans_closer', 'client_inconnu', 'rien_encaisse', 'hors_abonnement']) {
      expect(resumeRejeu([{ issue }]).autres.map((a) => a.libelle).join()).not.toMatch(/^Autre issue/)
    }
  })

  it('écrit le mois en toutes lettres', () => {
    expect(moisLisible('2026-09')).toBe('septembre 2026')
    expect(moisLisible('2027-01')).toBe('janvier 2027')
    expect(moisLisible('2026-13')).toBe('2026-13')
    expect(moisLisible(null)).toBe('—')
  })

  it('découpe la note en lignes', () => {
    expect(lignesDeNote('Saisie Shopify\n\nFacture remboursée après paiement ')).toEqual(['Saisie Shopify', 'Facture remboursée après paiement'])
    expect(lignesDeNote(null)).toEqual([])
  })

  it('signale une commission payée puis remboursée, et seulement elle', () => {
    expect(alerteRemboursement({ statut: 'payee', note: 'Facture remboursée après paiement' })).toBe('Facture remboursée après paiement')
    expect(alerteRemboursement({ statut: 'payee', note: 'ok\nRemboursement partiel de 10,00 € par le client' })).toBe('Facture remboursée en partie')
    expect(alerteRemboursement({ statut: 'payee', note: 'Correction : voir le remboursement du mois dernier' })).toBeNull()
    expect(alerteRemboursement({ statut: 'annulee', note: 'Facture remboursée par le client' })).toBeNull()
    expect(alerteRemboursement({ statut: 'payee', note: null })).toBeNull()
  })
})

/** Rend une vue avec des réponses d'API déjà en cache, et en rend le texte lisible. */
function rendre(Vue, reponses) {
  const client = new QueryClient()
  for (const [cle, valeur] of reponses) client.setQueryData(cle, valeur)
  const html = renderToStaticMarkup(h(QueryClientProvider, { client }, h(Vue)))
  const texte = html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&')
    .replace(/\u00a0/g, ' ').replace(/\s+/g, ' ')
  return { html, texte }
}

const commission = (surcharge = {}) => ({
  id: 'com_1',
  montant_centimes: 10000,
  montant_facture_centimes: 8900,
  plan: 'pro',
  formule: 'mensuel',
  type: 'mensuelle',
  source: 'stripe',
  statut: 'a_valider',
  payee_par_client_le: '2026-09-01T10:00:00Z',
  validee_at: null,
  payee_at: null,
  created_at: '2026-09-01T10:00:01Z',
  stripe_invoice_id: 'in_1',
  note: 'Commission supérieure au montant payé (89,00 €) : à vérifier\nAppel du closer le 2 septembre',
  closer: { id: 'clo_1', prenom: 'Léa', nom: 'Martin', code: 'LEA', statut: 'actif', profil_complet: true },
  boutique: 'Maison Test',
  remboursable_jusqu_au: '2026-10-01T10:00:00Z',
  signaux: ['meme_domaine', 'iban_recent'],
  ...surcharge,
})

describe('files « À valider » et « À payer » (rendu)', () => {
  it('« À valider » montre le montant payé, chaque ligne de la note, les signaux et la coupure', () => {
    const { texte } = rendre(FileCommissions, [[['admin-closer-commissions', 'a_valider'], { commissions: [commission()], tronque: true }]])
    expect(texte).toContain('Payé par le client : 89 €')
    expect(texte).toContain('Commission supérieure au montant payé (89,00 €) : à vérifier')
    expect(texte).toContain('Appel du closer le 2 septembre')
    expect(texte).toContain('Même domaine d’e-mail que le client')
    expect(texte).toContain('IBAN modifié il y a moins de 72 h')
    expect(texte).toContain('Plus de 500 commissions à valider')
  })

  it('sans montant payé connu, pas de ligne « Payé par le client »', () => {
    const { texte } = rendre(FileCommissions, [[['admin-closer-commissions', 'a_valider'], {
      commissions: [commission({ montant_facture_centimes: null, source: 'manuel', note: null, signaux: [] })], tronque: false,
    }]])
    expect(texte).not.toContain('Payé par le client')
    expect(texte).not.toContain('Plus de 500')
    expect(texte).toContain('Saisie manuelle')
  })

  it('« À payer » fait ressortir un IBAN récent avant le virement', () => {
    const { html, texte } = rendre(CommissionsAPayer, [[['admin-closer-commissions', 'validee'], {
      commissions: [commission({ statut: 'validee' }), commission({ id: 'com_2', boutique: 'Autre Boutique', signaux: ['iban_recent'], montant_facture_centimes: null })],
      tronque: false,
    }]])
    expect(texte).toContain('Alerte avant virement')
    expect(texte).toContain('Payé par le client : 89 €')
    expect(texte).toContain('Appel du closer le 2 septembre')
    expect(texte).toContain('Même domaine d’e-mail que le client')
    // Le badge de l'IBAN récent est rouge dans « À payer » ; les autres restent en avertissement.
    expect(html).toMatch(/<li class="[^"]*bg-red-50[^"]*">.*?IBAN modifié il y a moins de 72 h<\/li>/)
    expect(html).toMatch(/<li class="[^"]*bg-warn-bg[^"]*">.*?Même domaine/)
    expect(texte).toContain('200 €')
  })

  it('« À payer » sans IBAN récent n’affiche pas d’alerte', () => {
    const { texte } = rendre(CommissionsAPayer, [[['admin-closer-commissions', 'validee'], {
      commissions: [commission({ statut: 'validee', signaux: [] })], tronque: false,
    }]])
    expect(texte).not.toContain('Alerte avant virement')
    expect(texte).toContain('Révéler l’IBAN')
  })
})

describe('onglet « Historique » (rendu)', () => {
  const historique = (payees, refusees, annulees) => [
    [['admin-closer-commissions', 'payee'], payees],
    [['admin-closer-commissions', 'refusee'], refusees],
    [['admin-closer-commissions', 'annulee'], annulees],
  ]

  it('réunit payées, refusées et annulées, la plus récente d’abord, avec la note complète et la coupure', () => {
    const { texte } = rendre(Historique, historique(
      { commissions: [commission({ id: 'p1', statut: 'payee', boutique: 'Boutique Payée', payee_at: '2026-09-10T09:00:00Z', note: 'Saisie Shopify\nFacture remboursée après paiement', signaux: [] })], tronque: true },
      { commissions: [commission({ id: 'r1', statut: 'refusee', boutique: 'Boutique Refusée', created_at: '2026-09-12T09:00:00Z', note: 'Première note\nClient parti au bout d’une semaine', montant_facture_centimes: null })], tronque: false },
      { commissions: [commission({ id: 'a1', statut: 'annulee', boutique: 'Boutique Annulée', created_at: '2026-08-01T09:00:00Z', note: 'Facture remboursée par le client' })], tronque: false },
    ))
    expect(texte).toContain('Facture remboursée après paiement')
    expect(texte).toContain('Client parti au bout d’une semaine')
    expect(texte).toContain('Première note')
    expect(texte).toContain('Plus de 500 commissions « Payée »')
    expect(texte).toMatch(/Tout 3 .*Payées 1 .*Refusées 1 .*Annulées 1/)
    expect(texte).toContain('Total : 300 €')
    const ordre = ['Boutique Refusée', 'Boutique Payée', 'Boutique Annulée'].map((b) => texte.indexOf(b))
    expect(ordre).toEqual([...ordre].sort((a, b) => a - b))
    expect(texte).toContain('Payée le 10 sept. 2026')
    expect(texte).toContain('Créée le 12 sept. 2026')
  })

  it('le badge de remboursement ne marque que la commission payée puis remboursée', () => {
    const { html } = rendre(Historique, historique(
      { commissions: [commission({ id: 'p1', statut: 'payee', note: 'Remboursement partiel de 10,00 € par le client' }), commission({ id: 'p2', statut: 'payee', note: 'RAS' })], tronque: false },
      { commissions: [], tronque: false },
      { commissions: [commission({ id: 'a1', statut: 'annulee', note: 'Facture remboursée par le client' })], tronque: false },
    ))
    expect(html.match(/bg-red-50/g)).toHaveLength(1)
    expect(html).toContain('Facture remboursée en partie')
  })

  it('un historique vide le dit', () => {
    const vide = { commissions: [], tronque: false }
    expect(rendre(Historique, historique(vide, vide, vide)).texte).toContain('Aucune commission dans l’historique.')
  })
})

describe('Attributions : rejouer les factures Stripe (rendu)', () => {
  const texteDe = (element) => renderToStaticMarkup(element).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

  it('le bouton n’apparaît que pour un client rattaché', () => {
    const { texte } = rendre(Attributions, [[['admin-closer-attribution', ''], {
      closers: [{ id: 'clo_1', prenom: 'Léa', nom: 'Martin', code: 'LEA', statut: 'actif' }],
      clients: [
        { id: 'cli_1', boutique: 'Rattachée', contact_email: 'a@exemple.fr', plan: 'pro', closer_id: 'clo_1', source: 'manuel', rattache_le: '2026-09-01T09:00:00Z' },
        { id: 'cli_2', boutique: 'Libre', contact_email: 'b@exemple.fr', plan: 'starter', closer_id: null, source: null, rattache_le: null },
      ],
    }]])
    expect(texte.match(/Rejouer les factures Stripe/g)).toHaveLength(1)
    expect(texte.match(/Retirer/g)).toHaveLength(1)
    expect(texte).toContain('Léa Martin (LEA)')
  })

  it('résume les issues : créées, déjà créées, puis le reste en français', () => {
    const texte = texteDe(h(ResultatRejeu, { rejeu: { resultats: [
      { facture: 'in_1', issue: 'creee' },
      { facture: 'in_2', issue: 'deja_creee' },
      { facture: 'in_3', issue: 'unique_deja_versee' },
      { facture: 'in_4', issue: 'erreur' },
    ] } }))
    expect(texte).toContain('4 factures payées relues chez Stripe.')
    expect(texte).toMatch(/Commissions créées : 1 · déjà créées : 1/)
    expect(texte).toContain('Commission unique déjà versée pour ce client : 1')
    expect(texte).toContain('En erreur : 1 — relancez ; si l’erreur persiste, voyez Sentry')
  })

  it('dit quand il n’y a rien à rejouer, et affiche l’erreur de l’API telle quelle', () => {
    expect(texteDe(h(ResultatRejeu, { rejeu: { resultats: [] } }))).toContain('Aucune facture payée chez Stripe pour ce client')
    const erreur = texteDe(h(ResultatRejeu, { rejeu: { erreur: 'Stripe n’est pas configuré sur ce déploiement.' } }))
    expect(erreur).toContain('Stripe n’est pas configuré sur ce déploiement.')
  })
})
