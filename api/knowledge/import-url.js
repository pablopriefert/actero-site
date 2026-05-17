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
 */
import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'

const TAVILY_API_KEY = process.env.TAVILY_API_KEY
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
    // 1. Extract clean, LLM-ready content via Tavily Extract
    let pageContent = ''

    if (TAVILY_API_KEY) {
      try {
        const tavilyRes = await fetch('https://api.tavily.com/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: TAVILY_API_KEY,
            urls: [url],
            extract_depth: 'advanced', // handles JS-rendered / protected pages
            format: 'markdown',
          }),
          signal: AbortSignal.timeout(20000),
        })
        if (tavilyRes.ok) {
          const tavilyData = await tavilyRes.json()
          const result = tavilyData?.results?.[0]
          if (result?.raw_content) {
            pageContent = String(result.raw_content).trim().substring(0, 12000)
          }
        } else {
          console.warn(`[knowledge/import-url] Tavily extract ${tavilyRes.status}`)
        }
      } catch (e) {
        console.warn('[knowledge/import-url] Tavily extract failed:', e?.message)
      }
    }

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

    // 2. Use Claude to extract FAQ pairs
    if (!ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })
    }

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: `Tu es un extracteur de contenu pour un agent de support client IA. A partir du contenu d'une page web, genere des entrees pour une base de connaissances.

Genere entre 5 et 15 entrees, melange de:
- FAQ (question/reponse) — categorie "faq"
- Politiques (livraison, retour, remboursement) — categorie "policy"
- Informations produit — categorie "product"

Reponds UNIQUEMENT en JSON valide:
[
  {"category": "faq|policy|product", "title": "titre ou question", "content": "contenu detaille de la reponse"}
]

Pas de markdown, pas de commentaires, juste le JSON.`,
        messages: [{ role: 'user', content: `Contenu de la page ${url}:\n\n${pageContent.substring(0, 9000)}` }],
      }),
    })

    if (!claudeRes.ok) throw new Error(`Claude ${claudeRes.status}`)
    const claudeData = await claudeRes.json()
    let rawText = claudeData?.content?.[0]?.text || '[]'

    // Clean Claude response — sometimes wraps JSON in ```json blocks
    rawText = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()

    // Try to extract JSON array from the response
    const jsonMatch = rawText.match(/\[[\s\S]*\]/)
    if (jsonMatch) rawText = jsonMatch[0]

    let entries
    try {
      entries = JSON.parse(rawText)
    } catch {
      // Last resort: try to fix common JSON issues
      try {
        entries = JSON.parse(rawText.replace(/,\s*]/g, ']').replace(/,\s*}/g, '}'))
      } catch {
        return res.status(500).json({ error: 'Erreur parsing des resultats. Essayez une autre URL.' })
      }
    }

    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ error: 'Aucune entree extraite de cette page' })
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
