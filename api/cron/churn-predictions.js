import { createClient } from '@supabase/supabase-js'
import { decryptToken } from '../lib/crypto.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Cron: Predict churn risk & CLV for each client's customers.
 *
 * Runs weekly (Sunday 6am UTC). For each active client:
 *   1. Fetch ai_conversations from the past 30 days with valid customer_email
 *   2. Group by email, aggregate signals (sentiment, complaints, refund tickets, contact frequency)
 *   3. Fetch Shopify order history (last order, total orders, total spent)
 *   4. Ask Claude to compute churn_risk / clv_estimate / signals / recommended actions
 *   5. Upsert into churn_predictions (one row per client + email)
 */
export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const cronSecret = process.env.CRON_SECRET
  const internalSecret = process.env.INTERNAL_API_SECRET
  const authHeader = req.headers.authorization || ''
  const internalHeader = req.headers['x-internal-secret']
  const authorized =
    (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
    (internalSecret && internalHeader === internalSecret)
  if (!authorized) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY missing' })
  }

  // Optional single-client mode for manual refresh
  const onlyClientId = req.query?.client_id || req.body?.client_id || null

  try {
    const query = supabase
      .from('clients')
      .select('id, brand_name')
    if (onlyClientId) query.eq('id', onlyClientId)

    const { data: clients, error: clientsErr } = await query
    if (clientsErr) throw clientsErr

    const results = []
    for (const client of clients || []) {
      try {
        const r = await processClient(client)
        results.push({ client_id: client.id, ...r })
      } catch (err) {
        console.error(`[cron/churn] Client ${client.id} failed:`, err.message)
        results.push({ client_id: client.id, error: err.message })
      }
    }

    return res.status(200).json({
      processed: results.length,
      results,
    })
  } catch (err) {
    console.error('[cron/churn] Fatal:', err)
    return res.status(500).json({ error: err.message })
  }
}

async function processClient(client) {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // 1. Conversations from the past month
  const { data: conversations, error: convErr } = await supabase
    .from('ai_conversations')
    .select('id, customer_email, customer_name, customer_message, ai_response, subject, ticket_type, escalation_reason, status, created_at, metadata')
    .eq('client_id', client.id)
    .gte('created_at', since)
    .not('customer_email', 'is', null)
    .order('created_at', { ascending: false })
    .limit(2000)

  if (convErr) throw convErr

  // 2. Group by normalized email
  const byEmail = new Map()
  for (const c of conversations || []) {
    const email = String(c.customer_email || '').trim().toLowerCase()
    if (!EMAIL_RE.test(email)) continue
    if (!byEmail.has(email)) {
      byEmail.set(email, {
        email,
        name: c.customer_name || null,
        items: [],
      })
    }
    const entry = byEmail.get(email)
    entry.items.push(c)
    if (!entry.name && c.customer_name) entry.name = c.customer_name
  }

  if (byEmail.size === 0) {
    return { analyzed: 0, reason: 'no_conversations' }
  }

  // 3. Sentiment history for this client (for sentiment scoring)
  const emails = Array.from(byEmail.keys())
  const { data: sentimentLogs } = await supabase
    .from('sentiment_logs')
    .select('customer_name, score, category, created_at')
    .eq('client_id', client.id)
    .gte('created_at', since)
    .limit(2000)

  const sentimentByName = new Map()
  for (const s of sentimentLogs || []) {
    const key = String(s.customer_name || '').trim().toLowerCase()
    if (!key) continue
    if (!sentimentByName.has(key)) sentimentByName.set(key, [])
    sentimentByName.get(key).push(s)
  }

  // 4. Shopify connection for order enrichment
  const { data: shopify } = await supabase
    .from('client_shopify_connections')
    .select('shop_domain, access_token')
    .eq('client_id', client.id)
    .maybeSingle()

  const shopifyAccessToken = decryptToken(shopify?.access_token)
  const hasShopify = !!(shopifyAccessToken && shopify?.shop_domain)
  if (hasShopify) shopify.access_token = shopifyAccessToken

  // 5. Process per customer
  let analyzed = 0
  let skipped = 0

  // Limit to top 100 most active customers to stay within budget
  const sortedEmails = Array.from(byEmail.values())
    .sort((a, b) => b.items.length - a.items.length)
    .slice(0, 100)

  for (const entry of sortedEmails) {
    try {
      const signals = computeSignals(entry.items, sentimentByName.get(String(entry.name || '').toLowerCase()))
      const shopifyData = hasShopify
        ? await fetchShopifyCustomer(shopify, entry.email)
        : null

      const prediction = await askClaude({
        brandName: client.brand_name,
        email: entry.email,
        customerName: entry.name,
        signals,
        shopifyData,
      })

      if (!prediction) { skipped++; continue }

      const upsertRow = {
        client_id: client.id,
        customer_email: entry.email,
        customer_name: entry.name,
        churn_risk: clampNum(prediction.churn_risk, 0, 100),
        churn_signals: Array.isArray(prediction.churn_signals) ? prediction.churn_signals : [],
        clv_estimate: isFinite(prediction.clv_estimate) ? Number(prediction.clv_estimate) : null,
        recommended_actions: Array.isArray(prediction.recommended_actions) ? prediction.recommended_actions : [],
        predicted_at: new Date().toISOString(),
        last_order_at: shopifyData?.last_order_at || null,
        total_orders: shopifyData?.total_orders || 0,
        total_spent: shopifyData?.total_spent || 0,
      }

      // Upsert by (client_id, customer_email) — delete + insert since we don't have a unique constraint
      await supabase
        .from('churn_predictions')
        .delete()
        .eq('client_id', client.id)
        .eq('customer_email', entry.email)
        .in('status', ['active', 'addressed'])

      const { error: insertErr } = await supabase
        .from('churn_predictions')
        .insert(upsertRow)

      if (insertErr) {
        console.error(`[cron/churn] Insert failed for ${entry.email}:`, insertErr.message)
        skipped++
        continue
      }

      analyzed++
    } catch (err) {
      console.error(`[cron/churn] Customer ${entry.email} failed:`, err.message)
      skipped++
    }
  }

  return { analyzed, skipped, total_candidates: sortedEmails.length }
}

