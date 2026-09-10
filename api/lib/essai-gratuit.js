/**
 * La durée de l'essai gratuit — ACT-33.
 *
 * Trois chemins mènent à un abonnement Stripe, et le 10 septembre 2026 ils
 * accordaient trois essais différents :
 *
 *   api/create-checkout-session.js   30 jours si parrainage, sinon AUCUN essai
 *   api/billing/create-subscription  30 jours si parrainage, sinon 7 jours
 *   api/billing/upgrade              30 jours si parrainage, sinon 7 jours
 *
 * Un marchand obtenait donc 30, 7 ou 0 jours selon le bouton qu'il avait
 * cliqué. Personne ne l'avait écrit : les trois valeurs ont dérivé
 * séparément, et rien ne les tenait ensemble.
 *
 * Ça devient coûteux au moment précis où une publicité promet « 1 mois
 * gratuit » : la promesse est la même pour tout le monde, l'essai non. C'est
 * la première chose que le marchand vérifie, et le premier motif de
 * remboursement.
 *
 * DÉCISION QUI RESTE À PRENDRE
 * `ESSAI_STANDARD_JOURS` vaut 7 — la valeur que deux chemins sur trois
 * appliquaient déjà. Si la campagne annonce un mois, c'est **cette
 * constante** qu'on change, une fois, et les trois chemins suivent. Ce
 * fichier existe pour que ce soit une ligne et pas une chasse au trésor.
 */

/** Essai accordé à un marchand qui n'en a jamais eu. */
export const ESSAI_STANDARD_JOURS = 7

/** Essai accordé à un marchand parrainé — « premier mois offert ». */
export const ESSAI_PARRAINAGE_JOURS = 30

/**
 * Essai accordé à un marchand venu d'une campagne publicitaire.
 *
 * Décision du 10 septembre : la publicité annonce « 1 mois gratuit », mais on
 * ne l'ouvre pas à tout le monde — seulement à ceux qui arrivent par elle. Le
 * marchand qui trouve Actero autrement garde l'essai standard.
 *
 * Le drapeau `campaign_first_month_free` est posé **côté serveur** après
 * validation du code contre `CAMPAIGN_TRIAL_CODES`. Il n'est jamais déduit de
 * l'URL ni d'un champ envoyé par le navigateur : un mois d'abonnement offert
 * sur la foi d'un paramètre que n'importe qui peut écrire, ce n'est pas une
 * campagne, c'est un cadeau à qui devine le mot.
 */
export const ESSAI_CAMPAGNE_JOURS = 30

/**
 * Combien de jours d'essai accorder à ce client.
 *
 * @param {{ referral_first_month_free?: boolean, campaign_first_month_free?: boolean,
 *           trial_ends_at?: string|null }} client
 * @returns {number|undefined} un nombre de jours, ou `undefined` pour « pas
 *   d'essai » — c'est ce que Stripe attend quand on ne veut pas de période
 *   d'essai, et non `0`, qui déclencherait une facturation immédiate mais
 *   marquerait quand même l'abonnement comme sortant d'essai.
 */
export function joursEssaiPour(client) {
  // CETTE LIGNE EST LA PREMIÈRE, ET C'EST TOUT L'ENJEU.
  //
  // `trial_ends_at` est renseigné dès le premier essai, même expiré : c'est la
  // trace qui empêche d'en réclamer un second en résiliant puis en se
  // réabonnant. Tant qu'elle passait APRÈS les deux drapeaux, elle ne
  // protégeait de rien — un drapeau encore posé l'emportait sur elle.
  //
  // C'est pour ça que les routes de facturation consommaient le drapeau dès la
  // création de la session Stripe. Elles fermaient bien la porte au
  // réabonnement, mais elles la fermaient AUSSI au marchand qui ouvre l'écran
  // de paiement, hésite, et revient dix minutes plus tard : son mois était déjà
  // brûlé alors qu'il n'avait rien payé. Constaté en vrai le 10 septembre —
  // Stripe affichait « Démarrer l'essai de 7 jours » à quelqu'un venu par le
  // lien de la publicité.
  //
  // L'ordre ci-dessous rend la consommation anticipée inutile : un essai déjà
  // pris bloque, un essai jamais pris reste dû.
  if (client?.trial_ends_at) return undefined
  if (client?.referral_first_month_free) return ESSAI_PARRAINAGE_JOURS
  if (client?.campaign_first_month_free) return ESSAI_CAMPAGNE_JOURS
  return ESSAI_STANDARD_JOURS
}
