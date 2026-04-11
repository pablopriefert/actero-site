/**
 * POST /api/integrations/whatsapp/exchange-code
 *
 * Called by the frontend right after Meta's Embedded Signup popup closes.
 * The popup returns a short-lived `code` via FB.login().authResponse.code.
 * We exchange it for a permanent business access token, discover the
 * business / WABA / phone number, register the number on Cloud API (with a
 * random 2FA PIN), subscribe the app to the WABA webhook, encrypt the token,
 * and persist everything in whatsapp_accounts.
 *
 * Body:  { client_id: UUID, code: string }
 * Auth:  Bearer JWT → authenticateClientAccess()
 * Response: { success, phone_number_id, display_phone_number, waba_id, business_id }
 *
 * Env required: META_APP_ID, META_APP_SECRET
 * Env optional: META_GRAPH_VERSION (default v21.0), WHATSAPP_TOKEN_ENCRYPTION_KEY
 */
import {
  supabaseAdmin,
  authenticateClientAccess,
  readJsonBody,
  requireMetaCredentials,
  metaFetch,
  encryptToken,
  META_GRAPH_VERSION,
} from './_helpers.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!requireMetaCredentials(res)) return

  const body = await readJsonBody(req)
  const auth = await authenticateClientAccess(req, res, body.client_id)
  if (!auth) return

  const { clientId } = auth
  const code = body.code
  if (!code) return res.status(400).json({ error: 'code required' })

  const META_APP_ID = process.env.META_APP_ID
  const META_APP_SECRET = process.env.META_APP_SECRET

  try {
    /* ---------- 1. Exchange short-lived code for a business token ---------- */
    const tokenResp = await metaFetch('/oauth/access_token', {
      method: 'GET',
      query: {
        client_id: META_APP_ID,
        client_secret: META_APP_SECRET,
        code,
      },
    })
    if (!tokenResp.ok || !tokenResp.data?.access_token) {
      return res.status(400).json({
        error: 'Meta token exchange failed',
        detail: tokenResp.data?.error?.message || `HTTP ${tokenResp.status}`,
      })
    }
    const accessToken = tokenResp.data.access_token

    /* ---------- 2. Discover business portfolio ---------- */
    const bizResp = await metaFetch('/me/businesses', {
      accessToken,
      query: { fields: 'id,name' },
    })
    if (!bizResp.ok || !bizResp.data?.data?.length) {
      return res.status(400).json({
        error: 'No Meta business portfolio found',
        detail: bizResp.data?.error?.message || 'empty /me/businesses',
      })
    }
    const business = bizResp.data.data[0]
    const businessId = business.id

    /* ---------- 3. Find the WABA owned by that business ---------- */
    const wabaResp = await metaFetch(`/${businessId}/owned_whatsapp_business_accounts`, {
      accessToken,
      query: { fields: 'id,name,currency,timezone_id' },
    })
    if (!wabaResp.ok || !wabaResp.data?.data?.length) {
      return res.status(400).json({
        error: 'No WABA found under this business',
        detail: wabaResp.data?.error?.message || 'empty owned_whatsapp_business_accounts',
      })
    }
    const waba = wabaResp.data.data[0]
    const wabaId = waba.id

    /* ---------- 4. Fetch phone numbers attached to the WABA ---------- */
    const phonesResp = await metaFetch(`/${wabaId}/phone_numbers`, {
      accessToken,
      query: { fields: 'id,display_phone_number,verified_name,quality_rating,code_verification_status,messaging_limit_tier' },
    })
    if (!phonesResp.ok || !phonesResp.data?.data?.length) {
      return res.status(400).json({
        error: 'No phone number attached to this WABA',
        detail: phonesResp.data?.error?.message || 'empty phone_numbers',
      })
    }
    const phone = phonesResp.data.data[0]
    const phoneNumberId = phone.id

    /* ---------- 5. Register the number on Cloud API with a random PIN ---------- */
    const pin = String(Math.floor(100_000 + Math.random() * 900_000)) // 6 digits
    const registerResp = await metaFetch(`/${phoneNumberId}/register`, {
      method: 'POST',
      accessToken,
      body: { messaging_product: 'whatsapp', pin },
    })
    // Some numbers are already registered — Meta returns an error but we
    // still want to proceed. Log and continue.
    if (!registerResp.ok) {
      console.warn(
        `[whatsapp/exchange-code] register warning for ${phoneNumberId}:`,
        registerResp.data?.error?.message || registerResp.status,
      )
    }

    /* ---------- 6. Subscribe our app to the WABA webhook ---------- */
    const subResp = await metaFetch(`/${wabaId}/subscribed_apps`, {
      method: 'POST',
      accessToken,
    })
    const webhookSubscribed = subResp.ok === true
    if (!webhookSubscribed) {
      console.warn(
        `[whatsapp/exchange-code] webhook subscribe warning:`,
        subResp.data?.error?.message || subResp.status,
      )
    }

    /* ---------- 7. Persist in whatsapp_accounts (upsert) ---------- */
    const encryptedToken = encryptToken(accessToken)
    const { data: upserted, error: upsertError } = await supabaseAdmin
      .from('whatsapp_accounts')
      .upsert(
        {
          client_id: clientId,
          business_id: businessId,
          business_name: business.name || null,
          waba_id: wabaId,
          waba_name: waba.name || null,
          phone_number_id: phoneNumberId,
          display_phone_number: phone.display_phone_number || null,
          verified_name: phone.verified_name || null,
          quality_rating: phone.quality_rating || null,
          messaging_tier: phone.messaging_limit_tier || null,
          code_verification_status: phone.code_verification_status || null,
          access_token: encryptedToken,
          token_pin: pin,
          webhook_subscribed: webhookSubscribed,
          graph_version: META_GRAPH_VERSION,
          status: 'active',
          connected_at: new Date().toISOString(),
        },
        { onConflict: 'client_id' }
      )
      .select()
      .single()

    if (upsertError) {
      console.error('[whatsapp/exchange-code] upsert error:', upsertError)
      return res.status(500).json({ error: 'DB upsert failed', detail: upsertError.message })
    }

    /* ---------- 8. Flip the kill-switch on ---------- */
    await supabaseAdmin
      .from('client_settings')
      .update({ whatsapp_agent_enabled: true, updated_at: new Date().toISOString() })
      .eq('client_id', clientId)

    return res.status(200).json({
      success: true,
      phone_number_id: phoneNumberId,
      display_phone_number: phone.display_phone_number,
      verified_name: phone.verified_name,
      waba_id: wabaId,
      business_id: businessId,
      webhook_subscribed: webhookSubscribed,
    })
  } catch (err) {
    console.error('[whatsapp/exchange-code] fatal error:', err)
    return res.status(500).json({ error: err.message || 'Unknown error' })
  }
}
