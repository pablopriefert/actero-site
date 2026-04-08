import React, { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FlaskConical, Send, Loader2, Trash2, User, Bot,
  AlertTriangle, CheckCircle2, RotateCcw, Zap, Star,
  ThumbsUp, ThumbsDown, ChevronRight, Sparkles, Clock,
  ShoppingBag, Frown, HelpCircle, Tag, MessageCircle,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../ui/Toast'

const SCENARIOS = [
  {
    id: 'suivi',
    label: 'Suivi commande',
    icon: ShoppingBag,
    color: 'bg-blue-50 text-blue-600 border-blue-200',
    messages: [
      "Bonjour, je n'ai toujours pas recu ma commande passee il y a 8 jours. Pouvez-vous me donner un suivi ?",
      "Mon numero de commande est #4521.",
      "Ca fait quand meme long, vous pouvez verifier avec le transporteur ?",
    ],
  },
  {
    id: 'remboursement',
    label: 'Remboursement',
    icon: Tag,
    color: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    messages: [
      "Je souhaite me faire rembourser ma commande #12345. Le produit ne correspond pas a la description.",
      "J'ai commande une taille M mais j'ai recu du S. Et la couleur est differente aussi.",
      "Je veux un remboursement complet, pas un echange.",
    ],
  },
  {
    id: 'mecontent',
    label: 'Client mecontent',
    icon: Frown,
    color: 'bg-red-50 text-red-600 border-red-200',
    messages: [
      "C'est inadmissible ! Ca fait 3 semaines que j'attends et personne ne me repond !",
      "Je vais laisser un avis 1 etoile partout si ca continue comme ca.",
      "Vous allez faire quoi concretement pour me dedommager ?",
    ],
  },
  {
    id: 'info',
    label: 'Question produit',
    icon: HelpCircle,
    color: 'bg-violet-50 text-violet-600 border-violet-200',
    messages: [
      "Bonjour, est-ce que le serum hydratant convient aux peaux sensibles ?",
      "Et il y a combien de ml dans le flacon ? C'est pour combien de temps d'utilisation ?",
      "Parfait, et vous avez un code promo en ce moment ?",
    ],
  },
  {
    id: 'promo',
    label: 'Code promo',
    icon: Sparkles,
    color: 'bg-amber-50 text-amber-600 border-amber-200',
    messages: [
      "J'ai un code promo BIENVENUE20 mais il ne fonctionne pas sur mon panier.",
      "J'ai 3 articles dans le panier. Le code dit 'non valide'.",
      "Ok merci, et il y a des codes qui marchent en ce moment ?",
    ],
  },
]

export const ConversationSimulator = ({ clientId, clientType, theme }) => {
  const toast = useToast()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeScenario, setActiveScenario] = useState(null)
  const [scenarioStep, setScenarioStep] = useState(0)
  const [scores, setScores] = useState([])
  const [scoring, setScoring] = useState(false)
  const chatEndRef = useRef(null)
  const inputRef = useRef(null)

  // Fetch client config for context
  const { data: clientConfig } = useQuery({
    queryKey: ['simulator-config', clientId],
    queryFn: async () => {
      const [settingsRes, guardrailsRes, kbRes] = await Promise.all([
        supabase.from('client_settings').select('brand_tone, brand_language, return_policy, excluded_products, custom_instructions, greeting_template, brand_context').eq('client_id', clientId).maybeSingle(),
        supabase.from('client_guardrails').select('rule_text').eq('client_id', clientId).eq('is_enabled', true),
        supabase.from('client_knowledge_base').select('title, content, category').eq('client_id', clientId).limit(20),
      ])
      return {
        settings: settingsRes.data || {},
        guardrails: (guardrailsRes.data || []).map(g => g.rule_text),
        knowledge: (kbRes.data || []).map(k => `[${k.category}] ${k.title}: ${k.content}`).join('\n'),
      }
    },
    enabled: !!clientId,
  })

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text) => {
    if (!text.trim() || loading) return
    const userMsg = { role: 'user', content: text.trim() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const s = clientConfig?.settings || {}
      const systemPrompt = buildSystemPrompt(s, clientConfig?.guardrails || [], clientConfig?.knowledge || '')

      const res = await fetch('/api/simulator-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          prompt: text.trim(),
          systemPrompt,
          history: messages.map(m => ({ role: m.role, content: m.content })),
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur API')
      const rawResponse = data.text || "Je n'ai pas pu generer une reponse."
      const aiResponse = rawResponse
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/^#+\s/gm, '')
        .replace(/^-\s/gm, '• ')
        .replace(/`([^`]+)`/g, '$1')

      const guardrailTriggered = clientConfig?.guardrails?.some(rule =>
        aiResponse.toLowerCase().includes('escalad') || aiResponse.toLowerCase().includes('humain')
      )

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: aiResponse,
        guardrailTriggered,
      }])

      // Auto-score the response
      scoreResponse(text.trim(), aiResponse)

    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Erreur: impossible de generer la reponse. Verifiez que ANTHROPIC_API_KEY est configure sur Vercel.",
        error: true,
      }])
    }
    setLoading(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const scoreResponse = async (question, answer) => {
    setScoring(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/simulator-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          prompt: `Evalue cette reponse d'agent IA. Reponds UNIQUEMENT en JSON valide:
{"pertinence": 1-5, "ton": 1-5, "escalade_correcte": true/false, "suggestion": "une phrase courte"}

Question client: "${question}"
Reponse agent: "${answer}"
Ton attendu: ${clientConfig?.settings?.brand_tone || 'professionnel'}`,
          systemPrompt: 'Tu es un evaluateur de qualite pour un service client IA. Note la reponse sur 5 criteres. Reponds uniquement en JSON valide, sans markdown.',
          history: [],
        }),
      })
      const data = await res.json()
      if (res.ok && data.text) {
        try {
          const score = JSON.parse(data.text)
          setScores(prev => [...prev, score])
        } catch {}
      }
    } catch {}
    setScoring(false)
  }

  const startScenario = (scenario) => {
    setActiveScenario(scenario)
    setScenarioStep(0)
    setMessages([])
    setScores([])
    sendMessage(scenario.messages[0])
    setScenarioStep(1)
  }

  const continueScenario = () => {
    if (!activeScenario || scenarioStep >= activeScenario.messages.length) return
    sendMessage(activeScenario.messages[scenarioStep])
    setScenarioStep(prev => prev + 1)
  }

  const clearChat = () => {
    setMessages([])
    setInput('')
    setScores([])
    setActiveScenario(null)
    setScenarioStep(0)
  }

  const avgScore = scores.length > 0
    ? ((scores.reduce((s, sc) => s + (sc.pertinence || 3) + (sc.ton || 3), 0) / (scores.length * 2))).toFixed(1)
    : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <FlaskConical className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[#262626]">Tester l'agent</h2>
            <p className="text-sm text-[#716D5C]">Simulez des conversations clients pour verifier les reponses de votre agent</p>
          </div>
        </div>
      </div>

      {/* Scenarios */}
      {messages.length === 0 && (
        <div>
          <p className="text-[10px] font-bold text-[#716D5C] uppercase tracking-wider mb-3">
            Choisir un scenario de test
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {SCENARIOS.map(scenario => {
              const Icon = scenario.icon
              return (
                <button
                  key={scenario.id}
                  onClick={() => startScenario(scenario)}
                  className="flex items-center gap-3 p-4 bg-white border border-gray-100 rounded-xl hover:border-gray-200 hover:shadow-sm transition-all text-left group"
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center border ${scenario.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-[#262626]">{scenario.label}</p>
                    <p className="text-[11px] text-[#716D5C]">{scenario.messages.length} messages</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#716D5C] transition-colors" />
                </button>
              )
            })}
          </div>

          <div className="mt-4 p-3 rounded-xl bg-[#F9F7F1] border border-gray-100">
            <p className="text-xs text-[#716D5C] text-center">
              Ou tapez directement un message ci-dessous pour un test libre
            </p>
          </div>
        </div>
      )}

      {/* Score Bar */}
      {scores.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 p-4 bg-white border border-gray-100 rounded-xl"
        >
          <div className="flex items-center gap-2">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
              avgScore >= 4 ? 'bg-emerald-100 text-emerald-700' : avgScore >= 3 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
            }`}>
              {avgScore}
            </div>
            <div>
              <p className="text-xs font-bold text-[#262626]">Score qualite</p>
              <p className="text-[10px] text-[#716D5C]">{scores.length} reponse{scores.length > 1 ? 's' : ''} evaluee{scores.length > 1 ? 's' : ''}</p>
            </div>
          </div>

          <div className="flex-1 flex gap-3">
            {scores[scores.length - 1] && (
              <>
                <div className="flex items-center gap-1.5 px-2 py-1 bg-[#F5F5F0] rounded-lg">
                  <Star className="w-3 h-3 text-[#716D5C]" />
                  <span className="text-[10px] text-[#262626] font-medium">Pertinence: {scores[scores.length - 1].pertinence}/5</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 bg-[#F5F5F0] rounded-lg">
                  <MessageCircle className="w-3 h-3 text-[#716D5C]" />
                  <span className="text-[10px] text-[#262626] font-medium">Ton: {scores[scores.length - 1].ton}/5</span>
                </div>
                {scores[scores.length - 1].suggestion && (
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 rounded-lg flex-1 min-w-0">
                    <Sparkles className="w-3 h-3 text-blue-600 flex-shrink-0" />
                    <span className="text-[10px] text-blue-700 truncate">{scores[scores.length - 1].suggestion}</span>
                  </div>
                )}
              </>
            )}
          </div>

          {scoring && <Loader2 className="w-4 h-4 animate-spin text-[#716D5C]" />}
        </motion.div>
      )}

      {/* Chat area */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        {/* Scenario progress */}
        {activeScenario && (
          <div className="px-5 py-3 bg-[#F9F7F1] border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#0F5F35]" />
              <span className="text-xs font-bold text-[#262626]">Scenario : {activeScenario.label}</span>
              <span className="text-[10px] text-[#716D5C]">— Message {Math.min(scenarioStep, activeScenario.messages.length)}/{activeScenario.messages.length}</span>
            </div>
            {scenarioStep < activeScenario.messages.length && !loading && (
              <button
                onClick={continueScenario}
                className="flex items-center gap-1 px-3 py-1.5 bg-[#0F5F35] text-white text-xs font-bold rounded-full hover:bg-[#003725] transition-colors"
              >
                Message suivant
                <ChevronRight className="w-3 h-3" />
              </button>
            )}
            {scenarioStep >= activeScenario.messages.length && (
              <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Scenario termine
              </span>
            )}
          </div>
        )}

        {/* Messages */}
        <div className="h-[400px] overflow-y-auto p-5 space-y-4">
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full text-[#716D5C] text-sm">
              Choisissez un scenario ou envoyez un message
            </div>
          )}

          <AnimatePresence>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    msg.error ? 'bg-red-50' : msg.guardrailTriggered ? 'bg-amber-50' : 'bg-[#003725]/10'
                  }`}>
                    <Bot className={`w-4 h-4 ${
                      msg.error ? 'text-red-500' : msg.guardrailTriggered ? 'text-amber-600' : 'text-[#003725]'
                    }`} />
                  </div>
                )}

                <div className={`max-w-[75%] ${msg.role === 'user' ? 'order-first' : ''}`}>
                  <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[#003725] text-white rounded-tr-md'
                      : msg.error
                        ? 'bg-red-50 text-red-700 border border-red-200 rounded-tl-md'
                        : 'bg-[#F5F5F0] text-[#262626] rounded-tl-md'
                  }`}>
                    {msg.content}
                  </div>
                  {msg.guardrailTriggered && (
                    <div className="flex items-center gap-1 mt-1.5 text-[10px] text-amber-600 font-medium">
                      <AlertTriangle className="w-3 h-3" />
                      Regle d'escalade declenchee
                    </div>
                  )}
                </div>

                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-[#716D5C]" />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#003725]/10 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-[#003725]" />
              </div>
              <div className="px-4 py-3 bg-[#F5F5F0] rounded-2xl rounded-tl-md">
                <Loader2 className="w-4 h-4 animate-spin text-[#716D5C]" />
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-100 p-4">
          <div className="flex gap-2">
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                className="p-3 rounded-xl text-[#716D5C] hover:bg-gray-50 hover:text-red-500 transition-colors"
                title="Recommencer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage(input)}
              placeholder="Tapez un message client..."
              disabled={loading}
              className="flex-1 px-4 py-3 bg-[#F5F5F0] border border-gray-200 rounded-xl text-sm text-[#262626] outline-none focus:ring-1 focus:ring-gray-300 placeholder-gray-400 disabled:opacity-50"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className="px-4 py-3 bg-[#0F5F35] text-white rounded-xl hover:bg-[#003725] transition-colors disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Config status */}
      {clientConfig && (
        <div className="flex flex-wrap gap-3 text-[10px] text-[#716D5C]">
          <span className="flex items-center gap-1 px-2 py-1 bg-white border border-gray-100 rounded-lg">
            <CheckCircle2 className="w-3 h-3 text-[#003725]" />
            Ton: {clientConfig.settings?.brand_tone || 'par defaut'}
          </span>
          <span className="flex items-center gap-1 px-2 py-1 bg-white border border-gray-100 rounded-lg">
            <CheckCircle2 className="w-3 h-3 text-[#003725]" />
            {clientConfig.guardrails?.length || 0} regles actives
          </span>
          <span className="flex items-center gap-1 px-2 py-1 bg-white border border-gray-100 rounded-lg">
            <CheckCircle2 className="w-3 h-3 text-[#003725]" />
            Langue: {clientConfig.settings?.brand_language || 'fr'}
          </span>
        </div>
      )}
    </div>
  )
}

