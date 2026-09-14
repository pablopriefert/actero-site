import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { PLANS } from '../../src/lib/plans.js'
import { PLAN_FEATURES } from './plan-limits.js'

/**
 * Ce qu'on vend doit exister — le registre des preuves.
 *
 * LE DÉFAUT QUE CE FICHIER EXISTE POUR ARRÊTER
 *
 * Le 10 septembre 2026, un audit de la page tarifs a trouvé SIX
 * fonctionnalités vendues et injoignables. Aucune ne provoquait d'erreur.
 * Chacune l'était pour une raison différente :
 *
 *   multi-boutiques        rien ne l'implémentait
 *   portail white-label    drapeau à false sur les quatre plans
 *   relance SMS            aucun envoi SMS dans le flux
 *   remises conditionnelles aucun code promo généré
 *   rapport PDF            aucune librairie PDF dans le projet
 *   rétention d'historique  valeur lue uniquement pour l'affichage
 *
 * Et le portail à lui seul a demandé QUATRE correctifs successifs et
 * indépendants avant qu'un marchand puisse s'en servir : le drapeau de plan,
 * une adresse jamais générée, une barre de navigation invisible, un drapeau
 * de compilation qui cachait l'onglet.
 *
 * POURQUOI UNE TABLE ÉCRITE À LA MAIN
 *
 * On ne peut pas déduire d'un dépôt qu'une promesse commerciale est tenue :
 * l'existence d'un fichier au bon nom ne prouve rien — c'est exactement
 * l'erreur qui a laissé passer les six. Il faut donc dire explicitement, pour
 * chaque chose vendue, CE QUI PROUVE qu'elle marche. Ce fichier est cette
 * table, et le test refuse qu'un drapeau passe à `true` sans elle.
 *
 * Ajouter une fonctionnalité payante coûte donc une ligne ici. C'est le prix,
 * et il est très inférieur à celui d'un marchand qui découvre tout seul qu'il
 * paie pour une porte fermée.
 */

/**
 * @typedef {object} Preuve
 * @property {string} vendu       ce que le client lit sur la page tarifs
 * @property {string[]} [fichiers] doivent exister — le code qui la réalise
 * @property {[string, RegExp][]} [motifs] fichier → motif qui doit s'y trouver,
 *   quand l'existence ne suffit pas et qu'il faut prouver le BRANCHEMENT
 * @property {string} [pourquoi]  ce que la preuve démontre, s'il faut le dire
 */

