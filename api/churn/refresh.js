import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/**
 * Manual refresh of churn predictions for the current user's client.
 * Rate-limited to 1 call per day per client (based on last predicted_at in churn_predictions).
 */
async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Non autorise' })

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Non autorise' })

  try {
    // Resolve the user's client_id (owner or team member)
    let clientId = null
    const { data: link } = await supabase
      .from('client_users')
      .select('client_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (link?.client_id) {
      clientId = link.client_id
    } else {
      const { data: ownerClient } = await supabase
        .from('clients')
        .select('id')
        .eq('owner_user_id', user.id)
        .maybeSingle()
      clientId = ownerClient?.id || null
    }

    if (!clientId) return res.status(404).json({ error: 'Client introuvable' })

    // Daily limit: reject if we already have a prediction younger than 20h
    const { data: lastRow } = await supabase
      .from('churn_predictions')
      .select('predicted_at')
      .eq('client_id', clientId)
      .order('predicted_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (lastRow?.predicted_at) {
      const ageMs = Date.now() - new Date(lastRow.predicted_at).getTime()
      const MIN_INTERVAL_MS = 20 * 60 * 60 * 1000 // ~20h so daily refresh stays viable
      if (ageMs < MIN_INTERVAL_MS) {
        const retryAfterH = Math.ceil((MIN_INTERVAL_MS - ageMs) / (3600 * 1000))
        return res.status(429).json({
          error: 'Limite atteinte',
          message: `Analyse deja effectuee recemment. Reessayez dans ${retryAfterH}h.`,
          retry_after_hours: retryAfterH,
        })
      }
    }

    // Trigger the cron handler for this client only. We do an internal fetch
    // so the same logic is reused. In serverless Vercel, api/cron routes are
    // callable from the same deployment.
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : (process.env.PUBLIC_BASE_URL || '')

    let runResult = null

    if (baseUrl) {
      try {
        const r = await fetch(`${baseUrl}/api/cron/churn-predictions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(process.env.CRON_SECRET ? { 'Authorization': `Bearer ${process.env.CRON_SECRET}` } : {}),
          },
          body: JSON.stringify({ client_id: clientId }),
        })
        if (r.ok) runResult = await r.json()
      } catch (err) {
        console.error('[churn/refresh] internal fetch failed:', err.message)
      }
    }

    // Fallback: import and call handler directly if internal fetch failed
    if (!runResult) {
      const mod = await import('../cron/churn-predictions.js')
      const fakeReq = {
        method: 'POST',
        headers: { authorization: process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : '' },
        query: { client_id: clientId },
        body: { client_id: clientId },
      }
      const fakeRes = {
        _status: 200,
        _body: null,
        status(code) { this._status = code; return this },
        json(body) { this._body = body; return this },
      }
      await mod.default(fakeReq, fakeRes)
      runResult = fakeRes._body
    }

    return res.status(200).json({
      ok: true,
      client_id: clientId,
      result: runResult,
    })
  } catch (err) {
    console.error('[churn/refresh] error:', err)
    return res.status(500).json({ error: err.message })
  }
}

export default withSentry(handler)
