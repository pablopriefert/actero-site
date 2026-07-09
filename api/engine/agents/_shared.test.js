import { describe, it, expect } from 'vitest'
import { buildClaudeMessages } from './_shared.js'

const roles = (m) => m.map((x) => x.role).join(',')
const alternates = (m) => m.every((x, i) => i === 0 || x.role !== m[i - 1].role)

describe('buildClaudeMessages', () => {
  it('widget path: history ends with the current message echo', () => {
    const { claudeMessages } = buildClaudeMessages({
      conversationHistory: [
        { role: 'user', content: 'salut' },
        { role: 'assistant', content: 'bonjour' },
        { role: 'user', content: 'où est ma commande ?' },
      ],
      currentMessage: 'où est ma commande ?',
    })
    expect(alternates(claudeMessages)).toBe(true)
    expect(claudeMessages[0].role).toBe('user')
    expect(claudeMessages.at(-1)).toEqual({ role: 'user', content: 'où est ma commande ?' })
  })

  it('DB-rebuild path: history does NOT include the current message and ends with assistant', () => {
    const { claudeMessages } = buildClaudeMessages({
      conversationHistory: [
        { role: 'user', content: 'salut' },
        { role: 'assistant', content: 'bonjour' },
      ],
      currentMessage: 'où est ma commande ?',
    })
    // Must not drop the assistant turn and must not produce two adjacent users.
    expect(alternates(claudeMessages)).toBe(true)
    expect(roles(claudeMessages)).toBe('user,assistant,user')
    expect(claudeMessages.at(-1).content).toBe('où est ma commande ?')
  })

  it('history ending with an unanswered user turn does not create adjacent users', () => {
    const { claudeMessages } = buildClaudeMessages({
      conversationHistory: [{ role: 'user', content: 'ancien message' }],
      currentMessage: 'nouveau message',
    })
    expect(alternates(claudeMessages)).toBe(true)
    expect(claudeMessages.at(-1).content).toBe('nouveau message')
  })

  it('empty history → just the current message', () => {
    const { claudeMessages, hasHistory } = buildClaudeMessages({ conversationHistory: [], currentMessage: 'hi' })
    expect(hasHistory).toBe(false)
    expect(claudeMessages).toEqual([{ role: 'user', content: 'hi' }])
  })
})
