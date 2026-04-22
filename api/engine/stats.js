/**
 * Actero Engine — Stats / Health Endpoint
 * Returns engine metrics for monitoring.
 *
 * GET /api/engine/stats
 * Requires x-engine-secret or x-internal-secret header.
 */
import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'

const ENGINE_SECRET = process.env.ENGINE_WEBHOOK_SECRET
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function handler(req, res) {
  const secret = req.headers['x-engine-secret'] || req.headers['x-internal-secret']
  if (secret !== ENGINE_SECRET && secret !== INTERNAL_SECRET) {
    return res.status(401).json({ error: 'Non autorise' })
  }

  const now = new Date()
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString()
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()

  try {
    const [
      { count: totalMessages },
      { count: hourMessages },
      { count: dayMessages },
      { count: processedCount },
      { count: escalatedCount },
      { count: failedCount },
      { data: avgResponse },
    ] = await Promise.all([
      supabase.from('engine_messages').select('*', { count: 'exact', head: true }),
      supabase.from('engine_messages').select('*', { count: 'exact', head: true }).gte('created_at', oneHourAgo),
      supabase.from('engine_messages').select('*', { count: 'exact', head: true }).gte('created_at', oneDayAgo),
      supabase.from('engine_messages').select('*', { count: 'exact', head: true }).eq('status', 'processed'),
      supabase.from('engine_messages').select('*', { count: 'exact', head: true }).eq('status', 'escalated'),
      supabase.from('engine_messages').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
      supabase.from('engine_responses').select('processing_time_ms').not('processing_time_ms', 'is', null).order('created_at', { ascending: false }).limit(50),
    ])

    const avgProcessingMs = avgResponse && avgResponse.length > 0
      ? Math.round(avgResponse.reduce((s, r) => s + (r.processing_time_ms || 0), 0) / avgResponse.length)
      : 0

    const autoResolveRate = (processedCount || 0) + (escalatedCount || 0) > 0
      ? Math.round(((processedCount || 0) / ((processedCount || 0) + (escalatedCount || 0))) * 100)
      : 0

    return res.status(200).json({
      status: 'healthy',
      engine_version: '1.0.0',
      stats: {
        total_messages: totalMessages || 0,
        last_hour: hourMessages || 0,
        last_24h: dayMessages || 0,
        processed: processedCount || 0,
        escalated: escalatedCount || 0,
        failed: failedCount || 0,
        auto_resolve_rate: `${autoResolveRate}%`,
        avg_processing_ms: avgProcessingMs,
      },
      timestamp: now.toISOString(),
    })
  } catch (err) {
    return res.status(500).json({ status: 'error', error: err.message })
  }
}

export default withSentry(handler)
