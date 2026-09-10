import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/**
 * Boucle d'outils du Copilot — contrat avec OpenRouter.
 *
 * Le 9 septembre 2026, la boucle d'outils du Copilot Slack parlait au SDK
 * Anthropic en direct, avec `claude-sonnet-4-5` codé en dur. Le passage à
 * OpenRouter change le format des outils dans les deux sens :
 *
 *   Anthropic            OpenRouter (format OpenAI)
 *   ────────             ──────────────────────────
 *   { name, input_schema }        { type:'function', function:{ name, parameters } }
 *   content[].type === 'tool_use' message.tool_calls[]
 *   tu.input (objet)              function.arguments (chaîne JSON)
 *   { type:'tool_result',         { role:'tool', tool_call_id, content }
 *     tool_use_id }
 *
 * Une erreur sur n'importe laquelle de ces quatre lignes ne casse pas l'appel :
 * elle produit un modèle qui ne voit pas ses outils, ou qui ne retrouve pas le
 * résultat qu'il vient de demander, et qui répond alors de mémoire. Sur un
 * copilot qui annonce des chiffres au marchand, c'est le pire mode de panne :
 * une réponse plausible et fausse.
 *
 * Aucune clé n'existe en local, donc ces tests stubent `fetch` et vérifient la
 * requête effectivement envoyée plutôt que la réponse du modèle.
 */

const OLD_ENV = { ...process.env }
let appels = []

function reponseOutil(toolCalls) {
  return {
    ok: true,
    json: async () => ({
      choices: [{ message: { content: '', tool_calls: toolCalls } }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
      model: 'anthropic/claude-sonnet-5',
    }),
  }
}
function reponseTexte(texte) {
  return {
    ok: true,
    json: async () => ({
      choices: [{ message: { content: texte } }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
      model: 'anthropic/claude-sonnet-5',
    }),
  }
}

beforeEach(() => {
  appels = []
  process.env.OPENROUTER_API_KEY = 'test-key'
  vi.stubGlobal('fetch', async (url, init) => {
    appels.push({ url, body: JSON.parse(init.body) })
    return appels.length === 1
      ? reponseOutil([{ id: 'call_1', type: 'function', function: { name: 'get_tickets_stats', arguments: '{"period":"week"}' } }])
      : reponseTexte('42 tickets cette semaine.')
  })
})
afterEach(() => {
  vi.unstubAllGlobals()
  process.env = { ...OLD_ENV }
})

describe('chatComplete — passe-plat des outils', () => {
  it('envoie les outils et remonte les tool_calls', async () => {
    const { chatComplete } = await import('./llm.js')
    const r = await chatComplete({
      messages: [{ role: 'user', content: 'combien de tickets ?' }],
      tools: [{ type: 'function', function: { name: 'get_tickets_stats', parameters: { type: 'object' } } }],
    })
    expect(appels[0].url).toContain('openrouter.ai')
    expect(appels[0].body.model).toBe('anthropic/claude-sonnet-5')
    expect(appels[0].body.tools).toHaveLength(1)
    expect(r.toolCalls).toHaveLength(1)
    expect(r.toolCalls[0].function.name).toBe('get_tickets_stats')
  })

  it('ne transmet pas de champ tools quand il n\'y en a pas', async () => {
    const { chatComplete } = await import('./llm.js')
    await chatComplete({ messages: [{ role: 'user', content: 'bonjour' }] })
    expect(appels[0].body).not.toHaveProperty('tools')
  })

  it('conserve tool_calls et tool_call_id dans l\'historique renvoyé au modèle', async () => {
    const { chatComplete } = await import('./llm.js')
    await chatComplete({
      messages: [
        { role: 'user', content: 'combien ?' },
        { role: 'assistant', content: '', tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'x', arguments: '{}' } }] },
        { role: 'tool', tool_call_id: 'call_1', content: '{"total":42}' },
      ],
    })
    const envoyes = appels[0].body.messages
    expect(envoyes[1].tool_calls[0].id).toBe('call_1')
    expect(envoyes[2].tool_call_id).toBe('call_1')
  })
})

describe('paliers de modèle', () => {
  it('le palier par défaut est Sonnet 5', async () => {
    const { chatComplete } = await import('./llm.js')
    await chatComplete({ messages: [{ role: 'user', content: 'x' }] })
    expect(appels[0].body.model).toBe('anthropic/claude-sonnet-5')
  })

  it("le palier rapide est Haiku 4.5, pas un modèle d'un autre fournisseur", async () => {
    // Le tier rapide ne doit jamais servir à ce qu'un client lit : il répond
    // à des drapeaux binaires. Mais il doit rester chez le même éditeur, sinon
    // le produit a deux politiques de données et deux factures.
    const { chatComplete } = await import('./llm.js')
    await chatComplete({ messages: [{ role: 'user', content: 'x' }], tier: 'fast' })
    expect(appels[0].body.model).toBe('anthropic/claude-haiku-4-5')
  })
})

describe('askCopilot — boucle complète', () => {
  it('exécute l\'outil demandé puis répond en texte', async () => {
    const { askCopilot } = await import('./kpi-tools.js')
    const supabaseFactice = {
      from: () => ({
        select: () => ({ eq: () => ({ gte: () => ({ lte: async () => ({ data: [], error: null }) }) }) }),
      }),
    }
    const r = await askCopilot(supabaseFactice, {
      clientId: 'c1',
      message: 'combien de tickets cette semaine ?',
      brandName: 'Test',
    })

    // Deux tours : l'appel d'outil, puis la réponse rédigée.
    expect(appels).toHaveLength(2)
    expect(r.toolCalls).toContain('get_tickets_stats')
    expect(r.reply).toBe('42 tickets cette semaine.')

    // Les outils partent bien au format OpenAI, pas au format Anthropic.
    const outils = appels[0].body.tools
    expect(outils[0]).toHaveProperty('function.parameters')
    expect(outils[0]).not.toHaveProperty('input_schema')

    // Le second tour rattache le résultat à l'appel qui l'a produit.
    const second = appels[1].body.messages
    const msgOutil = second.find((m) => m.role === 'tool')
    expect(msgOutil.tool_call_id).toBe('call_1')
  })
})
