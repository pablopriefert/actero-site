/**
 * GET /api/widget/config?api_key=<merchant_data_actero_key>
 *
 * Public endpoint called by public/widget.js once at init. Returns just
 * what the widget needs to know to bootstrap optional features:
 *   - replay_enabled: whether to load Amplitude Session Replay
 *   - amplitude_api_key: the public Amplitude project key (safe to expose;
 *     it's the same key the SDK ships with on every site that uses it)
 *   - server_zone: 'EU' | 'US' (Actero's project is EU)
 *
 * NEVER add secrets here — anything returned is visible to every shopper
 * loading the widget.
 */
import { createClient } from '@supabase/supabase-js'
import { withSentry } from '../lib/sentry.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

async function handler(req, res) {
  // CORS — widget runs on merchant domains.
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' })

  const apiKey = String(req.query.api_key || '')
  if (!apiKey) return res.status(400).json({ error: 'missing_api_key' })

  // Resolve the merchant by their public widget key.
  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('widget_api_key', apiKey)
    .maybeSingle()

  if (!client) {
    // Default everything off — widget keeps working, just no extras.
    return res.status(200).json({
      replay_enabled: false,
      amplitude_api_key: null,
      server_zone: 'EU',
    })
  }

  const { data: settings } = await supabase
    .from('client_settings')
    .select('replay_recording_enabled')
    .eq('client_id', client.id)
    .maybeSingle()

  const replayEnabled = settings?.replay_recording_enabled === true
  const amplitudeKey = process.env.AMPLITUDE_API_KEY || null

  // Cache for 5 min on the edge — config rarely changes mid-session.
  res.setHeader('Cache-Control', 'public, max-age=300')

  return res.status(200).json({
    replay_enabled: replayEnabled && Boolean(amplitudeKey),
    amplitude_api_key: replayEnabled ? amplitudeKey : null,
    server_zone: 'EU',
  })
}

export default withSentry(handler)
