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
const PROVIDER = (process.env.LLM_PROVIDER || 'openrouter').toLowerCase()
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-5'
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5.4-mini'
const OPENAI_REASONING_EFFORT = process.env.OPENAI_REASONING_EFFORT || 'none'
// Cheap/fast tier for trivial classification (binary flags, injection checks)
// so we don't spend the full model on a one-word answer.
const CLAUDE_FAST_MODEL = process.env.CLAUDE_FAST_MODEL || 'claude-haiku-4-5'
const OPENAI_FAST_MODEL = process.env.OPENAI_FAST_MODEL || 'gpt-5.4-nano'

// OpenRouter — OpenAI-compatible gateway and our default provider. Model ids
// are namespaced (`vendor/model`). Main tier is Sonnet 5: $2/$10 per 1M on
// OpenRouter, i.e. cheaper than Sonnet 4.5 for the same tier.
//
// Le tier rapide est Haiku 4.5 ($1/$5) et non un classifieur d'un autre
// fournisseur : un seul éditeur pour tout le produit, donc un seul jeu de
// garanties sur les données et une facturation lisible. Il ne sert qu'aux
// réponses courtes et mécaniques (drapeaux binaires, détection d'injection,
// sentiment) — jamais à ce qu'un client lit.
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-5'
const OPENROUTER_FAST_MODEL = process.env.OPENROUTER_FAST_MODEL || 'anthropic/claude-haiku-4-5'

const OPENAI_CFG = {
  endpoint: 'https://api.openai.com/v1/chat/completions',
  getKey: () => process.env.OPENAI_API_KEY,
  keyName: 'OPENAI_API_KEY',
  defaultModel: OPENAI_MODEL,
  extraHeaders: {},
}
const OPENROUTER_CFG = {
  endpoint: 'https://openrouter.ai/api/v1/chat/completions',
  getKey: () => process.env.OPENROUTER_API_KEY,
  keyName: 'OPENROUTER_API_KEY',
  defaultModel: OPENROUTER_MODEL,
  extraHeaders: {
    'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://actero.fr',
    'X-Title': process.env.OPENROUTER_APP_NAME || 'Actero',
  },
}

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

async function callAnthropic({ system, messages, maxTokens, model, tools, signal }) {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY not configured')
  // Les outils ne sont câblés que sur le chemin OpenAI-compatible. Échouer ici
  // est préférable à un appel silencieusement dépourvu d'outils, qui rendrait
  // une réponse inventée au lieu d'une réponse mesurée.
  if (tools?.length) {
    throw new Error("Tool-calling n'est câblé que sur les fournisseurs OpenAI-compatibles (openrouter, openai)")
  }
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: model || CLAUDE_MODEL,
      max_tokens: maxTokens,
      ...(system ? { system: Array.isArray(system) ? system.map((b) => b.text || '').join('\n\n') : system } : {}),
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
    toolCalls: [],
    usage: { tokensIn: data?.usage?.input_tokens || 0, tokensOut: data?.usage?.output_tokens || 0 },
    modelId: data?.model || model || CLAUDE_MODEL,
  }
}

// Shared for OpenAI + OpenRouter (identical Chat Completions API). `cfg`
// selects the endpoint/key/headers/default-model; defaults to OpenAI.
async function callOpenAIChat({ system, messages, maxTokens, model, json, jsonSchema, tools, reasoning, signal, cfg = OPENAI_CFG }) {
  const key = cfg.getKey()
  if (!key) throw new Error(`${cfg.keyName} not configured`)
  const full = [
    // `system` accepte des blocs ({ type:'text', text, cache_control }) pour
    // poser des points de cache : le préfixe stable (prompt système, contexte
    // marque) n'est alors facturé qu'une fois par fenêtre.
    ...(system ? [{ role: 'system', content: system }] : []),
    // Une boucle d'outils renvoie au modèle ses propres `tool_calls` puis les
    // résultats (`role: 'tool'`). Sans ce passe-plat, le second tour perdait
    // le lien entre l'appel et son résultat et le modèle repartait de zéro.
    ...messages.map((m) => ({
      role: m.role,
      content: toOpenAIContent(m.content),
      ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}),
      ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
    })),
  ]
  const res = await fetch(cfg.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, ...cfg.extraHeaders },
    body: JSON.stringify({
      model: model || cfg.defaultModel,
      messages: full,
      max_completion_tokens: maxTokens,
      reasoning_effort: OPENAI_REASONING_EFFORT,
      ...(jsonSchema
        ? { response_format: { type: 'json_schema', json_schema: { name: jsonSchema.name || 'reponse', strict: true, schema: jsonSchema.schema || jsonSchema } } }
        : json ? { response_format: { type: 'json_object' } } : {}),
      ...(tools?.length ? { tools } : {}),
      ...(reasoning ? { reasoning } : {}),
    }),
    signal,
  })
  if (!res.ok) {
    const e = await res.text().catch(() => '')
    throw new Error(`${cfg.keyName === 'OPENROUTER_API_KEY' ? 'OpenRouter' : 'OpenAI'} ${res.status}: ${e.slice(0, 200)}`)
  }
  const data = await res.json()
  const msg = data?.choices?.[0]?.message || {}
  return {
    text: msg.content || '',
    toolCalls: msg.tool_calls || [],
    usage: {
      tokensIn: data?.usage?.prompt_tokens || 0,
      tokensOut: data?.usage?.completion_tokens || 0,
      tokensCache: data?.usage?.prompt_tokens_details?.cached_tokens || 0,
    },
    modelId: data?.model || model || cfg.defaultModel,
  }
}

/**
 * `tools` suit le format OpenAI ({ type: 'function', function: { name,
 * description, parameters } }) et n'est honoré que par les fournisseurs
 * OpenAI-compatibles. `toolCalls` est vide quand le modèle répond en texte.
 *
 * @returns {Promise<{ text: string, toolCalls: Array, usage: {tokensIn:number, tokensOut:number}, modelId: string }>}
 */
export async function chatComplete({ system, messages, maxTokens = 512, json = false, jsonSchema, model, tier, tools, reasoning, timeoutMs } = {}) {
  // Resolve the model: explicit `model` wins; else `tier: 'fast'` picks the
  // cheap classifier for the active provider; else the provider default.
  const fastModel = PROVIDER === 'openai' ? OPENAI_FAST_MODEL
    : PROVIDER === 'openrouter' ? OPENROUTER_FAST_MODEL
    : CLAUDE_FAST_MODEL
  const resolvedModel = model || (tier === 'fast' ? fastModel : undefined)

  let signal
  let timer
  if (timeoutMs) {
    const controller = new AbortController()
    signal = controller.signal
    timer = setTimeout(() => controller.abort(), timeoutMs)
  }
  try {
    const args = { system, messages, maxTokens, model: resolvedModel, json, jsonSchema, tools, reasoning, signal }
    let result
    if (PROVIDER === 'openrouter') result = await callOpenAIChat({ ...args, cfg: OPENROUTER_CFG })
    else if (PROVIDER === 'openai') result = await callOpenAIChat(args)
    else result = await callAnthropic(args)
    return result
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export { PROVIDER as LLM_PROVIDER }
