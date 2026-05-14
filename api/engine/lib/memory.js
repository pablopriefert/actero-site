/**
 * Actero Engine V2 — Customer Memory helper
 *
 * Persistent memory per end-customer (by email), stored with embeddings in
 * the customer_memories table. Powers Actero Memory RAG: we retrieve the
 * most relevant past interactions for a given query and inject them into
 * the system prompt so the agent feels like it "knows" the customer.
 */
import { getEmbedding } from './embeddings.js'

function isAnonymousEmail(email) {
  if (!email) return true
  if (typeof email !== 'string') return true
  return email.includes('@anonymous.actero.fr')
}

/**
 * Store a new memory for a customer.
 */
export async function storeMemory(supabase, { clientId, customerEmail, type, content, metadata = {} }) {
  if (!clientId || !customerEmail || isAnonymousEmail(customerEmail)) return null
  if (!content || typeof content !== 'string' || content.trim().length === 0) return null
  try {
    const embedding = await getEmbedding(content)
    const { data, error } = await supabase
      .from('customer_memories')
      .insert({
        client_id: clientId,
        customer_email: customerEmail,
        memory_type: type || 'conversation',
        content,
        embedding,
        metadata,
      })
      .select('id')
      .single()
    if (error) throw error
    return data
  } catch (err) {
    console.error('[memory] Store error:', err.message)
    return null
  }
}

/**
 * Retrieve relevant memories for a query using vector similarity.
 * Falls back to most-recent memories if the RPC fails.
 */
export async function retrieveMemories(supabase, { clientId, customerEmail, query, limit = 5 }) {
  if (!clientId || !customerEmail || isAnonymousEmail(customerEmail)) return []
  try {
    // First, try vector search via RPC
    const queryEmbedding = await getEmbedding(query || '')
    const { data, error } = await supabase.rpc('match_customer_memories', {
      p_client_id: clientId,
      p_customer_email: customerEmail,
      p_query_embedding: queryEmbedding,
      p_match_count: limit,
    })
    if (!error && data && data.length > 0) {
      // Best-effort: mark these memories as referenced (non-blocking)
      try {
        const ids = data.map(m => m.id).filter(Boolean)
        if (ids.length > 0) {
          await supabase
            .from('customer_memories')
            .update({ last_referenced_at: new Date().toISOString() })
            .in('id', ids)
        }
      } catch { /* non-blocking */ }
      return data
    }

    // Fallback: just return the most recent memories for this customer
    const { data: recent } = await supabase
      .from('customer_memories')
      .select('id, memory_type, content, metadata, created_at')
      .eq('client_id', clientId)
      .eq('customer_email', customerEmail)
      .order('created_at', { ascending: false })
      .limit(limit)
    return recent || []
  } catch (err) {
    console.error('[memory] Retrieve error:', err.message)
    return []
  }
}

/**
 * Build a memory context string to inject into the system prompt.
 */
export function buildMemoryContext(memories) {
  if (!memories || memories.length === 0) return ''
  const items = memories.map(m => `- [${m.memory_type}] ${m.content}`).join('\n')
  return `\n\nHISTORIQUE DE CE CLIENT:\n${items}\n\nUtilise ces informations pour personnaliser ta reponse. Si le client a deja passe une commande ou pose une question avant, fais-y reference naturellement.`
}
