/**
 * Actero Engine V2 — Return Agent
 *
 * Specialized agent for returns, refunds and exchanges.
 * Grounded in the client's real return policy (clientConfig.settings.return_policy)
 * and knowledge base — refuses to invent delays, conditions or RMA processes.
 */
import { callClaude } from '../lib/claude-client.js'
import { buildSystemPrompt } from '../lib/prompt-builder.js'
import { lookupOrder } from '../lib/shopify-client.js'
import {
  buildClaudeMessages,
  cleanMarkdown,
  CONTINUITY_REMINDER,
  VISION_CONTEXT_INSTRUCTION,
} from './_shared.js'

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

export const returnAgent = {
  name: 'return',
  classifications: ['retour', 'remboursement', 'echange', 'return', 'refund'],
  tools: ['lookup_order'],

  buildSystemPrompt(clientConfig, memoryContext, orderContext) {
    const base = buildSystemPrompt(clientConfig) + (memoryContext || '')
    const policy = clientConfig?.settings?.return_policy?.trim()

    let specialization = `\n\nROLE SPECIALISE — RETOURS / REMBOURSEMENTS / ECHANGES:
Tu es l'assistant dedie aux retours pour "${clientConfig.client.brand_name}".
Ton objectif: guider le client etape par etape dans le processus de retour ou de remboursement, en te basant EXCLUSIVEMENT sur la politique officielle ci-dessous.

REGLES ANTI-HALLUCINATION (CRITIQUES):
- Tu n'INVENTES JAMAIS un delai de retour, un pourcentage de remboursement, une adresse de retour, un bordereau, une condition d'eligibilite.
- Si la politique officielle ne couvre pas le cas precis du client, dis-le honnetement et propose d'escalader vers un humain.
- Si aucune politique n'est configuree, indique que tu dois verifier aupres d'un responsable.`

    if (policy) {
      specialization += `\n\nPOLITIQUE DE RETOUR OFFICIELLE (source de verite):\n${policy}`
    } else {
      specialization += `\n\nPOLITIQUE DE RETOUR OFFICIELLE: non renseignee. Escalade tout cas de retour vers un humain.`
    }

    if (orderContext && orderContext.length > 0) {
      specialization += `\n\nDONNEES COMMANDE CLIENT (pour verifier l'eligibilite — n'invente rien au-dela):\n`
      specialization += orderContext.map(o => o.contextText || '').join('\n')
    }

    specialization += `\n\nSTRUCTURE DE REPONSE:
- Confirme brievement que tu comprends la demande (retour, remboursement ou echange).
- Rappelle LA condition-cle applicable (delai, etat du produit) en citant la politique officielle.
- Donne l'etape suivante concrete (ex: ou envoyer, quoi joindre, qui contacter).
- Si le cas sort de la politique ou si des donnees manquent, escalade vers un humain.`

    return base + specialization
  },

  async run({ supabase, clientConfig, clientId, normalized, conversationHistory, memoryContext, classification, visionContext }) {
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
        console.error('[return-agent] lookupOrder error:', err.message)
      }
    }

    let systemPrompt = this.buildSystemPrompt(clientConfig, memoryContext, orderContext)
    if (visionContext) {
      systemPrompt += VISION_CONTEXT_INSTRUCTION + '\n\nvision_context = ' + JSON.stringify(visionContext)
    }
    const { claudeMessages, hasHistory } = buildClaudeMessages({
      conversationHistory,
      currentMessage: normalized.message,
    })
    const finalSystem = hasHistory ? systemPrompt + CONTINUITY_REMINDER : systemPrompt

    const respResult = await callClaude({
      systemPrompt: finalSystem,
      messages: claudeMessages,
      maxTokens: 450,
    })

    const aiResponse = cleanMarkdown(respResult.response || respResult.rawText)

    return {
      aiResponse,
      shouldEscalate: respResult.should_escalate === true,
      escalationReason: respResult.escalation_reason || null,
      sentimentScore: respResult.sentiment_score || 5,
      toolsUsed,
      usage: respResult.usage || null,
      modelId: respResult.modelId || null,
    }
  },
}
