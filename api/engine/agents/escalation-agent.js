/**
 * Actero Engine V2 — Escalation Agent
 *
 * Handles complaints, aggressive customers and any classification the
 * router wants to hand directly to a human. Does NOT call Claude: it
 * returns a short holding message and flags shouldEscalate=true so the
 * downstream escalation logic in brain.js takes over.
 */

export const escalationAgent = {
  name: 'escalation',
  classifications: ['reclamation', 'aggressive', 'complaint'],
  tools: [],

  async run({ clientConfig }) {
    const brand = clientConfig?.client?.brand_name || 'notre equipe'
    const aiResponse =
      `Je transmets immediatement votre demande a un responsable de ${brand}. ` +
      `Pour que nous puissions vous recontacter rapidement, pourriez-vous me confirmer votre adresse email ?`

    return {
      aiResponse,
      shouldEscalate: true,
      escalationReason: 'escalation_agent',
      // Low sentiment by default — downstream logic will also force-escalate
      sentimentScore: 3,
      toolsUsed: [],
    }
  },
}
