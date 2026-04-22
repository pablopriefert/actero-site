/**
 * POST /api/email/poll-now
 *
 * Manual trigger for the email poller, scoped to the caller's client.
 * Auto-detects the provider (Gmail OAuth OR SMTP/IMAP) — picks whichever is
 * connected. If BOTH are connected, Gmail wins (OAuth is more reliable).
 *
 * Auth: Bearer JWT. Body: { client_id }
 */
import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'
import { pollOneMailbox } from '../lib/email-poller.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

export const maxDuration = 30

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Auth
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Non autorisé' })
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Non autorisé' })

  const { client_id } = req.body || {}
  if (!client_id) return res.status(400).json({ error: 'client_id requis' })

  // Access check
  const isAdmin = user.app_metadata?.role === 'admin'
  if (!isAdmin) {
    const { data: link } = await supabase.from('client_users')
      .select('client_id').eq('user_id', user.id).eq('client_id', client_id).maybeSingle()
    if (!link) {
      const { data: owned } = await supabase.from('clients')
        .select('id').eq('id', client_id).eq('owner_user_id', user.id).maybeSingle()
      if (!owned) return res.status(403).json({ error: 'Accès refusé' })
    }
  }

  // Fetch both possible integrations — prefer Gmail OAuth over IMAP when both exist
  const { data: gmail } = await supabase
    .from('client_integrations')
    .select('access_token, refresh_token, expires_at, extra_config')
    .eq('client_id', client_id)
    .eq('provider', 'gmail')
    .eq('status', 'active')
    .maybeSingle()

  const { data: imap } = await supabase
    .from('client_integrations')
    .select('api_key, extra_config')
    .eq('client_id', client_id)
    .eq('provider', 'smtp_imap')
    .eq('status', 'active')
    .maybeSingle()

  let provider, integration
  if (gmail) {
    provider = 'gmail'
    integration = gmail
  } else if (imap) {
    provider = 'smtp_imap'
    integration = imap
  } else {
    return res.status(400).json({ error: 'Aucune intégration email active (Gmail ou IMAP)' })
  }

  const result = await pollOneMailbox({ supabase, clientId: client_id, provider, integration })

  await supabase.from('client_settings')
    .update({ email_last_polled_at: new Date().toISOString() })
    .eq('client_id', client_id)

  if (result.error) {
    return res.status(500).json({ error: result.error, diagnostics: result.diagnostics, provider })
  }

  return res.status(200).json({
    ok: true,
    provider,
    processed: result.processed,
    diagnostics: result.diagnostics,
  })
}

export default withSentry(handler)
