/**
 * Admin AI Terminal — Backend
 *
 * POST /api/admin/ai-terminal
 * Body: { message, history, action? }
 *
 * Calls Claude with full Actero context. Can execute read-only Supabase queries.
 */
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `Tu es l'assistant IA interne d'Actero, accessible uniquement par les admins.
Tu connais parfaitement l'architecture et les données d'Actero.

## Contexte Actero
- SaaS d'automatisation IA pour le support client e-commerce (Shopify, WooCommerce, Webflow)
- 4 plans: Free (0€, 50 tickets), Starter (99€, 1000 tickets), Pro (399€, 5000 tickets), Enterprise (sur devis)
- Stack: React + Vite (frontend), Vercel Serverless (backend), Supabase PostgreSQL (DB), Stripe (paiement)
- Engine IA: Gateway → Brain (Claude classification) → Executor (actions) → Logger

## Tables principales Supabase
- clients: id, brand_name, contact_email, plan, status, owner_user_id, shopify_url, created_at
- client_users: client_id, user_id, role (owner/member)
- client_settings: client_id, widget_api_key, hourly_cost, tone, guardrails
- usage_counters: client_id, period (YYYY-MM), tickets_used, voice_minutes_used
- automation_events: client_id, event_type, status, customer_email, ai_response, created_at
- metrics_daily: client_id, date, tickets_total, tickets_auto, avg_response_time_ms
- escalation_tickets: client_id, customer_email, subject, status, created_at
- referrals: referrer_client_id, referee_email, status, created_at
- engine_runs: client_id, event_id, playbook_id, status, classification, confidence, duration_ms
- engine_playbooks: id, name, display_name, is_active
- client_integrations: client_id, provider, status, auth_type

## Capacités
Tu peux :
1. Répondre à des questions sur Actero (architecture, features, plans, métriques)
2. Exécuter des requêtes Supabase READ-ONLY pour obtenir des données en temps réel
3. Analyser des métriques et donner des recommandations
4. Aider à diagnostiquer des problèmes techniques

Pour exécuter une requête, retourne un bloc JSON dans ta réponse :
\`\`\`sql-query
{"table": "clients", "select": "id, brand_name, plan, status", "filters": [{"column": "plan", "op": "eq", "value": "pro"}], "order": "created_at", "limit": 10}
\`\`\`

Filtres supportés: eq, neq, gt, gte, lt, lte, like, ilike
Tu ne peux PAS faire de INSERT, UPDATE, DELETE.

Réponds toujours en français. Sois concis et actionnable.`

// Whitelist of tables the AI terminal is allowed to read. Anything sensitive
// (passwords, API keys, OAuth tokens, admin session tokens, verification codes,
// auth schema) MUST be excluded.
const ALLOWED_TABLES = new Set([
  'clients',
  'client_users',
  'client_settings',
  'usage_counters',
  'automation_events',
  'metrics_daily',
  'escalation_tickets',
  'referrals',
  'referral_rewards',
  'engine_events',
  'engine_runs',
  'engine_runs_v2',
  'engine_messages',
  'engine_responses',
  'engine_playbooks',
  'engine_client_playbooks',
  'engine_reviews_v2',
  'client_integrations',
  'client_shopify_connections',
  'ai_conversations',
  'client_credits',
  'credit_transactions',
  'client_entitlements',
  'funnel_clients',
  'ambassadors',
  'ambassador_applications',
  'partner_applications',
  'partners',
  'partner_access_tokens',
  'marketplace_templates',
  'marketplace_installs',
  'startup_applications',
  'churn_predictions',
  'voice_calls',
  'voice_agent_config',
  'whatsapp_accounts',
  'sentiment_logs',
  'admin_action_logs',
  'admin_alert_rules',
  'admin_client_notes',
  'client_knowledge_base',
  'client_notification_preferences',
  'customer_memories',
  'error_reports',
])

// Execute a safe read-only query
async function executeQuery(queryDef) {
  try {
    if (!queryDef.table || !ALLOWED_TABLES.has(queryDef.table)) {
      return { error: `Table "${queryDef.table}" non autorisée (lecture interdite).` }
    }

    // Never allow '*' select when the table may contain sensitive cols. Force
    // explicit column list, and sanitize api_key / access_token / refresh_token
    // / code_hash / payload if accidentally requested.
    let selectExpr = queryDef.select || '*'
    if (typeof selectExpr === 'string') {
      const forbidden = /(access_token|refresh_token|api_key|code_hash|key_value|password|payload)/i
      if (forbidden.test(selectExpr)) {
        return { error: 'Colonnes sensibles interdites dans SELECT.' }
      }
    }

    let query = supabase.from(queryDef.table).select(selectExpr)

    if (queryDef.filters) {
      for (const f of queryDef.filters) {
        if (['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike'].includes(f.op)) {
          query = query[f.op](f.column, f.value)
        }
      }
    }

    if (queryDef.order) {
      query = query.order(queryDef.order, { ascending: queryDef.ascending ?? false })
    }

    query = query.limit(queryDef.limit || 20)

    const { data, error } = await query
    if (error) return { error: error.message }
    return { data, count: data?.length || 0 }
  } catch (err) {
    return { error: err.message }
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Auth — admin only
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Non autorisé' })

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Non autorisé' })

  // Check admin role
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') {
    return res.status(403).json({ error: 'Accès réservé aux administrateurs' })
  }

  const { message, history = [] } = req.body || {}
  if (!message) return res.status(400).json({ error: 'Message requis' })

  // Build messages for Claude
  const messages = [
    ...history.slice(-20).map(m => ({
      role: m.role,
      content: m.content,
    })),
    { role: 'user', content: message },
  ]

  try {
    // First call to Claude
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages,
    })

    let assistantText = response.content[0]?.text || ''

    // Check if Claude wants to execute a query
    const queryMatch = assistantText.match(/```sql-query\s*\n([\s\S]*?)\n```/)
    if (queryMatch) {
      try {
        const queryDef = JSON.parse(queryMatch[1])
        const result = await executeQuery(queryDef)

        // Remove the query block from the response
        const beforeQuery = assistantText.split('```sql-query')[0]

        // Second call to Claude with the query results
        const followUp = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          messages: [
            ...messages,
            { role: 'assistant', content: beforeQuery + `\n\n[Résultat de la requête sur "${queryDef.table}"]\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\`` },
            { role: 'user', content: 'Analyse ces résultats et donne-moi ta réponse complète.' },
          ],
        })

        assistantText = followUp.content[0]?.text || assistantText
        return res.status(200).json({
          response: assistantText,
          query_executed: { table: queryDef.table, result_count: result.count || 0 },
        })
      } catch (parseErr) {
        // Query parsing failed, return original response
        console.error('[ai-terminal] Query parse error:', parseErr.message)
      }
    }

    return res.status(200).json({ response: assistantText })
  } catch (err) {
    console.error('[ai-terminal] Claude error:', err.message)
    return res.status(500).json({ error: 'Erreur IA: ' + err.message })
  }
}
