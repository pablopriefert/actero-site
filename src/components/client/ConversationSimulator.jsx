import React, { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FlaskConical, Send, Loader2, Trash2, User, Bot,
  AlertTriangle, CheckCircle2, RotateCcw,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

const EXAMPLE_TICKETS = [
  { label: "Suivi commande", message: "Bonjour, je n'ai toujours pas recu ma commande passee il y a 8 jours. Pouvez-vous me donner un suivi ?" },
  { label: "Demande remboursement", message: "Je souhaite me faire rembourser ma commande #12345. Le produit ne correspond pas a la description." },
  { label: "Produit defectueux", message: "Le serum que j'ai recu fait des grumeaux, ce n'est pas normal. Je veux un remplacement ou un remboursement." },
  { label: "Code promo", message: "J'ai un code promo BIENVENUE20 mais il ne fonctionne pas sur mon panier. Pouvez-vous m'aider ?" },
  { label: "Ton agressif", message: "C'est inadmissible ! Ca fait 3 semaines que j'attends ma commande et personne ne me repond ! Je vais laisser un avis 1 etoile partout !" },
]

export const ConversationSimulator = ({ clientId, clientType, theme }) => {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
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

      // Build the system prompt from client config
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
      const aiResponse = data.text || "Je n'ai pas pu generer une reponse."

      // Check if any guardrail was triggered
      const guardrailTriggered = clientConfig?.guardrails?.some(rule =>
        aiResponse.toLowerCase().includes('escalad') || aiResponse.toLowerCase().includes('humain')
      )

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: aiResponse,
        guardrailTriggered,
      }])
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Erreur: impossible de generer la reponse. Verifiez que GEMINI_API_KEY est configure.",
        error: true,
      }])
    }
    setLoading(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const clearChat = () => {
    setMessages([])
    setInput('')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <FlaskConical className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[#262626]">Simulateur de conversation</h2>
            <p className="text-sm text-[#716D5C]">Testez votre agent IA en envoyant un faux ticket client</p>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 border border-blue-200">
        <FlaskConical className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
        <div className="text-sm text-blue-800">
          <p className="font-medium mb-1">Mode sandbox</p>
          <p className="text-blue-600 text-xs">Les reponses utilisent votre configuration actuelle : ton de marque, base de connaissances, garde-fous et seuils d'escalade. Aucun ticket reel n'est cree.</p>
        </div>
      </div>

      {/* Example tickets */}
      {messages.length === 0 && (
        <div>
          <p className="text-xs font-semibold text-[#716D5C] uppercase tracking-wider mb-3">Exemples de tickets a tester</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_TICKETS.map((ex, i) => (
              <button
                key={i}
                onClick={() => sendMessage(ex.message)}
                className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium text-[#262626] hover:border-gray-300 hover:shadow-sm transition-all"
              >
                {ex.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat area */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        {/* Messages */}
        <div className="h-[400px] overflow-y-auto p-5 space-y-4">
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full text-[#716D5C] text-sm">
              Envoyez un message pour tester votre agent
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
                      Garde-fou potentiellement declenche
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
                title="Effacer la conversation"
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
              placeholder="Tapez un faux message client..."
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
            {clientConfig.guardrails?.length || 0} garde-fous actifs
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

  prompt += `\n\nSi tu ne peux pas repondre a la question ou si une regle d'exclusion s'applique, indique que tu escalades vers un humain.`

  return prompt
}
