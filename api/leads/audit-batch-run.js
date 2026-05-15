/**
 * POST /api/leads/audit-batch-run
 *
 * Processes queued prospect_audits rows sequentially:
 *   scrape → analyze → send RGPD-compliant cold email.
 *
 * Body: { batch_id?, limit? }   (limit default 10, hard cap 25)
 * Auth: admin only
 *
 * Returns { processed, emailed, skipped, failed, remaining_queued }
 */

import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '../lib/admin-auth.js'
import { runAuditForProspect, sendAuditEmail } from '../lib/prospect-audit.js'

export const maxDuration = 60

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

// Hard cap: one invocation must not exceed maxDuration=60s.
const MAX_PER_INVOCATION = 25
const DEFAULT_LIMIT = 10

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function markRow(id, patch) {
  await supabase.from('prospect_audits').update(patch).eq('id', id)
}

async function handler(req, res) {
  const allowedOrigin = process.env.SITE_URL || 'https://actero.fr'
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin)
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const adminUser = await requireAdmin(req, res, supabase)
  if (!adminUser) return

  const body = req.body || {}
  const batchId = body.batch_id || null
  let limit = parseInt(body.limit, 10)
  if (!Number.isFinite(limit) || limit <= 0) limit = DEFAULT_LIMIT
  limit = Math.min(limit, MAX_PER_INVOCATION)

  try {
    // Select oldest queued rows (optionally scoped to a batch).
    let query = supabase
      .from('prospect_audits')
      .select('*')
      .eq('pipeline_status', 'queued')
      .order('created_at', { ascending: true })
      .limit(limit)
    if (batchId) query = query.eq('batch_id', batchId)

    const { data: rows, error: selectError } = await query
    if (selectError) {
      return res.status(500).json({ error: 'Select failed: ' + selectError.message })
    }

    let processed = 0
    let emailed = 0
    let skipped = 0
    let failed = 0

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      processed++

      try {
        const email = (row.contact_email || '').trim().toLowerCase()

        // 1a. No contact email → skip.
        if (!email) {
          await markRow(row.id, {
            pipeline_status: 'skipped',
            pipeline_error: 'no contact_email',
          })
          skipped++
          continue
        }

        // 1b. Email opted out (suppression list, case-insensitive).
        const { data: suppressed } = await supabase
          .from('email_suppressions')
          .select('email')
          .eq('email', email)
          .maybeSingle()
        if (suppressed) {
          await markRow(row.id, {
            pipeline_status: 'skipped',
            pipeline_error: 'email suppressed (unsubscribed)',
          })
          skipped++
          continue
        }

        // 1c. Same store already emailed in a prior row → skip duplicate.
        const { data: priorEmailed } = await supabase
          .from('prospect_audits')
          .select('id')
          .eq('store_name', row.store_name)
          .eq('pipeline_status', 'emailed')
          .neq('id', row.id)
          .limit(1)
          .maybeSingle()
        if (priorEmailed) {
          await markRow(row.id, {
            pipeline_status: 'skipped',
            pipeline_error: 'store already emailed in a prior row',
          })
          skipped++
          continue
        }

        // 2. Scrape + analyze + upsert (updates this queued row in place).
        const { audit, noReviews } = await runAuditForProspect({
          store_name: row.store_name,
          store_url: row.store_url,
          contact_email: row.contact_email,
          contact_name: row.contact_name,
          supabase,
          existingId: row.id,
        })

        if (noReviews) {
          await markRow(row.id, {
            pipeline_status: 'skipped',
            pipeline_error: 'no reviews found',
          })
          skipped++
          continue
        }

        // 3. Audited OK + email present + not suppressed → send.
        const sendResult = await sendAuditEmail({ audit, supabase })
        if (sendResult.skipped) {
          await markRow(row.id, {
            pipeline_status: 'skipped',
            pipeline_error: 'send skipped: ' + sendResult.reason,
          })
          skipped++
          continue
        }

        await markRow(row.id, {
          pipeline_status: 'emailed',
          pipeline_error: null,
        })
        emailed++
      } catch (err) {
        // 4. Never abort the whole batch.
        console.error(`[batch] row ${row.id} failed:`, err)
        await markRow(row.id, {
          pipeline_status: 'failed',
          pipeline_error: (err.message || String(err)).slice(0, 500),
        })
        failed++
      }

      // ~1.5s polite delay between prospects (skip after the last one).
      if (i < rows.length - 1) await sleep(1500)
    }

    // Count remaining queued (respecting the optional batch filter).
    let remainingQuery = supabase
      .from('prospect_audits')
      .select('id', { count: 'exact', head: true })
      .eq('pipeline_status', 'queued')
    if (batchId) remainingQuery = remainingQuery.eq('batch_id', batchId)
    const { count: remaining_queued } = await remainingQuery

    return res.status(200).json({
      processed,
      emailed,
      skipped,
      failed,
      remaining_queued: remaining_queued || 0,
    })
  } catch (error) {
    console.error('Batch run error:', error)
    return res.status(500).json({ error: 'Erreur batch: ' + error.message })
  }
}

export default withSentry(handler)
