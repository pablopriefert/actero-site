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
import { retrieveMemories, storeMemory, buildMemoryContext } from './lib/memory.js'
import { searchShopifyProducts } from './lib/shopify-products.js'

// Keywords hinting the customer is asking for a product recommendation.
const PRODUCT_INTENT_PATTERNS = /\b(recommand|suggest|conseill|cherch|besoin|je veux|j'aimerais|j'?ai envie|produit|article|acheter|commander|comme|similaire|equivalent|alternative|quel|quelle|montre-?moi|montrez-?moi|proposer?|proposez|avez-?vous)\b/i

/**
 * Heuristically extract a short product query from a free-text message.
 * Falls back to the raw message (capped) if no pattern matches.
 */
function extractProductQuery(message) {
  if (!message) return ''
  const cleaned = message
    .replace(/[?!.,;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  // Try to capture what follows a trigger verb ("cherche", "veux", "besoin de", ...)
  const patterns = [
    /(?:je cherche|cherche|je veux|veux|je voudrais|voudrais|j'aimerais|aimerais|j'ai besoin(?: de| d')?|besoin(?: de| d')?|recommand(?:e|ez|er)(?: moi| nous)?(?: une?| des| du)?|suggest(?:e|ez|er)(?: moi| nous)?(?: une?| des| du)?|conseill(?:e|ez|er)(?: moi| nous)?(?: une?| des| du)?|montre(?:z|r)?(?: moi| nous)?(?: une?| des| du)?|propose(?:z|r)?(?: moi| nous)?(?: une?| des| du)?|avez-?vous(?: une?| des| du)?)\s+(.{3,60}?)(?:\s+(?:pour|qui|parce|car|avec|sans|comme)\b|$)/i,
  ]

  for (const pat of patterns) {
    const m = cleaned.match(pat)
    if (m && m[1]) {
      return m[1].trim().split(/\s+/).slice(0, 5).join(' ')
    }
  }

  // Fallback: strip stopwords and keep substantive words (max 5)
  const stop = new Set(['je', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles', 'un', 'une', 'des', 'le', 'la', 'les', 'de', 'du', 'au', 'aux', 'en', 'et', 'ou', 'pour', 'avec', 'sans', 'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'son', 'sa', 'ses', 'ce', 'ces', 'cette', 'bonjour', 'salut', 'merci', 'svp', 'stp', 'est', 'ai', 'avez', 'suis', 'etre', 'avoir', 'cherche', 'cherches', 'veux', 'voudrais', 'besoin', 'aimerais', 'recommande', 'recommander', 'suggere', 'conseille', 'conseiller', 'produit', 'produits', 'article', 'articles'])
  const words = cleaned
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 2 && !stop.has(w))
  return words.slice(0, 5).join(' ')
}

/**
 * Fetch product recommendations if the message shows product intent
 * and the client has the feature enabled.
 */
async function maybeFetchProductRecommendations(supabase, { clientConfig, clientId, classification, message, sentimentScore }) {
  if (!message) return []

  // Setting opt-out (defaults to true at DB level)
  const enabled = clientConfig?.settings?.product_recommendations_enabled
  if (enabled === false) return []

  // Only trigger on product questions or neutral/positive general messages
  const eligibleClassification =
    classification === 'question_produit' ||
    classification === 'autre' ||
    classification === 'general' ||
    classification === 'general_info'
  if (!eligibleClassification) return []

  // Don't recommend if sentiment is negative
  if (typeof sentimentScore === 'number' && sentimentScore <= 3) return []

  // Keyword-based intent gate
  if (!PRODUCT_INTENT_PATTERNS.test(message)) return []

  const query = extractProductQuery(message)
  if (!query || query.length < 2) return []

  try {
    const products = await searchShopifyProducts(supabase, { clientId, query, limit: 3 })
    return products || []
  } catch (err) {
    console.error('[brain] Product recommendation error:', err.message)
    return []
  }
}

/**
 * Run the Brain on a normalized event.
 * Returns: { classification, confidence, actionPlan, aiResponse, needsReview, reviewReason }
 */
export async function runBrain(supabase, { event, playbook, clientId, normalized, conversationHistory }) {
  // Load full client context
  const clientConfig = await loadClientConfig(supabase, clientId)

  // --- Actero Memory: retrieve persistent memories for this end-customer ---
  // These are injected into the system prompt so the agent can personalize
  // its answer based on past interactions with the same email.
  let memoryContext = ''
  let retrievedMemories = []
  try {
    retrievedMemories = await retrieveMemories(supabase, {
      clientId,
      customerEmail: normalized?.customer_email,
      query: normalized?.message || '',
      limit: 5,
    })
    memoryContext = buildMemoryContext(retrievedMemories)
  } catch (err) {
    console.error('[brain] Memory retrieval error:', err.message)
  }

  // --- Step 1: Classification ---
  let classificationPrompt = playbook.classification_prompt + `

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
      const responsePrompt = buildSystemPrompt(clientConfig) + memoryContext
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
      const basePrompt = buildSystemPrompt(clientConfig) + memoryContext

      // Build messages with conversation history for context/memory
      let claudeMessages = []
      const hasHistory = conversationHistory && conversationHistory.length > 1

      if (hasHistory) {
        // Include previous exchanges (skip the current message which is last)
        const prevMessages = conversationHistory.slice(0, -1)
        for (const msg of prevMessages) {
          if (msg.role === 'user') {
            claudeMessages.push({ role: 'user', content: msg.content })
          } else if (msg.role === 'assistant') {
            // Wrap assistant text in the JSON format Claude expects, so it recognizes the conversation
            claudeMessages.push({ role: 'assistant', content: `{"response": ${JSON.stringify(msg.content)}, "confidence": 0.9, "should_escalate": false, "detected_intent": "general", "sentiment_score": 7, "injection_detected": false}` })
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

      // Add conversation context reminder to system prompt when there's history
      const responsePrompt = hasHistory
        ? basePrompt + `\n\nIMPORTANT: Ceci est une conversation EN COURS. Les messages precedents sont dans l'historique ci-dessous. Continue la conversation naturellement, ne te re-presente pas, ne dis pas "Bonjour" a nouveau. Reponds dans le contexte de ce qui a deja ete dit.`
        : basePrompt

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

      // --- Actero Memory: persist this exchange as a new memory ---
      // Fire-and-forget; storeMemory is a no-op for anonymous emails.
      // Skip entirely in test mode.
      if (aiResponse && normalized?.customer_email && !normalized?._is_test) {
        const memoryContent = `Client a demande: "${normalized.message}"\nReponse donnee: "${aiResponse}"`
        storeMemory(supabase, {
          clientId,
          customerEmail: normalized.customer_email,
          type: 'conversation',
          content: memoryContent,
          metadata: {
            classification,
            confidence,
            session_id: normalized?.session_id || null,
            source: event?.source || null,
            sentiment_score: sentimentScore,
          },
        }).catch(err => console.error('[brain] Memory store error:', err.message))
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

  // --- Step 4: Check escalation signals ---
  // Detect explicit human request from message text
  const msgLower = (normalized?.message || '').toLowerCase()
  const asksForHuman = /\b(parler.*humain|parler.*conseiller|parler.*responsable|parler.*agent|parler.*personne|transferer|escalad|vrai.*(humain|personne|conseiller)|besoin.*humain|responsable.*humain)\b/i.test(msgLower)

  // Escalate when ANY of these is true:
  // - Customer explicitly asks for a human (keyword detection)
  // - Claude flags should_escalate (AI detects escalation needed)
  // - Sentiment very negative (<=2) = angry/aggressive
  // - Classification is 'aggressive' or 'reclamation'
  const shouldForceEscalate =
    asksForHuman ||
    shouldEscalate ||
    sentimentScore <= 2 ||
    classification === 'aggressive' ||
    classification === 'reclamation'

  if (shouldForceEscalate) {
    if (!actionPlan.includes('escalate')) {
      actionPlan = [...actionPlan, 'escalate']
    }
    return {
      classification,
      confidence,
      actionPlan,
      aiResponse,
      needsReview: true,
      reviewReason: sentimentScore <= 2 ? 'aggressive' : (escalationReason || 'out_of_policy'),
    }
  }

  // --- Step 5: Product recommendations (if eligible + Shopify connected) ---
  const productRecommendations = await maybeFetchProductRecommendations(supabase, {
    clientConfig,
    clientId,
    classification,
    message: normalized?.message,
    sentimentScore,
  })

  return {
    classification,
    confidence,
    actionPlan,
    aiResponse,
    needsReview: false,
    reviewReason: null,
    productRecommendations,
  }
}

/**
 * Get the action plan from playbook decision rules based on classification.
 */
function getActionPlan(playbook, classification) {
  const rules = playbook.decision_rules || {}
  return rules[classification] || rules['autre'] || ['send_reply']
}
