/**
 * Knowledge Base — URL Import via SerpAPI
 * Scrapes a URL's content and uses Claude to extract FAQ pairs.
 */
import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'

const SERPAPI_KEY = process.env.SERPAPI_KEY
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
    // 1. Scrape the URL via SerpAPI (Google cached version)
    let pageContent = ''

    if (SERPAPI_KEY) {
      // Use SerpAPI to get the page content via Google search
      const searchUrl = `https://serpapi.com/search.json?q=site:${encodeURIComponent(url)}&api_key=${SERPAPI_KEY}&hl=fr`
      const searchRes = await fetch(searchUrl)
      const searchData = await searchRes.json()

      // Extract snippets from organic results
      if (searchData.organic_results) {
        pageContent = searchData.organic_results
          .slice(0, 10)
          .map(r => `${r.title || ''}\n${r.snippet || ''}`)
          .join('\n\n')
      }

      // Also try to get the knowledge graph if available
      if (searchData.knowledge_graph?.description) {
        pageContent = searchData.knowledge_graph.description + '\n\n' + pageContent
      }
    }

    // Fallback: direct fetch if SerpAPI didn't return content
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
      } catch {} // Direct fetch failed, use what we have
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
        messages: [{ role: 'user', content: `Contenu de la page ${url}:\n\n${pageContent.substring(0, 6000)}` }],
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

    // 4. Sync brand context
    try {
      await fetch(`${req.headers.origin || 'https://actero.fr'}/api/sync-brand-context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id }),
      })
    } catch {} // Non-critical

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
