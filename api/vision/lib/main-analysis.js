// api/vision/lib/main-analysis.js
/**
 * Structured vision analysis (provider-agnostic via lib/llm.js).
 * Input:  { imageUrl, useCase, contextText? }
 * Output: { analysis, tokens_in, tokens_out, model_id, processing_ms }
 *
 * `analysis` is the JSON contract documented in use-cases.js. If the model
 * returns non-JSON or malformed JSON, we fall back to a request_more_info
 * envelope with low confidence so brain.js can escalate gracefully.
 */
import { buildPromptFor, defaultActionFor } from './use-cases.js'
import { chatComplete } from '../../lib/llm.js'

const TIMEOUT_MS = 15000   // 15s — vision calls are slower than text
const MAX_TOKENS = 600

function safeJson(raw) {
  try { return JSON.parse(raw) } catch { /* fallthrough */ }
  const m = raw.match(/\{[\s\S]*\}/)
  if (m) {
    try { return JSON.parse(m[0]) } catch { /* fallthrough */ }
  }
  return null
}

export async function analyzeImage({ imageUrl, useCase = 'other', contextText = '' }) {
  if (!imageUrl) throw new Error('imageUrl required')

  const startTime = Date.now()

  const { text: raw, usage, modelId } = await chatComplete({
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', url: imageUrl },
          { type: 'text', text: buildPromptFor(useCase, contextText) },
        ],
      },
    ],
    maxTokens: MAX_TOKENS,
    timeoutMs: TIMEOUT_MS,
  })

  const parsed = safeJson(raw)
  const analysis = parsed || {
    description: raw.slice(0, 240),
    detected_issue: null,
    extracted_data: {},
    recommended_action: defaultActionFor(useCase),
    confidence: 0.3,
  }

  return {
    analysis,
    tokens_in: usage.tokensIn,
    tokens_out: usage.tokensOut,
    model_id: modelId,
    processing_ms: Date.now() - startTime,
  }
}
