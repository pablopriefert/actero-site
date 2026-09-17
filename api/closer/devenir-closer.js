import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'
import { compteDuJeton, creerFiche, ficheVisible, nettoyerNom, nomDuCompte } from '../lib/fiche-closer.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

/**
 * POST /api/closer/devenir-closer — crée la fiche closer du compte connecté.
 *
 * Deux chemins l'appellent : le retour Google d'une inscription closer
 * (/closer/callback), et le bouton « Devenir closer » d'un compte existant
 * (un marchand, par exemple). Rejouable : un compte qui a déjà sa fiche la
 * reçoit telle quelle (200).
 *
 * Corps : { prenom?, nom? } — à défaut, ceux du compte (profil Google).
 *
 * N'écrit ni le rôle du compte, ni aucun client marchand.
 */
async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'methode_non_autorisee' })

  const user = await compteDuJeton(supabase, req)
  if (!user) return res.status(401).json({ error: 'non_authentifie', message: 'Connectez-vous pour continuer.' })

  const corps = req.body || {}
  const duCompte = nomDuCompte(user)
  const prenom = nettoyerNom(corps.prenom) || duCompte.prenom
  const nom = nettoyerNom(corps.nom) || duCompte.nom
  if (!prenom || !nom) return res.status(400).json({ error: 'nom_requis', message: 'Indiquez votre prénom et votre nom.' })

  try {
    const { fiche, creee } = await creerFiche(supabase, { user, prenom, nom })
    return res.status(creee ? 201 : 200).json({ fiche: ficheVisible(fiche) })
  } catch (err) {
    console.error('[closer/devenir-closer]', err.message)
    return res.status(500).json({ error: 'erreur_interne', message: 'Impossible de créer votre espace. Réessayez.' })
  }
}

export default withSentry(handler)
