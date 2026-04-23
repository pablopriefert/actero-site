// api/vision/lib/ingress.js
/**
 * Upload remote images (URLs or Buffer) to ticket-attachments bucket.
 * Returns array of storage paths.
 *
 *   uploadToStorage({ supabase, clientId, ticketId, images })
 *     images: Array<{ buffer: Buffer, mime: string, ext: string } | { url: string }>
 */
import crypto from 'crypto'

const BUCKET = 'ticket-attachments'
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
const MAX_BYTES = 5 * 1024 * 1024    // 5 MB
const MIN_BYTES = 10 * 1024          // 10 KB — drop tiny email-signature logos

export async function uploadToStorage({ supabase, clientId, ticketId, images }) {
  const paths = []
  const idPart = ticketId || crypto.randomUUID()

  for (const img of images.slice(0, 5)) {
    let buf, mime, ext
    if (img.url) {
      const res = await fetch(img.url)
      if (!res.ok) continue
      mime = res.headers.get('content-type') || 'image/jpeg'
      if (!ALLOWED_MIME.has(mime)) continue
      buf = Buffer.from(await res.arrayBuffer())
      ext = mime.split('/')[1].replace('jpeg', 'jpg')
    } else if (img.buffer) {
      buf = img.buffer
      mime = img.mime
      if (!ALLOWED_MIME.has(mime)) continue
      ext = img.ext || 'jpg'
    } else {
      continue
    }

    if (buf.length < MIN_BYTES) continue   // signature logos
    if (buf.length > MAX_BYTES) continue   // too big

    const path = `${clientId}/${idPart}/${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from(BUCKET).upload(path, buf, {
      contentType: mime,
      upsert: false,
    })
    if (!error) paths.push(path)
  }
  return paths
}
