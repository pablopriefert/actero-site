/**
 * Actero Engine — OpenAI Client
 *
 * Mirrors the contract of claude-client.js exactly (same args, same return
 * shape) so it's a drop-in provider behind llm-client.js. Handles the GPT-5
 * family's Chat Completions quirks:
 *   - `max_completion_tokens` (NOT `max_tokens`)
 *   - no `temperature` (reasoning models reject it)
 *   - `reasoning_effort` — defaults to 'none' so the engine stays within its
 *     ~8s budget and doesn't pay for hidden reasoning tokens. Override via
 *     OPENAI_REASONING_EFFORT for non-latency-sensitive call sites.
 *   - `response_format: json_object` for structured output (the engine parses
 *     JSON). The caller's system prompt already asks for JSON.
 *
 * Wrapped in a Braintrust span ("openai.call") — fail-soft, never blocks.
 */
import { trace } from './braintrust-init.js'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
// Exact API model id — env-overridable so a model deprecation is a Vercel env
// change, not a redeploy (same lesson as the claude-sonnet-4 outage).
const MODEL = process.env.OPENAI_MODEL || 'gpt-5.4-mini'
const REASONING_EFFORT = process.env.OPENAI_REASONING_EFFORT || 'none'
const MAX_TOKENS = 512
const TIMEOUT_MS = 8000

export async function callOpenAI({ systemPrompt, messages, maxTokens = MAX_TOKENS }) {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured')

  return trace(
    'openai.call',
    {
      input: { system: systemPrompt, messages },
      metadata: { model: MODEL, max_tokens: maxTokens, reasoning_effort: REASONING_EFFORT },
    },
    async (span) => _callOpenAIInner({ systemPrompt, messages, maxTokens }, span),
  )
}

async function _callOpenAIInner({ systemPrompt, messages, maxTokens }, span) {
  const startTime = Date.now()
  let lastError = null

  // OpenAI takes the system prompt as the first message (unlike Anthropic's
  // top-level `system`). Everything else is the same {role, content} shape.
  const fullMessages = [{ role: 'system', content: systemPrompt }, ...(messages || [])]

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: fullMessages,
          max_completion_tokens: maxTokens,
          reasoning_effort: REASONING_EFFORT,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      })

      clearTimeout(timeout)

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(`OpenAI API ${res.status}: ${errText}`)
      }

      const data = await res.json()
      const rawText = data?.choices?.[0]?.message?.content || ''
      const processingTimeMs = Date.now() - startTime

      const usage = {
        tokensIn: data?.usage?.prompt_tokens || 0,
        tokensOut: data?.usage?.completion_tokens || 0,
      }
      const modelId = data?.model || MODEL

      // Parse JSON — response_format should give clean JSON, but stay robust.
      let parsed
      try {
        parsed = JSON.parse(rawText)
      } catch {
        let jsonStr = rawText
        const codeBlockMatch = rawText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
        if (codeBlockMatch) {
          jsonStr = codeBlockMatch[1].trim()
        } else {
          const jsonMatch = rawText.match(/\{[\s\S]*\}/)
          if (jsonMatch) jsonStr = jsonMatch[0]
        }
        try {
          parsed = JSON.parse(jsonStr)
        } catch {
          parsed = {
            response: rawText.replace(/\*\*/g, '').replace(/\*/g, '').replace(/^#+\s/gm, '').trim(),
            confidence: 0.5,
            should_escalate: false,
            escalation_reason: null,
            detected_intent: 'general',
            sentiment_score: 5,
            injection_detected: false,
          }
        }
      }

      try {
        span?.log({
          output: rawText,
          metadata: {
            model_id: modelId,
            tokens_in: usage.tokensIn,
            tokens_out: usage.tokensOut,
            reasoning_tokens: data?.usage?.completion_tokens_details?.reasoning_tokens ?? null,
            processing_time_ms: processingTimeMs,
            attempt: attempt + 1,
            parsed_intent: parsed?.detected_intent,
            parsed_confidence: parsed?.confidence,
            should_escalate: parsed?.should_escalate,
          },
        })
      } catch { /* observability never blocks */ }

      return { ...parsed, processingTimeMs, rawText, usage, modelId }

    } catch (err) {
      lastError = err
      if (err.name === 'AbortError') {
        lastError = new Error('OpenAI API timeout (8s)')
      }
      if (attempt === 0) await new Promise(r => setTimeout(r, 500))
    }
  }

  try {
    span?.log({ output: null, metadata: { error: lastError?.message || 'unknown', failed: true } })
  } catch { /* observability never blocks */ }

  throw lastError
}
