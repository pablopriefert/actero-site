/**
 * Registre des actions du moteur : risque, effet externe, réversibilité.
 *
 * Pourquoi ce fichier existe. L'exécuteur sait faire onze choses, et rien ne
 * distinguait « incrémenter un compteur » de « écrire au client du marchand en
 * son nom ». Les deux étaient une entrée de `switch`.
 *
 * Le 9 septembre 2026, une réponse tronquée est partie à un client sous la
 * forme `{ "response": "Je comprends votre inquietude…`. C'était une action
 * HIGH, irréversible et adressée à un tiers, traitée avec la même désinvolture
 * qu'un log. Ce registre existe pour que cette différence soit écrite quelque
 * part et vérifiable.
 *
 * Trois axes, délibérément séparés :
 *
 *   risk        ce qu'on perd si l'action part à tort
 *   external    l'action sort-elle du système ? (appel tiers, message envoyé)
 *   reversible  peut-on VRAIMENT l'annuler ? Jamais « oui » par optimisme.
 *
 * `reversible: false` sur un message n'est pas une limite technique à lever :
 * un message lu ne se retire pas. Prétendre le contraire serait pire que de ne
 * rien annoncer.
 */

/** Niveaux, du moins au plus grave. L'ordre sert aux comparaisons. */
export const NIVEAUX_DE_RISQUE = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']

/**
 * @typedef {object} DefinitionAction
 * @property {'LOW'|'MEDIUM'|'HIGH'|'CRITICAL'} risk
 * @property {boolean} external    sort du système (tiers ou destinataire humain)
 * @property {boolean} reversible  réellement annulable, sans faire semblant
 * @property {string}  effet       ce que ça fait, en une phrase
 */

/** @type {Record<string, DefinitionAction>} */
export const ACTIONS = {
  /* ── Interne, sans effet dehors ─────────────────────────────────────── */
  log_metric: {
    risk: 'LOW', external: false, reversible: true,
    effet: 'Incrémente un compteur interne. Aucun effet visible.',
  },
  tag_contact: {
    risk: 'LOW', external: false, reversible: true,
    effet: 'Pose une étiquette interne sur le contact.',
  },
  wait_then: {
    risk: 'LOW', external: false, reversible: true,
    effet: 'Diffère la suite du plan. Rien n\'est envoyé.',
  },

  /* ── Lectures externes ──────────────────────────────────────────────── */
  lookup_order: {
    risk: 'LOW', external: true, reversible: true,
    effet: 'Lit une commande chez Shopify. Lecture seule.',
  },
  check_treasury: {
    risk: 'LOW', external: true, reversible: true,
    effet: 'Lit les soldes chez le fournisseur comptable. Lecture seule.',
  },

  /* ── Crée du travail interne ────────────────────────────────────────── */
  create_ticket: {
    risk: 'MEDIUM', external: false, reversible: true,
    effet: 'Crée un ticket dans le helpdesk. Supprimable.',
  },

  /* ── Sort du système vers le MARCHAND ───────────────────────────────── */
  notify_slack: {
    risk: 'MEDIUM', external: true, reversible: false,
    effet: 'Poste dans le Slack du marchand. Un message posté ne se dépose pas.',
  },
  escalate: {
    risk: 'MEDIUM', external: true, reversible: false,
    effet: 'Crée un ticket d\'escalade et alerte le marchand.',
  },

  /* ── Sort du système vers le CLIENT DU MARCHAND, en son nom ─────────── */
  send_reply: {
    risk: 'HIGH', external: true, reversible: false,
    effet: 'Répond au client du marchand, sous son nom. Irréversible.',
  },
  send_email: {
    risk: 'HIGH', external: true, reversible: false,
    effet: 'Envoie un email au client du marchand. Irréversible.',
  },
  send_invoice_reminder: {
    risk: 'HIGH', external: true, reversible: false,
    effet: 'Relance un client du marchand sur une facture impayée. Irréversible et sensible.',
  },
}

/**
 * Le risque le plus élevé d'un plan d'action.
 *
 * Un plan vaut son maillon le plus dangereux : `['log_metric', 'send_reply']`
 * est un plan HIGH, pas un plan LOW avec un détail.
 *
 * @param {string[]} plan
 * @returns {'LOW'|'MEDIUM'|'HIGH'|'CRITICAL'|null} null si le plan est vide
 */
export function risqueDuPlan(plan) {
  const niveaux = (plan || [])
    .map((a) => ACTIONS[a]?.risk)
    .filter(Boolean)
    .map((r) => NIVEAUX_DE_RISQUE.indexOf(r))
  if (niveaux.length === 0) return null
  return NIVEAUX_DE_RISQUE[Math.max(...niveaux)]
}

/**
 * Les actions d'un plan qui sortent du système et ne peuvent pas être annulées.
 *
 * C'est la liste qui compte avant d'exécuter quoi que ce soit automatiquement :
 * ce qu'on ne pourra pas rattraper.
 *
 * @param {string[]} plan
 * @returns {string[]}
 */
export function actionsIrreversibles(plan) {
  return (plan || []).filter((a) => {
    const d = ACTIONS[a]
    return d && d.external && !d.reversible
  })
}

/** Une action est-elle connue du registre ? */
export function actionConnue(nom) {
  return Object.prototype.hasOwnProperty.call(ACTIONS, nom)
}
