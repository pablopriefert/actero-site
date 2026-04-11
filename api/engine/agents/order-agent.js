/**
 * Actero Engine V2 — Order Agent
 *
 * Specialized agent for order tracking / shipping / delivery questions.
 * Uses the Shopify API (via lookupOrder) to ground the response in REAL
 * order data and strictly forbids Claude from inventing order numbers,
 * tracking codes, carriers, or dates.
 */
import { callClaude } from '../lib/claude-client.js'
import { buildSystemPrompt } from '../lib/prompt-builder.js'
import { lookupOrder } from '../lib/shopify-client.js'
import {
  buildClaudeMessages,
  cleanMarkdown,
  CONTINUITY_REMINDER,
} from './_shared.js'

// Try to extract an order identifier (e.g. "#4521", "commande 4521") from free text.
function extractOrderId(message) {
  if (!message) return null
  const patterns = [
    /#\s*(\d{3,8})/,
    /\bcommande\s*(?:n[o°]?)?\s*#?\s*(\d{3,8})\b/i,
    /\border\s*(?:n[o°]?)?\s*#?\s*(\d{3,8})\b/i,
  ]
  for (const pat of patterns) {
    const m = message.match(pat)
    if (m && m[1]) return m[1]
  }
  return null
}

export const orderAgent = {
  name: 'order',
  classifications: ['suivi_commande', 'livraison', 'tracking', 'order_tracking'],
  tools: ['lookup_order'],

  buildSystemPrompt(clientConfig, memoryContext, orderContext) {
    const base = buildSystemPrompt(clientConfig) + (memoryContext || '')

    let specialization = `\n\nROLE SPECIALISE — SUIVI DE COMMANDE:
Tu es l'assistant dedie au suivi de commande pour "${clientConfig.client.brand_name}".
Ton unique objectif est de renseigner le client sur l'etat, le transporteur, le suivi et la date de livraison de sa commande.

REGLES ANTI-HALLUCINATION (CRITIQUES):
- Tu n'INVENTES JAMAIS un numero de commande, un numero de suivi, un transporteur, une date, un montant, une adresse ou un statut.
- Si les donnees reelles de la commande ne sont PAS fournies ci-dessous, tu le dis explicitement et tu demandes au client son numero de commande ou son email.
- Ne mentionne une information que si elle apparait textuellement dans la section "DONNEES COMMANDE" ci-dessous.
- Si la commande est introuvable, indique-le clairement et propose de verifier le numero ou de contacter un humain.`

    if (orderContext && orderContext.length > 0) {
      specialization += `\n\nDONNEES COMMANDE (source de verite — n'invente rien au-dela):\n`
      specialization += orderContext.map(o => o.contextText || '').join('\n')
    } else {
      specialization += `\n\nDONNEES COMMANDE: aucune commande trouvee (pas de connexion Shopify OU commande introuvable). Demande poliment le numero de commande et/ou l'email associe si le client ne les a pas deja fournis.`
    }

    return base + specialization
  },

  async run({ supabase, clientConfig, clientId, normalized, conversationHistory, memoryContext, classification }) {
    // 1. Try to fetch the real order from Shopify
    let orderContext = null
    const toolsUsed = []

    if (!normalized?._is_test) {
      try {
        const orderId = extractOrderId(normalized?.message || '')
        const fetched = await lookupOrder(supabase, {
          clientId,
          orderId,
          customerEmail: normalized?.customer_email,
        })
        if (fetched && fetched.length > 0) {
          orderContext = fetched
          toolsUsed.push('lookup_order')
        }
      } catch (err) {
        console.error('[order-agent] lookupOrder error:', err.message)
      }
    }

    // 2. Build prompt + messages
    const systemPrompt = this.buildSystemPrompt(clientConfig, memoryContext, orderContext)
    const { claudeMessages, hasHistory } = buildClaudeMessages({
      conversationHistory,
      currentMessage: normalized.message,
    })
    const finalSystem = hasHistory ? systemPrompt + CONTINUITY_REMINDER : systemPrompt

    // 3. Call Claude
    const respResult = await callClaude({
      systemPrompt: finalSystem,
      messages: claudeMessages,
      maxTokens: 400,
    })

    const aiResponse = cleanMarkdown(respResult.response || respResult.rawText)

    return {
      aiResponse,
      shouldEscalate: respResult.should_escalate === true,
      escalationReason: respResult.escalation_reason || null,
      sentimentScore: respResult.sentiment_score || 5,
      toolsUsed,
    }
  },
}
