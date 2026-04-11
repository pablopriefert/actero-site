/**
 * Actero Engine — WhatsApp Cloud API Normalizer
 *
 * Transforms Meta's webhook payload (entry[0].changes[0].value) into the
 * standard `normalized` object expected by runBrain().
 *
 * Meta payload shape:
 *   {
 *     messaging_product: "whatsapp",
 *     metadata: { display_phone_number, phone_number_id },
 *     contacts: [{ profile: { name }, wa_id }],
 *     messages: [{ from, id, timestamp, type, text: { body }, ... }]
 *   }
 */

/**
 * Extract a friendly text body from any message type WhatsApp can send.
 * Falls back to a short marker so Brain always has something to classify.
 */
function extractBody(message) {
  if (!message) return '[empty]'
  switch (message.type) {
    case 'text':
      return message.text?.body || '[text]'
    case 'button':
      return message.button?.text || message.button?.payload || '[button]'
    case 'interactive': {
      const i = message.interactive
      return (
        i?.button_reply?.title ||
        i?.list_reply?.title ||
        i?.nfm_reply?.body ||
        '[interactive]'
      )
    }
    case 'image':
      return message.image?.caption || '[image]'
    case 'video':
      return message.video?.caption || '[video]'
    case 'document':
      return message.document?.caption || message.document?.filename || '[document]'
    case 'audio':
      return '[audio]'
    case 'voice':
      return '[voice]'
    case 'sticker':
      return '[sticker]'
    case 'location':
      return '[location]'
    case 'contacts':
      return '[contacts]'
    case 'reaction':
      return message.reaction?.emoji || '[reaction]'
    case 'order':
      return '[order]'
    default:
      return `[${message.type || 'unknown'}]`
  }
}

/**
 * Normalize a single inbound WhatsApp message into the Brain's input shape.
 */
export function normalizeWhatsAppMessage({ value, message, contact }) {
  const phone = message?.from || ''
  const name = contact?.profile?.name || null

  return {
    // Synthetic email so downstream code (memory, threads, connectors) that
    // expects an email key keeps working. "@whatsapp.actero.fr" is our
    // reserved internal TLD.
    customer_email: phone ? `${phone}@whatsapp.actero.fr` : '',
    customer_phone: phone,
    customer_name: name,
    message: extractBody(message),
    subject: 'Message WhatsApp',
    session_id: `whatsapp_${phone}`,
    source: 'whatsapp',
    channel: 'whatsapp',
    metadata: {
      wa_message_id: message?.id || null,
      wa_message_type: message?.type || null,
      wa_timestamp: message?.timestamp || null,
      wa_phone_number_id: value?.metadata?.phone_number_id || null,
      wa_display_phone_number: value?.metadata?.display_phone_number || null,
    },
    // Duplicated at top level for convenience
    wa_message_id: message?.id || null,
    wa_message_type: message?.type || null,
  }
}
