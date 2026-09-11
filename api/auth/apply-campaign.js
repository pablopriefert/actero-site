/**
 * POST /api/auth/apply-campaign — accorder le mois de campagne après coup.
 *
 * L'inscription email/mot de passe passe par `api/auth/signup.js`, qui pose le
 * drapeau lui-même. L'inscription **Google** ne passe par aucune route : le
 * compte est créé côté navigateur, au retour d'OAuth, par
 * `resolveOrCreateClientId`. Sans cette route, un marchand venu de la
 * publicité et inscrit avec Google repartait avec sept jours — constaté en
 * vrai le 10 septembre.
 *
 * Le navigateur envoie le code ; c'est ici qu'on décide. Un client qui
 * appellerait cette route avec n'importe quoi n'obtient rien.
 *
 * Body : { campaign_code: string }
 * Auth : Bearer <jeton de session Supabase>
 */
import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'
import { appliquerCampagne } from '../lib/campagne.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Non autorisé' })

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Non autorisé' })

  const { campaign_code } = req.body || {}
  if (!campaign_code) return res.status(400).json({ error: '`campaign_code` requis' })

  // Le client est résolu depuis la SESSION, jamais depuis le corps de la
  // requête : sinon n'importe qui offrirait un mois au compte de son choix.
  const { data: link } = await supabase
    .from('client_users')
    .select('client_id')
    .eq('user_id', user.id)
    .maybeSingle()

  let clientId = link?.client_id
  if (!clientId) {
    const { data: owned } = await supabase
      .from('clients')
      .select('id')
      .eq('owner_user_id', user.id)
      .maybeSingle()
    clientId = owned?.id
  }
  if (!clientId) return res.status(404).json({ error: 'Client introuvable' })

  const resultat = await appliquerCampagne(supabase, clientId, campaign_code)

  if (!resultat.applique) {
    // Volontairement discret côté client — un code refusé ne dit pas pourquoi,
    // pour ne pas transformer cette route en oracle à deviner les codes. La
    // raison reste dans les journaux.
    console.warn(`[apply-campaign] refusé pour ${clientId} : ${resultat.raison}`)
    return res.status(200).json({ ok: true, applique: false })
  }

  console.log(`[apply-campaign] mois de campagne accordé à ${clientId}`)
  return res.status(200).json({ ok: true, applique: true })
}

export default withSentry(handler)