function buildSystemPrompt(settings, guardrails, knowledge) {
  let prompt = `Tu es un agent de support client IA. Tu reponds aux demandes des clients de maniere ${settings.brand_tone || 'professionnelle et chaleureuse'}.`

  if (settings.brand_language && settings.brand_language !== 'fr') {
    prompt += ` Reponds en ${settings.brand_language === 'en' ? 'anglais' : settings.brand_language === 'es' ? 'espagnol' : settings.brand_language === 'de' ? 'allemand' : settings.brand_language}.`
  }

  if (settings.greeting_template) {
    prompt += `\n\nMessage d'accueil: "${settings.greeting_template}"`
  }

  if (settings.return_policy) {
    prompt += `\n\nPolitique de retour:\n${settings.return_policy}`
  }

  if (settings.excluded_products) {
    prompt += `\n\nRegles speciales produits:\n${settings.excluded_products}`
  }

  if (settings.custom_instructions) {
    prompt += `\n\nInstructions supplementaires:\n${settings.custom_instructions}`
  }

  if (guardrails.length > 0) {
    prompt += `\n\nREGLES D'EXCLUSION (a respecter absolument):\n${guardrails.map((r, i) => `${i + 1}. ${r}`).join('\n')}`
  }

  if (knowledge) {
    prompt += `\n\nBASE DE CONNAISSANCES:\n${knowledge}`
  }

  prompt += `\n\nREGLES DE FORMAT:\n- Reponds en texte brut uniquement, PAS de markdown (pas de **, pas de #, pas de backticks)\n- Pas d'emoji sauf si le ton de marque le demande\n- Reponses courtes et claires (max 3-4 phrases)\n- Si tu ne peux pas repondre ou si une regle d'exclusion s'applique, indique que tu escalades vers un humain.`

  return prompt
}
