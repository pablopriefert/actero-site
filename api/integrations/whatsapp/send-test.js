/**
 * POST /api/integrations/whatsapp/send-test
 *
 * Sends a hard-coded confirmation message ("Actero est connecte") to a number
 * the merchant chose. Used right after the Embedded Signup completes so the
 * merchant can verify the pipe works end-to-end.
 *
 * Body: { client_id: UUID, to: "+33xxxxxxxxx" }
 * Auth: Bearer JWT → authenticateClientAccess()
 *
 * Note: for this to work the `to` number must already be inside the 24h
 * customer service window OR the sender must be a newly-registered test
 * number (Meta gives every merchant 5 test recipients during review).
 */
import { withSentry } from '../../lib/sentry.js'
import {
  authenticateClientAccess,
  readJsonBody,
  requireMetaCredentials,
  loadWhatsAppAccount,
  supabaseAdmin,
} from './_helpers.js'
import { sendWhatsAppMessage } from '../../engine/connectors/whatsapp.js'

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!requireMetaCredentials(res)) return

  const body = await readJsonBody(req)
  const auth = await authenticateClientAccess(req, res, body.client_id)
  if (!auth) return

  const { clientId } = auth
  const to = body.to
  if (!to) return res.status(400).json({ error: 'to required (e.g. +33XXXXXXXXX)' })

  const account = await loadWhatsAppAccount(supabaseAdmin, clientId)
  if (!account) {
    return res.status(404).json({ error: 'No WhatsApp account connected for this client' })
  }

  const result = await sendWhatsAppMessage(
    {
      phone_number_id: account.phone_number_id,
      access_token_decrypted: account.access_token_decrypted,
    },
    {
      to,
      body: 'Actero est connecte. Ce canal WhatsApp est maintenant gere par votre agent IA.',
    }
  )

  if (!result.success) {
    return res.status(502).json({
      error: result.error || 'Meta send failed',
      error_code: result.errorCode || null,
      hint: result.hint || null,
    })
  }

  // Log the outbound row so the dashboard shows the test message.
  try {
    await supabaseAdmin.from('whatsapp_messages').insert({
      client_id: clientId,
      whatsapp_account_id: account.id,
      phone_number_id: account.phone_number_id,
      wa_message_id: result.wa_message_id || null,
      wa_message_type: 'text',
      direction: 'outbound',
      from_phone: account.display_phone_number || null,
      to_phone: to,
      body: 'Actero est connecte. Ce canal WhatsApp est maintenant gere par votre agent IA.',
      status: 'sent',
      metadata: { test: true },
    })
  } catch { /* non-blocking */ }

  return res.status(200).json({
    success: true,
    wa_message_id: result.wa_message_id,
    to,
  })
}

export default withSentry(handler)