/** @type {Record<string, Preuve>} */
const PREUVES = {
  guardrails: {
    vendu: 'Règles & limites',
    fichiers: ['src/components/client/GuardrailsEditor.jsx'],
    motifs: [['src/pages/ClientDashboard.jsx', /<PlanGate feature="guardrails"/]],
  },

  simulator: {
    vendu: 'Simulateur de conversation',
    fichiers: ['src/components/client/ConversationSimulator.jsx'],
    motifs: [['src/pages/ClientDashboard.jsx', /<PlanGate feature="simulator"/]],
  },

  specialized_agents: {
    vendu: 'Agents IA spécialisés (WISMO, retour, produit, proactif)',
    fichiers: [
      'api/engine/agents/order-agent.js',
      'api/engine/agents/return-agent.js',
    ],
    // Le 8 septembre, ces agents existaient et n'avaient JAMAIS tourné : un mot
    // manquant dans une requête faisait croire que tous les comptes étaient en
    // formule gratuite. C'est le routage qu'il faut prouver, pas les fichiers.
    motifs: [['api/engine/brain.js', /canAccessFeature\(/]],
    pourquoi: 'le cerveau route vraiment vers les agents spécialisés',
  },

  api_webhooks: {
    vendu: 'API REST + Webhooks',
    fichiers: ['api/client/webhooks.js'],
    motifs: [['src/pages/ClientDashboard.jsx', /<PlanGate feature="api_webhooks"/]],
  },

  pdf_report: {
    vendu: 'Rapport PDF mensuel auto-envoyé',
    fichiers: ['api/lib/rapport-pdf.js'],
    // Une librairie PDF ne suffit pas : il faut que le cron l'appelle ET
    // réserve la pièce jointe aux plans qui la paient.
    motifs: [
      ['api/cron/monthly-report.js', /construireRapportPdf\(/],
      ['api/cron/monthly-report.js', /canAccessFeature\([^)]*'pdf_report'\)/],
    ],
    pourquoi: 'le PDF est réellement généré et joint, et seulement pour ceux qui le paient',
  },

  portal_enabled: {
    vendu: 'Portail client en marque blanche',
    fichiers: [
      'api/portal/resolve-client.js',
      'api/client/toggle-portal.js',
      'api/lib/portal-slug.js',
      'src/pages/portal/PortalApp.jsx',
    ],
    motifs: [
      // Le quatrième verrou : l'onglet doit être visible, sinon le marchand
      // n'a aucun moyen d'activer ce qu'il paie.
      ['src/config/features.js', /portalSav: true/],
      // Le troisième : sans adresse, la fonctionnalité n'est pas joignable.
      ['api/client/toggle-portal.js', /assurerSlugPortail\(/],
      // Et la garde côté serveur, pas seulement un bouton grisé.
      ['api/client/toggle-portal.js', /clientHasEntitlement\(/],
    ],
    pourquoi: 'onglet visible, adresse générée, activation refusée côté serveur',
  },

  portal_customization: {
    vendu: 'White-label du portail (branding Actero retiré)',
    fichiers: ['api/client/update-portal-branding.js', 'src/components/client/PortalBrandingView.jsx'],
  },

  email_agent: {
    vendu: 'Agent Email natif Actero',
    fichiers: ['api/email/settings.js', 'src/components/client/EmailAgentView.jsx'],
    motifs: [
      ['src/config/features.js', /emailAgent: true/],
      ['vercel.json', /poll-inbound-emails/],
    ],
    pourquoi: 'onglet visible et cron d\'interrogation réellement planifié',
  },

  white_label: {
    vendu: 'White-label du widget',
    fichiers: ['api/client/widget-settings.js'],
  },
}

/**
 * Ce qui est vendu sur AUCUN plan n'a pas à être prouvé — mais doit être
 * déclaré ici, pour que « personne n'y a droit » reste un choix visible et
 * pas un oubli.
 */
const VOLONTAIREMENT_FERMES = {
  multi_shop:
    "Vendu sur Enterprise jusqu'au 9 septembre (« 10 stores »), jamais construit : "
    + 'les 21 fichiers qui lisent la connexion Shopify la traitent comme unique. '
    + 'Le drapeau est à false partout et la promesse a été retirée de la page tarifs. '
    + 'Le remettre à true suppose de construire la fonctionnalité (ACT-29).',
}

// `roi_dashboard` porte un niveau ('basic' | 'full' | 'custom') et non un
// booléen : ce n'est pas une porte ouverte ou fermée, c'est la même page avec
// plus ou moins de cartes. Rien à prouver au sens de ce fichier.
const NON_BOOLEENS = ['roi_dashboard']

const PLANS_ATTENDUS = ['free', 'starter', 'pro', 'enterprise']

function ouverteQuelquePart(cle) {
  return PLANS_ATTENDUS.some((p) => PLANS[p].features[cle] === true)
}

describe('les promesses tenues', () => {
  it('toute fonctionnalité ouverte sur un plan a une preuve déclarée', () => {
    // C'est LE test. Sans lui, ouvrir un drapeau est gratuit — et six fois sur
    // six cette année, ça a suffi à vendre une porte fermée.
    const sansPreuve = []
    for (const cle of Object.keys(PLANS.enterprise.features)) {
      if (NON_BOOLEENS.includes(cle)) continue
      if (!ouverteQuelquePart(cle)) {
        if (!VOLONTAIREMENT_FERMES[cle]) {
          sansPreuve.push(`${cle} : fermée partout, sans raison écrite dans VOLONTAIREMENT_FERMES`)
        }
        continue
      }
      if (!PREUVES[cle]) sansPreuve.push(`${cle} : ouverte sur un plan, aucune preuve dans PREUVES`)
    }
    expect(
      sansPreuve,
      `Vendu sans preuve — ajoutez l'entrée, ou refermez le drapeau :\n${sansPreuve.join('\n')}`,
    ).toEqual([])
  })

  it('chaque preuve déclarée tient encore', () => {
    const rompues = []
    for (const [cle, preuve] of Object.entries(PREUVES)) {
      if (!ouverteQuelquePart(cle)) continue
      for (const f of preuve.fichiers || []) {
        if (!existsSync(f)) rompues.push(`${cle} (« ${preuve.vendu} ») : ${f} a disparu`)
      }
      for (const [f, motif] of preuve.motifs || []) {
        if (!existsSync(f)) { rompues.push(`${cle} : ${f} a disparu`); continue }
        if (!motif.test(readFileSync(f, 'utf8'))) {
          rompues.push(`${cle} (« ${preuve.vendu} ») : ${f} ne contient plus ${motif}`)
        }
      }
    }
    expect(
      rompues,
      `Une promesse vendue n'est plus tenue :\n${rompues.join('\n')}`,
    ).toEqual([])
  })

  it('ce qui est prouvé ici est bien ce que la page tarifs annonce', () => {
    // Le registre ne vaut que s'il décrit la MÊME chose que le client lit.
    // Si une promesse disparaît de la grille sans que le drapeau se referme,
    // on garde du code payant que plus personne n'achète ; si elle y
    // réapparaît sans preuve, on retombe dans le défaut de septembre.
    const tarifs = readFileSync('src/pages/PricingPage.jsx', 'utf8')
    const absentes = []
    for (const [cle, preuve] of Object.entries(PREUVES)) {
      if (!ouverteQuelquePart(cle)) continue
      // On cherche les deux ou trois premiers mots de la promesse : la
      // formulation exacte bouge (« Portail client en marque blanche » vs
      // « White-label du widget et du portail »), le sujet non.
      const noyau = preuve.vendu.split(' ').slice(0, 2).join(' ')
      if (!tarifs.toLowerCase().includes(noyau.toLowerCase())) {
        absentes.push(`${cle} : « ${preuve.vendu} » ne se retrouve plus sur la page tarifs`)
      }
    }
    expect(
      absentes,
      `Prouvé mais plus vendu — refermez le drapeau, ou remettez la phrase :\n${absentes.join('\n')}`,
    ).toEqual([])
  })

  it('les deux fichiers de plans déclarent les mêmes fonctionnalités', () => {
    // Le miroir serveur avait purement et simplement OUBLIÉ les clés du
    // portail : toute vérification côté serveur répondait donc « non » pour
    // tous les plans, quoi qu'annonce la source.
    const divergences = []
    for (const plan of PLANS_ATTENDUS) {
      const cles = new Set([
        ...Object.keys(PLANS[plan].features),
        ...Object.keys(PLAN_FEATURES[plan]),
      ])
      for (const cle of cles) {
        if (PLANS[plan].features[cle] !== PLAN_FEATURES[plan][cle]) {
          divergences.push(`${plan}.${cle}`)
        }
      }
    }
    expect(divergences, `Miroir désynchronisé : ${divergences.join(', ')}`).toEqual([])
  })
})
