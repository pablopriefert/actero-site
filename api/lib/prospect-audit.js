/**
 * Reusable core for the prospect-audit pipeline.
 *
 * Extracted from api/leads/audit-analyze.js and api/leads/audit-email.js so
 * that the single-prospect endpoints and the batch runner share one
 * implementation. Behavior of the single endpoints MUST stay identical.
 *
 * Exports:
 *   - searchTrustpilotViaTavily(storeName)
 *   - scrapeReviews(storeName)
 *   - dedupeAndReturn(reviews, averageRating, totalReviews, sources)
 *   - analyzeWithClaude(storeName, reviews, averageRating, totalReviews)
 *   - runAuditForProspect({ store_name, store_url, contact_email, contact_name, supabase })
 *   - buildAuditEmailHtml(audit, { unsubscribeUrl })
 *   - sendAuditEmail({ audit, supabase })
 */

import { randomUUID } from 'crypto'
import { Resend } from 'resend'

const SERPAPI_KEY = process.env.SERPAPI_KEY
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const TAVILY_API_KEY = process.env.TAVILY_API_KEY
const SITE_URL = process.env.SITE_URL || 'https://actero.fr'

const resend = new Resend(process.env.RESEND_API_KEY)

// ── Trustpilot via Tavily (bypasses WAF that blocks direct fetch) ────

