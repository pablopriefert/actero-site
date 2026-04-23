// api/cron/purge-vision-images.js
import { withCronMonitor } from '../lib/cron-monitor.js'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)
export const maxDuration = 60

async function handler(req, res) {
  const cutoff = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString()

  const { data: old } = await supabase
    .from('vision_analyses')
    .select('image_path')
    .lt('created_at', cutoff)
    .limit(500)

  if (!old?.length) return res.status(200).json({ deleted: 0 })

  const paths = old.map(r => r.image_path).filter(Boolean)
  await supabase.storage.from('ticket-attachments').remove(paths).catch(() => {})

  // We keep the DB row for audit but null the path (analysis result still readable)
  await supabase.from('vision_analyses')
    .update({ image_path: '[purged]' })
    .lt('created_at', cutoff)

  return res.status(200).json({ deleted: paths.length })
}

export default withCronMonitor('purge-vision-images', '0 3 * * *', handler)
