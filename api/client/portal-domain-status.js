/**
 * Return the DNS + Vercel verification status for the authed client's
 * portal_custom_domain. Used by the Portal SAV UI to show a live badge.
 *
 * GET /api/client/portal-domain-status
 * Auth: Bearer token (Supabase session)
 *
 * Response:
 * {
 *   ok: true,
 *   domain: 'sav.mamarque.fr' | null,
 *   status: 'none' | 'not_configured' | 'pending' | 'verified' | 'misconfigured' | 'error',
 *   verified: boolean,
 *   misconfigured: boolean,
 *   verification: [{ type, domain, value, reason }] | null,
 *   message: string | null
 * }
 */
import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'
import { getProjectDomain, getDomainConfig } from '../lib/vercel.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Non autorisé' })

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Non autorisé' })

  // Resolve client_id
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

  const { data: client } = await supabase
    .from('clients')
    .select('portal_custom_domain')
    .eq('id', clientId)
    .maybeSingle()

  const domain = client?.portal_custom_domain || null

  if (!domain) {
    return res.status(200).json({
      ok: true,
      domain: null,
      status: 'none',
      verified: false,
      misconfigured: false,
      verification: null,
      message: null,
    })
  }

  const [project, config] = await Promise.all([
    getProjectDomain(domain),
    getDomainConfig(domain),
  ])

  // Vercel not configured on this environment — still return the domain so the UI
  // can show a friendly "configuration en attente côté Actero" message.
  if (project.reason === 'not_configured' || config.reason === 'not_configured') {
    return res.status(200).json({
      ok: true,
      domain,
      status: 'not_configured',
      verified: false,
      misconfigured: false,
      verification: null,
      message: 'Synchronisation Vercel non configurée. Contactez le support.',
    })
  }

  const verified = project.ok ? !!project.body?.verified : false
  const misconfigured = config.ok ? !!config.body?.misconfigured : false
  const verification = project.ok ? project.body?.verification || null : null

  let status
  let message = null
  if (!project.ok) {
    status = 'error'
    message = 'Impossible de récupérer l\'état du domaine. Réessayez dans quelques minutes.'
  } else if (verified && !misconfigured) {
    status = 'verified'
  } else if (misconfigured) {
    status = 'misconfigured'
    message = 'Le DNS ne pointe pas encore vers portal.actero.fr. Vérifiez votre enregistrement CNAME.'
  } else {
    status = 'pending'
    message = 'En attente de la propagation DNS (jusqu\'à 24h).'
  }

  return res.status(200).json({
    ok: true,
    domain,
    status,
    verified,
    misconfigured,
    verification,
    message,
  })
}

export default withSentry(handler)
