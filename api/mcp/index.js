/**
 * Actero MCP Server — Main endpoint
 *
 * URL: /api/mcp
 * Transport: Streamable HTTP (MCP 2025-03-26)
 * Auth: Bearer token in Authorization header (obtained via OAuth flow)
 *
 * OAuth flow:
 * 1. Claude Desktop opens /api/mcp/authorize in the browser
 * 2. User logs in and clicks "Authorize"
 * 3. Actero redirects back with a code
 * 4. Claude exchanges the code for a token via /api/mcp/token
 * 5. Claude uses the token in Authorization header for all MCP requests
 */
import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Versions we know how to speak. We echo back the client's preferred
// version if it matches one of these; otherwise we fall back to our
// newest. Claude's hosted Connector currently asks for `2025-06-18`,
// so always returning the older `2025-03-26` (the previous behaviour
// here) made Claude treat us as an incompatible server and abort.
const SUPPORTED_PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26']
const PREFERRED_PROTOCOL_VERSION = '2025-06-18'

const SERVER_CAPABILITIES = { tools: {} }
const SERVER_METADATA = { name: 'actero-mcp', version: '1.0.0' }

const TOOLS = [
  {
    name: 'actero_send_message',
    description: 'Envoie un message au support IA Actero et retourne la reponse de l\'agent',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Le message du client' },
        session_id: { type: 'string', description: 'Identifiant de session (optionnel)' },
      },
      required: ['message'],
    },
  },
  {
    name: 'actero_get_usage',
    description: 'Retourne les statistiques de consommation du mois (tickets, plan, limites)',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'actero_list_escalations',
    description: 'Liste les escalades en attente de traitement humain',
    inputSchema: {
      type: 'object',
      properties: { limit: { type: 'number', description: 'Nombre max (defaut 10)' } },
    },
  },
  {
    name: 'actero_get_conversations',
    description: 'Retourne les dernieres conversations traitees par l\'agent IA',
    inputSchema: {
      type: 'object',
      properties: { limit: { type: 'number', description: 'Nombre max (defaut 10)' } },
    },
  },
]

// Resolve client from bearer token (API key or Supabase JWT)
async function resolveClientFromToken(authHeader) {
  if (!authHeader) return null
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) return null
  // Don't log token prefixes — that hands an attacker free reconnaissance via
  // Vercel logs.

  // Try as API key FIRST (faster, no auth call needed)
  try {
    const { data: keyRow } = await supabase
      .from('client_api_keys')
      .select('client_id')
      .eq('key_value', token)
      .eq('is_active', true)
      .maybeSingle()
    if (keyRow) {
      console.log('[mcp] Resolved via client_api_keys:', keyRow.client_id)
      return keyRow.client_id
    }
  } catch (e) {
    console.error('[mcp] client_api_keys lookup error:', e.message)
  }

  // Try as widget_api_key
  try {
    const { data: settings } = await supabase
      .from('client_settings')
      .select('client_id')
      .eq('widget_api_key', token)
      .maybeSingle()
    if (settings) {
      console.log('[mcp] Resolved via widget_api_key:', settings.client_id)
      return settings.client_id
    }
  } catch (e) {
    console.error('[mcp] widget_api_key lookup error:', e.message)
  }

  // Try as Supabase JWT last (most expensive call)
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (!error && user) {
      const { data: link } = await supabase
        .from('client_users')
        .select('client_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle()
      if (link) {
        console.log('[mcp] Resolved via JWT:', link.client_id)
        return link.client_id
      }
    }
  } catch (e) {
    console.error('[mcp] JWT getUser error:', e.message)
  }

  console.error('[mcp] Could not resolve client for token:', token.slice(0, 8))
  return null
}

