import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit } from '../lib/rate-limit.js'
import { rattacherCloser } from '../lib/attribution-closer.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

/**
 * POST /api/closer/attribuer — le marchand connecté présente le code closer
 * mémorisé par son navigateur (lien /c/:code, src/lib/code-closer.js).
 *
 * Même mécanique que le code de campagne (api/auth/apply-campaign.js) : le
 * navigateur transporte le code, le serveur décide. Le client est celui de la
 * SESSION, jamais un identifiant reçu : sinon n'importe qui rattacherait le
 * client de son choix.
 *
 * Corps : { code }
 * Réponses :
 *   200 { ok, rattache }  le serveur a tranché — rattaché, ou refusé sans dire
 *                         pourquoi (pas d'oracle pour deviner les codes ;
 *                         la raison reste dans les journaux)
 *   401                   jeton absent ou refusé
 *   404                   pas encore de client pour ce compte : rien n'est tranché
 *   429, 500, 503         rien n'est tranché, le navigateur garde le code
 */
async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'methode_non_autorisee' })

  const jeton = req.headers.authorization?.replace('Bearer ', '')
  if (!jeton) return res.status(401).json({ error: 'non_authentifie' })
  const { data: { user } = {}, error: erreurAuth } = await supabase.auth.getUser(jeton)
  if (erreurAuth || !user) return res.status(401).json({ error: 'non_authentifie' })

  const limite = await checkRateLimit(`closer-attribuer:${user.id}`, 10, 60 * 60 * 1000)
  if (!limite.allowed) return res.status(429).json({ error: 'trop_de_demandes' })

  const { code } = req.body || {}
  if (typeof code !== 'string' || !code.trim()) return res.status(400).json({ error: 'code_requis' })

  const { data: lien, error: erreurLien } = await supabase
    .from('client_users').select('client_id').eq('user_id', user.id).limit(1).maybeSingle()
  if (erreurLien) return res.status(503).json({ error: 'indisponible' })
  let clientId = lien?.client_id
  if (!clientId) {
    const { data: possede, error: erreurPossede } = await supabase
      .from('clients').select('id').eq('owner_user_id', user.id).limit(1).maybeSingle()
    if (erreurPossede) return res.status(503).json({ error: 'indisponible' })
    clientId = possede?.id
  }
  if (!clientId) return res.status(404).json({ error: 'client_introuvable' })

  try {
    const resultat = await rattacherCloser(supabase, { clientId, code })
    if (!resultat.rattache) {
      console.warn(`[closer/attribuer] refusé pour ${clientId} : ${resultat.raison}`)
      return res.status(200).json({ ok: true, rattache: false })
    }
    console.log(`[closer/attribuer] client ${clientId} rattaché au closer ${resultat.closerId}`)
    return res.status(200).json({ ok: true, rattache: true })
  } catch (err) {
    console.error('[closer/attribuer]', err.message)
    return res.status(500).json({ error: 'erreur_interne' })
  }
}

export default withSentry(handler)
