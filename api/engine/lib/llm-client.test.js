import { describe, it, expect, vi, beforeEach } from 'vitest'

const calls = { claude: [], openai: [] }
const behavior = { openaiThrows: false }

vi.mock('./claude-client.js', () => ({
  callClaude: (args) => { calls.claude.push(args); return Promise.resolve({ provider: 'claude', ...args }) },
}))
vi.mock('./openai-client.js', () => ({
  callOpenAI: (args) => {
    calls.openai.push(args)
    if (behavior.openaiThrows) return Promise.reject(new Error('boom'))
    return Promise.resolve({ provider: 'openai', ...args })
  },
}))

const { callLLM } = await import('./llm-client.js')

beforeEach(() => { calls.claude = []; calls.openai = []; behavior.openaiThrows = false })

describe('callLLM override', () => {
  it('defaults to anthropic (env LLM_PROVIDER unset in tests)', async () => {
    const r = await callLLM({ systemPrompt: 's', messages: [] })
    expect(r.provider).toBe('claude')
    expect(calls.openai).toHaveLength(0)
  })

  it('routes to openai with the given model when provider override = openai', async () => {
    const r = await callLLM({ systemPrompt: 's', messages: [] }, { provider: 'openai', model: 'gpt-5.4-mini' })
    expect(r.provider).toBe('openai')
    expect(calls.openai[0].model).toBe('gpt-5.4-mini')
    expect(calls.claude).toHaveLength(0)
  })

  it('routes to anthropic with the given model when provider override = anthropic', async () => {
    await callLLM({ systemPrompt: 's', messages: [] }, { provider: 'anthropic', model: 'claude-sonnet-5' })
    expect(calls.claude[0].model).toBe('claude-sonnet-5')
    expect(calls.openai).toHaveLength(0)
  })

  it('does NOT fail over to the other provider when a provider override is set', async () => {
    behavior.openaiThrows = true
    await expect(callLLM({ systemPrompt: 's', messages: [] }, { provider: 'openai', model: 'gpt-5.4-mini' })).rejects.toThrow('boom')
    expect(calls.claude).toHaveLength(0)   // no silent fallback that would corrupt an A/B
  })
})
