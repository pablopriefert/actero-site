/**
 * Détection d'un ARRÊT du moteur — pas d'une absence de trafic.
 *
 * Le fait qui justifie ce fichier : le moteur n'a traité aucun message du
 * 11 juillet au 8 septembre 2026, et personne ne s'en est aperçu. Deux mois.
 * Relevé exact en base au 9 septembre :
 *
 *   Actero               74 événements, 21 mai → 11 juillet   60 jours de silence
 *   Boutique E-com Test  27 événements, 10 avril → 7 juillet  64 jours de silence
 *
 * Le piège de conception est là. Un moniteur « zéro événement en 24 h »
 * sonnerait aujourd'hui pour les QUATRE clients de la base, dont deux qui n'ont
 * jamais rien produit. Une alerte qui sonne toujours n'est pas une alerte :
 * c'est ce qui apprend à les ignorer, et c'est exactement pourquoi les 24
 * échecs n8n du 26 août n'ont alerté personne.
 *
 * Le bon signal est donc une CHUTE : un client qui avait du trafic et n'en a
 * plus. Un client qui n'en a jamais eu n'est pas en panne, il n'a pas démarré —
 * c'est une information utile, mais pas une alarme.
 *
 * La décision est isolée ici, sans accès base, pour être testable.
 */

/**
 * @typedef {object} LigneClient
 * @property {string} clientId
 * @property {string} brandName
 * @property {boolean} playbookActif       un playbook actif est attendu pour traiter
 * @property {string|Date|null} dernierEvenement  null si le client n'a JAMAIS rien produit
 */

/**
 * Clients dont le moteur s'est arrêté.
 *
 * @param {LigneClient[]} lignes
 * @param {{ seuilHeures?: number, maintenant?: Date }} [options]
 * @returns {{ clientId: string, brandName: string, heuresDeSilence: number }[]}
 */
export function clientsEnSilence(lignes, { seuilHeures = 24, maintenant = new Date() } = {}) {
  const sortie = []

  for (const l of lignes || []) {
    // Sans playbook actif, aucun trafic n'est attendu : rien à signaler.
    if (!l?.playbookActif) continue

    // Jamais aucun événement : le moteur n'a pas chuté, il n'a pas démarré.
    // C'est le cas de deux des quatre clients aujourd'hui, et les faire sonner
    // noierait les vraies alertes.
    if (!l.dernierEvenement) continue

    const dernier = new Date(l.dernierEvenement)
    if (Number.isNaN(dernier.getTime())) continue

    const heures = (maintenant.getTime() - dernier.getTime()) / 3_600_000
    if (heures > seuilHeures) {
      sortie.push({
        clientId: l.clientId,
        brandName: l.brandName,
        heuresDeSilence: Math.floor(heures),
      })
    }
  }

  // Le plus silencieux d'abord : c'est celui qui saigne depuis le plus longtemps.
  return sortie.sort((a, b) => b.heuresDeSilence - a.heuresDeSilence)
}

/**
 * Faut-il alerter à nouveau pour ce client ?
 *
 * Une alerte par incident, pas une par passage du cron. Un cron aux 5 minutes
 * qui répète la même alerte pendant 60 jours produit 17 000 notifications et
 * détruit la confiance dans le canal.
 *
 * @param {{ derniereAlerte?: string|Date|null, dernierEvenement: string|Date }} etat
 * @returns {boolean}
 */
export function alerteDejaEnvoyee({ derniereAlerte, dernierEvenement }) {
  if (!derniereAlerte) return false
  const alerte = new Date(derniereAlerte)
  const evenement = new Date(dernierEvenement)
  if (Number.isNaN(alerte.getTime())) return false
  // L'alerte compte si elle est postérieure au dernier événement : elle porte
  // donc sur CE silence-ci. Si du trafic est revenu puis reparti, l'alerte
  // précédente est périmée et il faut sonner de nouveau.
  return alerte > evenement
}
