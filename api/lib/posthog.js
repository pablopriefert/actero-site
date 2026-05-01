/**
 * Actero — minimal PostHog server-side capture.
 *
 * Fire-and-forget by design: never throws, never blocks the caller. If the
 * project key is missing the function is a silent no-op so the engine
 * doesn't pay any cost when analytics are disabled in dev/test.
 *
 * Uses the public PostHog ingest endpoint directly — no SDK dependency,
 * no event batching (each call is a single HTTP fetch). For our cron and
 * webhook traffic the volume is well under any sane rate limit; if that
 * changes we can swap this for `posthog-node` without changing call sites.
 */

const PROJECT_KEY = process.env.POSTHOG_PROJECT_API_KEY || process.env.VITE_POSTHOG_KEY
const HOST = process.env.POSTHOG_HOST || 'https://eu.i.posthog.com'

const enabled = () => Boolean(PROJECT_KEY)

/**
 * Capture an event in PostHog. Always returns void; errors are swallowed.
 *
 * @param {string} event — event name (e.g. '$ai_generation')
 * @param {object} props — event properties (will be sent as-is)
 * @param {string} [distinctId] — usually the Actero client_id; falls back
 *                                 to a stable `engine-server` bucket
 */
export function captureEvent(event, props = {}, distinctId) {
  if (!enabled() || !event) return
  const body = {
    api_key: PROJECT_KEY,
    event,
    distinct_id: distinctId || 'engine-server',
    properties: { ...props, $lib: 'actero-engine', $lib_version: '1' },
    timestamp: new Date().toISOString(),
  }
  // Fire-and-forget: don't await, don't throw.
  fetch(`${HOST}/i/v0/e/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => { /* swallow */ })
}

/**
 * Capture a Claude generation in PostHog's LLM Analytics format.
 * Mirrors the property names PostHog's UI expects so the standard
 * dashboards (cost per model, latency, token volume) render automatically.
 */
export function captureClaudeGeneration({
  clientId,
  model,
  inputTokens,
  outputTokens,
  costUsd,
  latencyMs,
  success = true,
  error = null,
  context = {},
}) {
  if (!enabled()) return
  const props = {
    $ai_provider: 'anthropic',
    $ai_model: model || 'unknown',
    $ai_input_tokens: Number(inputTokens) || 0,
    $ai_output_tokens: Number(outputTokens) || 0,
    $ai_total_tokens: (Number(inputTokens) || 0) + (Number(outputTokens) || 0),
    $ai_total_cost_usd: Number(costUsd) || 0,
    // PostHog stores latency in seconds.
    $ai_latency: latencyMs ? latencyMs / 1000 : null,
    $ai_is_error: !success,
    $ai_http_status: success ? 200 : (error?.status || 500),
    ...context,
  }
  if (error) props.$ai_error = String(error?.message || error).slice(0, 500)
  captureEvent('$ai_generation', props, clientId)
}
