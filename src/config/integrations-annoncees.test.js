import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'

/**
 * Ce que le site ANNONCE doit être ce que le moteur SAIT FAIRE. — ACT-41
 *
 * CE QUE CE FICHIER EXISTE POUR ARRÊTER
 *
 * Le 11 septembre 2026, en retirant Intercom (ACT-40), quatre surfaces
 * publiques annonçaient des helpdesks — et aucune ne s'accordait avec une
 * autre, ni avec le moteur :
 *
 *   le moteur (webhooks + registre)    Gorgias, Zendesk
 *   FaqPage « intégrations disponibles » + Tidio, Crisp
 *   ProductPage « logos réels supportés » + Tidio, Crisp
 *   IntegrationGrid (landing)          + HubSpot
 *
 * Tidio et HubSpot n'avaient **aucun fichier** — ni connecteur, ni route
 * d'intégration. Crisp n'existait que comme une ligne du registre retombant
 * sur l'email, sans chemin entrant : l'état exact d'Intercom avant son
 * retrait.
 *
 * Ce ne sont pas des formules commerciales. « Quelles intégrations sont
 * DISPONIBLES » et « logos réels SUPPORTÉS » sont des affirmations de fait.
 * Le coût est celui d'ACT-40 : un marchand choisit Actero parce qu'il utilise
 * Tidio, et le découvre après.
 *
 * POURQUOI LA GARDE NE REGARDE QUE CERTAINS BLOCS
 *
 * Le site NOMME légitimement ces produits ailleurs : `/alternative-tidio`,
 * `/intercom-vs-actero`, la question « en quoi Actero est-il différent de
 * Gorgias, Zendesk ou Tidio ? ». Ce sont des comparaisons, pas des promesses.
 *
 * Une garde qui bannirait ces noms partout serait rouge en permanence — donc
 * désactivée ou ignorée, ce qui est pire qu'aucune garde. Elle s'ancre donc
 * sur les STRUCTURES qui listent des intégrations, pas sur la prose.
 */

/**
 * Produits de support qu'Actero ne sait PAS recevoir, chacun avec sa raison.
 * Les annoncer comme intégration est un engagement qu'on ne tient pas.
 */
const NON_SUPPORTES = {
  Tidio: 'aucun fichier — ni connecteur, ni route d’intégration (11 sept. 2026)',
  Crisp: 'une ligne du registre avec repli email, aucun chemin entrant — '
    + 'l’état exact d’Intercom avant son retrait (ACT-40)',
  Intercom: 'retiré de l’offre le 11 sept. 2026 faute de webhook entrant (ACT-40). '
    + 'Le code OAuth et le connecteur restent, l’import d’historique aussi — '
    + 'mais ce n’est pas une intégration de canal',
  HubSpot: 'aucun fichier ; la tuile promettait « synchronisation CRM et '
    + 'scoring clients », qui n’existe nulle part',
  Shippo: 'aucun fichier — le suivi transporteur remonte via Shopify',
  Sendcloud: 'aucun fichier — idem',
  Freshdesk: 'jamais construit',
  'Help Scout': 'jamais construit',
  'Re:amaze': 'jamais construit',
  Outlook: 'reconnu comme fournisseur dans ChannelsHubView mais non '
    + 'connectable : absent du catalogue, aucune route OAuth',
}

/**
 * Les blocs qui ANNONCENT des intégrations. Chacun est extrait par sa
 * structure, pas par une recherche de texte — c'est ce qui permet aux pages
 * de comparaison de nommer les mêmes produits sans faire échouer la garde.
 */
function blocsAnnonces() {
  const blocs = []

  // ProductPage — l'objet `integrations`.
  const produit = readFileSync('src/pages/ProductPage.jsx', 'utf8')
  const mProduit = produit.match(/const integrations = \{[\s\S]*?\n {2}\}/)
  blocs.push({ nom: 'ProductPage → const integrations', texte: mProduit?.[0] })

  // IntegrationGrid — la table des tuiles de la landing.
  const grille = readFileSync('src/components/landing/IntegrationGrid.jsx', 'utf8')
  const mGrille = grille.match(/const INTEGRATIONS = \{[\s\S]*?\n\}/)
  blocs.push({ nom: 'IntegrationGrid → const INTEGRATIONS', texte: mGrille?.[0] })

  // FaqPage — la réponse à « Quelles intégrations sont disponibles ? », et
  // elle seule. Les autres réponses comparent, et ont le droit de nommer.
  const faq = readFileSync('src/pages/FaqPage.jsx', 'utf8')
  const mFaq = faq.match(/q: "Quelles intégrations sont disponibles \?",\s*\n\s*a: "([^"]*)"/)
  blocs.push({ nom: 'FaqPage → « Quelles intégrations sont disponibles ? »', texte: mFaq?.[1] })

  // Le catalogue produit lui-même.
  const cat = readFileSync('src/config/integrations.js', 'utf8')
  blocs.push({ nom: 'src/config/integrations.js', texte: cat })

  return blocs
}

describe('ACT-41 — le site n’annonce que ce qui existe', () => {
  it('chaque bloc d’annonce a bien été trouvé', () => {
    // Si une structure est renommée, l'extraction renvoie `undefined` et la
    // garde ci-dessous passe au vert sans rien regarder. Un test qui ne peut
    // pas échouer rassure à tort.
    const perdus = blocsAnnonces().filter((b) => !b.texte).map((b) => b.nom)
    expect(
      perdus,
      'Bloc d’annonce introuvable — la garde ne regarde plus rien :\n  ' + perdus.join('\n  '),
    ).toEqual([])
  })

  it('aucun bloc n’annonce un produit qu’on ne sait pas recevoir', () => {
    const fautifs = []
    for (const bloc of blocsAnnonces()) {
      if (!bloc.texte) continue
      for (const [produit, raison] of Object.entries(NON_SUPPORTES)) {
        if (new RegExp(`\\b${produit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(bloc.texte)) {
          fautifs.push(`${bloc.nom} annonce ${produit} — ${raison}`)
        }
      }
    }
    expect(
      fautifs,
      'Intégration annoncée sans rien derrière. Deux issues : la construire, '
      + 'ou la retirer de l’annonce.\n  ' + fautifs.join('\n  '),
    ).toEqual([])
  })

  it('les helpdesks annoncés sont ceux dont le moteur sait recevoir', () => {
    // L'autre sens : plutôt que d'énumérer l'interdit, on vérifie que les
    // helpdesks du catalogue ont chacun un webhook entrant. C'est la garde
    // d'ACT-40 (canaux-entrants.test.js) appliquée au catalogue public.
    const cat = readFileSync('src/config/integrations.js', 'utf8')
    const groupeHelpdesk = cat.match(/id: 'helpdesk',[\s\S]*?ids: \[([^\]]*)\]/)
    expect(groupeHelpdesk, 'le groupe helpdesk a disparu du catalogue').not.toBeNull()

    const annonces = [...groupeHelpdesk[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1])
    const sansEntree = annonces.filter((id) => !existsSync(`api/engine/webhooks/${id}.js`))
    expect(
      sansEntree,
      'Helpdesk proposé au marchand sans webhook entrant : il se connectera, '
      + 'verra « Connecté », et ne recevra jamais rien.\n  ' + sansEntree.join('\n  '),
    ).toEqual([])
  })
})
