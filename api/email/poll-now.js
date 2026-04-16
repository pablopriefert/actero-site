/**
 * POST /api/email/poll-now
 *
 * Manual trigger for the IMAP poller, scoped to the caller's own client.
 * Useful for:
 *   - Immediate test after configuring IMAP
 *   - Manual refresh from the Email Agent UI
 *
 * Auth: Bearer JWT (any authenticated user belonging to the client).
 * Body: { client_id }
 */
import { createClient } from '@supabase/supabase-js'
import { ImapFlow } from 'imapflow'
import { decryptToken } from '../lib/crypto.js'
import { cleanEmailBody } from '../lib/email.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

export const maxDuration = 30

const SITE_URL = process.env.SITE_URL || 'https://actero.fr'
const MAX_MESSAGES_PER_CYCLE = 20

export default async function handler(req, res) {
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

  // Integration
  const { data: integration } = await supabase
    .from('client_integrations')
    .select('api_key, extra_config')
    .eq('client_id', client_id)
    .eq('provider', 'smtp_imap')
    .eq('status', 'active')
    .maybeSingle()

  if (!integration) {
    return res.status(400).json({ error: 'Aucune intégration IMAP active' })
  }

  const { imap_host, imap_port, username, use_ssl } = integration.extra_config || {}
  const password = decryptToken(integration.api_key) || integration.api_key

  if (!imap_host || !username || !password) {
    return res.status(400).json({ error: 'Config IMAP incomplète' })
  }

  const client = new ImapFlow({
    host: imap_host,
    port: parseInt(imap_port, 10) || 993,
    secure: use_ssl !== false,
    auth: { user: username, pass: password },
    logger: false,
    socketTimeout: 15_000,
  })

  let processed = 0
  let errorMsg = null
  const diagnostics = { connected: false, mailbox_total: 0, unread_count: 0, last_5: [] }
  try {
    await client.connect()
    diagnostics.connected = true
    const mb = await client.mailboxOpen('INBOX')
    diagnostics.mailbox_total = mb?.exists || 0

    // Search BOTH modes: unread (for normal processing) AND recent (for diagnostics)
    const unreadUids = await client.search({ seen: false })
    diagnostics.unread_count = (unreadUids || []).length

    // Diagnostics — fetch last 5 envelopes regardless of read status
    // so we can tell the user what IMAP actually sees
    try {
      const total = mb?.exists || 0
      if (total > 0) {
        const from = Math.max(1, total - 4)
        for await (const msg of client.fetch(`${from}:${total}`, { envelope: true })) {
          const env = msg.envelope || {}
          const fromObj = env.from?.[0] || {}
          diagnostics.last_5.push({
            uid: msg.uid,
            date: env.date,
            from: fromObj.address,
            subject: (env.subject || '').slice(0, 80),
            unread: (unreadUids || []).includes(msg.uid),
          })
        }
      }
    } catch { /* diag is best-effort */ }

    const slice = (unreadUids || []).slice(0, MAX_MESSAGES_PER_CYCLE)

    for await (const msg of client.fetch(slice, { envelope: true, source: true })) {
      try {
        const env = msg.envelope || {}
        const fromObj = env.from?.[0] || {}
        const toObj = env.to?.[0] || {}
        const rawSource = msg.source?.toString('utf8') || ''
        const textBody = extractPlainText(rawSource)
        const cleaned = cleanEmailBody(textBody)

        if (!cleaned || cleaned.length < 3) {
          await client.messageFlagsAdd(msg.uid, ['\\Seen'], { uid: true })
          continue
        }

        const resp = await fetch(
          `${SITE_URL}/api/engine/webhooks/inbound-email?client_id=${client_id}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-engine-secret': process.env.ENGINE_WEBHOOK_SECRET || '',
            },
            body: JSON.stringify({
              from: fromObj.address,
              from_name: fromObj.name || '',
              to: toObj.address,
              subject: env.subject || '',
              text: cleaned,
              message_id: env.messageId || null,
              in_reply_to: env.inReplyTo || null,
              references: env.references || null,
            }),
          },
        )
        if (!resp.ok) continue
        await client.messageFlagsAdd(msg.uid, ['\\Seen'], { uid: true })
        processed += 1
      } catch (err) {
        console.warn('[poll-now] per-message:', err.message)
      }
    }

    await supabase.from('client_settings')
      .update({ email_last_polled_at: new Date().toISOString() })
      .eq('client_id', client_id)
  } catch (err) {
    errorMsg = err.message
  } finally {
    try { await client.logout() } catch { /* noop */ }
  }

  if (errorMsg) return res.status(500).json({ error: errorMsg, diagnostics })
  return res.status(200).json({ ok: true, processed, diagnostics })
}

function extractPlainText(raw) {
  if (!raw) return ''
  const plainMatch = raw.match(/Content-Type:\s*text\/plain[\s\S]*?\r?\n\r?\n([\s\S]+?)(?:\r?\n--|$)/i)
  if (plainMatch) return plainMatch[1]
  const bodyStart = raw.indexOf('\r\n\r\n')
  let body = bodyStart >= 0 ? raw.slice(bodyStart + 4) : raw
  body = body.replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
  return body
}
