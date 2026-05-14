/**
 * POST /api/leads/audit-analyze
 *
 * Full prospect audit pipeline:
 *   1. Scrapes reviews via SerpAPI (reuses scrape-reviews logic)
 *   2. Sends reviews to Claude for support-quality analysis
 *   3. Saves structured audit to Supabase `prospect_audits`
 *   4. Returns the audit report
 *
 * Body: { store_name, store_url?, contact_email?, contact_name? }
 * Auth: admin only (uses SerpAPI + Anthropic credits)
 */

import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '../lib/admin-auth.js'
import { randomUUID } from 'crypto'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const SERPAPI_KEY = process.env.SERPAPI_KEY
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const TAVILY_API_KEY = process.env.TAVILY_API_KEY

// ── Trustpilot via Tavily (bypasses WAF that blocks direct fetch) ────

async function searchTrustpilotViaTavily(storeName) {
  if (!TAVILY_API_KEY) return { reviews: [], rating: 0, totalReviews: 0 }

  const queries = [
    `${storeName} avis clients`,
    `${storeName} avis négatifs problèmes`,
    `${storeName} livraison service client`,
  ]

  const allReviews = []
  let rating = 0
  let totalReviews = 0

  for (const query of queries) {
    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: TAVILY_API_KEY,
          query,
          search_depth: 'advanced',
          include_domains: ['trustpilot.com', 'trustpilot.fr'],
          max_results: 10,
        }),
      })
      if (!res.ok) continue
      const data = await res.json()

      for (const r of data.results || []) {
        // Extract rating + total review count from titles like "Horace Avis 769 - Trustpilot"
        const totalMatch = r.title?.match(/Avis\s+(\d{1,6})/i)
        if (totalMatch && !totalReviews) totalReviews = parseInt(totalMatch[1])

        const ratingMatch =
          r.content?.match(/note\s+de\s+(\d[.,]?\d?)\s+étoiles?/i) ||
          r.content?.match(/(\d[.,]\d)\s*\/\s*5/)
        if (ratingMatch && !rating) rating = parseFloat(ratingMatch[1].replace(',', '.'))

        if (r.content && r.content.length > 40) {
          allReviews.push({
            author: 'Trustpilot User',
            stars: 0, // unknown — Claude will infer sentiment from text
            date: '',
            text: r.content.trim(),
            source: 'trustpilot',
            url: r.url,
          })
        }
      }
    } catch (e) {
      console.warn('[audit] Tavily query failed:', e.message)
    }
  }

  return { reviews: allReviews, rating, totalReviews }
}

// ── Step 1: Scrape reviews (inlined from scrape-reviews.js) ──────────

