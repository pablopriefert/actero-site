/**
 * GET /api/leads/audit-report?token=xxx
 *
 * Public endpoint — returns the audit report for a given token.
 * No auth required (the token IS the auth — shared via email).
 */

import { createClient } from '@supabase/supabase-js'
import { withSentry } from '../lib/sentry.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.SITE_URL || 'https://actero.fr')
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { token } = req.query
  if (!token || token.length < 10) {
    return res.status(400).json({ error: 'Invalid token' })
  }

  try {
    const { data: audit, error } = await supabase
      .from('prospect_audits')
      .select('store_name, store_url, average_rating, total_reviews, negative_reviews_count, reviews_source, analysis, support_score, created_at')
      .eq('report_token', token)
      .single()

    if (error || !audit) {
      return res.status(404).json({ error: 'Report not found' })
    }

    // Track that the report was opened (best-effort)
    supabase
      .from('prospect_audits')
      .update({ email_status: 'opened', report_opened_at: new Date().toISOString() })
      .eq('report_token', token)
      .eq('email_status', 'sent') // Only update if currently "sent" (don't downgrade "replied")
      .then(() => {})
      .catch(() => {})

    return res.status(200).json(audit)
  } catch (err) {
    console.error('Audit report fetch error:', err)
    return res.status(500).json({ error: 'Server error' })
  }
}

export default withSentry(handler)
