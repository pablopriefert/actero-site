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

  buildSystemPrompt(clientConfig, memoryContext, orderContext, trackingContext) {
    const base = buildSystemPrompt(clientConfig) + (memoryContext || '')

    let specialization = `\n\nROLE SPECIALISE — SUIVI DE COMMANDE:
Tu es l'assistant dedie au suivi de commande pour "${clientConfig.client.brand_name}".
Ton unique objectif est de renseigner le client sur l'etat, le transporteur, le suivi et la date de livraison de sa commande.

REGLES ANTI-HALLUCINATION (CRITIQUES):
- Tu n'INVENTES JAMAIS un numero de commande, un numero de suivi, un transporteur, une date, un montant, une adresse ou un statut.
- Si les donnees reelles de la commande ne sont PAS fournies ci-dessous, tu le dis explicitement et tu demandes au client son numero de commande ou son email.
- Ne mentionne une information que si elle apparait textuellement dans la section "DONNEES COMMANDE" ou "TRACKING TEMPS REEL" ci-dessous.
- Si la commande est introuvable, indique-le clairement et propose de verifier le numero ou de contacter un humain.`

    if (orderContext && orderContext.length > 0) {
      specialization += `\n\nDONNEES COMMANDE (source de verite — n'invente rien au-dela):\n`
      specialization += orderContext.map(o => o.contextText || '').join('\n')
    } else {
      specialization += `\n\nDONNEES COMMANDE: aucune commande trouvee (pas de connexion Shopify OU commande introuvable). Demande poliment le numero de commande et/ou l'email associe si le client ne les a pas deja fournis.`
    }

    // AfterShip real-time tracking data
    if (trackingContext && trackingContext.length > 0) {
      specialization += `\n\nTRACKING TEMPS REEL (via AfterShip — source de verite):\n`
      specialization += trackingContext.map(t => {
        const parts = [
          `- Colis ${t.tracking_number} (${t.carrier_name})`,
          `  Statut: ${t.status_label}`,
          t.expected_delivery ? `  Livraison prevue: ${t.expected_delivery}` : null,
          t.last_event ? `  Dernier evenement: ${t.last_event.message}${t.last_event.location ? ` a ${t.last_event.location}` : ''} (${new Date(t.last_event.time).toLocaleString('fr-FR')})` : null,
          t.tracking_url ? `  Lien de suivi: ${t.tracking_url}` : null,
        ].filter(Boolean)
        return parts.join('\n')
      }).join('\n\n')
      specialization += `\n\nSi le client a plusieurs colis, mentionne-les tous. Donne le lien de suivi si disponible.`
    }

    return base + specialization
  },

  async run({ supabase, clientConfig, clientId, normalized, conversationHistory, memoryContext, classification }) {
    // 1. Try to fetch the real order from Shopify
    let orderContext = null
    let trackingContext = null
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

      // 1b. Enrich with AfterShip tracking if the client has the integration
      try {
        const { data: aftership } = await supabase
          .from('client_integrations')
          .select('api_key')
          .eq('client_id', clientId)
          .eq('provider', 'aftership')
          .eq('status', 'active')
          .maybeSingle()

        if (aftership?.api_key) {
          const { getTrackingsByOrderId, getTrackingsByEmail } = await import('../connectors/aftership.js')

          // Priority 1: use Shopify order IDs if available
          const shopifyOrderIds = (orderContext || []).map(o => o.id || o.order_id).filter(Boolean).slice(0, 3)
          const trackings = []

          for (const oid of shopifyOrderIds) {
            const r = await getTrackingsByOrderId(aftership.api_key, String(oid))
            if (r.trackings?.length) trackings.push(...r.trackings)
          }

          // Priority 2: fallback to email if no orderIds (or no trackings found)
          if (trackings.length === 0 && normalized?.customer_email) {
            const r = await getTrackingsByEmail(aftership.api_key, normalized.customer_email)
            if (r.trackings?.length) trackings.push(...r.trackings.slice(0, 3))
          }

          if (trackings.length > 0) {
            trackingContext = trackings
            toolsUsed.push('aftership_tracking')
          }
        }
      } catch (err) {
        console.error('[order-agent] aftership error:', err.message)
      }
    }

    // 2. Build prompt + messages
    const systemPrompt = this.buildSystemPrompt(clientConfig, memoryContext, orderContext, trackingContext)
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
      usage: respResult.usage || null,
      modelId: respResult.modelId || null,
    }
  },
}
