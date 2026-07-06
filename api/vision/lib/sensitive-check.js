// api/vision/lib/sensitive-check.js
/**
 * Binary classifier that flags images containing sensitive documents (ID card,
 * passport, credit/debit card, driving licence). When flagged, the caller MUST
 * NOT persist the image nor send it through the main analysis — instead
 * escalate the ticket to a human.
 *
 * Runs on the cheap/fast tier (haiku on Anthropic, nano on OpenAI) — it's a
 * one-word answer, no need for the full model.
 *
 * Input: { imageUrl } — signed public URL (5 min TTL is enough)
 * Output: { is_sensitive, tokens_in, tokens_out, model_id, processing_ms }
 */
import { chatComplete } from '../../lib/llm.js'

const TIMEOUT_MS = 6000

const PROMPT = `You classify whether a single image contains a SENSITIVE identity or payment document.

Return exactly one lowercase token — no punctuation, no explanation:
- "yes" if the image contains: national ID card, passport, residence permit, driving licence, credit/debit card (front OR back), cheque, social security card, or similar government/financial document.
- "no" otherwise (product photo, screenshot, receipt, shipping label, any other content).

Your answer is ONE WORD. Nothing else.`

export async function checkSensitive({ imageUrl }) {
  if (!imageUrl) throw new Error('imageUrl required')

  const startTime = Date.now()

  const { text, usage, modelId } = await chatComplete({
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', url: imageUrl },
          { type: 'text', text: PROMPT },
        ],
      },
    ],
    maxTokens: 4,
    tier: 'fast',
    timeoutMs: TIMEOUT_MS,
  })

  const raw = (text || '').trim().toLowerCase()
  // Fail-safe: if we don't get a clear "no", assume sensitive.
  const is_sensitive = raw === 'yes' || (raw !== 'no')

  return {
    is_sensitive,
    tokens_in: usage.tokensIn,
    tokens_out: usage.tokensOut,
    model_id: modelId,
    processing_ms: Date.now() - startTime,
  }
}
