// api/vision/lib/sensitive-check.js
/**
 * Haiku 4.5 binary classifier that flags images containing sensitive documents
 * (ID card, passport, credit/debit card, driving licence). When flagged, the
 * caller MUST NOT persist the image nor send it through the main analysis —
 * instead escalate the ticket to a human.
 *
 * Input: { imageUrl } — signed public URL (5 min TTL is enough)
 * Output: { is_sensitive, tokens_in, tokens_out, model_id, processing_ms }
 */
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const MODEL = 'claude-haiku-4-5'
const TIMEOUT_MS = 6000

const PROMPT = `You classify whether a single image contains a SENSITIVE identity or payment document.

Return exactly one lowercase token — no punctuation, no explanation:
- "yes" if the image contains: national ID card, passport, residence permit, driving licence, credit/debit card (front OR back), cheque, social security card, or similar government/financial document.
- "no" otherwise (product photo, screenshot, receipt, shipping label, any other content).

Your answer is ONE WORD. Nothing else.`

export async function checkSensitive({ imageUrl }) {
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
        max_tokens: 4,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'url', url: imageUrl } },
              { type: 'text', text: PROMPT },
            ],
          },
        ],
      }),
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!res.ok) {
      const err = await res.text().catch(() => '')
      throw new Error(`Haiku ${res.status}: ${err.slice(0, 200)}`)
    }

    const data = await res.json()
    const raw = (data?.content?.[0]?.text || '').trim().toLowerCase()

    // Fail-safe: if we don't get a clear "no", assume sensitive
    const is_sensitive = raw === 'yes' || (raw !== 'no')

    return {
      is_sensitive,
      tokens_in: data?.usage?.input_tokens || 0,
      tokens_out: data?.usage?.output_tokens || 0,
      model_id: data?.model || MODEL,
      processing_ms: Date.now() - startTime,
    }
  } catch (err) {
    clearTimeout(timeout)
    if (err.name === 'AbortError') throw new Error('Haiku timeout (6s)')
    throw err
  }
}
