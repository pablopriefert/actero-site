import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '../lib/admin-auth.js'
import { decryptToken } from '../lib/crypto.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

/**
 * GET /api/admin/closer-iban?closer_id=… — l'IBAN en clair d'un closer, au
 * moment de payer.
 *
 * Le seul endroit du produit qui déchiffre un IBAN pour l'afficher. Chaque
 * lecture est journalisée dans admin_action_logs AVANT la réponse, et sans
 * trace écrite, pas d'IBAN : une lecture non tracée ne doit pas exister.
 */
async function handler(req, res) {
  const admin = await requireAdmin(req, res, supabase)
  if (!admin) return
  if (req.method !== 'GET') return res.status(405).json({ error: 'methode_non_autorisee' })
  res.setHeader('Cache-Control', 'no-store')

  const closerId = typeof req.query?.closer_id === 'string' ? req.query.closer_id : ''
  if (!closerId) return res.status(400).json({ error: 'closer_requis' })

  const { data: closer, error } = await supabase
    .from('closers').select('id, titulaire_iban, iban_chiffre').eq('id', closerId).maybeSingle()
  if (error) return res.status(503).json({ error: 'indisponible', message: error.message })
  if (!closer?.iban_chiffre) return res.status(404).json({ error: 'iban_absent', message: 'Ce closer n’a pas encore renseigné d’IBAN.' })

  const { error: erreurJournal } = await supabase.from('admin_action_logs').insert({
    actor_id: admin.id,
    actor_email: admin.email ?? null,
    action: 'closer_iban_lu',
    target_type: 'closer',
    target_id: closer.id,
    client_id: null,
    metadata: {},
  })
  if (erreurJournal) {
    console.error('[admin/closer-iban] lecture non journalisée :', erreurJournal.message)
    return res.status(503).json({ error: 'journal_indisponible', message: 'Lecture non journalisée : IBAN non affiché. Réessayez.' })
  }

  const iban = decryptToken(closer.iban_chiffre)
  if (!iban) return res.status(500).json({ error: 'iban_illisible', message: 'IBAN illisible : la clé de chiffrement a-t-elle changé ?' })
  return res.status(200).json({ iban, titulaire: closer.titulaire_iban })
}

export default withSentry(handler)
