import React, { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FlaskConical, Send, Loader2, User, Bot, Zap,
  AlertTriangle, CheckCircle2, RotateCcw, Play,
  ShoppingBag, Mail, Headphones, MessageSquare,
  Gift, Shield, Star, Heart, Search, TrendingUp,
  Package, Clock, ArrowRight, Eye, Rocket,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../ui/Toast'

/* ═══════════ PLAYBOOK TEST SCENARIOS ═══════════ */

const PLAYBOOK_ICONS = {
  sav_ecommerce: Headphones,
  abandoned_cart: ShoppingBag,
  shipping_tracker: Package,
  order_issue_handler: AlertTriangle,
  promo_code_handler: Gift,
  vip_customer_care: Star,
  anti_churn: Shield,
  post_purchase_followup: Mail,
  winback_inactive: TrendingUp,
  review_collector: MessageSquare,
  support_technique: Headphones,
}

const PLAYBOOK_TESTS = {
  sav_ecommerce: [
    { label: 'Suivi commande', message: "Bonjour, ou en est ma commande #4521 ? Ca fait 8 jours que j'attends.", event_type: 'email_inbound' },
    { label: 'Retour produit', message: "Je voudrais retourner le sérum que j'ai reçu. Il ne convient pas à ma peau.", event_type: 'email_inbound' },
    { label: 'Client agressif', message: "C'est INADMISSIBLE ! 3 semaines sans réponse ! Je vais porter plainte !", event_type: 'email_inbound' },
    { label: 'Question produit', message: "Est-ce que le serum hydratant convient aux peaux sensibles ?", event_type: 'widget_message' },
  ],
  abandoned_cart: [
    { label: 'Panier 50€', message: 'Panier abandonné', event_type: 'shopify_abandoned_cart', metadata: { total_price: '49.90', line_items: [{ title: 'Serum Hydratant', quantity: 1, price: '49.90' }] } },
    { label: 'Panier 150€ multi-articles', message: 'Panier abandonné', event_type: 'shopify_abandoned_cart', metadata: { total_price: '149.70', line_items: [{ title: 'Serum', quantity: 1, price: '49.90' }, { title: 'Creme jour', quantity: 2, price: '49.90' }] } },
  ],
  shipping_tracker: [
    { label: 'Ou est mon colis ?', message: "Bonjour, je n'ai toujours pas recu mon colis. Commande #4521.", event_type: 'email_inbound' },
    { label: 'Delai de livraison', message: "Combien de temps pour recevoir ma commande ?", event_type: 'widget_message' },
    { label: 'Changement adresse', message: "Je veux changer l'adresse de livraison de ma commande #4521.", event_type: 'email_inbound' },
  ],
  order_issue_handler: [
    { label: 'Colis endommage', message: "J'ai recu mon colis mais il etait completement ecrase. Les produits sont casses.", event_type: 'email_inbound' },
    { label: 'Article manquant', message: "Il manque un article dans ma commande #4521. J'avais commande 3 produits mais n'en ai recu que 2.", event_type: 'email_inbound' },
    { label: 'Erreur expedition', message: "J'ai recu la mauvaise commande. Ce n'est pas ce que j'avais commande.", event_type: 'email_inbound' },
  ],
  promo_code_handler: [
    { label: 'Code invalide', message: "Mon code promo BIENVENUE20 ne fonctionne pas. Il dit 'code invalide'.", event_type: 'email_inbound' },
    { label: 'Code expire', message: "J'ai un code promo de la semaine derniere mais il est marque comme expire.", event_type: 'widget_message' },
    { label: 'Demande de code', message: "Est-ce que vous avez des codes promo en ce moment ?", event_type: 'widget_message' },
  ],
  vip_customer_care: [
    { label: 'VIP suivi commande', message: "Bonjour, j'ai passe une commande de 350€ et je n'ai pas de nouvelles.", event_type: 'email_inbound' },
    { label: 'VIP reclamation', message: "Je suis client depuis 2 ans et c'est la premiere fois que j'ai un probleme. Le produit ne correspond pas.", event_type: 'email_inbound' },
  ],
  anti_churn: [
    { label: 'Menace de partir', message: "Franchement je suis tres decu. Si ca continue je vais aller chez un concurrent.", event_type: 'email_inbound' },
    { label: 'Insatisfaction', message: "La qualite a vraiment baisse ces derniers temps. C'est pas normal pour le prix.", event_type: 'email_inbound' },
  ],
  post_purchase_followup: [
    { label: 'Commande livree', message: 'Commande livree', event_type: 'shopify_order', metadata: { order_number: '4521', total_price: '89.90' } },
  ],
  winback_inactive: [
    { label: 'Client inactif 60j', message: 'Client inactif depuis 60 jours', event_type: 'schedule', metadata: { days_inactive: 60 } },
  ],
  review_collector: [
    { label: 'Demande avis J+7', message: 'Commande livree depuis 7 jours', event_type: 'shopify_order', metadata: { days_since_delivery: 7 } },
  ],
  support_technique: [
    { label: 'Bug report', message: "Le bouton 'Ajouter au panier' ne fonctionne plus sur mobile depuis ce matin.", event_type: 'email_inbound' },
    { label: 'Question technique', message: "Comment je peux integrer votre widget sur mon site WordPress ?", event_type: 'widget_message' },
  ],
}

/* ═══════════ COMPONENT ═══════════ */

export const ConversationSimulator = ({ clientId, clientType, theme }) => {
  const toast = useToast()
  const [selectedPlaybook, setSelectedPlaybook] = useState(null)
  const [testResults, setTestResults] = useState([])
  const [testing, setTesting] = useState(false)
  const [testingAll, setTestingAll] = useState(false)
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef(null)

  // Fetch playbooks
  const { data: playbooks = [] } = useQuery({
    queryKey: ['playbooks-for-test'],
    queryFn: async () => {
      const { data } = await supabase.from('engine_playbooks').select('*').eq('is_active', true).order('display_name')
      return data || []
    },
  })

  // Fetch client's active playbooks
  const { data: clientPlaybooks = [] } = useQuery({
    queryKey: ['client-playbooks-test', clientId],
    queryFn: async () => {
      const { data } = await supabase.from('engine_client_playbooks').select('playbook_id').eq('client_id', clientId).eq('is_active', true)
      return (data || []).map(cp => cp.playbook_id)
    },
    enabled: !!clientId,
  })

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  // Test a single scenario via the Engine Gateway
  const runTest = async (playbook, scenario) => {
    const startTime = Date.now()
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/engine/gateway', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          client_id: clientId,
          event_type: scenario.event_type,
          source: scenario.event_type,
          customer_email: 'test@actero-test.com',
          customer_name: 'Client Test',
          message: scenario.message,
          subject: scenario.label,
          ...(scenario.metadata || {}),
        }),
      })
      const data = await res.json()
      return {
        playbook: playbook.display_name,
        scenario: scenario.label,
        status: res.ok ? (data.status || 'ok') : 'error',
        classification: data.classification,
        confidence: data.confidence,
        response: data.response,
        stepsExecuted: data.steps_executed,
        durationMs: data.duration_ms || (Date.now() - startTime),
        error: data.error,
      }
    } catch (err) {
      return {
        playbook: playbook.display_name,
        scenario: scenario.label,
        status: 'error',
        error: err.message,
        durationMs: Date.now() - startTime,
      }
    }
  }

  // Test all scenarios for a playbook
  const testPlaybook = async (playbook) => {
    const scenarios = PLAYBOOK_TESTS[playbook.name] || []
    if (scenarios.length === 0) {
      toast.info('Aucun scenario de test pour ce playbook')
      return
    }

    setTesting(true)
    setSelectedPlaybook(playbook.id)
    setTestResults([])

    for (const scenario of scenarios) {
      const result = await runTest(playbook, scenario)
      setTestResults(prev => [...prev, result])
    }

    setTesting(false)
    toast.success(`${scenarios.length} tests executes pour "${playbook.display_name}"`)
  }

  // Test ALL active playbooks
  const testAllPlaybooks = async () => {
    setTestingAll(true)
    setTestResults([])
    setSelectedPlaybook(null)

    for (const playbook of playbooks.filter(p => clientPlaybooks.includes(p.id))) {
      const scenarios = PLAYBOOK_TESTS[playbook.name] || []
      for (const scenario of scenarios) {
        const result = await runTest(playbook, scenario)
        setTestResults(prev => [...prev, result])
      }
    }

    setTestingAll(false)
    toast.success('Tous les playbooks testes')
  }

  // Free chat with the simulator
  const sendChat = async (text) => {
    if (!text.trim() || chatLoading) return
    const userMsg = { role: 'user', content: text.trim() }
    setChatMessages(prev => [...prev, userMsg])
    setChatInput('')
    setChatLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/simulator-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          prompt: text.trim(),
          systemPrompt: null, // Uses default from client config
          history: chatMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json()
      const response = (data.text || '').replace(/\*\*/g, '').replace(/\*/g, '').replace(/^#+\s/gm, '').trim()
      setChatMessages(prev => [...prev, { role: 'assistant', content: response || 'Pas de reponse.' }])
    } catch {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Erreur lors du test.', error: true }])
    }
    setChatLoading(false)
  }

  const activePlaybooks = playbooks.filter(p => clientPlaybooks.includes(p.id))
  const inactivePlaybooks = playbooks.filter(p => !clientPlaybooks.includes(p.id))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <FlaskConical className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[#1a1a1a]">Tester</h2>
            <p className="text-sm text-[#71717a]">Testez chaque playbook avec des scenarios reels avant de les mettre en production</p>
          </div>
        </div>
        {activePlaybooks.length > 0 && (
          <button
            onClick={testAllPlaybooks}
            disabled={testingAll}
            className="flex items-center gap-2 px-4 py-2 bg-cta text-white text-sm font-bold rounded-full hover:bg-[#003725] disabled:opacity-50"
          >
            {testingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
            Tester tous les playbooks actifs
          </button>
        )}
      </div>

      {/* Active Playbooks to test */}
      {activePlaybooks.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-[#71717a] uppercase tracking-wider mb-3">
            Playbooks actifs ({activePlaybooks.length})
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {activePlaybooks.map(playbook => {
              const Icon = PLAYBOOK_ICONS[playbook.name] || Zap
              const scenarios = PLAYBOOK_TESTS[playbook.name] || []
              const results = testResults.filter(r => r.playbook === playbook.display_name)
              const passed = results.filter(r => r.status === 'completed' || r.status === 'needs_review').length
              const failed = results.filter(r => r.status === 'error' || r.status === 'failed').length
              const isTesting = testing && selectedPlaybook === playbook.id

              return (
                <button
                  key={playbook.id}
                  onClick={() => testPlaybook(playbook)}
                  disabled={testing || testingAll}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    results.length > 0 && failed === 0 ? 'border-emerald-200 bg-emerald-50/50' :
                    results.length > 0 && failed > 0 ? 'border-red-200 bg-red-50/50' :
                    'border-gray-100 hover:border-cta hover:shadow-sm'
                  } disabled:opacity-50`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="w-4 h-4 text-cta" />
                    <span className="font-bold text-sm text-[#1a1a1a]">{playbook.display_name}</span>
                    {isTesting && <Loader2 className="w-3.5 h-3.5 animate-spin text-cta ml-auto" />}
                  </div>
                  <p className="text-xs text-[#71717a] mb-2">{scenarios.length} scenario{scenarios.length > 1 ? 's' : ''} de test</p>
                  {results.length > 0 && (
                    <div className="flex gap-2">
                      {passed > 0 && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">{passed} OK</span>}
                      {failed > 0 && <span className="text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">{failed} erreur{failed > 1 ? 's' : ''}</span>}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Inactive playbooks */}
      {inactivePlaybooks.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-[#71717a] uppercase tracking-wider mb-2">Playbooks inactifs (activez-les dans Playbooks pour les tester)</p>
          <div className="flex flex-wrap gap-2">
            {inactivePlaybooks.map(p => (
              <span key={p.id} className="px-3 py-1.5 bg-gray-100 rounded-lg text-xs text-[#71717a]">{p.display_name}</span>
            ))}
          </div>
        </div>
      )}

      {/* Test Results */}
      {testResults.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-cta" />
              <p className="font-bold text-sm text-[#1a1a1a]">Resultats ({testResults.length} tests)</p>
            </div>
            <div className="flex gap-2 text-xs">
              <span className="text-emerald-600 font-bold">{testResults.filter(r => r.status === 'completed').length} auto</span>
              <span className="text-amber-600 font-bold">{testResults.filter(r => r.status === 'needs_review').length} review</span>
              <span className="text-red-600 font-bold">{testResults.filter(r => r.status === 'error' || r.status === 'failed').length} erreur</span>
            </div>
          </div>
          <div className="divide-y divide-gray-50 max-h-[400px] overflow-y-auto">
            {testResults.map((result, i) => (
              <TestResultRow key={i} result={result} />
            ))}
          </div>
        </div>
      )}

      {/* Separator */}
      <div className="border-t border-gray-200 pt-6">
        <p className="text-[10px] font-bold text-[#71717a] uppercase tracking-wider mb-3">Test libre — discutez avec votre agent</p>
      </div>

      {/* Free Chat */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="h-[300px] overflow-y-auto p-5 space-y-4">
          {chatMessages.length === 0 && (
            <div className="flex items-center justify-center h-full text-[#71717a] text-sm">
              Tapez un message pour tester votre agent en mode libre
            </div>
          )}
          {chatMessages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-lg bg-[#003725]/10 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-[#003725]" />
                </div>
              )}
              <div className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user' ? 'bg-[#003725] text-white rounded-tr-md' :
                msg.error ? 'bg-red-50 text-red-700 border border-red-200 rounded-tl-md' :
                'bg-[#F5F5F0] text-[#1a1a1a] rounded-tl-md'
              }`}>
                {msg.content}
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-[#71717a]" />
                </div>
              )}
            </div>
          ))}
          {chatLoading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#003725]/10 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-[#003725]" />
              </div>
              <div className="px-4 py-3 bg-[#F5F5F0] rounded-2xl rounded-tl-md">
                <Loader2 className="w-4 h-4 animate-spin text-[#71717a]" />
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
        <div className="border-t border-gray-100 p-4 flex gap-2">
          {chatMessages.length > 0 && (
            <button onClick={() => setChatMessages([])} className="p-3 rounded-xl text-[#71717a] hover:bg-gray-50 hover:text-red-500">
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendChat(chatInput)}
            placeholder="Tapez un message client..."
            disabled={chatLoading}
            className="flex-1 px-4 py-3 bg-[#F5F5F0] border border-gray-200 rounded-xl text-sm text-[#1a1a1a] outline-none focus:ring-1 focus:ring-gray-300 disabled:opacity-50"
          />
          <button onClick={() => sendChat(chatInput)} disabled={!chatInput.trim() || chatLoading}
            className="px-4 py-3 bg-cta text-white rounded-xl hover:bg-[#003725] disabled:opacity-50">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

/* ═══════════ TEST RESULT ROW ═══════════ */

const TestResultRow = ({ result }) => {
  const [expanded, setExpanded] = useState(false)
  const statusColor = {
    completed: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    needs_review: 'bg-amber-50 text-amber-600 border-amber-200',
    no_playbook: 'bg-gray-50 text-gray-600 border-gray-200',
    error: 'bg-red-50 text-red-600 border-red-200',
    failed: 'bg-red-50 text-red-600 border-red-200',
  }

  return (
    <div>
      <button onClick={() => setExpanded(!expanded)} className="w-full p-3 flex items-center gap-3 text-left hover:bg-gray-50">
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusColor[result.status] || statusColor.error}`}>
          {result.status === 'completed' ? 'OK' : result.status === 'needs_review' ? 'Review' : result.status === 'no_playbook' ? 'Pas actif' : 'Erreur'}
        </span>
        <span className="text-xs font-bold text-[#1a1a1a]">{result.playbook}</span>
        <span className="text-xs text-[#71717a]">→ {result.scenario}</span>
        {result.classification && <span className="text-[10px] text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full ml-auto">{result.classification}</span>}
        {result.confidence && <span className="text-[10px] text-[#71717a]">{Math.round(result.confidence * 100)}%</span>}
        <span className="text-[10px] text-[#71717a]">{result.durationMs}ms</span>
      </button>
      {expanded && (
        <div className="px-4 pb-3 space-y-2">
          {result.response && (
            <div className="p-3 bg-emerald-50 rounded-lg">
              <p className="text-[10px] text-emerald-600 font-bold uppercase mb-1">Reponse IA</p>
              <p className="text-sm text-[#1a1a1a]">{result.response}</p>
            </div>
          )}
          {result.error && (
            <div className="p-3 bg-red-50 rounded-lg">
              <p className="text-[10px] text-red-600 font-bold uppercase mb-1">Erreur</p>
              <p className="text-sm text-red-700">{result.error}</p>
            </div>
          )}
          {result.stepsExecuted !== undefined && (
            <p className="text-xs text-[#71717a]">{result.stepsExecuted} step{result.stepsExecuted > 1 ? 's' : ''} executee{result.stepsExecuted > 1 ? 's' : ''}</p>
          )}
        </div>
      )}
    </div>
  )
}
