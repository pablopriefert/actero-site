/**
 * Update the chat-widget customization for the authed client.
 *
 * POST /api/client/widget-settings
 * Body (all optional): {
 *   widget_brand_color, widget_accent_color, widget_position,
 *   widget_greeting, widget_logo_url, widget_show_powered_by
 * }
 * Auth: Bearer token (Supabase session). Caller must own the client_id.
 *
 * Writes to client_settings (the same row read by /api/engine/widget-config,
 * which the embedded widget.js fetches at boot). No code change is ever needed
 * on the merchant's site — they paste the one-line snippet once and every
 * change here goes live on the next widget load.
 *
 * Plan gate: hiding the "Powered by Actero" footer (widget_show_powered_by=
 * false) is Pro/Enterprise only. Below Pro we force it back to true so a
 * tampered request can't strip attribution.
 */
import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const PRO_PLANS = ['pro', 'enterprise']
const HEX_RE = /^#[0-9a-fA-F]{6}$/
const MAX_GREETING = 200

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // ── Auth ──────────────────────────────────────────────────────
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Non autorisé' })

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Non autorisé' })

  // ── Resolve client_id (client_users, then clients.owner_user_id) ──
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

  // ── Plan (for the powered-by gate) ────────────────────────────
  const { data: clientData } = await supabase
    .from('clients')
    .select('plan, trial_ends_at')
    .eq('id', clientId)
    .maybeSingle()
  const plan = clientData?.plan || 'free'
  const inTrial = clientData?.trial_ends_at && new Date(clientData.trial_ends_at) > new Date()
  const canWhiteLabel = PRO_PLANS.includes(plan) || (inTrial && PRO_PLANS.includes(plan))

  // ── Validate ──────────────────────────────────────────────────
  const {
    widget_brand_color,
    widget_accent_color,
    widget_position,
    widget_greeting,
    widget_logo_url,
    widget_show_powered_by,
  } = req.body || {}

  const update = {}

  if (widget_brand_color !== undefined) {
    if (widget_brand_color && !HEX_RE.test(widget_brand_color)) {
      return res.status(400).json({ error: 'widget_brand_color doit être une couleur hex (ex: #0F5F35).' })
    }
    update.widget_brand_color = widget_brand_color || '#0F5F35'
  }

  if (widget_accent_color !== undefined) {
    if (widget_accent_color && !HEX_RE.test(widget_accent_color)) {
      return res.status(400).json({ error: 'widget_accent_color doit être une couleur hex (ex: #14A85C).' })
    }
    update.widget_accent_color = widget_accent_color || '#14A85C'
  }

  if (widget_position !== undefined) {
    if (!['bottom-right', 'bottom-left'].includes(widget_position)) {
      return res.status(400).json({ error: "widget_position doit être 'bottom-right' ou 'bottom-left'." })
    }
    update.widget_position = widget_position
  }

  if (widget_greeting !== undefined) {
    if (typeof widget_greeting !== 'string' || widget_greeting.length > MAX_GREETING) {
      return res.status(400).json({ error: `widget_greeting doit faire ${MAX_GREETING} caractères maximum.` })
    }
    update.widget_greeting = widget_greeting.trim() || 'Bonjour ! Comment puis-je vous aider ?'
  }

  if (widget_logo_url !== undefined) {
    if (widget_logo_url) {
      try {
        const u = new URL(widget_logo_url)
        if (u.protocol !== 'https:') throw new Error()
      } catch {
        return res.status(400).json({ error: 'widget_logo_url doit être une URL HTTPS valide.' })
      }
    }
    update.widget_logo_url = widget_logo_url?.trim() || null
  }

  if (widget_show_powered_by !== undefined) {
    if (typeof widget_show_powered_by !== 'boolean') {
      return res.status(400).json({ error: 'widget_show_powered_by doit être un booléen.' })
    }
    // Below Pro, the footer stays on regardless of what the client sends.
    update.widget_show_powered_by = canWhiteLabel ? widget_show_powered_by : true
  }

  if (Object.keys(update).length === 0) {
    return res.status(400).json({ error: 'Aucun champ à mettre à jour.' })
  }

  // ── Write to client_settings (upsert on client_id) ────────────
  // The row is created at onboarding, but upsert guards against edge cases.
  const { error: updateError } = await supabase
    .from('client_settings')
    .update(update)
    .eq('client_id', clientId)

  if (updateError) {
    console.error('[widget-settings] DB update error:', updateError.message)
    return res.status(500).json({ error: 'Erreur serveur' })
  }

  return res.status(200).json({
    ok: true,
    can_white_label: canWhiteLabel,
    widget: update,
  })
}

export default withSentry(handler)
