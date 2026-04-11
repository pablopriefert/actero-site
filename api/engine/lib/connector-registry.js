/**
 * Actero Engine — Connector Registry
 * Maps source types to their outbound connector modules.
 *
 * Every connector shares the same runtime signature:
 *   (supabase, { clientId, customerEmail, customerName, subject, response,
 *                brandName, ... }) → { success, error? }
 *
 * The WhatsApp connector internally looks up `whatsapp_accounts` for the
 * given clientId (the registry does not carry the integration itself).
 */

import { sendViaEmail } from '../connectors/email.js'
import { sendViaGorgias } from '../connectors/gorgias.js'
import { sendViaZendesk } from '../connectors/zendesk.js'
import { sendViaSlack } from '../connectors/slack.js'
import { sendWhatsAppMessage } from '../connectors/whatsapp.js'

// Thin adapter so the WhatsApp connector matches the registry contract.
async function sendViaWhatsApp(supabase, args) {
  return sendWhatsAppMessage(supabase, args)
}

const CONNECTORS = {
  email: sendViaEmail,
  gorgias: sendViaGorgias,
  zendesk: sendViaZendesk,
  slack: sendViaSlack,
  whatsapp: sendViaWhatsApp,
  // Phase 3+
  shopify: sendViaEmail,    // fallback to email
  web_widget: null,         // handled synchronously in webhook response
  intercom: sendViaEmail,   // fallback to email
  crisp: sendViaEmail,      // fallback to email
}

/**
 * Get the connector function for a given source.
 * Returns the email connector as fallback if no specific connector exists.
 */
export function getConnector(source) {
  return CONNECTORS[source] || sendViaEmail
}

/**
 * Check if a source has a native connector (not email fallback).
 */
export function hasNativeConnector(source) {
  return ['email', 'gorgias', 'zendesk', 'slack', 'whatsapp'].includes(source)
}
