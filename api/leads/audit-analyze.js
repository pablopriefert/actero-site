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

// ── Step 1: Scrape reviews (inlined from scrape-reviews.js) ──────────

async function scrapeReviews(storeName) {
  if (!SERPAPI_KEY) throw new Error('SERPAPI_KEY not configured')

  const searchQuery = `${storeName} avis clients site:trustpilot.com OR site:google.com`
  const searchUrl = `https://serpapi.com/search.json?q=${encodeURIComponent(searchQuery)}&hl=fr&gl=fr&api_key=${SERPAPI_KEY}`

  const searchRes = await fetch(searchUrl)
  const searchData = await searchRes.json()

  let reviews = []
  let averageRating = 0
  let totalReviews = 0
  let source = 'google'

  // Knowledge graph
  if (searchData.knowledge_graph?.reviews) {
    averageRating = searchData.knowledge_graph.reviews.rating || 0
    totalReviews = searchData.knowledge_graph.reviews.total || 0
  }

  // Google Maps reviews
  const placeSearchUrl = `https://serpapi.com/search.json?engine=google_maps&q=${encodeURIComponent(storeName)}&hl=fr&api_key=${SERPAPI_KEY}`
  const placeRes = await fetch(placeSearchUrl)
  const placeData = await placeRes.json()

  if (placeData.place_results?.place_id) {
    const reviewsUrl = `https://serpapi.com/search.json?engine=google_maps_reviews&place_id=${placeData.place_results.place_id}&hl=fr&sort_by=newestFirst&api_key=${SERPAPI_KEY}`
    const reviewsRes = await fetch(reviewsUrl)
    const reviewsData = await reviewsRes.json()

    if (reviewsData.reviews) {
      reviews = reviewsData.reviews
        .filter(r => r.rating <= 3) // Include 1-3 star reviews for analysis
        .slice(0, 15)
        .map(r => ({
          author: r.user?.name || 'Anonyme',
          stars: r.rating || 1,
          date: r.date || '',
          text: r.snippet || r.extracted_snippet?.original || '',
          source: 'google',
        }))
      averageRating = reviewsData.place_info?.rating || averageRating
      totalReviews = reviewsData.place_info?.reviews || totalReviews
    }
  }

  // Trustpilot via organic results
  const trustpilotResult = searchData.organic_results?.find(r =>
    r.link?.includes('trustpilot.com') || r.link?.includes('trustpilot.fr'),
  )

  if (trustpilotResult) {
    const tpSearchUrl = `https://serpapi.com/search.json?q=${encodeURIComponent(storeName + ' avis 1 etoile site:trustpilot.com')}&hl=fr&gl=fr&num=10&api_key=${SERPAPI_KEY}`
    const tpRes = await fetch(tpSearchUrl)
    const tpData = await tpRes.json()

    if (tpData.organic_results) {
      const tpReviews = tpData.organic_results
        .filter(r => r.link?.includes('trustpilot'))
        .slice(0, 5)
        .map(r => ({
          author: 'Trustpilot User',
          stars: 1,
          date: r.date || '',
          text: r.snippet || '',
          source: 'trustpilot',
        }))
      reviews = [...reviews, ...tpReviews]
      source = 'trustpilot+google'
    }

    if (trustpilotResult.snippet) {
      const ratingMatch = trustpilotResult.snippet.match(/(\d[.,]\d)/)
      if (ratingMatch) {
        averageRating = parseFloat(ratingMatch[1].replace(',', '.'))
      }
    }
  }

  return { reviews, averageRating, totalReviews, source }
}

// ── Step 2: Claude AI analysis ───────────────────────────────────────

async function analyzeWithClaude(storeName, reviews, averageRating, totalReviews) {
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured')

  const reviewTexts = reviews
    .map((r, i) => `[${i + 1}] ${r.stars}★ — "${r.text}" (${r.source})`)
    .join('\n')

  const systemPrompt = `Tu es un expert en expérience client e-commerce. Tu analyses les avis négatifs d'une boutique pour identifier les problèmes de support client et proposer des solutions concrètes.

Réponds UNIQUEMENT en JSON valide, sans markdown, sans backticks.`

  const userMessage = `Analyse les avis négatifs de "${storeName}" (note moyenne: ${averageRating}/5, ${totalReviews} avis au total).

Voici ${reviews.length} avis négatifs récents :
${reviewTexts || '(Aucun avis négatif trouvé)'}

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
