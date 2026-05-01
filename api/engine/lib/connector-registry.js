/**
 * Actero Engine — Connector Registry
 * Maps source types to their outbound connector modules.
 *
 * Every connector shares the same runtime signature:
 *   (supabase, { clientId, customerEmail, customerName, subject, response,
 *                brandName, ... }) → { success, error? }
 */

import { sendViaEmail } from '../connectors/email.js'
import { sendViaGorgias } from '../connectors/gorgias.js'
import { sendViaZendesk } from '../connectors/zendesk.js'
import { sendViaSlack } from '../connectors/slack.js'

const CONNECTORS = {
  email: sendViaEmail,
  gorgias: sendViaGorgias,
  zendesk: sendViaZendesk,
  slack: sendViaSlack,
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
  return ['email', 'gorgias', 'zendesk', 'slack'].includes(source)
}
