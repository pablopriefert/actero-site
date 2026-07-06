/**
 * Shared LLM text helper — provider-agnostic single-shot chat for the
 * non-engine call sites (sentiment, prompt-injection, concierge, simulator,
 * vision, churn, KB extraction, reports…). Picks the provider from
 * LLM_PROVIDER and returns the raw assistant text + token usage.
 *
 * The engine has its own richer client (engine/lib/llm-client.js) that returns
 * a parsed, engine-shaped object with failover; this one is deliberately thin.
 *
 * Message content may be a plain string, or an array of blocks:
 *   { type: 'text', text }         → text
 *   { type: 'image', url }         → image (translated to each provider's shape)
 */
const PROVIDER = (process.env.LLM_PROVIDER || 'anthropic').toLowerCase()
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-5'
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5.4-mini'
const OPENAI_REASONING_EFFORT = process.env.OPENAI_REASONING_EFFORT || 'none'
// Cheap/fast tier for trivial classification (binary flags, injection checks)
// so we don't spend the full model on a one-word answer.
const CLAUDE_FAST_MODEL = process.env.CLAUDE_FAST_MODEL || 'claude-haiku-4-5'
const OPENAI_FAST_MODEL = process.env.OPENAI_FAST_MODEL || 'gpt-5.4-nano'

function toAnthropicContent(content) {
  if (typeof content === 'string') return content
  return content.map((b) =>
    b.type === 'image'
      ? { type: 'image', source: { type: 'url', url: b.url } }
      : { type: 'text', text: b.text })
}

function toOpenAIContent(content) {
  if (typeof content === 'string') return content
  return content.map((b) =>
    b.type === 'image'
      ? { type: 'image_url', image_url: { url: b.url } }
      : { type: 'text', text: b.text })
}

async function callAnthropic({ system, messages, maxTokens, model, signal }) {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY not configured')
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: model || CLAUDE_MODEL,
      max_tokens: maxTokens,
      ...(system ? { system } : {}),
      messages: messages.map((m) => ({ role: m.role, content: toAnthropicContent(m.content) })),
    }),
    signal,
  })
  if (!res.ok) {
    const e = await res.text().catch(() => '')
    throw new Error(`Anthropic ${res.status}: ${e.slice(0, 200)}`)
  }
  const data = await res.json()
  return {
    text: data?.content?.[0]?.text || '',
    usage: { tokensIn: data?.usage?.input_tokens || 0, tokensOut: data?.usage?.output_tokens || 0 },
    modelId: data?.model || model || CLAUDE_MODEL,
  }
}

async function callOpenAIChat({ system, messages, maxTokens, model, json, signal }) {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('OPENAI_API_KEY not configured')
  const full = [
    ...(system ? [{ role: 'system', content: system }] : []),
    ...messages.map((m) => ({ role: m.role, content: toOpenAIContent(m.content) })),
  ]
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: model || OPENAI_MODEL,
      messages: full,
      max_completion_tokens: maxTokens,
      reasoning_effort: OPENAI_REASONING_EFFORT,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
    }),
    signal,
  })
  if (!res.ok) {
    const e = await res.text().catch(() => '')
    throw new Error(`OpenAI ${res.status}: ${e.slice(0, 200)}`)
  }
  const data = await res.json()
  return {
    text: data?.choices?.[0]?.message?.content || '',
    usage: { tokensIn: data?.usage?.prompt_tokens || 0, tokensOut: data?.usage?.completion_tokens || 0 },
    modelId: data?.model || model || OPENAI_MODEL,
  }
}

/**
 * @returns {Promise<{ text: string, usage: {tokensIn:number, tokensOut:number}, modelId: string }>}
 */
export async function chatComplete({ system, messages, maxTokens = 512, json = false, model, tier, timeoutMs } = {}) {
  // Resolve the model: explicit `model` wins; else `tier: 'fast'` picks the
  // cheap classifier for the active provider; else the provider default.
  const resolvedModel = model || (tier === 'fast'
    ? (PROVIDER === 'openai' ? OPENAI_FAST_MODEL : CLAUDE_FAST_MODEL)
    : undefined)

  let signal
  let timer
  if (timeoutMs) {
    const controller = new AbortController()
    signal = controller.signal
    timer = setTimeout(() => controller.abort(), timeoutMs)
  }
  try {
    const fn = PROVIDER === 'openai' ? callOpenAIChat : callAnthropic
    return await fn({ system, messages, maxTokens, model: resolvedModel, json, signal })
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export { PROVIDER as LLM_PROVIDER }
