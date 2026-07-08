/**
 * Actero Engine — Shopify Vocal Widget (disabled)
 *
 * The voice agent is not a live feature. This endpoint used to inject the
 * ElevenLabs widget into layout/theme.liquid via the Asset API — removed to
 * comply with App Store policy 5.1.1 (no theme-file edits via the Asset/Theme
 * API). If/when voice ships, it must install via a theme app extension block.
 */
import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Non autorise' })
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Non autorise' })

  return res.status(503).json({
    success: false,
    message: "L'agent vocal n'est pas disponible pour le moment.",
  })
}

export default withSentry(handler)
