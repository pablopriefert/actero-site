/**
 * Knowledge Base — storefront auto-crawl.
 *
 * Fired (fire-and-forget) by the E2B job cron right after a `shopify_onboard`
 * job completes. The onboarding job seeds the KB from structured Shopify data;
 * this endpoint enriches it by crawling the merchant's public storefront
 * (FAQ, shipping, returns, CGV, contact, ...) with Tavily Map + Extract, then
 * Claude turns it into KB entries flagged `needs_review = true`.
 *
 * Server-to-server only. Idempotent via client_settings.kb_autocrawl_done +
 * (defensively) the cron's own kb_autocrawl_done check.
 *
 * Auth: Vercel Cron header OR Authorization: Bearer <CRON_SECRET>.
 */
import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'
import { tavilyMap, tavilyExtract, extractKbEntriesWithClaude } from '../lib/kb-extract.js'
import { notifyCrawlFailure } from '../lib/notify-onboarding.js'

export const maxDuration = 60

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

// SAV-relevant page keywords (FR + EN). Matched case-insensitively against
// the URL path so we only crawl support-useful pages, not the whole catalog.
const SAV_KEYWORDS = [
  'faq', 'aide', 'help', 'support',
  'livraison', 'shipping', 'delivery',
  'retour', 'return', 'remboursement', 'refund',
  'cgv', 'terms', 'conditions',
  'contact', 'a-propos', 'about',
  'garantie', 'warranty',
  'taille', 'size', 'guide',
  'paiement', 'payment',
]

function isAuthorised(req) {
  const cronHeader = req.headers['x-vercel-cron']
  if (cronHeader) return true
  const authHeader = req.headers.authorization || ''
  const token = authHeader.replace(/^Bearer\s+/, '')
  return token && token === process.env.CRON_SECRET
}

async function markDone(clientId) {
  try {
    await supabase
      .from('client_settings')
      .update({ kb_autocrawl_done: true })
      .eq('client_id', clientId)
  } catch (e) {
    console.warn('[knowledge/crawl-site] markDone failed:', e?.message)
  }
}

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!isAuthorised(req)) return res.status(401).json({ error: 'Unauthorised' })

  const { client_id } = req.body || {}
  if (!client_id) return res.status(400).json({ error: 'client_id requis' })

  let storefrontUrl = null

  try {
    // 1. Idempotency — skip if we've already crawled for this client.
    const { data: settings } = await supabase
      .from('client_settings')
      .select('kb_autocrawl_done')
      .eq('client_id', client_id)
      .maybeSingle()

    if (settings?.kb_autocrawl_done === true) {
      return res.status(200).json({ skipped: 'already_done' })
    }

    // 2. Resolve the storefront URL. No custom-storefront-domain column
    //    exists in the tracked schema, so we use the Shopify shop domain.
    const { data: conn } = await supabase
      .from('client_shopify_connections')
      .select('shop_domain')
      .eq('client_id', client_id)
      .maybeSingle()

    const shopDomain = conn?.shop_domain
    if (!shopDomain) {
      await markDone(client_id)
      return res.status(200).json({ skipped: 'no_storefront' })
    }
    storefrontUrl = /^https?:\/\//i.test(shopDomain)
      ? shopDomain
      : `https://${shopDomain}`

    // 3. Map the storefront -> filter to SAV-relevant pages -> cap at 10.
    const mapped = await tavilyMap(storefrontUrl, { limit: 60 })
    const filtered = Array.from(
      new Set(
        mapped.filter((u) => {
          const low = String(u).toLowerCase()
          return SAV_KEYWORDS.some((kw) => low.includes(kw))
        }),
      ),
    ).slice(0, 10)

    if (filtered.length === 0) {
      await markDone(client_id)
      return res.status(200).json({ skipped: 'no_sav_pages' })
    }

    // 4. Extract clean content from the filtered pages.
    const content = await tavilyExtract(filtered, { perResultCap: 6000, totalCap: 18000 })
    if (!content || content.trim().length < 100) {
      await markDone(client_id)
      return res.status(200).json({ skipped: 'no_content' })
    }

    // 5. Existing active titles -> Claude dedups against them.
    const { data: existing } = await supabase
      .from('client_knowledge_base')
      .select('title')
      .eq('client_id', client_id)
      .eq('is_active', true)
    const existingTitles = (existing || []).map((r) => r.title).filter(Boolean)

    const entries = await extractKbEntriesWithClaude({
      content,
      sourceLabel: storefrontUrl,
      existingTitles,
    })

    // 6. Continue sort_order after the current max for this client.
    const { data: maxRow } = await supabase
      .from('client_knowledge_base')
      .select('sort_order')
      .eq('client_id', client_id)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()
    const baseOrder = (maxRow?.sort_order ?? -1) + 1

    const toInsert = entries.map((entry, i) => ({
      client_id,
      category: entry.category || 'faq',
      title: entry.title,
      content: entry.content,
      sort_order: baseOrder + i,
      is_active: true,
      source: 'auto_crawl',
      needs_review: true,
    }))

    const { error: insertError } = await supabase
      .from('client_knowledge_base')
      .insert(toInsert)
    if (insertError) throw new Error(insertError.message)

    // 7. Always mark done so the cron never re-picks this client.
    await markDone(client_id)

    // 8. Best-effort brand-context sync (fire-and-forget, like import-url.js).
    try {
      await fetch(`${process.env.PUBLIC_API_URL || 'https://actero.fr'}/api/sync-brand-context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id }),
      })
    } catch { /* Non-critical */ }

    return res.status(200).json({ imported: toInsert.length, urls_crawled: filtered })
  } catch (err) {
    console.error('[knowledge/crawl-site] Error:', err)
    // Don't infinite-retry a broken site — mark done anyway.
    await markDone(client_id)
    notifyCrawlFailure({
      clientId: client_id,
      storefrontUrl,
      error: err?.message,
    }).catch(() => {})
    return res.status(500).json({ error: err.message })
  }
}

export default withSentry(handler)
