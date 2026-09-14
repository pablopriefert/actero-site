import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'

/**
 * Un canal auquel on sait RÉPONDRE doit être un canal dont on sait RECEVOIR.
 *
 * CE QUE CE FICHIER EXISTE POUR ARRÊTER
 *
 * Le 11 septembre 2026, en balayant les exports que rien n'importe : Intercom
 * est proposé au marchand comme helpdesk, la connexion OAuth fonctionne, un
 * badge « Connecté » s'affiche — et aucune conversation n'arrive jamais.
 *
 *   api/integrations/intercom/{authorize,callback}.js   la connexion marche
 *   api/engine/connectors/intercom.js                   5 fonctions écrites,
 *                                                       importées par personne
 *   api/engine/webhooks/                                pas d'intercom.js
 *   connector-registry.js:23   intercom: sendViaEmail,  // repli email
 *
 * Il n'y a pas d'erreur à voir. C'est une absence, et une absence ne se
 * signale pas toute seule. Même famille qu'ACT-31 (« Gorgias et Zendesk
 * tournaient sur l'ancien moteur »), mais un cran plus loin : là il y avait un
 * ancien chemin, ici il n'y en a aucun.
 *
 * POURQUOI PAS UNE GARDE SUR LA CATÉGORIE
 *
 * `src/config/integrations.js` étiquetait Gorgias, Zendesk ET Intercom
 * `category: 'ecommerce'` alors que ce sont des helpdesks. Se fier à ce champ
 * aurait donné une garde qui ne regarde rien. On ancre donc sur le registre de
 * connecteurs, qui est la vraie liste des canaux que le moteur connaît.
 *
 * Ce champ a depuis été retiré (11 septembre) : il n'était lu par personne, et
 * l'écran des intégrations groupe via `INTEGRATION_CATEGORIES[].ids`, qui
 * range ces trois-là sous `helpdesk` correctement. Voir
 * src/config/integrations.test.js. L'ancrage sur le registre reste le bon :
 * il décrit ce que le MOTEUR sait faire, pas ce que l'écran affiche.
 */

/**
 * Comment une conversation ENTRE, pour chaque canal du registre.
 *
 * `null` = pas de chemin entrant, et il faut alors une raison écrite dans
 * LACUNES_CONNUES. C'est le prix : ajouter un canal oblige à dire par où il
 * reçoit, ou à assumer par écrit qu'il ne reçoit rien.
 */
const CHEMINS_ENTRANTS = {
  //                        par où ça entre                          un client y écrit-il ?
  email:      { chemin: 'api/engine/webhooks/inbound-email.js', conversationnel: true },
  gorgias:    { chemin: 'api/engine/webhooks/gorgias.js',       conversationnel: true },
  zendesk:    { chemin: 'api/engine/webhooks/zendesk.js',       conversationnel: true },
  web_widget: { chemin: 'api/engine/webhooks/widget.js',        conversationnel: true },
  intercom:   { chemin: null,                                    conversationnel: true },
  crisp:      { chemin: null,                                    conversationnel: true },
  slack:      { chemin: null,                                    conversationnel: false },
  shopify:    { chemin: null,                                    conversationnel: false },
}

const LACUNES_CONNUES = {
  slack:
    "Slack est un canal de NOTIFICATION vers l'équipe du marchand, pas un canal "
    + "où un client écrit. Rien à recevoir.",
  shopify:
    "Shopify n'est pas un canal de conversation : il fournit les commandes et "
    + "déclenche `checkouts/create`. Son entrée vit dans api/engine/webhooks/"
    + "shopify-cart.js, qui n'est pas un canal de support.",
  intercom:
    "ACT-40 — RETIRÉ DE L'OFFRE le 11 septembre 2026. C'est la lacune que ce "
    + "fichier a servi à trouver : proposé au marchand, connectable, et sans "
    + "aucun chemin entrant. Des deux issues — construire le webhook ou retirer "
    + "l'intégration — Pablo a tranché pour la seconde. Le code reste en place "
    + "(OAuth, les 5 fonctions du connecteur, l'import E2B de l'historique), "
    + "prêt si l'arbitrage change ; seules les surfaces qui le PROMETTAIENT ont "
    + "été retirées : le catalogue, la grille de la landing, le hub des canaux "
    + "et l'article d'aide. Même état que crisp désormais.",
  crisp:
    "Présent dans le registre avec un repli email, mais PAS proposé dans "
    + "src/config/integrations.js. Configuration morte, sans conséquence "
    + "marchand — à retirer si personne ne la revendique.",
}