export async function searchTrustpilotViaTavily(storeName) {
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

export async function scrapeReviews(storeName) {
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

export function dedupeAndReturn(reviews, averageRating, totalReviews, sources) {
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

export async function analyzeWithClaude(storeName, reviews, averageRating, totalReviews) {
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured')

  // Format each review for the prompt. If stars is 0 (e.g., Tavily snippets where the
  // rating wasn't extractable), display "?★" so Claude infers polarity from text.
  const reviewTexts = reviews
    .map((r, i) => `[${i + 1}] ${r.stars > 0 ? `${r.stars}★` : '?★'} (${r.source}) — "${r.text}"`)
    .join('\n')

  const negCount = reviews.filter(r => r.stars > 0 && r.stars <= 3).length
  const posCount = reviews.filter(r => r.stars >= 4).length
  const unknownCount = reviews.filter(r => !r.stars).length

  const systemPrompt = `Tu es un expert en expérience client e-commerce. Tu produis des audits RIGOUREUX basés sur des données réelles.

Règles ABSOLUES :
- INTERDIT d'inventer des chiffres. Chaque pourcentage doit refléter les avis effectivement présents dans l'échantillon.
- Si une catégorie de problème n'est mentionnée par AUCUN avis fourni, ne l'inclus PAS dans top_issues.
- Pour les avis sans note ("?★"), infère le sentiment uniquement depuis le texte (mots-clés négatifs : "déçu", "retard", "remboursement", "jamais reçu", "aucune réponse", etc. ; positifs : "merci", "top", "rapide", "satisfait").
- Si l'échantillon contient peu de signaux négatifs, le support_score doit refléter cette réalité (note >70 si majorité positive).
- email_hook doit citer un détail concret réellement présent dans les avis, jamais générique.

Réponds UNIQUEMENT en JSON valide, sans markdown, sans backticks.`

  const userMessage = `Analyse les avis de "${storeName}".

Données :
- Note moyenne publique : ${averageRating}/5
- Total avis publics : ${totalReviews}
- Avis analysés ici : ${reviews.length} (${negCount} négatifs 1-3★, ${posCount} positifs 4-5★, ${unknownCount} sans note explicite — infère depuis le texte)

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

// ── High-level: scrape → analyze → upsert prospect_audits row ────────
//
// Returns { audit, noReviews, scraped }.
//   - If no reviews were found: returns { audit: null, noReviews: true, scraped }.
//     Callers decide what to do (single endpoint → 422; batch → 'skipped').
//   - Otherwise upserts the row with pipeline_status='audited' and returns it.

export async function runAuditForProspect({
  store_name,
  store_url,
  contact_email,
  contact_name,
  supabase,
  existingId = null,
}) {
  // Step 1: Scrape reviews
  const scraped = await scrapeReviews(store_name)

  // Hard fail if no reviews — avoid generating fabricated insights.
  if (!scraped.reviews.length) {
    return { audit: null, noReviews: true, scraped }
  }

  // Step 2: Claude analysis
  const analysis = await analyzeWithClaude(
    store_name,
    scraped.reviews,
    scraped.averageRating,
    scraped.totalReviews,
  )

  // Step 3: Generate unique token for public report link (if absent)
  const reportToken = randomUUID().replace(/-/g, '').slice(0, 16)

  // Step 4: Upsert into Supabase
  const baseRow = {
    store_name,
    store_url: store_url || null,
    contact_email: contact_email || null,
    contact_name: contact_name || null,
    average_rating: scraped.averageRating,
    total_reviews: scraped.totalReviews,
    negative_reviews_count: scraped.reviews.length,
    reviews_source: scraped.source,
    raw_reviews: scraped.reviews,
    analysis,
    support_score: analysis.support_score || 0,
    pipeline_status: 'audited',
  }

  let audit
  if (existingId) {
    // Update an already-queued row (batch path). Keep its report_token.
    const { data, error } = await supabase
      .from('prospect_audits')
      .update(baseRow)
      .eq('id', existingId)
      .select()
      .single()
    if (error) throw new Error(`prospect_audits update failed: ${error.message}`)
    audit = data
  } else {
    // Fresh insert (single-endpoint path).
    const { data, error } = await supabase
      .from('prospect_audits')
      .insert({
        ...baseRow,
        report_token: reportToken,
        email_status: 'pending', // pending | sent | opened | replied
        created_at: new Date().toISOString(),
      })
      .select()
      .single()
    if (error) throw new Error(`prospect_audits insert failed: ${error.message}`)
    audit = data
  }

  return { audit, noReviews: false, scraped }
}

// ── Email HTML builder + sender ──────────────────────────────────────

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildAuditEmailHtml(audit, { unsubscribeUrl } = {}) {
  const { store_name, analysis, support_score, average_rating, total_reviews, report_token } = audit
  const safeName = escapeHtml(store_name)
  const reportLink = `${SITE_URL}/audit-report/${report_token}`
  const unsubUrl =
    unsubscribeUrl || `${SITE_URL}/api/leads/unsubscribe?token=${report_token}`

  const topIssues = (analysis?.top_issues || []).slice(0, 3)
  const savings = analysis?.estimated_savings || {}
  const hook = escapeHtml(analysis?.email_hook || '')

  const issueRows = topIssues
    .map(
      (issue) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#262626;">
          ${escapeHtml(issue.category)}
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center;">
          <span style="display:inline-block;padding:2px 10px;border-radius:99px;font-size:12px;font-weight:600;${
            issue.severity === 'critical'
              ? 'background:#fef2f2;color:#dc2626;'
              : issue.severity === 'high'
                ? 'background:#fffbeb;color:#d97706;'
                : 'background:#f0fdf4;color:#16a34a;'
          }">
            ${escapeHtml(issue.severity)}
          </span>
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:14px;color:#71717a;">
          ${issue.percentage || '—'}%
        </td>
      </tr>`,
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f8f8f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8f8f8;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="padding:32px 32px 0 32px;">
              <img src="${SITE_URL}/actero-logo.png" alt="Actero" width="100" style="margin-bottom:24px;" />
            </td>
          </tr>

          <!-- Score badge -->
          <tr>
            <td style="padding:0 32px;">
              <div style="background:#f9f7f1;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
                <div style="font-size:12px;font-weight:700;color:#71717a;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">
                  Score Support de ${safeName}
                </div>
                <div style="font-size:48px;font-weight:800;color:${support_score >= 70 ? '#16a34a' : support_score >= 40 ? '#d97706' : '#dc2626'};line-height:1;">
                  ${support_score}<span style="font-size:20px;color:#71717a;">/100</span>
                </div>
                <div style="font-size:13px;color:#71717a;margin-top:6px;">
                  Basé sur ${total_reviews} avis · Note moyenne ${average_rating}/5
                </div>
              </div>
            </td>
          </tr>

          <!-- Hook -->
          <tr>
            <td style="padding:0 32px 16px;">
              <p style="font-size:16px;line-height:1.6;color:#262626;margin:0;">
                ${hook}
              </p>
            </td>
          </tr>

          <!-- Issues table -->
          ${topIssues.length > 0 ? `
          <tr>
            <td style="padding:0 32px 24px;">
              <div style="font-size:12px;font-weight:700;color:#71717a;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">
                Problèmes identifiés
              </div>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #f0f0f0;border-radius:8px;border-collapse:collapse;">
                <thead>
                  <tr style="background:#fafafa;">
                    <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:#71717a;text-transform:uppercase;">Problème</th>
                    <th style="padding:8px 12px;text-align:center;font-size:11px;font-weight:700;color:#71717a;text-transform:uppercase;">Sévérité</th>
                    <th style="padding:8px 12px;text-align:right;font-size:11px;font-weight:700;color:#71717a;text-transform:uppercase;">% avis</th>
                  </tr>
                </thead>
                <tbody>
                  ${issueRows}
                </tbody>
              </table>
            </td>
          </tr>` : ''}

          <!-- Savings -->
          ${savings.hours_per_month ? `
          <tr>
            <td style="padding:0 32px 24px;">
              <div style="background:linear-gradient(135deg,#003725 0%,#005c3d 100%);border-radius:12px;padding:20px;color:white;">
                <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;opacity:0.7;margin-bottom:12px;">
                  Potentiel d'économie estimé
                </div>
                <div style="display:flex;gap:16px;">
                  <div style="flex:1;text-align:center;">
                    <div style="font-size:28px;font-weight:800;">${savings.hours_per_month}h</div>
                    <div style="font-size:11px;opacity:0.7;">gagnées/mois</div>
                  </div>
                  <div style="flex:1;text-align:center;">
                    <div style="font-size:28px;font-weight:800;">${savings.tickets_automatable}%</div>
                    <div style="font-size:11px;opacity:0.7;">automatisable</div>
                  </div>
                  <div style="flex:1;text-align:center;">
                    <div style="font-size:28px;font-weight:800;">${escapeHtml(savings.response_time_improvement || '')}</div>
                    <div style="font-size:11px;opacity:0.7;">temps réponse</div>
                  </div>
                </div>
              </div>
            </td>
          </tr>` : ''}

          <!-- CTA -->
          <tr>
            <td style="padding:0 32px 32px;">
              <a href="${reportLink}" style="display:block;text-align:center;background:#003725;color:white;padding:14px 24px;border-radius:12px;text-decoration:none;font-size:15px;font-weight:600;">
                Voir mon rapport complet →
              </a>
              <p style="text-align:center;font-size:12px;color:#71717a;margin:12px 0 0;">
                Ce rapport est privé et accessible uniquement via ce lien.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #f0f0f0;text-align:center;">
              <p style="font-size:12px;color:#71717a;margin:0;">
                Actero — Agent IA pour le support e-commerce<br />
                <a href="${SITE_URL}" style="color:#003725;">actero.fr</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
  <hr/>
  <p style="font-size:12px;color:#71717a;line-height:1.6">
    Vous recevez cet email car l'analyse publique des avis clients de ${safeName}
    indique un score de support client faible. Actero propose un agent IA de
    support e-commerce.<br/>
    <strong>Actero</strong> — [Actero — adresse légale à compléter]<br/>
    <a href="${unsubUrl}" style="color:#71717a">Se désinscrire</a> · cet email
    est un message professionnel à but informatif.
  </p>
</body>
</html>`
}

// Defense-in-depth: returns true if this email opted out of cold email.
async function isEmailSuppressed(supabase, email) {
  if (!email) return false
  const { data } = await supabase
    .from('email_suppressions')
    .select('email')
    .eq('email', email.toLowerCase())
    .maybeSingle()
  return !!data
}

export async function sendAuditEmail({ audit, supabase }) {
  if (!audit?.contact_email) {
    return { skipped: true, reason: 'no contact_email' }
  }

  // Defense in depth: never email a suppressed recipient even if a caller
  // forgot to check.
  if (await isEmailSuppressed(supabase, audit.contact_email)) {
    return { skipped: true, reason: 'suppressed' }
  }

  const unsubscribeUrl = `${SITE_URL}/api/leads/unsubscribe?token=${audit.report_token}`
  const emailHtml = buildAuditEmailHtml(audit, { unsubscribeUrl })
  const subject = `${audit.store_name} : votre score support est ${audit.support_score}/100`

  const { data: emailResult, error: emailError } = await resend.emails.send({
    from: 'Pablo d\'Actero <pablo@actero.fr>',
    to: audit.contact_email,
    subject,
    html: emailHtml,
    reply_to: 'pablo@actero.fr',
    tags: [
      { name: 'type', value: 'prospect-audit' },
      { name: 'store', value: audit.store_name.slice(0, 50) },
    ],
  })

  if (emailError) {
    throw new Error('Email send failed: ' + emailError.message)
  }

  await supabase
    .from('prospect_audits')
    .update({
      email_status: 'sent',
      email_sent_at: new Date().toISOString(),
      resend_email_id: emailResult?.id || null,
    })
    .eq('id', audit.id)

  return { skipped: false, email_id: emailResult?.id, sent_to: audit.contact_email }
}
