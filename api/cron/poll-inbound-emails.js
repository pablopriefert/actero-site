// Vercel Cron — Poll inbound emails (IMAP + Gmail OAuth).
//
// Schedule: every 2 min — cron expression configured in vercel.json
// (the raw cron pattern is NOT repeated here on purpose: the "*/" sequence
// prematurely closes JSDoc block comments and breaks ESM parsing on Node 24).
//
// For each active client integration (smtp_imap OR gmail) where the client has
// email_agent_enabled = true, polls the mailbox and forwards new messages to
// the Engine Gateway.
//
// Auth: Vercel Cron header OR Authorization: Bearer <CRON_SECRET>.
import { createClient } from '@supabase/supabase-js'
import { pollOneMailbox } from '../lib/email-poller.js'
import { withCronMonitor } from '../lib/cron-monitor.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

export const maxDuration = 60

async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET
  const provided = req.headers['authorization']?.replace('Bearer ', '') || req.query?.secret
  const isVercelCron = req.headers['x-vercel-cron']
  if (!isVercelCron && cronSecret && provided !== cronSecret) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  if (!cronSecret && !isVercelCron) {
    return res.status(503).json({ error: 'CRON_SECRET missing' })
  }

  try {
    // Fetch all active email integrations (gmail OR smtp_imap)
    const { data: integrations } = await supabase
      .from('client_integrations')
      .select('client_id, provider, api_key, access_token, refresh_token, expires_at, extra_config')
      .in('provider', ['smtp_imap', 'gmail'])
      .eq('status', 'active')

    if (!integrations?.length) {
      return res.status(200).json({ ok: true, polled: 0, reason: 'no active email integrations' })
    }

    // Group by client_id — prefer Gmail over IMAP when both exist
    const byClient = new Map()
    for (const i of integrations) {
      const existing = byClient.get(i.client_id)
      if (!existing || (i.provider === 'gmail' && existing.provider !== 'gmail')) {
        byClient.set(i.client_id, i)
      }
    }

    const results = []
    for (const integration of byClient.values()) {
      try {
        const { data: settings } = await supabase
          .from('client_settings')
          .select('email_agent_enabled')
          .eq('client_id', integration.client_id)
          .maybeSingle()

        if (!settings?.email_agent_enabled) {
          results.push({ client_id: integration.client_id, skipped: 'agent_disabled' })
          continue
        }

        const result = await pollOneMailbox({
          supabase,
          clientId: integration.client_id,
          provider: integration.provider,
          integration,
        })

        await supabase.from('client_settings')
          .update({ email_last_polled_at: new Date().toISOString() })
          .eq('client_id', integration.client_id)

        results.push({
          client_id: integration.client_id,
          provider: integration.provider,
          processed: result.processed,
          error: result.error || null,
        })
      } catch (err) {
        console.error(`[poll-inbound] ${integration.client_id}:`, err.message)
        results.push({ client_id: integration.client_id, error: err.message })
      }
    }

    return res.status(200).json({ ok: true, clients_checked: byClient.size, results })
  } catch (err) {
    console.error('[poll-inbound-emails] fatal:', err.message)
    return res.status(500).json({ error: err.message })
  }
}

export default withCronMonitor('cron-poll-inbound-emails', '*/2 * * * *', handler)
