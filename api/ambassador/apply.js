import { withSentry } from '../lib/sentry.js'

/**
 * POST /api/ambassador/apply — FERMÉE le 14 septembre 2026.
 *
 * Cette route publique, sans compte ni validation, faisait trois choses pour
 * n'importe quelle adresse e-mail reçue :
 *
 *   1. retrouver le compte existant et remplacer son rôle par « ambassador »,
 *      dans Supabase Auth ET dans `profiles` — compte admin compris, dont
 *      l'accès reposait sur ces deux seuls endroits ;
 *   2. créer un compte pour une adresse inconnue ;
 *   3. envoyer à cette adresse un e-mail signé Actero, code ambassadeur actif.
 *
 * Plus aucune page ne l'appelait depuis la suppression de l'espace
 * ambassadeurs, et aucune candidature n'a jamais été enregistrée.
 *
 * L'inscription des closers ne rouvrira pas ce chemin : elle ne devra jamais
 * écrire le rôle d'un compte existant. Voir apply.test.js.
 */
async function handler(_req, res) {
  return res.status(410).json({ error: 'Les candidatures ambassadeur sont fermées.' })
}

export default withSentry(handler)
