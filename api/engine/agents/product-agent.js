/**
 * Actero Engine V2 — Product Agent
 *
 * Specialized agent for product questions, availability and recommendations.
 * Uses searchShopifyProducts to ground its answer in the real catalog
 * instead of hallucinating SKUs, prices or variants.
 */
import { callClaude } from '../lib/claude-client.js'
import { buildSystemPrompt } from '../lib/prompt-builder.js'
import { searchShopifyProducts } from '../lib/shopify-products.js'
import {
  buildClaudeMessages,
  cleanMarkdown,
  CONTINUITY_REMINDER,
  VISION_CONTEXT_INSTRUCTION,
} from './_shared.js'

// Lightweight query extractor — reuses the same heuristics as brain.js
function extractProductQuery(message) {
  if (!message) return ''
  const cleaned = message.replace(/[?!.,;:]/g, ' ').replace(/\s+/g, ' ').trim()
  const stop = new Set(['je', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'un', 'une', 'des', 'le', 'la', 'les', 'de', 'du', 'en', 'et', 'ou', 'pour', 'avec', 'sans', 'est', 'ai', 'avez', 'suis', 'bonjour', 'salut', 'merci', 'svp', 'stp', 'cherche', 'veux', 'voudrais', 'besoin', 'aimerais', 'produit', 'produits', 'article', 'articles', 'avez-vous', 'dispo', 'disponible'])
  const words = cleaned.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !stop.has(w))
  return words.slice(0, 5).join(' ')
}

export const productAgent = {
  name: 'product',
  classifications: ['question_produit', 'disponibilite', 'recommandation', 'product_question'],
  tools: ['search_products'],

  buildSystemPrompt(clientConfig, memoryContext, catalogContext) {
    const base = buildSystemPrompt(clientConfig) + (memoryContext || '')

    let specialization = `\n\nROLE SPECIALISE — QUESTIONS PRODUIT:
Tu es l'assistant dedie aux questions produit, disponibilite et recommandations pour "${clientConfig.client.brand_name}".

REGLES ANTI-HALLUCINATION (CRITIQUES):
- Tu ne cites JAMAIS un nom de produit, un prix, une variante, un stock ou un SKU qui n'apparait pas dans le catalogue ci-dessous OU dans la base de connaissances du client.
- Si le catalogue ne contient pas de produit pertinent, dis-le honnetement et propose d'affiner la recherche ou d'escalader.
- Ne promets jamais une disponibilite ou un delai que tu ne peux pas verifier.`

    if (catalogContext && catalogContext.length > 0) {
      const formatted = catalogContext.map(p => {
        const price = p.price ? `${p.price} ${p.currency || ''}`.trim() : 'prix non renseigne'
        return `- ${p.title} (${price}) — ${p.url}`
      }).join('\n')
      specialization += `\n\nCATALOGUE PERTINENT (source de verite — n'invente rien au-dela):\n${formatted}`
    } else {
      specialization += `\n\nCATALOGUE PERTINENT: aucun produit retourne pour cette requete (pas de connexion Shopify OU aucun resultat). Reponds en te basant UNIQUEMENT sur la base de connaissances du client, ou demande des precisions.`
    }

    return base + specialization
  },

  async run({ supabase, clientConfig, clientId, normalized, conversationHistory, memoryContext, classification, visionContext }) {
    let catalogContext = []
    const toolsUsed = []

    if (!normalized?._is_test) {
      try {
        const query = extractProductQuery(normalized?.message || '')
        if (query && query.length >= 2) {
          const products = await searchShopifyProducts(supabase, { clientId, query, limit: 5 })
          if (products && products.length > 0) {
            catalogContext = products
            toolsUsed.push('search_products')
          }
        }
      } catch (err) {
        console.error('[product-agent] searchShopifyProducts error:', err.message)
      }
    }

    let systemPrompt = this.buildSystemPrompt(clientConfig, memoryContext, catalogContext)
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
