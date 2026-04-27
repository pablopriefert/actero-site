/**
 * Actero MCP Server — rebuilt on the official @modelcontextprotocol/sdk.
 *
 * Why a rebuild: the previous implementation hand-rolled the JSON-RPC layer
 * (custom protocolVersion negotiation, hand-set Mcp-Session-Id, etc.) and
 * Claude.ai's hosted Connector kept rejecting it for subtle spec mismatches
 * with no surfaced reason. The SDK ships a Streamable HTTP transport that's
 * tested against every Claude/ChatGPT MCP client out there — using it
 * eliminates the entire surface where we kept bumping into spec drift.
 *
 * Transport: Streamable HTTP, stateless (sessionIdGenerator: undefined).
 * One McpServer instance is created per HTTP request — Vercel functions
 * are short-lived anyway, no point holding state.
 *
 * Auth: Bearer token resolved against three stores in order — API keys,
 * widget keys, and Supabase JWT. Same logic as the previous handler so the
 * OAuth flow already issuing tokens (api/mcp/authorize + token) keeps
 * working unchanged.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

// ───── Auth: bearer → clientId ─────
async function resolveClientFromToken(authHeader) {
  if (!authHeader) return null
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return null

  // 1. API key
  try {
    const { data } = await supabase
      .from('client_api_keys')
      .select('client_id')
      .eq('key_value', token)
      .eq('is_active', true)
      .maybeSingle()
    if (data) return data.client_id
  } catch { /* fall through */ }

  // 2. Widget key
  try {
    const { data } = await supabase
      .from('client_settings')
      .select('client_id')
      .eq('widget_api_key', token)
      .maybeSingle()
    if (data) return data.client_id
  } catch { /* fall through */ }

  // 3. Supabase JWT
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (!error && user) {
      const { data: link } = await supabase
        .from('client_users')
        .select('client_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle()
      if (link) return link.client_id
    }
  } catch { /* fall through */ }

  return null
}

// ───── Tool implementations ─────
// Each tool returns an MCP `content` array. We use plain text JSON because
// Claude/ChatGPT both render it predictably and merchants can debug it.

async function toolSendMessage({ message, session_id }, clientId) {
  const sessionId = session_id || `mcp-${Date.now()}`
  const url = `${process.env.PUBLIC_API_URL || 'https://actero.fr'}/api/engine/webhooks/widget?api_key=${clientId}`
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, session_id: sessionId }),
  })
  const data = await r.json().catch(() => ({}))
  return { response: data.response || 'Pas de réponse', session_id: sessionId }
}

async function toolGetUsage(_args, clientId) {
  const period = new Date().toISOString().slice(0, 7)
  const [{ data: usage }, { data: client }] = await Promise.all([
    supabase.from('usage_counters').select('*').eq('client_id', clientId).eq('period', period).maybeSingle(),
    supabase.from('clients').select('plan, brand_name').eq('id', clientId).maybeSingle(),
  ])
  return {
    brand: client?.brand_name || null,
    plan: client?.plan || 'free',
    period,
    tickets_used: usage?.tickets_used || 0,
    voice_minutes_used: usage?.voice_minutes_used || 0,
  }
}

async function toolListEscalations({ limit }, clientId) {
  const { data } = await supabase
    .from('escalation_tickets')
    .select('id, customer_email, status, created_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(limit || 10)
  return { escalations: data || [], count: data?.length || 0 }
}

async function toolGetConversations({ limit }, clientId) {
  const { data } = await supabase
    .from('ai_conversations')
    .select('id, customer_email, customer_message, ai_response, status, created_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(limit || 10)
  return { conversations: data || [], count: data?.length || 0 }
}

// Wrap a tool implementation to fit the SDK's expected return shape
// ({ content: [...] }). We always return one text block with JSON so it
// reads cleanly in any MCP client.
function toolResponse(payload) {
  return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] }
}

function buildServer(clientId) {
  const server = new McpServer({ name: 'actero-mcp', version: '2.0.0' })

  server.registerTool('actero_send_message', {
    description: 'Send a customer message to the Actero AI agent and return the agent\'s reply. Use this to test responses, draft replies on behalf of a shopper, or simulate a conversation.',
    inputSchema: {
      message: z.string().min(1).describe('The customer message text. Required.'),
      session_id: z.string().optional().describe('Optional session id to continue an existing conversation. A new one is generated if omitted.'),
    },
  }, async (args) => toolResponse(await toolSendMessage(args, clientId)))

  server.registerTool('actero_get_usage', {
    description: 'Return the merchant\'s current-month usage counters: plan, tickets used, voice minutes used, brand name. Read-only.',
    inputSchema: {},
    annotations: { readOnlyHint: true },
  }, async () => toolResponse(await toolGetUsage({}, clientId)))

  server.registerTool('actero_list_escalations', {
    description: 'List the merchant\'s pending escalation tickets — conversations the AI handed off to a human. Read-only.',
    inputSchema: {
      limit: z.number().int().min(1).max(100).optional().describe('Max number of escalations to return (default 10, max 100).'),
    },
    annotations: { readOnlyHint: true },
  }, async (args) => toolResponse(await toolListEscalations(args, clientId)))

  server.registerTool('actero_get_conversations', {
    description: 'List the most recent AI conversations for the merchant — customer message, AI response, status, timestamp. Useful for audit, sampling responses, or building reports. Read-only.',
    inputSchema: {
      limit: z.number().int().min(1).max(100).optional().describe('Max number of conversations to return (default 10, max 100).'),
    },
    annotations: { readOnlyHint: true },
  }, async (args) => toolResponse(await toolGetConversations(args, clientId)))

  return server
}

// ───── Vercel handler ─────
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization, Mcp-Session-Id, MCP-Protocol-Version, Last-Event-ID')
  res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id')
  res.setHeader('Cache-Control', 'no-store')

  if (req.method === 'OPTIONS') return res.status(200).end()

  // Auth — return 401 with WWW-Authenticate so the client triggers OAuth.
  const clientId = await resolveClientFromToken(req.headers.authorization)
  if (!clientId) {
    const siteUrl = process.env.PUBLIC_API_URL || 'https://actero.fr'
    res.setHeader(
      'WWW-Authenticate',
      `Bearer realm="actero-mcp", resource_metadata="${siteUrl}/.well-known/oauth-protected-resource"`,
    )
    return res.status(401).json({ error: 'unauthorized' })
  }

  // Stateless Streamable HTTP — no sessions, one transport per request.
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
  const server = buildServer(clientId)

  res.on('close', () => { try { transport.close() } catch {} ; try { server.close() } catch {} })

  try {
    await server.connect(transport)
    await transport.handleRequest(req, res, req.body)
  } catch (err) {
    console.error('[mcp] handler error:', err?.message || err)
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal error' },
        id: null,
      })
    }
  }
}

// Allow up to 60s — same budget as the rest of the engine.
export const maxDuration = 60