async function executeTool(toolName, args, clientId) {
  switch (toolName) {
    case 'actero_send_message': {
      const sessionId = args.session_id || `mcp-${Date.now()}`
      try {
        const res = await fetch(`${process.env.PUBLIC_API_URL || 'https://actero.fr'}/api/engine/webhooks/widget?api_key=${clientId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: args.message, session_id: sessionId }),
        })
        const data = await res.json()
        return JSON.stringify({ response: data.response || 'Pas de reponse', session_id: sessionId })
      } catch (err) {
        return JSON.stringify({ error: err.message })
      }
    }
    case 'actero_get_usage': {
      const period = new Date().toISOString().slice(0, 7)
      const [{ data: usage }, { data: client }] = await Promise.all([
        supabase.from('usage_counters').select('*').eq('client_id', clientId).eq('period', period).maybeSingle(),
        supabase.from('clients').select('plan, brand_name').eq('id', clientId).maybeSingle(),
      ])
      return JSON.stringify({ brand: client?.brand_name, plan: client?.plan || 'free', period, tickets_used: usage?.tickets_used || 0, voice_minutes_used: usage?.voice_minutes_used || 0 })
    }
    case 'actero_list_escalations': {
      const { data } = await supabase.from('escalation_tickets').select('id, customer_email, subject, status, created_at').eq('client_id', clientId).order('created_at', { ascending: false }).limit(args.limit || 10)
      return JSON.stringify({ escalations: data || [], count: data?.length || 0 })
    }
    case 'actero_get_conversations': {
      const { data } = await supabase.from('ai_conversations').select('id, customer_email, customer_message, ai_response, status, created_at').eq('client_id', clientId).order('created_at', { ascending: false }).limit(args.limit || 10)
      return JSON.stringify({ conversations: data || [], count: data?.length || 0 })
    }
    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` })
  }
}

async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization, Mcp-Session-Id, MCP-Protocol-Version')
  res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id')

  res.setHeader('Cache-Control', 'no-store')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method === 'DELETE') return res.status(200).json({ ok: true })

  // Per spec: validate MCP-Protocol-Version on every request EXCEPT the
  // very first initialize (where the client doesn't know yet what to send).
  // If the header is present and unsupported → 400 Bad Request.
  const clientProtoHeader = req.headers['mcp-protocol-version']
  if (clientProtoHeader && !SUPPORTED_PROTOCOL_VERSIONS.includes(clientProtoHeader)) {
    return res.status(400).json({
      jsonrpc: '2.0', id: null,
      error: { code: -32600, message: `Unsupported MCP-Protocol-Version: ${clientProtoHeader}` },
    })
  }

  // Auth
  const clientId = await resolveClientFromToken(req.headers.authorization)
  if (!clientId) {
    const siteUrl = process.env.PUBLIC_API_URL || 'https://actero.fr'
    res.setHeader('WWW-Authenticate', `Bearer resource_metadata="${siteUrl}/.well-known/oauth-protected-resource"`)
    console.log('[mcp] 401 — no client resolved')
    return res.status(401).json({ error: 'Unauthorized. Use OAuth to connect.' })
  }
  console.log('[mcp] Authenticated client:', clientId)

  // GET — SSE stream
  if (req.method === 'GET') {
    const accept = req.headers.accept || ''
    if (!accept.includes('text/event-stream')) {
      return res.status(405).json({ error: 'GET requires Accept: text/event-stream' })
    }
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders?.()
    const ping = setInterval(() => { try { res.write(': ping\n\n') } catch { clearInterval(ping) } }, 25000)
    setTimeout(() => { clearInterval(ping); try { res.end() } catch {} }, 270000)
    req.on('close', () => clearInterval(ping))
    return
  }

  // POST — JSON-RPC
  if (req.method === 'POST') {
    let body
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    } catch {
      return res.status(400).json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } })
    }

    const { id, method, params } = body || {}

    // Notifications
    if (id === undefined || id === null) return res.status(202).end()

    if (method === 'initialize') {
      // Negotiate protocol version: if the client's preferred version is
      // one we support, echo it back; otherwise return our newest. Claude
      // checks this echo against what it asked for and aborts on mismatch.
      const clientPreferred = params?.protocolVersion
      const negotiated = SUPPORTED_PROTOCOL_VERSIONS.includes(clientPreferred)
        ? clientPreferred
        : PREFERRED_PROTOCOL_VERSION

      // Provide a session id so the client can correlate subsequent
      // requests. Spec says this is OPTIONAL but Claude's hosted Connector
      // expects it on initialize and routes follow-up traffic by it.
      const sessionId = req.headers['mcp-session-id'] || crypto.randomUUID()
      res.setHeader('Mcp-Session-Id', sessionId)

      return res.status(200).json({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: negotiated,
          capabilities: SERVER_CAPABILITIES,
          serverInfo: SERVER_METADATA,
        },
      })
    }
    if (method === 'ping') return res.status(200).json({ jsonrpc: '2.0', id, result: {} })
    if (method === 'tools/list') return res.status(200).json({ jsonrpc: '2.0', id, result: { tools: TOOLS } })
    if (method === 'resources/list') return res.status(200).json({ jsonrpc: '2.0', id, result: { resources: [] } })
    if (method === 'prompts/list') return res.status(200).json({ jsonrpc: '2.0', id, result: { prompts: [] } })

    if (method === 'tools/call') {
      const toolName = params?.name
      const toolArgs = params?.arguments || {}
      if (!toolName || !TOOLS.find(t => t.name === toolName)) {
        return res.status(200).json({ jsonrpc: '2.0', id, error: { code: -32602, message: `Unknown tool: ${toolName}` } })
      }
      try {
        const resultText = await executeTool(toolName, toolArgs, clientId)
        return res.status(200).json({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: resultText }] } })
      } catch (err) {
        return res.status(200).json({ jsonrpc: '2.0', id, error: { code: -32000, message: err.message } })
      }
    }

    return res.status(200).json({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

export default withSentry(handler)
