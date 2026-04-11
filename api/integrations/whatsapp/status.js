/**
 * GET /api/integrations/whatsapp/status?client_id=UUID
 *
 * Returns the current WhatsApp connection state for a merchant so the
 * dashboard can render "Connecte / Deconnecte / Besoin d'action".
 *
 * Response shape:
 *   { connected: false }                          — nothing in DB
 *   { connected: true, phone_number_id, display_phone_number,
 *     verified_name, quality_rating, messaging_tier, webhook_subscribed,
 *     business_name, waba_name, connected_at }
 *
 * Auth: Bearer JWT
 */
import {
  supabaseAdmin,
  authenticateClientAccess,
  requireMetaCredentials,
} from './_helpers.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  if (!requireMetaCredentials(res)) return

  const auth = await authenticateClientAccess(req, res, req.query?.client_id)
  if (!auth) return

  const { clientId } = auth

  const { data: account, error } = await supabaseAdmin
    .from('whatsapp_accounts')
    .select(
      'phone_number_id, display_phone_number, verified_name, quality_rating, messaging_tier, code_verification_status, webhook_subscribed, business_id, business_name, waba_id, waba_name, connected_at, status'
    )
    .eq('client_id', clientId)
    .maybeSingle()

  if (error) {
    console.error('[whatsapp/status] DB error:', error)
    return res.status(500).json({ error: error.message })
  }

  if (!account) {
    return res.status(200).json({ connected: false })
  }

  // Mirror the kill-switch so the frontend can reflect "paused" vs "live".
  const { data: settings } = await supabaseAdmin
    .from('client_settings')
    .select('whatsapp_agent_enabled')
    .eq('client_id', clientId)
    .maybeSingle()

  return res.status(200).json({
    connected: true,
    agent_enabled: settings?.whatsapp_agent_enabled !== false,
    ...account,
  })
}
