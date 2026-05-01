// api/vision/analyze.js
/**
 * POST /api/vision/analyze
 * Internal endpoint called by brain.js. Analyzes up to 5 images in parallel.
 *
 * Auth: x-internal-secret header OR x-engine-secret.
 *
 * Body:
 *   {
 *     client_id: UUID (required)
 *     ticket_id: UUID (optional — links result to ai_conversations row)
 *     image_paths: string[] (required, max 5, each is a storage path under ticket-attachments)
 *     use_case_hint?: 'broken_product' | 'checkout_error' | 'shipping_label' | 'invoice_receipt' | 'product_received' | 'other'
 *     context_text?: string — customer message snippet to help Claude interpret
 *   }
 *
 * Response:
 *   {
 *     analyses: Array<{
 *       image_path: string,
 *       is_sensitive: boolean,
 *       description?: string,
 *       extracted_data?: object,
 *       recommended_action: string,
 *       confidence?: number,
 *       error?: string
 *     }>,
 *     total_cost_eur: number,
 *     over_quota: boolean  // true if this run pushed the client over plan limit
 *   }
 */
import { withSentry, captureError } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'
import { checkSensitive } from './lib/sensitive-check.js'
import { analyzeImage } from './lib/main-analysis.js'
import { getLimits } from '../lib/plan-limits.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

// Indicative $/€ pricing — update if Anthropic changes their rates
const PRICE_PER_M_INPUT  = { 'claude-sonnet-4-6': 2.8, 'claude-haiku-4-5': 0.25 }   // EUR per 1M input tokens
const PRICE_PER_M_OUTPUT = { 'claude-sonnet-4-6': 14,  'claude-haiku-4-5': 1.25 }

function costEur(model, tin, tout) {
  const pin = PRICE_PER_M_INPUT[model] || 3
  const pout = PRICE_PER_M_OUTPUT[model] || 15
  return (tin * pin + tout * pout) / 1_000_000
}

async function createSignedUrl(path, ttlSeconds = 300) {
  const { data, error } = await supabase.storage
    .from('ticket-attachments')
    .createSignedUrl(path, ttlSeconds)
  if (error) throw error
  return data.signedUrl
}

async function currentMonthUsage(clientId) {
  const period = new Date().toISOString().slice(0, 7)  // 'YYYY-MM'
  const start = `${period}-01T00:00:00Z`
  const { count } = await supabase
    .from('vision_analyses')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', clientId)
    .gte('created_at', start)
  return count || 0
}

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })

  const secret = req.headers['x-internal-secret'] || req.headers['x-engine-secret']
  const ok = secret && (secret === process.env.INTERNAL_API_SECRET || secret === process.env.ENGINE_WEBHOOK_SECRET)
  if (!ok) return res.status(401).json({ error: 'unauthorized' })

  const { client_id, ticket_id, image_paths, use_case_hint, context_text } = req.body || {}
  if (!client_id) return res.status(400).json({ error: 'client_id required' })
  if (!Array.isArray(image_paths) || image_paths.length === 0) return res.status(400).json({ error: 'image_paths required' })
  if (image_paths.length > 5) return res.status(400).json({ error: 'max 5 images per call' })

  // ----- Plan quota check -----
  const { data: client } = await supabase
    .from('clients').select('plan').eq('id', client_id).maybeSingle()
  if (!client) return res.status(404).json({ error: 'client_not_found' })

  const limits = getLimits(client.plan || 'free')
  const already = await currentMonthUsage(client_id)
  const remaining = (limits.vision_analyses_per_month ?? 0) - already

  if (remaining <= 0 && limits.overage === null) {
    return res.status(429).json({ error: 'vision_quota_exceeded', quota: limits.vision_analyses_per_month, used: already })
  }

  // ----- Per-image pipeline (parallel) -----
  const analyses = []
  let totalCost = 0

  await Promise.all(image_paths.map(async (path) => {
    const rowBase = { client_id, ticket_id: ticket_id || null, image_path: path, use_case: use_case_hint || null }
    try {
      const signed = await createSignedUrl(path)

      // 1. Sensitivity pre-check
      const sens = await checkSensitive({ imageUrl: signed })
      const sensCost = costEur(sens.model_id, sens.tokens_in, sens.tokens_out)
      totalCost += sensCost

      if (sens.is_sensitive) {
        await supabase.from('vision_analyses').insert({
          ...rowBase,
          is_sensitive_detected: true,
          tokens_in: sens.tokens_in,
          tokens_out: sens.tokens_out,
          cost_eur: sensCost,
          model_id: sens.model_id,
          processing_ms: sens.processing_ms,
          result_json: { short_circuited: 'sensitive_document' },
        })
        // Delete the stored file immediately
        await supabase.storage.from('ticket-attachments').remove([path]).catch(() => {})

        analyses.push({
          image_path: path,
          is_sensitive: true,
          recommended_action: 'escalate_sensitive',
        })
        return
      }

      // 2. Main analysis
      const main = await analyzeImage({ imageUrl: signed, useCase: use_case_hint, contextText: context_text })
      const mainCost = costEur(main.model_id, main.tokens_in, main.tokens_out)
      totalCost += mainCost

      await supabase.from('vision_analyses').insert({
        ...rowBase,
        is_sensitive_detected: false,
        tokens_in: sens.tokens_in + main.tokens_in,
        tokens_out: sens.tokens_out + main.tokens_out,
        cost_eur: sensCost + mainCost,
        model_id: main.model_id,
        processing_ms: sens.processing_ms + main.processing_ms,
        result_json: main.analysis,
      })

      analyses.push({
        image_path: path,
        is_sensitive: false,
        ...main.analysis,
      })
    } catch (err) {
      captureError(err, { tags: { feature: 'vision', client_id, image_path: path } })
      analyses.push({ image_path: path, is_sensitive: false, error: String(err.message || err), recommended_action: 'request_more_info' })
    }
  }))

  return res.status(200).json({
    analyses,
    total_cost_eur: Number(totalCost.toFixed(5)),
    over_quota: remaining <= 0,
  })
}

export default withSentry(handler)
