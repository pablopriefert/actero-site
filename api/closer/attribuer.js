import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit } from '../lib/rate-limit.js'
import { rattacherCloser } from '../lib/attribution-closer.js'
import { enregistrerEvenementCloser } from '../lib/evenements-closer.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

/**
 * La boutique que l'appelant peut engager : celle dont il est PROPRIÉTAIRE
 * (`owner_user_id`, ou le rôle `owner` dans client_users), la plus récente
 * s'il en a plusieurs — le lien a mené à la dernière créée. À défaut, une
 * boutique dont il n'est que membre : la règle la refusera
 * (non_proprietaire), réponse définitive qui fait oublier le code.
 *
 * @returns {Promise<{ clientId: string | null } | { indisponible: true }>}
 */
async function boutiqueDeLAppelant(userId) {
  const [liens, possedees] = await Promise.all([
    supabase.from('client_users').select('client_id, role').eq('user_id', userId),
    supabase.from('clients').select('id').eq('owner_user_id', userId),
  ])
  if (liens.error || possedees.error) return { indisponible: true }

  const aLui = new Set([
    ...(possedees.data || []).map((c) => c.id),
    ...(liens.data || []).filter((l) => l.role === 'owner').map((l) => l.client_id),
  ])
  if (aLui.size > 0) {
    const { data: recente, error } = await supabase
      .from('clients').select('id').in('id', [...aLui])
      .order('created_at', { ascending: false, nullsFirst: false }).limit(1).maybeSingle()
    if (error) return { indisponible: true }
    if (recente?.id) return { clientId: recente.id }
  }
  return { clientId: liens.data?.[0]?.client_id ?? null }
}

const FORMAT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Fil d'activité du closer, après un rattachement réussi : les ouvertures du
 * lien faites par ce visiteur (même `visite`, même closer, encore sans
 * client) sont reliées au client, puis l'inscription est écrite. Rien ici ne
 * change la réponse : une panne est seulement journalisée.
 */
async function noterInscription({ clientId, closerId, visite }) {
  if (typeof visite === 'string' && FORMAT_UUID.test(visite)) {
    try {
      const { error } = await supabase
        .from('closer_evenements')
        .update({ client_id: clientId })
        .eq('visite_id', visite.toLowerCase())
        .eq('closer_id', closerId)
        .is('client_id', null)
      if (error) throw error
    } catch (err) {
      console.warn('[closer/attribuer] ouvertures du lien non reliées', { client: clientId, erreur: err?.code || err?.name || 'erreur' })
    }
  }
  await enregistrerEvenementCloser(supabase, {
    clientId,
    closerId,
    type: 'inscription',
    sourceKey: `inscription:${clientId}`,
  })
}

/**
 * POST /api/closer/attribuer — le marchand connecté présente le code closer
 * mémorisé par son navigateur (lien /c/:code, src/lib/code-closer.js).
 *
 * Même mécanique que le code de campagne (api/auth/apply-campaign.js) : le
 * navigateur transporte le code, le serveur décide. Le client est celui de la
 * SESSION, jamais un identifiant reçu : sinon n'importe qui rattacherait le
 * client de son choix. Et seul son propriétaire l'engage (voir
 * api/lib/attribution-closer.js pour les autres règles : client récent, qui
 * n'a jamais payé, premier closer gagnant).
 *
 * Corps : { code, visite? } — `visite` : l'identifiant du cookie closer_visite,
 *         qui relie au client les ouvertures du lien (fil du closer)
 * Réponses :
 *   200 { ok, rattache }  le serveur a tranché, définitivement : rattaché, ou
 *                         refusé sans dire pourquoi (pas d'oracle pour deviner
 *                         les codes ; la raison reste dans les journaux). Le
 *                         navigateur oublie le code.
 *   400 code_requis       corps sans code
 *   401 non_authentifie   jeton absent ou refusé
 *   404 client_introuvable pas encore de boutique pour ce compte : rien n'est tranché
 *   429 trop_de_demandes, 500 erreur_interne, 503 indisponible :
 *                         rien n'est tranché, le navigateur garde le code
 */
async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'methode_non_autorisee' })

  const jeton = req.headers.authorization?.replace('Bearer ', '')
  if (!jeton) return res.status(401).json({ error: 'non_authentifie' })
  const { data: { user } = {}, error: erreurAuth } = await supabase.auth.getUser(jeton)
  if (erreurAuth || !user) return res.status(401).json({ error: 'non_authentifie' })

  const limite = await checkRateLimit(`closer-attribuer:${user.id}`, 10, 60 * 60 * 1000)
  if (!limite.allowed) return res.status(429).json({ error: 'trop_de_demandes' })

  const { code, visite } = req.body || {}
  if (typeof code !== 'string' || !code.trim()) return res.status(400).json({ error: 'code_requis' })

  const boutique = await boutiqueDeLAppelant(user.id)
  if (boutique.indisponible) return res.status(503).json({ error: 'indisponible' })
  const { clientId } = boutique
  if (!clientId) return res.status(404).json({ error: 'client_introuvable' })

  try {
    const resultat = await rattacherCloser(supabase, { clientId, userId: user.id, code })
    if (!resultat.rattache) {
      console.warn(`[closer/attribuer] refusé pour ${clientId} : ${resultat.raison}`)
      return res.status(200).json({ ok: true, rattache: false })
    }
    console.log(`[closer/attribuer] client ${clientId} rattaché au closer ${resultat.closerId}`)
    // Ne lève jamais : le rattachement est fait, la réponse le dit quoi qu'il arrive au fil.
    await noterInscription({ clientId, closerId: resultat.closerId, visite })
    return res.status(200).json({ ok: true, rattache: true })
  } catch (err) {
    console.error('[closer/attribuer]', err.message)
    return res.status(500).json({ error: 'erreur_interne' })
  }
}

export default withSentry(handler)
