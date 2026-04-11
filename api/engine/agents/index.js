/**
 * Actero Engine V2 — Agent Registry
 *
 * Routes a given classification to the specialized agent that should
 * handle it. Each agent owns its own system prompt + toolset, which
 * keeps prompts focused and drastically reduces hallucinations compared
 * to the old monolithic brain.
 */
import { orderAgent } from './order-agent.js'
import { returnAgent } from './return-agent.js'
import { productAgent } from './product-agent.js'
import { generalAgent } from './general-agent.js'
import { escalationAgent } from './escalation-agent.js'

export const AGENTS = {
  order: orderAgent,
  return: returnAgent,
  product: productAgent,
  general: generalAgent,
  escalation: escalationAgent,
}

/**
 * Mapping classification label -> agent key.
 * Any classification not listed here falls back to the general agent.
 */
const CLASSIFICATION_MAP = {
  // Order-related
  suivi_commande: 'order',
  livraison: 'order',
  tracking: 'order',
  order_tracking: 'order',

  // Returns & refunds
  retour: 'return',
  remboursement: 'return',
  echange: 'return',
  return: 'return',
  refund: 'return',

  // Product questions
  question_produit: 'product',
  disponibilite: 'product',
  recommandation: 'product',
  product_question: 'product',

  // Escalation (angry / complaint / abusive)
  reclamation: 'escalation',
  aggressive: 'escalation',
  complaint: 'escalation',

  // General fallback
  autre: 'general',
  general: 'general',
  general_info: 'general',
  greeting: 'general',
}

/**
 * Resolve the agent that should handle a given classification.
 * Always returns a valid agent (defaults to generalAgent).
 */
export function getAgentForClassification(classification) {
  const key = CLASSIFICATION_MAP[classification] || 'general'
  return AGENTS[key] || AGENTS.general
}
