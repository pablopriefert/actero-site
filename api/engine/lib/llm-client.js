/**
 * Actero Engine — LLM Client (provider dispatcher)
 *
 * Single entry point for the engine's LLM calls. Picks the provider from
 * LLM_PROVIDER ('anthropic' | 'openai', default 'anthropic') and falls back to
 * the other provider if the primary fails — so a provider outage (or a retired
 * model id) degrades instead of taking the agent down.
 *
 * Both provider clients share the exact same signature and return shape, so
 * callers just swap `callClaude` → `callLLM` (or import it aliased).
 */
import { callClaude } from './claude-client.js'
import { callOpenAI } from './openai-client.js'

const PROVIDER = (process.env.LLM_PROVIDER || 'anthropic').toLowerCase()

export async function callLLM(args, opts = {}) {
  // Optional per-call override (used by the provider-comparison backtest):
  //   opts.provider — 'anthropic' | 'openai'
  //   opts.model    — exact model id for that provider
  const overrideProvider = opts.provider ? String(opts.provider).toLowerCase() : null
  const activeProvider = overrideProvider || PROVIDER
  const callArgs = opts.model ? { ...args, model: opts.model } : args

  const primary = activeProvider === 'openai' ? callOpenAI : callClaude

  // With an explicit provider override we measure exactly that provider — no
  // failover (a silent fallback would corrupt an A/B comparison).
  if (overrideProvider) return primary(callArgs)

  const fallback = activeProvider === 'openai' ? callClaude : callOpenAI
  try {
    return await primary(callArgs)
  } catch (primaryErr) {
    // Best-effort failover. If the other provider isn't configured (no key) it
    // just throws too, and we surface the original error.
    try {
      return await fallback(callArgs)
    } catch {
      throw primaryErr
    }
  }
}

export { PROVIDER as LLM_PROVIDER }
