/**
 * Shared Knowledge-Base extraction helpers.
 *
 * Extracted from api/knowledge/import-url.js so the same Tavily + Claude
 * pipeline can be reused by the auto-crawl flow (api/knowledge/crawl-site.js).
 *
 * Tavily is purpose-built for URL -> clean, LLM-ready content (handles
 * JS-rendered + WAF-protected pages). Claude then turns that clean content
 * into structured KB entries.
 *
 * Env: TAVILY_API_KEY, ANTHROPIC_API_KEY
 */

const TAVILY_API_KEY = process.env.TAVILY_API_KEY
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

/**
 * Tavily Extract — turn one or more URLs into clean markdown text.
 *
 * Never throws: returns '' if no API key, the call fails, or nothing was
 * extracted. Each result is capped, and the concatenated total is capped at
 * `totalCap` (default ~12000 chars — matches the original single-URL behaviour).
 *
 * @param {string[]} urls
 * @param {{ timeoutMs?: number, perResultCap?: number, totalCap?: number }} opts
 * @returns {Promise<string>}
 */
export async function tavilyExtract(urls, { timeoutMs = 20000, perResultCap = 12000, totalCap = 12000 } = {}) {
  if (!TAVILY_API_KEY) return ''
  const list = (Array.isArray(urls) ? urls : [urls]).filter(Boolean)
  if (list.length === 0) return ''

  try {
    const res = await fetch('https://api.tavily.com/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        urls: list,
        extract_depth: 'advanced', // handles JS-rendered / protected pages
        format: 'markdown',
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) {
      console.warn(`[kb-extract] Tavily extract ${res.status}`)
      return ''
    }
    const data = await res.json()
    const results = Array.isArray(data?.results) ? data.results : []
    if (results.length === 0) return ''

    const parts = []
    for (const r of results) {
      const raw = r?.raw_content || r?.content
      if (!raw) continue
      const clean = String(raw).trim()
      if (clean.length < 1) continue
      const head = r?.url ? `## ${r.url}\n\n` : ''
      parts.push(head + clean.substring(0, perResultCap))
    }
    return parts.join('\n\n---\n\n').substring(0, totalCap).trim()
  } catch (e) {
    console.warn('[kb-extract] Tavily extract failed:', e?.message)
    return ''
  }
}

/**
 * Tavily Map — discover URLs reachable from a domain.
 *
 * Never throws: returns [] on any failure. Normalises the various response
 * shapes Tavily may return (data.results / data.links / array of strings or
 * objects) into a flat array of string URLs.
 *
 * @param {string} domainUrl
 * @param {{ limit?: number, timeoutMs?: number, maxDepth?: number }} opts
 * @returns {Promise<string[]>}
 */
export async function tavilyMap(domainUrl, { limit = 60, timeoutMs = 20000, maxDepth = 2 } = {}) {
  if (!TAVILY_API_KEY || !domainUrl) return []
  try {
    const res = await fetch('https://api.tavily.com/map', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        url: domainUrl,
        limit,
        max_depth: maxDepth,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) {
      console.warn(`[kb-extract] Tavily map ${res.status}`)
      return []
    }
    const data = await res.json()

    // Normalise: Tavily may return { results: [...] }, { links: [...] },
    // a bare array, or { data: { results: [...] } }. Items may be strings
    // or objects with a url/href field.
    let raw =
      (Array.isArray(data?.results) && data.results) ||
      (Array.isArray(data?.links) && data.links) ||
      (Array.isArray(data) && data) ||
      (Array.isArray(data?.data?.results) && data.data.results) ||
      (Array.isArray(data?.data) && data.data) ||
      []

    const urls = raw
      .map((item) => {
        if (typeof item === 'string') return item
        if (item && typeof item === 'object') return item.url || item.href || item.link || ''
        return ''
      })
      .filter((u) => typeof u === 'string' && /^https?:\/\//i.test(u))

    return Array.from(new Set(urls))
  } catch (e) {
    console.warn('[kb-extract] Tavily map failed:', e?.message)
    return []
  }
}

/**
 * Claude — turn clean page content into structured KB entries.
 *
 * Same model / prompt / parsing+repair logic as the original import-url.js.
 * When `existingTitles` is non-empty, an anti-duplication instruction is
 * appended to the system prompt so the crawl flow only adds *new* info.
 *
 * Throws on hard failure (no API key, Claude non-OK, unparseable response,
 * or empty/invalid array) — callers decide how to surface it.
 *
 * @param {{ content: string, sourceLabel: string, existingTitles?: string[] }} args
 * @returns {Promise<Array<{category:string,title:string,content:string}>>}
 */
export async function extractKbEntriesWithClaude({ content, sourceLabel, existingTitles = [] }) {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured')
  }

  let system = `Tu es un extracteur de contenu pour un agent de support client IA. A partir du contenu d'une page web, genere des entrees pour une base de connaissances.

Genere entre 5 et 15 entrees, melange de:
- FAQ (question/reponse) — categorie "faq"
- Politiques (livraison, retour, remboursement) — categorie "policy"
- Informations produit — categorie "product"

Reponds UNIQUEMENT en JSON valide:
[
  {"category": "faq|policy|product", "title": "titre ou question", "content": "contenu detaille de la reponse"}
]

Pas de markdown, pas de commentaires, juste le JSON.`

  if (Array.isArray(existingTitles) && existingTitles.length > 0) {
    const list = existingTitles.slice(0, 200).map((t) => `- ${t}`).join('\n')
    system += `\n\nVoici les titres déjà présents dans la base :\n${list}\nN'ajoute QUE des informations nouvelles. Ne duplique pas, ne reformule pas un doublon, ne contredis pas une entrée existante.`
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
      system,
      messages: [{ role: 'user', content: `Contenu de la page ${sourceLabel}:\n\n${String(content).substring(0, 9000)}` }],
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
      throw new Error('Erreur parsing des resultats')
    }
  }

  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('Aucune entree extraite')
  }

  return entries
}