function computeSignals(items, sentimentHistory) {
  const now = Date.now()
  const contactCount = items.length

  // Sentiment avg from sentiment_logs (if any) — fallback to heuristic on messages
  let sentimentAvg = null
  if (sentimentHistory && sentimentHistory.length > 0) {
    const sum = sentimentHistory.reduce((s, x) => s + (Number(x.score) || 5), 0)
    sentimentAvg = sum / sentimentHistory.length
  }

  // Count complaints (negative keywords) + refund/return tickets
  const negativeRe = /(\bdec[eu]v|\bscandal|\bhonte|inadmiss|arnaque|jamais|\bnul\b|remboursement|rembourse|retour|annul|retard|retarde|casse|defectueux|plainte|reclamation|colere|mecontent|furieux|deplorable)/i
  const refundRe = /(rembours|retour|refund|return|annul)/i

  let complaintsCount = 0
  let refundTicketCount = 0
  for (const it of items) {
    const text = `${it.customer_message || ''} ${it.subject || ''} ${it.escalation_reason || ''}`.toLowerCase()
    if (negativeRe.test(text)) complaintsCount++
    if (refundRe.test(text) || String(it.ticket_type || '').toLowerCase().includes('refund')) refundTicketCount++
  }

  // Contact frequency trend: compare first 15 days vs last 15 days
  const cutoff = now - 15 * 24 * 60 * 60 * 1000
  const recent = items.filter(i => new Date(i.created_at).getTime() >= cutoff).length
  const older = items.length - recent
  const frequencyDelta = older > 0 ? (recent - older) / older : (recent > 0 ? 1 : 0)

  // Days since last contact
  let lastContactAt = null
  if (items.length > 0) {
    lastContactAt = items
      .map(i => new Date(i.created_at).getTime())
      .reduce((a, b) => Math.max(a, b), 0)
  }
  const daysSinceLastContact = lastContactAt ? Math.round((now - lastContactAt) / (24 * 3600 * 1000)) : null

  // Extract short message samples
  const samples = items.slice(0, 5).map(i => ({
    at: i.created_at,
    subject: i.subject || null,
    message: String(i.customer_message || '').slice(0, 240),
    status: i.status,
  }))

  return {
    contactCount,
    sentimentAvg,
    complaintsCount,
    refundTicketCount,
    frequencyDelta,
    daysSinceLastContact,
    samples,
  }
}

