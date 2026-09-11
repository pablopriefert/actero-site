// @ts-check
/**
 * Quand faut-il prévenir un marchand que sa bulle de chat a disparu ?
 *
 * POURQUOI CETTE DÉCISION VIT DANS SON PROPRE FICHIER
 *
 * Elle tient en trois lignes, et elle est entièrement faite de cas limites.
 * Laissée au milieu du cron, elle n'est vérifiable qu'en lisant du code ; ici
 * elle se teste avec une vraie table de vérité (api/lib/widget-alerte.test.js).
 *
 * LA RÈGLE : on alerte sur une RÉGRESSION, pas sur un état.
 *
 * Le contrôle `widget_qa` répond « le script Actero est-il sur la vitrine ? ».
 * Répondre non n'est pas forcément une nouvelle : une boutique qui n'a jamais
 * posé la bulle répondra non pour toujours. La prévenir qu'il manque quelque
 * chose qu'elle n'a jamais installé, tous les jours, c'est du bruit — et le
 * bruit finit par masquer le signal, donc par coûter le jour où ça compte
 * vraiment.
 *
 * Ce qui est une nouvelle, c'est la BASCULE : la bulle était là hier, elle n'y
 * est plus. Là, quelque chose s'est passé — presque toujours une mise à jour
 * de thème — et le marchand cesse de recevoir les messages laissés sur son
 * site sans qu'aucune erreur ne le lui dise.
 *
 * Trois cas, donc, et un seul déclenche :
 *
 *   pas de vérification précédente   → non. Une première mesure ne prouve
 *                                      rien : il n'y a pas de « avant ».
 *   la précédente était déjà en échec → non. Panne connue, déjà signalée.
 *   la précédente trouvait la bulle   → OUI. Elle a disparu entre les deux.
 */

/**
 * @param {{ widget_found?: boolean } | null | undefined} courante
 *   La vérification qui vient d'avoir lieu.
 * @param {{ widget_found?: boolean } | null | undefined} precedente
 *   Celle qui la précède immédiatement pour le même client, ou null.
 * @returns {boolean} true si — et seulement si — la bulle vient de disparaître.
 */
export function doitAlerterWidget(courante, precedente) {
  // Défensif : l'appelant ne devrait interroger que des échecs, mais une
  // alerte envoyée pour une bulle présente serait pire qu'une alerte manquée.
  if (courante?.widget_found !== false) return false
  if (!precedente) return false
  return precedente.widget_found === true
}
