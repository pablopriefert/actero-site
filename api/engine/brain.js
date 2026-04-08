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
export async function runBrain(supabase, { event, playbook, clientId, normalized }) {
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
      const respResult = await callClaude({
        systemPrompt: responsePrompt,
        messages: [{ role: 'user', content: normalized.message }],
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
  const actionPlan = getActionPlan(playbook, classification)

  // --- Step 3: Generate AI response if action plan includes send_reply ---
  let aiResponse = null
  if (actionPlan.includes('send_reply') || actionPlan.includes('send_email')) {
    try {
      const responsePrompt = buildSystemPrompt(clientConfig)
      const respResult = await callClaude({
        systemPrompt: responsePrompt,
        messages: [{ role: 'user', content: normalized.message }],
        maxTokens: 400,
      })
      aiResponse = respResult.response || respResult.rawText
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
