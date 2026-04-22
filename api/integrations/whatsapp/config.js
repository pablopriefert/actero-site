/**
 * Actero WhatsApp — Public config endpoint
 *
 * Returns the non-secret Meta config needed by the frontend to initialize
 * the Facebook JS SDK and open the Embedded Signup popup.
 *
 * GET /api/integrations/whatsapp/config
 *
 * Response shape:
 *   200 { available: true, app_id, config_id, graph_version }
 *   200 { available: false, reason: 'META_APP_ID missing' | 'META_CONFIG_ID missing' }
 *
 * We return 200 in both cases (with `available: false`) so the frontend can
 * display a friendly "coming soon" banner instead of crashing. No secrets
 * leave the server — META_APP_SECRET stays backend-only.
 */
import { withSentry } from '../../lib/sentry.js'
function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const appId = process.env.META_APP_ID
  const configId = process.env.META_CONFIG_ID
  const graphVersion = process.env.META_GRAPH_VERSION || 'v21.0'

  if (!appId) {
    return res.status(200).json({
      available: false,
      reason: 'META_APP_ID missing in server environment',
    })
  }
  if (!configId) {
    return res.status(200).json({
      available: false,
      reason: 'META_CONFIG_ID missing in server environment',
    })
  }

  return res.status(200).json({
    available: true,
    app_id: appId,
    config_id: configId,
    graph_version: graphVersion,
  })
}

export default withSentry(handler)
