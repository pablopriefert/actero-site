/**
 * Toggle portal_enabled for the authed client.
 *
 * POST /api/client/toggle-portal
 * Body: { enabled: boolean }
 * Auth: Bearer token (Supabase session)
 */
import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'
import { clientHasEntitlement } from '../lib/entitlements.js'
import { assurerSlugPortail } from '../lib/portal-slug.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Non autorisé' })

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Non autorisé' })

  const { enabled } = req.body || {}
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: '`enabled` (boolean) requis' })
  }

  // Look up client_id via client_users first, then owner_user_id
  const { data: link } = await supabase
    .from('client_users')
    .select('client_id')
    .eq('user_id', user.id)
    .maybeSingle()

  let clientId = link?.client_id
  if (!clientId) {
    const { data: clientRow } = await supabase
      .from('clients')
      .select('id')
      .eq('owner_user_id', user.id)
      .maybeSingle()
    clientId = clientRow?.id
  }

  if (!clientId) return res.status(404).json({ error: 'Client introuvable' })

  // Le portail est une fonctionnalité payante (Pro et Enterprise). Jusqu'au
  // 10 septembre, cette route ne vérifiait RIEN : le seul obstacle était le
  // bouton grisé dans le navigateur. N'importe quel compte, y compris Free,
  // pouvait ouvrir son portail en appelant cette route directement. Une
  // fonctionnalité payante gardée uniquement par l'interface n'est pas gardée.
  //
  // On ne vérifie qu'à l'activation : un marchand qui rétrograde doit pouvoir
  // refermer son portail, pas se retrouver coincé avec un portail ouvert.
  if (enabled) {
    const autorise = await clientHasEntitlement(supabase, clientId, 'portal_enabled')
    if (!autorise) {
      return res.status(403).json({ error: 'Le portail client nécessite le plan Pro ou Enterprise.' })
    }
  }

  const { error: updateError } = await supabase
    .from('clients')
    .update({ portal_enabled: enabled })
    .eq('id', clientId)

  if (updateError) {
    console.error('[toggle-portal] DB update error:', updateError.message)
    return res.status(500).json({ error: 'Erreur serveur' })
  }

  // Le portail vit à https://<slug>.portal.actero.fr. Rien n'écrivait jamais
  // ce slug : un marchand qui activait son portail lisait « Aucun slug
  // configuré. Contactez le support. » — une fonctionnalité sans adresse.
  // On le fabrique ici, au seul moment où il devient nécessaire.
  let slug = null
  if (enabled) {
    const { data: c } = await supabase
      .from('clients').select('brand_name').eq('id', clientId).maybeSingle()
    const resultat = await assurerSlugPortail(supabase, clientId, c?.brand_name)
    if (resultat.erreur) {
      // Le portail est activé mais injoignable : il faut que ça se voie.
      console.error('[toggle-portal] slug indisponible:', resultat.erreur)
      return res.status(200).json({
        ok: true, portal_enabled: enabled, slug: null, avertissement: resultat.erreur,
      })
    }
    slug = resultat.slug
  }

  return res.status(200).json({ ok: true, portal_enabled: enabled, slug })
}

export default withSentry(handler)
