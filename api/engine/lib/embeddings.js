/**
 * Actero Engine V2 — Embeddings helper
 *
 * Wraps OpenAI text-embedding-3-small for RAG over customer memories.
 * Falls back to a deterministic mock embedding in dev/no-key scenarios
 * so storeMemory / retrieveMemories keep working without external calls.
 */
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

/**
 * Get embedding for a text. Uses OpenAI text-embedding-3-small if available,
 * otherwise falls back to a mock embedding (hash-based) for dev.
 */
export async function getEmbedding(text) {
  if (!text || typeof text !== 'string') {
    return mockEmbedding('')
  }

  if (!OPENAI_API_KEY) {
    // Fallback: mock embedding (for dev / if OpenAI not configured)
    return mockEmbedding(text)
  }

  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text.substring(0, 8000),
      }),
    })
    if (!res.ok) throw new Error(`Embeddings API ${res.status}`)
    const data = await res.json()
    return data.data[0].embedding
  } catch (err) {
    console.error('[embeddings] Error:', err.message)
    return mockEmbedding(text)
  }
}

function mockEmbedding(text) {
  // Simple hash-based 1536-dim vector (not great but works for dev)
  const vec = new Array(1536).fill(0)
  const hash = text.split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0)
  for (let i = 0; i < 1536; i++) {
    vec[i] = Math.sin(hash * (i + 1) * 0.01) * 0.1
  }
  return vec
}
