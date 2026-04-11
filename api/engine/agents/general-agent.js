/**
 * Actero Engine V2 — General Agent
 *
 * Fallback agent used when no specialized agent matches. Replicates the
 * legacy brain.js behavior so nothing regresses for "autre", "general",
 * "greeting" or unknown classifications.
 */
import { callClaude } from '../lib/claude-client.js'
import { buildSystemPrompt } from '../lib/prompt-builder.js'
import {
  buildClaudeMessages,
  cleanMarkdown,
  CONTINUITY_REMINDER,
} from './_shared.js'

export const generalAgent = {
  name: 'general',
  classifications: ['autre', 'general', 'general_info', 'greeting'],
  tools: [],

  async run({ clientConfig, normalized, conversationHistory, memoryContext }) {
    const basePrompt = buildSystemPrompt(clientConfig) + (memoryContext || '')
    const { claudeMessages, hasHistory } = buildClaudeMessages({
      conversationHistory,
      currentMessage: normalized.message,
    })
    const systemPrompt = hasHistory ? basePrompt + CONTINUITY_REMINDER : basePrompt

    const respResult = await callClaude({
      systemPrompt,
      messages: claudeMessages,
      maxTokens: 400,
    })

    const aiResponse = cleanMarkdown(respResult.response || respResult.rawText)

    return {
      aiResponse,
      shouldEscalate: respResult.should_escalate === true,
      escalationReason: respResult.escalation_reason || null,
      sentimentScore: respResult.sentiment_score || 5,
      toolsUsed: [],
    }
  },
}
