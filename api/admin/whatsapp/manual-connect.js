/**
 * POST /api/admin/whatsapp/manual-connect
 *
 * Admin-only endpoint to manually connect a WhatsApp Business account to a
 * client WITHOUT going through the Meta Embedded Signup popup.
 *
 * Use case: bootstrap a client with a Meta test number, or re-link an account
 * when the OAuth flow can't be used (pending Business Verification / App Review).
 *
 * The admin provides the permanent access token, WABA ID and phone_number_id
 * that were generated from a System User in Meta Business Settings. This
 * endpoint fetches metadata from the Graph API, encrypts the token, subscribes
 * the WABA webhook and upserts the whatsapp_accounts row — same side-effects
 * as the real exchange-code flow.
 *
 * Body:  { client_id: UUID, access_token: string, phone_number_id: string, waba_id: string }
 * Auth:  Bearer JWT (admin only via requireAdmin)
 */
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '../../lib/admin-auth.js'
import {
  metaFetch,
  encryptToken,
  META_GRAPH_VERSION,
} from '../../integrations/whatsapp/_helpers.js'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Two auth modes:
  // 1) Bootstrap: x-bootstrap-secret header matches WHATSAPP_BOOTSTRAP_SECRET env
  // 2) Admin JWT: standard requireAdmin()
  const bootstrapSecret = process.env.WHATSAPP_BOOTSTRAP_SECRET
  const providedBootstrap = req.headers['x-bootstrap-secret']
  const bootstrapOk = bootstrapSecret && providedBootstrap && providedBootstrap === bootstrapSecret

  if (!bootstrapOk) {
    const admin = await requireAdmin(req, res, supabaseAdmin)
    if (!admin) return
  }

  const { client_id, access_token, phone_number_id, waba_id } = req.body || {}
  if (!client_id || !access_token || !phone_number_id || !waba_id) {
    return res.status(400).json({
      error: 'Missing fields',
      hint: 'client_id, access_token, phone_number_id, waba_id all required',
    })
  }

  try {
    /* ---------- 1. Verify access_token works & discover business ---------- */
    const meResp = await metaFetch('/me', {
      accessToken: access_token,
      query: { fields: 'id,name' },
    })
    if (!meResp.ok) {
      return res.status(400).json({
        error: 'Token invalid',
        detail: meResp.data?.error?.message || `HTTP ${meResp.status}`,
      })
    }

    /* ---------- 2. Fetch WABA details ---------- */
    const wabaResp = await metaFetch(`/${waba_id}`, {
      accessToken: access_token,
      query: { fields: 'id,name,currency,timezone_id,owner_business_info' },
    })
    if (!wabaResp.ok) {
      return res.status(400).json({
        error: 'WABA not accessible with this token',
        detail: wabaResp.data?.error?.message || `HTTP ${wabaResp.status}`,
      })
    }
    const waba = wabaResp.data
    const businessId = waba.owner_business_info?.id || null
    const businessName = waba.owner_business_info?.name || null

    /* ---------- 3. Fetch phone number details ---------- */
    const phoneResp = await metaFetch(`/${phone_number_id}`, {
      accessToken: access_token,
      query: {
        fields: 'id,display_phone_number,verified_name,quality_rating,code_verification_status,messaging_limit_tier',
      },
    })
    if (!phoneResp.ok) {
      return res.status(400).json({
        error: 'Phone number not accessible with this token',
        detail: phoneResp.data?.error?.message || `HTTP ${phoneResp.status}`,
      })
    }
    const phone = phoneResp.data

    /* ---------- 4. Subscribe our app to the WABA webhook ---------- */
    const subResp = await metaFetch(`/${waba_id}/subscribed_apps`, {
      method: 'POST',
      accessToken: access_token,
    })
    const webhookSubscribed = subResp.ok === true
    if (!webhookSubscribed) {
      console.warn(
        '[admin/whatsapp/manual-connect] webhook subscribe warning:',
        subResp.data?.error?.message || subResp.status,
      )
    }

    /* ---------- 5. Persist in whatsapp_accounts ---------- */
    const encryptedToken = encryptToken(access_token)
    const { data: upserted, error: upsertError } = await supabaseAdmin
      .from('whatsapp_accounts')
      .upsert(
        {
          client_id,
          waba_id,
          phone_number_id,
          display_phone_number: phone.display_phone_number || null,
          verified_name: phone.verified_name || null,
          quality_rating: phone.quality_rating || null,
          messaging_tier: phone.messaging_limit_tier || null,
          access_token_encrypted: encryptedToken,
          webhook_subscribed: webhookSubscribed,
          pin_configured: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'client_id' },
      )
      .select()
      .single()

    if (upsertError) {
      console.error('[admin/whatsapp/manual-connect] upsert error:', upsertError)
      return res.status(500).json({ error: 'DB upsert failed', detail: upsertError.message })
    }

    /* ---------- 6. Flip the kill-switch on ---------- */
    await supabaseAdmin
      .from('client_settings')
      .update({ whatsapp_agent_enabled: true, updated_at: new Date().toISOString() })
      .eq('client_id', client_id)

    return res.status(200).json({
      success: true,
      client_id,
      phone_number_id,
      display_phone_number: phone.display_phone_number,
      verified_name: phone.verified_name,
      waba_id,
      webhook_subscribed: webhookSubscribed,
    })
  } catch (err) {
    console.error('[admin/whatsapp/manual-connect] fatal:', err)
    return res.status(500).json({ error: err.message || 'Unknown error' })
  }
}
