/**
 * Knowledge Base — URL Import via Tavily Extract
 *
 * Tavily is purpose-built for this: URL -> clean, LLM-ready content
 * (handles JS-rendered + WAF-protected pages). Far better signal than the
 * old SerpAPI `site:` snippet scrape (which only returned Google search
 * snippets, not the actual page body). Claude then turns the clean content
 * into structured KB entries.
 *
 * Fallback: a best-effort raw fetch + HTML strip if Tavily is unavailable.
 *
 * The Tavily + Claude pipeline lives in ../lib/kb-extract.js and is shared
 * with the auto-crawl flow. This endpoint's request/response contract and
 * the rows it inserts are unchanged.
 */
import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'
import { tavilyExtract, extractKbEntriesWithClaude } from '../lib/kb-extract.js'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

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

  const { url, client_id } = req.body
  if (!url) return res.status(400).json({ error: 'url requis' })
  if (!client_id) return res.status(400).json({ error: 'client_id requis' })

  try {
    // 1. Extract clean, LLM-ready content via Tavily Extract (shared lib).
    //    tavilyExtract never throws — returns '' if unavailable / nothing.
    let pageContent = await tavilyExtract([url], { perResultCap: 12000, totalCap: 12000 })

    // Fallback: best-effort raw fetch if Tavily is unavailable / returned nothing
    if (!pageContent || pageContent.trim().length < 100) {
      try {
        const directRes = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ActeroBot/1.0)' },
          signal: AbortSignal.timeout(5000),
        })
        if (directRes.ok) {
          const html = await directRes.text()
          // Strip HTML tags to get text content
          pageContent = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
            .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
            .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 8000) // Limit to ~8k chars for Claude context
        }
      } catch { /* Direct fetch failed, use what we have */ }
    }

    if (!pageContent || pageContent.trim().length < 50) {
      return res.status(400).json({ error: 'Impossible d\'extraire du contenu de cette URL. Verifiez qu\'elle est accessible.' })
    }

    // 2. Use Claude to extract FAQ pairs (shared lib).
    if (!ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })
    }

    let entries
    try {
      // Single-URL path: no dedup (existingTitles: []) — preserves behaviour.
      entries = await extractKbEntriesWithClaude({
        content: pageContent,
        sourceLabel: url,
        existingTitles: [],
      })
    } catch (e) {
      if (e.message === 'Erreur parsing des resultats') {
        return res.status(500).json({ error: 'Erreur parsing des resultats. Essayez une autre URL.' })
      }
      if (e.message === 'Aucune entree extraite') {
        return res.status(400).json({ error: 'Aucune entree extraite de cette page' })
      }
      throw e
    }

    // 3. Insert entries into knowledge base
    const toInsert = entries.map((entry, i) => ({
      client_id,
      category: entry.category || 'faq',
      title: entry.title,
      content: entry.content,
      sort_order: i,
      is_active: true,
    }))

    const { error: insertError } = await supabase
      .from('client_knowledge_base')
      .insert(toInsert)

    if (insertError) throw new Error(insertError.message)

    // CIO — kb_first_entry_added (only on first KB entry ever for this client)
    // 4. Sync brand context
    try {
      await fetch(`${req.headers.origin || 'https://actero.fr'}/api/sync-brand-context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id }),
      })
    } catch { /* Non-critical */ }

    return res.status(200).json({
      imported: entries.length,
      entries: entries.map(e => ({ category: e.category, title: e.title })),
      source_url: url,
    })
  } catch (err) {
    console.error('[knowledge/import-url] Error:', err)
    return res.status(500).json({ error: err.message })
  }
}

export default withSentry(handler)
