// Onboarding Concierge — AI assistant that guides new clients through setup.
// Separate from /api/client-copilot which is the data-Q&A copilot for active clients.
import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

const CONCIERGE_SYSTEM_PROMPT = `Tu es l'assistant IA d'Actero, une plateforme d'agents IA pour le support client e-commerce.

Tu aides les nouveaux clients qui decouvrent Actero a configurer leur compte et comprendre le produit.

TES CONNAISSANCES SUR ACTERO :
- Actero fournit un agent IA qui automatise le service client e-commerce (SAV, paniers abandonnes, comptabilite)
- L'agent se connecte a Shopify, WooCommerce, Webflow, Gorgias, Zendesk, WhatsApp (Pro+), Slack, Email (SMTP/IMAP), Resend
- Le client configure : son identite de marque, le ton de l'agent, les regles absolues, sa base de connaissances
- Le client peut tester son agent dans l'onglet "Tester"
- Les escalades apparaissent dans l'onglet "A traiter"
- Les templates de reponses sont dans l'onglet "Templates"
- Le ROI est calcule automatiquement dans l'onglet "ROI"

CHECKLIST DE SETUP :
1. Connecter Shopify (onglet Integrations)
2. Connecter l'email professionnel SMTP/IMAP
3. Personnaliser le ton de l'agent (onglet Mon Agent)
4. Configurer les parametres ROI (cout horaire, temps par ticket, abonnement)
5. Tester son agent (onglet Tester)
6. Activer le playbook SAV (onglet Automatisations)
7. Recevoir son 1er message client

ONGLETS DISPONIBLES (valeurs exactes pour suggested_action.tab) :
- "integrations"   -> Integrations (Shopify, email SMTP/IMAP, etc.)
- "agent-config"   -> Mon Agent (ton de marque, identite, regles)
- "roi"            -> Parametres ROI
- "simulator"      -> Tester l'agent
- "playbooks"      -> Automatisations / Playbooks
- "conversations"  -> Messages clients
- "escalations"    -> A traiter
- "templates"      -> Templates de reponses
- "knowledge"      -> Base de connaissances
- "profile"        -> Mon profil
- "overview"       -> Accueil

TON ROLE :
- Repondre aux questions avec des reponses courtes et claires (max 3-4 phrases)
- Proposer des actions concretes ("Cliquez sur Integrations pour connecter Shopify")
- Reconnaitre quand le client est bloque et proposer de contacter un humain
- Etre chaleureux mais efficace
- Jamais dire "je ne sais pas" sans proposer une alternative

IMPORTANT: Si le client demande de l'aide technique complexe, oriente-le vers le support : support@actero.fr

Tu DOIS repondre en JSON valide, sans texte autour, sans markdown code fence :
{
  "response": "ta reponse en francais",
  "suggested_action": { "label": "Aller a Integrations", "tab": "integrations" } ou null,
  "escalate_to_human": false
}`

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY missing' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' })

  const { message, history = [], client_id } = req.body || {}
  if (!message) return res.status(400).json({ error: 'message required' })

  // Verify the caller has access to the requested client (admin or member)
  if (client_id) {
    const isAdmin = user.app_metadata?.role === 'admin' || user.email?.endsWith('@actero.fr')
    if (!isAdmin) {
      const { data: link } = await supabase
        .from('client_users')
        .select('client_id')
        .eq('user_id', user.id)
        .eq('client_id', client_id)
        .maybeSingle()
      if (!link) return res.status(403).json({ error: 'Forbidden' })
    }
  }

  // Get client setup state for context
  let setupContext = ''
  if (client_id) {
    try {
      const [shopifyRes, smtpRes, settingsRes, playbooksRes] = await Promise.all([
        supabase.from('client_shopify_connections').select('id').eq('client_id', client_id).maybeSingle(),
        supabase.from('client_integrations').select('id').eq('client_id', client_id).eq('provider', 'smtp_imap').eq('status', 'active').maybeSingle(),
        supabase.from('client_settings').select('brand_tone, hourly_cost').eq('client_id', client_id).maybeSingle(),
        supabase.from('engine_client_playbooks').select('id').eq('client_id', client_id).eq('is_active', true),
      ])
      setupContext = `\n\nETAT ACTUEL DU CLIENT :
- Shopify : ${shopifyRes.data ? 'connecte' : 'NON connecte'}
- Email SMTP : ${smtpRes.data ? 'connecte' : 'NON connecte'}
- Ton de marque : ${settingsRes.data?.brand_tone ? 'configure' : 'NON configure'}
- Cout horaire : ${settingsRes.data?.hourly_cost ? 'defini' : 'NON defini'}
- Playbooks actifs : ${playbooksRes.data?.length || 0}`
    } catch (ctxErr) {
      console.error('[concierge] Setup context error:', ctxErr.message)
    }
  }

  try {
    const messages = []
    for (const h of history.slice(-10)) {
      if (h.role === 'user') {
        messages.push({ role: 'user', content: String(h.content || '') })
      } else if (h.role === 'assistant') {
        messages.push({ role: 'assistant', content: JSON.stringify({ response: String(h.content || '') }) })
      }
    }
    messages.push({ role: 'user', content: String(message) })

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        system: CONCIERGE_SYSTEM_PROMPT + setupContext,
        messages,
      }),
    })

    if (!claudeRes.ok) {
      const errText = await claudeRes.text().catch(() => '')
      throw new Error(`Claude API ${claudeRes.status}: ${errText.slice(0, 200)}`)
    }
    const data = await claudeRes.json()
    const rawText = data?.content?.[0]?.text || ''

    let parsed
    try {
      parsed = JSON.parse(rawText)
    } catch {
      const match = rawText.match(/\{[\s\S]*\}/)
      try {
        parsed = match ? JSON.parse(match[0]) : null
      } catch {
        parsed = null
      }
      if (!parsed) {
        parsed = { response: rawText || 'Desole, je rencontre un probleme. Reessayez dans un instant.', suggested_action: null, escalate_to_human: false }
      }
    }

    // Normalize
    if (typeof parsed.response !== 'string') parsed.response = String(parsed.response || '')
    if (parsed.suggested_action && (!parsed.suggested_action.label || !parsed.suggested_action.tab)) {
      parsed.suggested_action = null
    }
    if (typeof parsed.escalate_to_human !== 'boolean') parsed.escalate_to_human = false

    return res.status(200).json(parsed)
  } catch (err) {
    console.error('[concierge] Error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}

export default withSentry(handler)
