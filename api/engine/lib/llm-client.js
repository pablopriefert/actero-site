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

export async function callLLM(args) {
  const primary = PROVIDER === 'openai' ? callOpenAI : callClaude
  const fallback = PROVIDER === 'openai' ? callClaude : callOpenAI

  try {
    return await primary(args)
  } catch (primaryErr) {
    // Best-effort failover. If the other provider isn't configured (no key) it
    // just throws too, and we surface the original error.
    try {
      return await fallback(args)
    } catch {
      throw primaryErr
    }
  }
}

export { PROVIDER as LLM_PROVIDER }
