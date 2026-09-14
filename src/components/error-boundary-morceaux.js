/**
 * Détection et récupération des morceaux de code périmés.
 *
 * Vit dans son propre fichier, et pas dans ErrorBoundary.jsx, pour une raison
 * de confort de développement : un fichier qui exporte À LA FOIS un composant
 * et des fonctions casse le Fast Refresh de Vite. Chaque modification du
 * composant provoquait alors un rechargement complet au lieu d'une mise à jour
 * à chaud — en silence, personne ne s'en apercevait.
 *
 * Signalé par ESLint (`react-refresh/only-export-components`), qui était
 * installé dans le projet mais que rien ne lançait.
 */

/**
 * Un morceau de code que le déploiement a remplacé.
 *
 * Vite nomme chaque morceau avec une empreinte (`ClientBillingView-Bq_WPgrU.js`).
 * Après un déploiement, l'ancien fichier n'existe plus — et un onglet resté
 * ouvert garde en mémoire l'ancienne table des noms. Le premier clic sur un
 * onglet chargé à la demande échoue alors, sans que rien ne soit cassé.
 */
export function estMorceauPerime(error) {
  const msg = error?.message || ''
  return /Failed to fetch dynamically imported module/i.test(msg)
    || /Importing a module script failed/i.test(msg)
    || /Loading chunk \d+ failed/i.test(msg)
}

/**
 * Recharge la page pour récupérer la nouvelle table des morceaux.
 *
 * @returns {boolean} true si un rechargement a été déclenché.
 *
 * LA FAILLE CORRIGÉE LE 10 SEPTEMBRE. La garde d'origine autorisait UN
 * rechargement par session, tous morceaux confondus. Elle empêchait bien la
 * boucle infinie, mais un jour de dix déploiements — ce qui est arrivé — le
 * marchand tombait sur l'écran d'erreur dès le deuxième morceau périmé,
 * puisque le drapeau était déjà posé.
 *
 * On compte donc PAR MORCEAU : chaque nouvelle URL morte a droit à son
 * rechargement, et la même deux fois de suite ne boucle pas. Un plafond
 * global reste, pour le cas où un déploiement servirait vraiment des fichiers
 * introuvables : mieux vaut un écran d'erreur qu'un onglet qui se recharge
 * sans fin.
 */
const PLAFOND_RECHARGEMENTS = 4

export function rechargerPourMorceauPerime(error) {
  if (typeof window === 'undefined') return false
  try {
    // L'URL du morceau est dans le message ; à défaut, on retombe sur le
    // message entier, qui reste discriminant.
    const url = (error?.message || '').match(/https?:\/\/\S+/)?.[0] || error?.message || 'inconnu'
    const cle = `actero-morceau-perime:${url}`
    const total = Number(sessionStorage.getItem('actero-rechargements-morceaux') || 0)
    if (sessionStorage.getItem(cle) || total >= PLAFOND_RECHARGEMENTS) return false
    sessionStorage.setItem(cle, '1')
    sessionStorage.setItem('actero-rechargements-morceaux', String(total + 1))
    window.location.reload()
    return true
  } catch {
    // sessionStorage indisponible (navigation privée verrouillée) : on
    // n'insiste pas, l'écran d'erreur reste une sortie honorable.
    return false
  }
}
