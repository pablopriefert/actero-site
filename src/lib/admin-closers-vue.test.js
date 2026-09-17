import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
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
  it('ses six vues existent', () => {
    expect(VUES.map((f) => f.split('/').pop()).sort()).toEqual([
      'AdminClosersView.jsx', 'Attributions.jsx', 'CommissionsAPayer.jsx', 'FileCommissions.jsx', 'ListeClosers.jsx', 'SaisieManuelle.jsx',
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
        { issue: 'hors_grille', nombre: 1, libelle: 'Hors grille (facture, formule ou plan sans commission)' },
        { issue: 'non_traitee', nombre: 1, libelle: 'Non traitées faute de temps : relancez pour continuer' },
        { issue: 'inedite', nombre: 1, libelle: 'Autre issue (inedite)' },
      ],
      aRelancer: true,
    })
    expect(resumeRejeu([])).toEqual({ factures: 0, creees: 0, dejaCreees: 0, autres: [], aRelancer: false })
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
