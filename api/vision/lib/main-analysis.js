// api/vision/lib/main-analysis.js
/**
 * Sonnet 4.6 structured vision analysis.
 * Input:  { imageUrl, useCase, contextText? }
 * Output: { analysis, tokens_in, tokens_out, model_id, processing_ms }
 *
 * `analysis` is the JSON contract documented in use-cases.js. If Claude
 * returns non-JSON or malformed JSON, we fall back to a request_more_info
 * envelope with low confidence so brain.js can escalate gracefully.
 */
import { buildPromptFor, defaultActionFor } from './use-cases.js'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const MODEL = 'claude-sonnet-4-6'
const TIMEOUT_MS = 15000   // 15s — vision calls are slower than text
const MAX_TOKENS = 600

function safeJson(raw) {
  try { return JSON.parse(raw) } catch {}
  const m = raw.match(/\{[\s\S]*\}/)
  if (m) {
    try { return JSON.parse(m[0]) } catch {}
  }
  return null
}

export async function analyzeImage({ imageUrl, useCase = 'other', contextText = '' }) {
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured')
  if (!imageUrl) throw new Error('imageUrl required')

  const startTime = Date.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'url', url: imageUrl } },
              { type: 'text', text: buildPromptFor(useCase, contextText) },
            ],
          },
        ],
      }),
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!res.ok) {
      const err = await res.text().catch(() => '')
      throw new Error(`Sonnet ${res.status}: ${err.slice(0, 200)}`)
    }

    const data = await res.json()
    const raw = data?.content?.[0]?.text || ''
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
      tokens_in: data?.usage?.input_tokens || 0,
      tokens_out: data?.usage?.output_tokens || 0,
      model_id: data?.model || MODEL,
      processing_ms: Date.now() - startTime,
    }
  } catch (err) {
    clearTimeout(timeout)
    if (err.name === 'AbortError') throw new Error('Sonnet timeout (15s)')
    throw err
  }
}