async function fetchShopifyCustomer(shopify, email) {
  try {
    const baseUrl = `https://${shopify.shop_domain}/admin/api/2024-01`
    const headers = {
      'X-Shopify-Access-Token': shopify.access_token,
      'Content-Type': 'application/json',
    }
    const res = await fetch(`${baseUrl}/orders.json?email=${encodeURIComponent(email)}&status=any&limit=50`, { headers })
    if (!res.ok) return null
    const data = await res.json()
    const orders = data.orders || []
    if (orders.length === 0) {
      return { last_order_at: null, total_orders: 0, total_spent: 0 }
    }
    const total_orders = orders.length
    const total_spent = orders.reduce((s, o) => s + parseFloat(o.total_price || 0), 0)
    const last_order_at = orders
      .map(o => new Date(o.created_at).getTime())
      .reduce((a, b) => Math.max(a, b), 0)
    return {
      last_order_at: new Date(last_order_at).toISOString(),
      total_orders,
      total_spent: Number(total_spent.toFixed(2)),
      currency: orders[0]?.currency || 'EUR',
    }
  } catch (err) {
    console.error('[cron/churn] Shopify fetch failed:', err.message)
    return null
  }
}

async function askClaude({ brandName, email, customerName, signals, shopifyData }) {
  const system = `Tu es un analyste CRM expert pour une boutique e-commerce. A partir des signaux fournis, calcule le risque de churn et la valeur a vie estimee (CLV).

Tu dois repondre UNIQUEMENT en JSON strict avec EXACTEMENT cette structure:
{
  "churn_risk": nombre entre 0 et 100 (100 = tres probable de partir),
  "churn_signals": [liste de 2 a 5 raisons courtes en francais, max 12 mots par raison],
  "clv_estimate": nombre en euros (valeur a vie estimee restante),
  "recommended_actions": [
    { "type": "discount" | "personal_contact" | "apology" | "upsell" | "winback", "label": "action courte en francais", "priority": "high" | "medium" | "low" }
  ]
}

Regles de calcul:
- Sentiment bas (< 5/10) + reclamations = risque eleve
- Beaucoup de tickets remboursement/retour = risque eleve
- Frequence de contact en hausse (frequencyDelta > 0.5) = risque eleve
- Plus de 60 jours sans commande = risque tres eleve
- CLV = total_spent * (1 - churn_risk/100) * 2 (ordre de grandeur), ajuste selon la frequence
- Si pas de donnees Shopify, estime depuis la frequence et le contexte
- Toujours proposer au moins 2 actions concretes
- Pas d'emojis dans les textes`

  const userContent = JSON.stringify({
    brand: brandName,
    customer: { email, name: customerName },
    conversation_signals: {
      total_contacts_30d: signals.contactCount,
      sentiment_avg_on_10: signals.sentimentAvg,
      complaints_count: signals.complaintsCount,
      refund_or_return_tickets: signals.refundTicketCount,
      contact_frequency_delta: signals.frequencyDelta,
      days_since_last_contact: signals.daysSinceLastContact,
      recent_messages_samples: signals.samples,
    },
    shopify_data: shopifyData,
  }, null, 2)

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        system,
        messages: [{ role: 'user', content: userContent }],
      }),
    })
    if (!r.ok) {
      console.error('[cron/churn] Claude API error', r.status)
      return null
    }
    const data = await r.json()
    const text = data?.content?.[0]?.text || '{}'
    const jsonStart = text.indexOf('{')
    const jsonEnd = text.lastIndexOf('}')
    if (jsonStart === -1 || jsonEnd === -1) return null
    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1))
    return parsed
  } catch (err) {
    console.error('[cron/churn] Claude parse error:', err.message)
    return null
  }
}

function clampNum(n, min, max) {
  const x = Number(n)
  if (!isFinite(x)) return min
  return Math.max(min, Math.min(max, x))
}
