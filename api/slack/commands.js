/**
 * POST /api/slack/commands
 *
 * Slack Slash Command endpoint. Users type `/actero <question>` and we reply.
 *
 * Slack sends application/x-www-form-urlencoded. Body format:
 *   token, team_id, team_domain, channel_id, user_id, user_name,
 *   command, text, response_url, trigger_id
 *
 * Response strategy:
 *   - Ack immediately with "Je cherche…" (ephemeral)
 *   - Process async and POST the final answer to response_url
 */
import { withSentry } from '../lib/sentry.js'
import {
  readRawBody,
  verifySlackSignature,
  resolveTeam,
  formatAsBlocks,
  shortAck,
} from '../lib/slack.js'
import { askCopilot } from '../lib/kpi-tools.js'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

export const config = { api: { bodyParser: false } }

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  let rawBody
  try {
    rawBody = await readRawBody(req)
  } catch {
    return res.status(400).json({ error: 'Cannot read body' })
  }

  const timestamp = req.headers['x-slack-request-timestamp']
  const signature = req.headers['x-slack-signature']
  if (!verifySlackSignature(rawBody, timestamp, signature)) {
    return res.status(401).json({ error: 'Invalid signature' })
  }

  // Parse form-urlencoded body
  const params = new URLSearchParams(rawBody.toString('utf8'))
  const teamId = params.get('team_id')
  const text = params.get('text') || ''
  const responseUrl = params.get('response_url')
  const userId = params.get('user_id')

  if (!text.trim()) {
    return res.status(200).json({
      response_type: 'ephemeral',
      text: 'Usage: `/actero <question>`\nExemples :\n• `/actero combien de tickets aujourd\'hui ?`\n• `/actero taux d\'escalade cette semaine`\n• `/actero quelle recommandation pour aujourd\'hui ?`',
    })
  }

  // Ack immediately with a "searching" message (visible only to the user)
  res.status(200).json(shortAck('🔍 Je cherche la réponse…'))

  // Process async and post final result via response_url
  processCommand({ teamId, text, responseUrl, userId }).catch(err => {
    console.error('[slack/commands] process error:', err?.message || err)
    if (responseUrl) {
      fetch(responseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response_type: 'ephemeral',
          text: `❌ Erreur: ${err.message?.slice(0, 120) || 'unknown'}`,
          replace_original: true,
        }),
      }).catch(() => { /* ignore */ })
    }
  })
}

async function processCommand({ teamId, text, responseUrl, userId }) {
  const team = await resolveTeam(teamId)
  if (!team) {
    await fetch(responseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        response_type: 'ephemeral',
        text: 'Aucune intégration Actero active pour ce workspace. Connectez Slack depuis votre dashboard Actero (Intégrations).',
        replace_original: true,
      }),
    })
    return
  }

  const { reply } = await askCopilot(supabaseAdmin, {
    clientId: team.clientId,
    message: text,
    brandName: team.brandName,
    channel: 'slack',
  })

  await fetch(responseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      response_type: 'in_channel', // visible to channel — set to 'ephemeral' if preferred
      text: reply.slice(0, 300),
      blocks: formatAsBlocks(reply),
      replace_original: true,
    }),
  })
}

export default withSentry(handler)