function registre() {
  const src = readFileSync('api/engine/lib/connector-registry.js', 'utf8')
  const bloc = src.slice(src.indexOf('const CONNECTORS'), src.indexOf('}', src.indexOf('const CONNECTORS')))
  return [...bloc.matchAll(/^\s*([a-z_]+)\s*:/gm)].map((m) => m[1])
}

describe('canaux entrants du moteur', () => {
  it('chaque canal du registre est classé : il reçoit, ou on sait pourquoi il ne reçoit pas', () => {
    // La garde qui compte. Ajouter un canal sans dire par où il reçoit devient
    // impossible — c'est exactement ce qui a laissé passer Intercom.
    const nonClasses = registre().filter((c) => !(c in CHEMINS_ENTRANTS))
    expect(
      nonClasses,
      'Canal ajouté au registre sans chemin entrant déclaré :\n' + nonClasses.join('\n'),
    ).toEqual([])
  })

  it('les chemins entrants déclarés existent vraiment', () => {
    const manquants = Object.entries(CHEMINS_ENTRANTS)
      .filter(([, v]) => v.chemin && !existsSync(v.chemin))
      .map(([canal, v]) => `${canal} → ${v.chemin}`)
    expect(manquants, 'Chemin entrant déclaré mais absent :\n' + manquants.join('\n')).toEqual([])
  })

  it('toute lacune est écrite, pas subie', () => {
    // Un canal sans chemin entrant doit porter une raison. Sans ça, « pas de
    // webhook » devient indistinguable de « on a oublié » — et c'est
    // précisément ce qui s'est passé.
    const muettes = Object.entries(CHEMINS_ENTRANTS)
      .filter(([canal, v]) => v.chemin === null && !LACUNES_CONNUES[canal])
      .map(([canal]) => canal)
    expect(
      muettes,
      'Canal sans chemin entrant ET sans raison écrite :\n' + muettes.join('\n'),
    ).toEqual([])
  })

  it('un canal de CONVERSATION proposé au marchand doit pouvoir recevoir', () => {
    // Le cœur du problème, et le discriminant qui compte.
    //
    // Ce n'est pas « être proposé sans webhook » qui pose problème : Slack et
    // Shopify sont proposés et n'ont aucun chemin entrant, ce qui est juste —
    // aucun client n'y écrit. Slack notifie l'équipe, Shopify fournit les
    // commandes.
    //
    // Ce qui coûte, c'est de proposer un canal où un CLIENT écrit, et de ne
    // pas savoir le recevoir. Le marchand branche, voit « Connecté », et
    // n'obtient rien — sans une seule erreur pour le lui dire.
    const integrations = readFileSync('src/config/integrations.js', 'utf8')
    const fautifs = []
    for (const [canal, v] of Object.entries(CHEMINS_ENTRANTS)) {
      if (v.chemin !== null || !v.conversationnel) continue
      if (!new RegExp(`id: '${canal}'`).test(integrations)) continue
      const raison = LACUNES_CONNUES[canal] || ''
      if (!/PROPOSÉ AU MARCHAND/.test(raison)) {
        fautifs.push(
          `${canal} — canal de conversation proposé au marchand, aucun chemin entrant, `
          + `et la lacune n'est pas signalée dans LACUNES_CONNUES`,
        )
      }
    }
    expect(fautifs, fautifs.join('\n')).toEqual([])
  })
})
