/**
 * POST /api/integrations/whatsapp/disconnect
 *
 * Cleanly disconnects a merchant:
 *   1. Unsubscribe our app from the WABA (best effort)
 *   2. Delete the whatsapp_accounts row
 *   3. Flip client_settings.whatsapp_agent_enabled = false
 *
 * We never fail the disconnect if Meta call #1 errors — local state wins so
 * the merchant can always recover.
 *
 * Body: { client_id: UUID }
 * Auth: Bearer JWT
 */
import {
  supabaseAdmin,
  authenticateClientAccess,
  readJsonBody,
  requireMetaCredentials,
  metaFetch,
  loadWhatsAppAccount,
} from './_helpers.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!requireMetaCredentials(res)) return

  const body = await readJsonBody(req)
  const auth = await authenticateClientAccess(req, res, body.client_id)
  if (!auth) return

  const { clientId } = auth
  const account = await loadWhatsAppAccount(supabaseAdmin, clientId)

  // Best-effort Meta unsubscribe
  let unsubscribed = false
  let unsubscribeError = null
  if (account?.waba_id && account?.access_token_decrypted) {
    try {
      const resp = await metaFetch(`/${account.waba_id}/subscribed_apps`, {
        method: 'DELETE',
        accessToken: account.access_token_decrypted,
      })
      unsubscribed = resp.ok === true
      if (!resp.ok) unsubscribeError = resp.data?.error?.message || `HTTP ${resp.status}`
    } catch (err) {
      unsubscribeError = err?.message || 'unknown error'
    }
  }

  // Local cleanup
  if (account?.id) {
    await supabaseAdmin.from('whatsapp_accounts').delete().eq('id', account.id)
  } else {
    await supabaseAdmin.from('whatsapp_accounts').delete().eq('client_id', clientId)
  }

  await supabaseAdmin
    .from('client_settings')
    .update({ whatsapp_agent_enabled: false, updated_at: new Date().toISOString() })
    .eq('client_id', clientId)

  return res.status(200).json({
    success: true,
    unsubscribed,
    unsubscribe_error: unsubscribeError,
  })
}
