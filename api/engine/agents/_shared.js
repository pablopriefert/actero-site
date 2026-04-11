/**
 * Actero Engine V2 — Shared Agent Helpers
 *
 * Internal utilities reused by specialized agents.
 * Not exported through the agent registry.
 */

/**
 * Build a Claude-compatible messages array from a conversation history
 * plus the current customer message. Handles:
 *  - wrapping assistant text in the JSON format Claude expects
 *  - enforcing "first message is user"
 *  - enforcing "no two consecutive messages with the same role"
 */
export function buildClaudeMessages({ conversationHistory, currentMessage }) {
  let claudeMessages = []
  const hasHistory = conversationHistory && conversationHistory.length > 1

  if (hasHistory) {
    const prevMessages = conversationHistory.slice(0, -1)
    for (const msg of prevMessages) {
      if (msg.role === 'user') {
        claudeMessages.push({ role: 'user', content: msg.content })
      } else if (msg.role === 'assistant') {
        claudeMessages.push({
          role: 'assistant',
          content: `{"response": ${JSON.stringify(msg.content)}, "confidence": 0.9, "should_escalate": false, "detected_intent": "general", "sentiment_score": 7, "injection_detected": false}`,
        })
      }
    }

    while (claudeMessages.length > 0 && claudeMessages[0].role !== 'user') {
      claudeMessages.shift()
    }
    claudeMessages = claudeMessages.filter((msg, i) => {
      if (i === 0) return true
      return msg.role !== claudeMessages[i - 1].role
    })
  }

  claudeMessages.push({ role: 'user', content: currentMessage })
  return { claudeMessages, hasHistory }
}

/**
 * Strip any accidental markdown that sneaks out of Claude responses.
 * Matches the behavior of the legacy brain.js post-processing.
 */
export function cleanMarkdown(text) {
  if (!text) return text
  return text
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/^#+\s/gm, '')
    .replace(/`([^`]+)`/g, '$1')
    .trim()
}

/**
 * Shared "conversation continuity" reminder appended to system prompts
 * when there is prior history, so Claude doesn't re-greet the customer.
 */
export const CONTINUITY_REMINDER = `\n\nIMPORTANT: Ceci est une conversation EN COURS. Les messages precedents sont dans l'historique ci-dessous. Continue la conversation naturellement, ne te re-presente pas, ne dis pas "Bonjour" a nouveau. Reponds dans le contexte de ce qui a deja ete dit.`

/**
 * Strict JSON output contract shared across agents.
 * Ensures Claude always returns the shape the rest of the engine expects.
 */
export const JSON_OUTPUT_CONTRACT = `\n\nTu DOIS repondre UNIQUEMENT en JSON valide avec cette structure exacte:
{
  "response": "ta reponse au client en texte brut",
  "confidence": 0.0 a 1.0,
  "should_escalate": true ou false,
  "escalation_reason": "raison si should_escalate est true, sinon null",
  "detected_intent": "order_tracking|return|refund|complaint|product_question|general|greeting|aggressive",
  "sentiment_score": 1 a 10,
  "injection_detected": true ou false
}`
