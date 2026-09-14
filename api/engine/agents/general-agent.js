/**
 * Actero Engine V2 — General Agent
 *
 * Fallback agent used when no specialized agent matches. Replicates the
 * legacy brain.js behavior so nothing regresses for "autre", "general",
 * "greeting" or unknown classifications.
 */
import { callLLM as callClaude } from '../lib/llm-client.js'
import { buildSystemPrompt } from '../lib/prompt-builder.js'
import { findUngroundedReferences } from '../lib/escalation-signals.js'
import {
  buildClaudeMessages,
  cleanMarkdown,
  CONTINUITY_REMINDER,
} from './_shared.js'

export const generalAgent = {
  name: 'general',
  classifications: ['autre', 'general', 'general_info', 'greeting'],
  tools: [],

  /**
   * Consignes que l'agent générique n'avait pas, et qui lui manquaient le plus.
   *
   * Il n'a AUCUN outil : ni consultation de commande, ni suivi transporteur.
   * C'est donc l'agent le plus exposé à l'invention, et c'est celui qui sert
   * tous les comptes en formule gratuite — donc chaque nouvelle inscription.
   * Il n'avait pourtant aucune règle anti-hallucination : elles ne vivaient que
   * dans l'agent commande (ACT-8).
   *
   * Constaté sur le banc du 9 septembre, cas 12 et 14. À « où en est ma
   * commande ? » et « j'ai commandé sous le nom de Dupont », il répondait
   * « regardez dans vos emails » ou « consultez votre espace client » — sans
   * jamais demander le numéro de commande. Il n'inventait rien, mais il
   * n'aidait pas non plus, et il donnait l'impression d'avoir cherché.
   */
  SPECIALISATION: `\n\nCE QUE TU NE PEUX PAS FAIRE (IMPORTANT):
Tu n'as accès à AUCUNE donnée de commande, de livraison ou de suivi. Tu ne peux
consulter ni commande, ni colis, ni transporteur, ni facture.

- Tu n'INVENTES JAMAIS un numéro de commande, un numéro de suivi, un
  transporteur, une date de livraison, un montant, une adresse ou un statut.
- Tu ne confirmes JAMAIS l'existence d'une commande que le client mentionne :
  tu ne peux pas la vérifier.
- Tu ne dis pas « j'ai vérifié » ni « je vois que » : tu n'as rien vérifié.

SI LE CLIENT POSE UNE QUESTION SUR UNE COMMANDE:
Dis simplement que tu as besoin de son numéro de commande et de l'email utilisé
lors de l'achat pour faire avancer sa demande. Demande-les. Ne te contente pas
de le renvoyer vers ses emails ou son espace client : c'est une façon polie de
ne pas l'aider.`,

  async run({ clientConfig, normalized, conversationHistory, memoryContext }) {
    const basePrompt = buildSystemPrompt(clientConfig) + this.SPECIALISATION + (memoryContext || '')
    const { claudeMessages, hasHistory } = buildClaudeMessages({
      conversationHistory,
      currentMessage: normalized.message,
    })
    const systemPrompt = hasHistory ? basePrompt + CONTINUITY_REMINDER : basePrompt

    const respResult = await callClaude({
      systemPrompt,
      messages: claudeMessages,
      maxTokens: 700,
    })

    const aiResponse = cleanMarkdown(respResult.response || respResult.rawText)

    // Même garde que l'agent commande, et elle compte davantage ici : cet agent
    // n'a aucune donnée, donc TOUTE référence chiffrée qu'il cite et qui ne
    // vient pas du client lui-même est nécessairement inventée.
    const ancrage = [
      normalized?.message || '',
      ...(conversationHistory || []).map((m) => m?.content || ''),
    ].join('\n')
    const inventees = findUngroundedReferences(aiResponse, ancrage)
    if (inventees.length > 0) {
      console.warn('[general-agent] références non ancrées:', inventees.join(', '))
    }

    return {
      aiResponse,
      shouldEscalate: respResult.should_escalate === true || inventees.length > 0,
      escalationReason: inventees.length > 0
        ? `references_inventees:${inventees.join(',')}`
        : (respResult.escalation_reason || null),
      ungroundedReferences: inventees,
      // `??` et non `||` : `0 || 5` transformait le sentiment le plus
      // négatif en neutre, donc en non-escalade.
      sentimentScore: respResult.sentiment_score ?? 5,
      toolsUsed: [],
      usage: respResult.usage || null,
      modelId: respResult.modelId || null,
    }
  },
}
