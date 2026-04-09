/**
 * Actero Engine V2 — Brain
 *
 * Le composant IA central. Reçoit un événement normalisé,
 * classifie la demande, et produit un action plan.
 *
 * Étape 1 : Classification (quel type de demande ?)
 * Étape 2 : Décision (quel action plan exécuter ?)
 */
import { callClaude } from './lib/claude-client.js'
import { loadClientConfig } from './lib/config-loader.js'
import { buildSystemPrompt } from './lib/prompt-builder.js'

/**
 * Run the Brain on a normalized event.
 * Returns: { classification, confidence, actionPlan, aiResponse, needsReview, reviewReason }
 */
export async function runBrain(supabase, { event, playbook, clientId, normalized, conversationHistory }) {
  // Load full client context
  const clientConfig = await loadClientConfig(supabase, clientId)

  // --- Step 1: Classification ---
  const classificationPrompt = playbook.classification_prompt + `

CONTEXTE CLIENT "${clientConfig.client.brand_name}":
${clientConfig.settings.brand_tone ? `Ton: ${clientConfig.settings.brand_tone}` : ''}
${clientConfig.knowledge ? `\nBASE DE CONNAISSANCES:\n${clientConfig.knowledge}` : ''}
${clientConfig.guardrails.length > 0 ? `\nREGLES:\n${clientConfig.guardrails.map((r, i) => `${i + 1}. ${r}`).join('\n')}` : ''}
`

  let classification, confidence, summary
  try {
    const classResult = await callClaude({
      systemPrompt: classificationPrompt,
      messages: [{ role: 'user', content: `Source: ${event.source}\nEmail: ${normalized.customer_email}\nSujet: ${normalized.subject || 'N/A'}\nMessage: ${normalized.message}` }],
      maxTokens: 200,
    })

    classification = classResult.classification || 'autre'
    confidence = classResult.confidence || 0.5
    summary = classResult.summary || ''
  } catch (err) {
    console.error('[brain] Classification error:', err.message)
    return {
      classification: 'error',
      confidence: 0,
      actionPlan: [],
      aiResponse: null,
      needsReview: true,
      reviewReason: 'error',
    }
  }

  // --- Check confidence threshold ---
  if (confidence < playbook.confidence_threshold) {
    // Generate a proposed response anyway (for the reviewer)
    let proposedResponse = null
    try {
      const responsePrompt = buildSystemPrompt(clientConfig)
      // Build messages with conversation history
      let lowConfMessages = []
      if (conversationHistory && conversationHistory.length > 0) {
        const prevMessages = conversationHistory.slice(0, -1)
        for (const msg of prevMessages) {
          if (msg.role === 'user') {
            lowConfMessages.push({ role: 'user', content: msg.content })
          } else if (msg.role === 'assistant') {
            lowConfMessages.push({ role: 'assistant', content: msg.content })
          }
        }
        // Ensure messages start with a user message
        while (lowConfMessages.length > 0 && lowConfMessages[0].role !== 'user') {
          lowConfMessages.shift()
        }
        // Remove consecutive same-role messages
        lowConfMessages = lowConfMessages.filter((msg, i) => {
          if (i === 0) return true
          return msg.role !== lowConfMessages[i - 1].role
        })
      }
      lowConfMessages.push({ role: 'user', content: normalized.message })
      const respResult = await callClaude({
        systemPrompt: responsePrompt,
        messages: lowConfMessages,
        maxTokens: 300,
      })
      proposedResponse = respResult.response || respResult.rawText
    } catch {}

    return {
      classification,
      confidence,
      actionPlan: getActionPlan(playbook, classification),
      aiResponse: proposedResponse,
      needsReview: true,
      reviewReason: 'low_confidence',
    }
  }

  // --- Step 2: Decision (get action plan from playbook rules) ---
  let actionPlan = getActionPlan(playbook, classification)

  // --- Step 3: Generate AI response if action plan includes send_reply ---
  let aiResponse = null
  let shouldEscalate = false
  let escalationReason = null
  let sentimentScore = 5

  if (actionPlan.includes('send_reply') || actionPlan.includes('send_email')) {
    try {
      const responsePrompt = buildSystemPrompt(clientConfig)

      // Build messages with conversation history for context/memory
      let claudeMessages = []
      if (conversationHistory && conversationHistory.length > 0) {
        // Include previous exchanges (skip the current message which is last)
        const prevMessages = conversationHistory.slice(0, -1)
        for (const msg of prevMessages) {
          if (msg.role === 'user') {
            claudeMessages.push({ role: 'user', content: msg.content })
          } else if (msg.role === 'assistant') {
            // Send previous assistant responses as plain text (not JSON) to avoid Claude mimicking JSON format
            claudeMessages.push({ role: 'assistant', content: msg.content })
          }
        }
        // Ensure messages start with a user message (Claude API requirement)
        while (claudeMessages.length > 0 && claudeMessages[0].role !== 'user') {
          claudeMessages.shift()
        }
        // Ensure no two consecutive messages have the same role
        claudeMessages = claudeMessages.filter((msg, i) => {
          if (i === 0) return true
          return msg.role !== claudeMessages[i - 1].role
        })
      }
      // Add current message
      claudeMessages.push({ role: 'user', content: normalized.message })

      const respResult = await callClaude({
        systemPrompt: responsePrompt,
        messages: claudeMessages,
        maxTokens: 400,
      })
      aiResponse = respResult.response || respResult.rawText
      shouldEscalate = respResult.should_escalate === true
      escalationReason = respResult.escalation_reason || null
      sentimentScore = respResult.sentiment_score || 5

      // Clean markdown
      if (aiResponse) {
        aiResponse = aiResponse.replace(/\*\*/g, '').replace(/\*/g, '').replace(/^#+\s/gm, '').replace(/`([^`]+)`/g, '$1').trim()
      }
    } catch (err) {
      console.error('[brain] Response generation error:', err.message)
      return {
        classification,
        confidence,
        actionPlan,
        aiResponse: null,
        needsReview: true,
        reviewReason: 'error',
      }
    }
  }

  // --- Step 4: Check escalation signals from Claude ---
  // Escalate if: Claude flagged should_escalate, or sentiment is very negative (<=2),
  // or classification is 'aggressive', or injection detected
  if (shouldEscalate || sentimentScore <= 2 || classification === 'aggressive') {
    if (!actionPlan.includes('escalate')) {
      actionPlan = [...actionPlan, 'escalate']
    }
    return {
      classification,
      confidence,
      actionPlan,
      aiResponse,
      needsReview: true,
      reviewReason: shouldEscalate ? (escalationReason || 'aggressive') : 'aggressive',
    }
  }

  return {
    classification,
    confidence,
    actionPlan,
    aiResponse,
    needsReview: false,
    reviewReason: null,
  }
}

/**
 * Get the action plan from playbook decision rules based on classification.
 */
function getActionPlan(playbook, classification) {
  const rules = playbook.decision_rules || {}
  return rules[classification] || rules['autre'] || ['send_reply']
}
