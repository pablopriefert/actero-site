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
const NOTION_VERSION = '2022-06-28'

function notionHeaders(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json',
  }
}

function extractPageTitle(page) {
  if (!page?.properties) return 'Sans titre'
  // Check all title-typed properties (handles "Name", "Title", "Nom" etc.)
  for (const prop of Object.values(page.properties)) {
    if (prop?.type === 'title' && Array.isArray(prop.title) && prop.title.length > 0) {
      return prop.title.map(t => t.plain_text).join('') || 'Sans titre'
    }
  }
  // Fallback: page.title for some endpoints
  if (Array.isArray(page.title) && page.title.length > 0) {
    return page.title.map(t => t.plain_text).join('')
  }
  return 'Sans titre'
}

async function listNotionPages(accessToken) {
  // Use POST /search to list ALL pages (and databases) the integration has access to
  // Notion only returns items explicitly shared with the integration
  const all = []
  let cursor = undefined
  // Cap at 200 pages to avoid runaway
  for (let i = 0; i < 4; i++) {
    const body = {
      filter: { property: 'object', value: 'page' },
      page_size: 50,
      sort: { direction: 'descending', timestamp: 'last_edited_time' },
    }
    if (cursor) body.start_cursor = cursor

    const res = await fetch('https://api.notion.com/v1/search', {
      method: 'POST',
      headers: notionHeaders(accessToken),
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      throw new Error(`Notion search ${res.status}: ${errBody.slice(0, 200)}`)
    }
    const data = await res.json()
    for (const p of data.results || []) {
      all.push({
        id: p.id,
        title: extractPageTitle(p),
        url: p.url,
        modified: p.last_edited_time,
      })
    }
    if (!data.has_more || !data.next_cursor) break
    cursor = data.next_cursor
  }
  return all
}

// Recursively fetch all child blocks (Notion paginates at 100 blocks per call)
async function fetchAllBlocks(accessToken, parentId, depth = 0) {
  if (depth > 3) return [] // Safety: limit nesting

  const out = []
  let cursor = undefined
  for (let i = 0; i < 10; i++) { // up to 1000 blocks per parent
    const url = new URL(`https://api.notion.com/v1/blocks/${parentId}/children`)
    url.searchParams.set('page_size', '100')
    if (cursor) url.searchParams.set('start_cursor', cursor)

    const res = await fetch(url.toString(), { headers: notionHeaders(accessToken) })
    if (!res.ok) {
      // Don't throw — just skip blocks we can't access
      console.warn(`[notion] blocks ${parentId}: ${res.status}`)
      break
    }
    const data = await res.json()
    out.push(...(data.results || []))
    if (!data.has_more) break
    cursor = data.next_cursor
  }
  return out
}

function blockToText(block) {
  const t = block?.type
  if (!t) return ''
  const node = block[t]
  if (!node) return ''

  const richToText = (rich) => Array.isArray(rich) ? rich.map(r => r.plain_text || '').join('') : ''

  switch (t) {
    case 'paragraph':
    case 'quote':
    case 'callout':
      return richToText(node.rich_text)
    case 'heading_1':
      return '# ' + richToText(node.rich_text)
    case 'heading_2':
      return '## ' + richToText(node.rich_text)
    case 'heading_3':
      return '### ' + richToText(node.rich_text)
    case 'bulleted_list_item':
      return '- ' + richToText(node.rich_text)
    case 'numbered_list_item':
      return '1. ' + richToText(node.rich_text)
    case 'to_do':
      return (node.checked ? '[x] ' : '[ ] ') + richToText(node.rich_text)
    case 'toggle':
      return richToText(node.rich_text)
    case 'code':
      return '```' + (node.language || '') + '\n' + richToText(node.rich_text) + '\n```'
    case 'divider':
      return '---'
    case 'child_page':
      return `[Sous-page: ${node.title || ''}]`
    case 'child_database':
      return `[Base de données: ${node.title || ''}]`
    case 'bookmark':
    case 'embed':
    case 'link_preview':
      return node.url || ''
    default:
      // Fallback for any block with rich_text
      if (node.rich_text) return richToText(node.rich_text)
      return ''
  }
}

async function fetchNotionPageContent(accessToken, pageId) {
  // Fetch the page itself for the title
  const pageRes = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    headers: notionHeaders(accessToken),
  })
  if (!pageRes.ok) {
    const errBody = await pageRes.text().catch(() => '')
    throw new Error(`Notion page ${pageRes.status}: ${errBody.slice(0, 200)}`)
  }
  const page = await pageRes.json()
  const title = extractPageTitle(page)

  // Fetch all blocks recursively
  const allLines = []
  const collect = async (parentId, depth = 0) => {
    const blocks = await fetchAllBlocks(accessToken, parentId, depth)
    for (const block of blocks) {
      const text = blockToText(block)
      if (text) allLines.push(text)
      if (block.has_children && depth < 3) {
        await collect(block.id, depth + 1)
      }
    }
  }
  await collect(pageId, 0)

  return { title, content: allLines.join('\n\n') }
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
          // category must be one of: policy, faq, product, tone, temporary (CHECK constraint)
          const { error: insertErr } = await supabase.from('client_knowledge_base').upsert({
            client_id: clientId,
            title: title?.slice(0, 200) || 'Sans titre',
            content: content.slice(0, 100000),
            source: provider,
            external_id: docId,
            category: 'faq', // imported docs go to FAQ category by default
            is_active: true,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'client_id,source,external_id' })
          if (insertErr) {
            console.error(`[knowledge-import] insert failed for ${docId}:`, insertErr.message)
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
