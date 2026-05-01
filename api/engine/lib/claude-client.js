/**
 * Actero Engine — Claude Client
 * Handles Claude API calls with timeout, retry, and structured JSON parsing.
 *
 * Side-effect: every call emits a `$ai_generation` event to PostHog (when
 * POSTHOG_PROJECT_API_KEY is set). This populates PostHog's LLM Analytics
 * dashboard automatically — cost per model, tokens by tenant, latency
 * percentiles — without any per-caller wiring. Callers can pass an
 * `analytics: { clientId, stage }` block to enrich the event; both are
 * optional and default to anonymous bucketing.
 */
import { captureClaudeGeneration } from '../../lib/posthog.js'
import { calculateCost } from './claude-pricing.js'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const MODEL = 'claude-sonnet-4-20250514'
const MAX_TOKENS = 512
const TIMEOUT_MS = 8000 // 8s to stay within Vercel's 10s limit

export async function callClaude({ systemPrompt, messages, maxTokens = MAX_TOKENS, analytics = {} }) {
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured')

  const startTime = Date.now()
  let lastError = null

  // 1 attempt + 1 retry
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: maxTokens,
          system: systemPrompt,
          messages,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeout)

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(`Claude API ${res.status}: ${errText}`)
      }

      const data = await res.json()
      const rawText = data?.content?.[0]?.text || ''
      const processingTimeMs = Date.now() - startTime

      // Capture usage + model so callers can track tokens/cost
      const usage = {
        tokensIn: data?.usage?.input_tokens || 0,
        tokensOut: data?.usage?.output_tokens || 0,
      }
      const modelId = data?.model || MODEL

      // Parse JSON response — handle markdown code blocks and other wrapping
      let parsed
      try {
        parsed = JSON.parse(rawText)
      } catch {
        // Try extracting JSON from markdown code blocks or surrounding text
        let jsonStr = rawText
        // Remove ```json ... ``` wrapper
        const codeBlockMatch = rawText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
        if (codeBlockMatch) {
          jsonStr = codeBlockMatch[1].trim()
        } else {
          // Try to find JSON object in the text
          const jsonMatch = rawText.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            jsonStr = jsonMatch[0]
          }
        }

        try {
          parsed = JSON.parse(jsonStr)
        } catch {
          // Final fallback: If Claude didn't return valid JSON, wrap it
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

      // Emit a fire-and-forget LLM analytics event so PostHog can render
      // cost / latency / token dashboards without per-call wiring.
      captureClaudeGeneration({
        clientId: analytics.clientId,
        model: modelId,
        inputTokens: usage.tokensIn,
        outputTokens: usage.tokensOut,
        costUsd: calculateCost(modelId, usage.tokensIn, usage.tokensOut),
        latencyMs: processingTimeMs,
        success: true,
        context: {
          stage: analytics.stage || null,
          attempt,
          source: analytics.source || 'engine',
        },
      })

      return {
        ...parsed,
        processingTimeMs,
        rawText,
        usage,
        modelId,
      }

    } catch (err) {
      lastError = err
      if (err.name === 'AbortError') {
        lastError = new Error('Claude API timeout (8s)')
      }
      // Wait 500ms before retry
      if (attempt === 0) await new Promise(r => setTimeout(r, 500))
    }
  }

  // All retries exhausted: still report to PostHog so the dashboard shows
  // error rate, then re-throw so callers handle the failure as before.
  captureClaudeGeneration({
    clientId: analytics.clientId,
    model: MODEL,
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
    latencyMs: Date.now() - startTime,
    success: false,
    error: lastError,
    context: {
      stage: analytics.stage || null,
      source: analytics.source || 'engine',
    },
  })

  throw lastError
}