async function scrapeReviews(storeName) {
  if (!SERPAPI_KEY && !TAVILY_API_KEY) {
    throw new Error('Neither SERPAPI_KEY nor TAVILY_API_KEY configured')
  }

  let reviews = []
  let averageRating = 0
  let totalReviews = 0
  const sources = new Set()

  // ── 0. Trustpilot via Tavily (primary source for e-commerce brands)
  if (TAVILY_API_KEY) {
    const tp = await searchTrustpilotViaTavily(storeName)
    if (tp.reviews.length) {
      reviews.push(...tp.reviews)
      sources.add('trustpilot')
    }
    if (tp.rating) averageRating = tp.rating
    if (tp.totalReviews) totalReviews = tp.totalReviews
  }

  if (!SERPAPI_KEY) {
    return dedupeAndReturn(reviews, averageRating, totalReviews, sources)
  }

  // ── A. Google general search (knowledge graph + Trustpilot snippet rating)
  const searchQuery = `${storeName} avis clients trustpilot`
  const searchUrl = `https://serpapi.com/search.json?q=${encodeURIComponent(searchQuery)}&hl=fr&gl=fr&api_key=${SERPAPI_KEY}`
  const searchRes = await fetch(searchUrl)
  const searchData = await searchRes.json()

  if (searchData.knowledge_graph?.reviews) {
    averageRating = searchData.knowledge_graph.reviews.rating || 0
    totalReviews = searchData.knowledge_graph.reviews.total || 0
  }

  // ── B. Google Maps reviews (no rating filter — Claude needs full distribution)
  try {
    const placeSearchUrl = `https://serpapi.com/search.json?engine=google_maps&q=${encodeURIComponent(storeName)}&hl=fr&api_key=${SERPAPI_KEY}`
    const placeRes = await fetch(placeSearchUrl)
    const placeData = await placeRes.json()

    const placeId =
      placeData.place_results?.place_id ||
      placeData.local_results?.[0]?.place_id

    if (placeId) {
      const reviewsUrl = `https://serpapi.com/search.json?engine=google_maps_reviews&place_id=${placeId}&hl=fr&sort_by=newestFirst&api_key=${SERPAPI_KEY}`
      const reviewsRes = await fetch(reviewsUrl)
      const reviewsData = await reviewsRes.json()

      if (reviewsData.reviews?.length) {
        const gReviews = reviewsData.reviews
          .slice(0, 30)
          .map(r => ({
            author: r.user?.name || 'Anonyme',
            stars: r.rating || 0,
            date: r.date || '',
            text: r.snippet || r.extracted_snippet?.original || '',
            source: 'google',
          }))
          .filter(r => r.text) // drop empty reviews
        reviews.push(...gReviews)
        if (gReviews.length) sources.add('google')
      }
      if (reviewsData.place_info?.rating) averageRating = reviewsData.place_info.rating
      if (reviewsData.place_info?.reviews) totalReviews = reviewsData.place_info.reviews
    }
  } catch (e) {
    console.warn('[audit] Google Maps reviews fetch failed:', e.message)
  }

  // ── C. Trustpilot — extract rating + snippets from organic search
  const trustpilotResult = searchData.organic_results?.find(r =>
    r.link?.includes('trustpilot.com') || r.link?.includes('trustpilot.fr'),
  )

  if (trustpilotResult) {
    // Rating from Trustpilot snippet (e.g., "Note 4,2 sur 5")
    if (trustpilotResult.snippet) {
      const ratingMatch = trustpilotResult.snippet.match(/(\d[.,]\d)\s*\/?\s*5|sur\s*5/i)
      const m = trustpilotResult.snippet.match(/(\d[.,]\d)/)
      if (m && !averageRating) averageRating = parseFloat(m[1].replace(',', '.'))
      if (ratingMatch) sources.add('trustpilot')
    }

    // Pull negative review snippets via targeted queries
    for (const query of [
      `${storeName} avis 1 étoile site:trustpilot.com`,
      `${storeName} avis 2 étoiles site:trustpilot.com`,
      `${storeName} problème site:trustpilot.com`,
    ]) {
      try {
        const tpUrl = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&hl=fr&gl=fr&num=10&api_key=${SERPAPI_KEY}`
        const tpRes = await fetch(tpUrl)
        const tpData = await tpRes.json()
        const hits = (tpData.organic_results || [])
          .filter(r => r.link?.includes('trustpilot') && r.snippet)
          .slice(0, 5)
          .map(r => ({
            author: r.title?.split(' a donné')?.[0] || 'Trustpilot User',
            stars: query.includes('1 étoile') ? 1 : query.includes('2 étoiles') ? 2 : 0,
            date: r.date || '',
            text: r.snippet,
            source: 'trustpilot',
          }))
        reviews.push(...hits)
        if (hits.length) sources.add('trustpilot')
      } catch (e) {
        console.warn('[audit] Trustpilot query failed:', e.message)
      }
    }
  }

  return dedupeAndReturn(reviews, averageRating, totalReviews, sources)
}

function dedupeAndReturn(reviews, averageRating, totalReviews, sources) {
  const seen = new Set()
  const deduped = reviews.filter(r => {
    const key = (r.text || '').slice(0, 80)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
  return {
    reviews: deduped,
    averageRating,
    totalReviews,
    source: sources.size ? [...sources].join('+') : 'none',
  }
}

// ── Step 2: Claude AI analysis ───────────────────────────────────────

async function analyzeWithClaude(storeName, reviews, averageRating, totalReviews) {
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured')

  const reviewTexts = reviews
    .map((r, i) => `[${i + 1}] ${r.stars}★ (${r.source}) — "${r.text}"`)
    .join('\n')

  const negCount = reviews.filter(r => r.stars > 0 && r.stars <= 3).length
  const posCount = reviews.filter(r => r.stars >= 4).length

  const systemPrompt = `Tu es un expert en expérience client e-commerce. Tu produis des audits RIGOUREUX basés sur des données réelles. INTERDIT d'inventer des chiffres. Chaque pourcentage doit être calculé sur les avis fournis. Si une catégorie n'est mentionnée par aucun avis, ne l'inclus PAS dans top_issues.

Réponds UNIQUEMENT en JSON valide, sans markdown, sans backticks.`

  const userMessage = `Analyse les avis de "${storeName}".

Données :
- Note moyenne : ${averageRating}/5
- Total avis publics : ${totalReviews}
- Avis analysés ici : ${reviews.length} (${negCount} négatifs 1-3★, ${posCount} positifs 4-5★)

Avis collectés :
${reviewTexts}

Génère un rapport d'audit structuré en JSON avec ce format exact :
{
  "support_score": <number 0-100>,
  "summary": "<2-3 phrases résumant l'état du support client>",
  "top_issues": [
    { "category": "<nom du problème>", "severity": "<critical|high|medium>", "percentage": <% des avis concernés>, "description": "<description courte>" }
  ],
  "recommendations": [
    { "title": "<titre de la recommandation>", "impact": "<high|medium>", "description": "<ce qu'Actero pourrait automatiser>" }
  ],
  "estimated_savings": {
    "hours_per_month": <number>,
    "tickets_automatable": <% des tickets qui pourraient être automatisés>,
    "response_time_improvement": "<ex: de 4h à 2min>"
  },
  "email_hook": "<1 phrase percutante personnalisée pour le cold email, basée sur les données réelles>"
}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Claude API ${res.status}: ${errText}`)
    }

    const data = await res.json()
    const rawText = data?.content?.[0]?.text || ''

    // Parse JSON from response (handle possible markdown fences)
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Claude returned non-JSON response')

    return JSON.parse(jsonMatch[0])
  } finally {
    clearTimeout(timeout)
  }
}

// ── Handler ──────────────────────────────────────────────────────────

async function handler(req, res) {
  const allowedOrigin = process.env.SITE_URL || 'https://actero.fr'
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin)
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const adminUser = await requireAdmin(req, res, supabase)
  if (!adminUser) return

  const { store_name, store_url, contact_email, contact_name } = req.body
  if (!store_name) return res.status(400).json({ error: 'store_name required' })

  try {
    // Step 1: Scrape reviews
    const scraped = await scrapeReviews(store_name)

    // Hard fail if no reviews — avoid generating fabricated insights.
    if (!scraped.reviews.length) {
      return res.status(422).json({
        error: `Aucun avis trouvé pour "${store_name}". Vérifie le nom (essaie le nom commercial complet) ou cette marque n'est pas indexée sur Google Maps / Trustpilot.`,
        scraped_meta: {
          source: scraped.source,
          average_rating: scraped.averageRating,
          total_reviews: scraped.totalReviews,
        },
      })
    }

    // Step 2: Claude analysis
    const analysis = await analyzeWithClaude(
      store_name,
      scraped.reviews,
      scraped.averageRating,
      scraped.totalReviews,
    )

    // Step 3: Generate unique token for public report link
    const reportToken = randomUUID().replace(/-/g, '').slice(0, 16)

    // Step 4: Save to Supabase
    const auditRow = {
      store_name,
      store_url: store_url || null,
      contact_email: contact_email || null,
      contact_name: contact_name || null,
      report_token: reportToken,
      average_rating: scraped.averageRating,
      total_reviews: scraped.totalReviews,
      negative_reviews_count: scraped.reviews.length,
      reviews_source: scraped.source,
      raw_reviews: scraped.reviews,
      analysis,
      support_score: analysis.support_score || 0,
      email_status: 'pending', // pending | sent | opened | replied
      created_at: new Date().toISOString(),
    }

    const { data: inserted, error: insertError } = await supabase
      .from('prospect_audits')
      .insert(auditRow)
      .select()
      .single()

    if (insertError) {
      console.error('prospect_audits insert error:', insertError)
      // Return audit even if DB save fails
      return res.status(200).json({
        ...auditRow,
        _db_error: insertError.message,
      })
    }

    return res.status(200).json(inserted)
  } catch (error) {
    console.error('Audit analyze error:', error)
    return res.status(500).json({ error: 'Erreur audit: ' + error.message })
  }
}

export default withSentry(handler)
