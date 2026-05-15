/**
 * POST /api/leads/audit-analyze
 *
 * Full prospect audit pipeline:
 *   1. Scrapes reviews via SerpAPI / Tavily
 *   2. Sends reviews to Claude for support-quality analysis
 *   3. Saves structured audit to Supabase `prospect_audits`
 *   4. Returns the audit report
 *
 * Body: { store_name, store_url?, contact_email?, contact_name? }
 * Auth: admin only (uses SerpAPI + Anthropic credits)
 *
 * Core logic lives in ../lib/prospect-audit.js (shared with the batch runner).
 */

import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '../lib/admin-auth.js'
import { runAuditForProspect } from '../lib/prospect-audit.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

async function handler(req, res) {
  const allowedOrigin = process.env.SITE_URL || 'https://actero.fr'
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin)
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const adminUser = await requireAdmin(req, res, supabase)
  if (!adminUser) return

  const { store_name, store_url, contact_email, contact_name } = req.body
  if (!store_name) return res.status(400).json({ error: 'store_name required' })

  try {
    const { audit, noReviews, scraped } = await runAuditForProspect({
      store_name,
      store_url,
      contact_email,
      contact_name,
      supabase,
    })

    // Hard fail if no reviews — avoid generating fabricated insights.
    // Preserves the original 422 behavior of the single-prospect endpoint.
    if (noReviews) {
      return res.status(422).json({
        error: `Aucun avis trouvé pour "${store_name}". Vérifie le nom (essaie le nom commercial complet) ou cette marque n'est pas indexée sur Google Maps / Trustpilot.`,
        scraped_meta: {
          source: scraped.source,
          average_rating: scraped.averageRating,
          total_reviews: scraped.totalReviews,
        },
      })
    }

    return res.status(200).json(audit)
  } catch (error) {
    console.error('Audit analyze error:', error)
    return res.status(500).json({ error: 'Erreur audit: ' + error.message })
  }
}

export default withSentry(handler)
