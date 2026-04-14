/**
 * Knowledge Base import — unified endpoint for Google Docs & Notion.
 *
 * GET  /api/integrations/knowledge-import?provider=google_docs&action=list
 * GET  /api/integrations/knowledge-import?provider=notion&action=list
 * POST /api/integrations/knowledge-import  { provider, action: 'import', doc_ids: [...] }
 *
 * Requires Bearer token from authenticated client user.
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function requireClient(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) { res.status(401).json({ error: 'Non autorisé' }); return null }
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) { res.status(401).json({ error: 'Non autorisé' }); return null }
  const { data: link } = await supabase
    .from('client_users')
    .select('client_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!link?.client_id) { res.status(403).json({ error: 'Aucun client associé' }); return null }
  return { user, clientId: link.client_id }
}

async function getIntegration(clientId, provider) {
  const { data } = await supabase
    .from('client_integrations')
    .select('*')
    .eq('client_id', clientId)
    .eq('provider', provider)
    .eq('status', 'active')
    .maybeSingle()
  return data
}

// ─── Google Docs ──────────────────────────────────────────
async function listGoogleDocs(accessToken) {
  const res = await fetch(
    'https://www.googleapis.com/drive/v3/files?' + new URLSearchParams({
      q: "mimeType='application/vnd.google-apps.document' and trashed=false",
      fields: 'files(id,name,modifiedTime,webViewLink)',
      pageSize: '50',
      orderBy: 'modifiedTime desc',
    }),
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!res.ok) throw new Error(`Google Drive: ${res.status}`)
  const data = await res.json()
  return (data.files || []).map(f => ({
    id: f.id,
    title: f.name,
    url: f.webViewLink,
    modified: f.modifiedTime,
  }))
}

async function fetchGoogleDocContent(accessToken, docId) {
  const res = await fetch(`https://docs.googleapis.com/v1/documents/${docId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Google Docs: ${res.status}`)
  const doc = await res.json()
  // Flatten all textRuns into plain text
  const extractText = (elements) => {
    if (!elements) return ''
    return elements
      .map(el => {
        if (el.paragraph) {
          return (el.paragraph.elements || [])
            .map(e => e.textRun?.content || '')
            .join('')
        }
        return ''
      })
      .join('')
  }
  return {
    title: doc.title,
    content: extractText(doc.body?.content),
  }
}

// ─── Notion ────────────────────────────────────────────────
async function listNotionPages(accessToken) {
  const res = await fetch('https://api.notion.com/v1/search', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      filter: { property: 'object', value: 'page' },
      page_size: 50,
      sort: { direction: 'descending', timestamp: 'last_edited_time' },
    }),
  })
  if (!res.ok) throw new Error(`Notion: ${res.status}`)
  const data = await res.json()
  return (data.results || []).map(p => ({
    id: p.id,
    title: p.properties?.title?.title?.[0]?.plain_text
        || p.properties?.Name?.title?.[0]?.plain_text
        || 'Sans titre',
    url: p.url,
    modified: p.last_edited_time,
  }))
}

async function fetchNotionPageContent(accessToken, pageId) {
  // Fetch blocks
  const blocksRes = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children?page_size=100`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Notion-Version': '2022-06-28',
    },
  })
  if (!blocksRes.ok) throw new Error(`Notion blocks: ${blocksRes.status}`)
  const { results } = await blocksRes.json()

  const flatten = (blocks) => blocks.map(b => {
    const t = b.type
    const rich = b[t]?.rich_text
    if (rich) return rich.map(r => r.plain_text).join('')
    return ''
  }).filter(Boolean).join('\n\n')

  // Fetch page title
  const pageRes = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Notion-Version': '2022-06-28',
    },
  })
  const page = await pageRes.json()
  const title = page.properties?.title?.title?.[0]?.plain_text
             || page.properties?.Name?.title?.[0]?.plain_text
             || 'Sans titre'

  return { title, content: flatten(results || []) }
}

// ─── Main handler ──────────────────────────────────────────
export default async function handler(req, res) {
  const auth = await requireClient(req, res)
  if (!auth) return
  const { clientId } = auth

  const provider = req.query.provider || req.body?.provider
  const action = req.query.action || req.body?.action
  if (!['google_docs', 'notion'].includes(provider)) {
    return res.status(400).json({ error: 'provider invalide' })
  }

  const integration = await getIntegration(clientId, provider)
  if (!integration) return res.status(404).json({ error: `${provider} non connecté` })

  try {
    // LIST action
    if (action === 'list' && req.method === 'GET') {
      const docs = provider === 'google_docs'
        ? await listGoogleDocs(integration.access_token)
        : await listNotionPages(integration.access_token)
      return res.status(200).json({ documents: docs })
    }

    // IMPORT action
    if (action === 'import' && req.method === 'POST') {
      const { doc_ids } = req.body || {}
      if (!Array.isArray(doc_ids) || doc_ids.length === 0) {
        return res.status(400).json({ error: 'doc_ids requis' })
      }

      const imported = []
      const errors = []

      for (const docId of doc_ids.slice(0, 20)) { // cap at 20
        try {
          const { title, content } = provider === 'google_docs'
            ? await fetchGoogleDocContent(integration.access_token, docId)
            : await fetchNotionPageContent(integration.access_token, docId)

          if (!content || content.trim().length < 10) {
            errors.push({ docId, error: 'Contenu vide' })
            continue
          }

          // Upsert to avoid duplicates (unique on client_id+source+external_id)
          const { error: insertErr } = await supabase.from('client_knowledge_base').upsert({
            client_id: clientId,
            title: title?.slice(0, 200) || 'Sans titre',
            content: content.slice(0, 100000),
            source: provider,
            external_id: docId,
            category: provider === 'google_docs' ? 'Google Docs' : 'Notion',
            is_active: true,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'client_id,source,external_id' })
          if (insertErr) {
            errors.push({ docId, error: insertErr.message })
          } else {
            imported.push({ docId, title })
          }
        } catch (err) {
          errors.push({ docId, error: err.message })
        }
      }

      return res.status(200).json({ imported, errors, count: imported.length })
    }

    return res.status(400).json({ error: 'action invalide' })
  } catch (err) {
    console.error(`[knowledge-import/${provider}]`, err.message)
    return res.status(500).json({ error: err.message })
  }
}
