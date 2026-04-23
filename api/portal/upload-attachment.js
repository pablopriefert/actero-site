import { withSentry } from '../lib/sentry.js'
import { getServiceRoleClient } from './lib/supabase.js'
import { requirePortalSession } from './lib/session.js'
import crypto from 'crypto'

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
const MAX = 5 * 1024 * 1024

export const config = { api: { bodyParser: { sizeLimit: '6mb' } } }

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })
  let session
  try { session = await requirePortalSession(req) }
  catch (e) { return res.status(e.status).json({ error: e.code }) }

  const { data_url, filename } = req.body || {}
  if (!data_url?.startsWith('data:image/')) return res.status(400).json({ error: 'invalid_data_url' })

  const [header, b64] = data_url.split(',')
  const mime = header.match(/data:(image\/[a-z+]+);base64/i)?.[1]
  if (!ALLOWED.has(mime)) return res.status(400).json({ error: 'mime_not_allowed' })

  const buf = Buffer.from(b64, 'base64')
  if (buf.length > MAX) return res.status(413).json({ error: 'too_large' })

  const ext = mime.split('/')[1].replace('jpeg', 'jpg')
  const path = `${session.clientId}/portal/${crypto.randomUUID()}.${ext}`

  const supabase = getServiceRoleClient()
  const { error } = await supabase.storage.from('ticket-attachments').upload(path, buf, {
    contentType: mime, upsert: false,
  })
  if (error) return res.status(500).json({ error: 'upload_failed' })

  return res.status(200).json({ path })
}

export default withSentry(handler)
