import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const CONVERSATIONS = {
  ecommerce: [
    { from: 'client', text: 'Bonjour, où en est ma commande #4521 ?' },
    { from: 'agent', agent: 'SARA', text: 'Bonjour ! Votre commande #4521 a été expédiée ce matin. Livraison prévue demain avant 13h. 📦' },
    { from: 'client', text: 'Super ! Et si je veux retourner un article ?' },
    { from: 'agent', agent: 'SARA', text: 'Pas de problème. Je génère votre étiquette de retour prépayée. Vous la recevez par email dans 2 minutes. ✅' },
    { from: 'client', text: 'Merci, vous êtes rapide !' },
    { from: 'agent', agent: 'SARA', text: "Toujours disponible 24h/24. 😊 Y a-t-il autre chose que je puisse faire pour vous ?" },
  ],
  immobilier: [
    { from: 'client', text: 'Bonjour, je cherche un T3 à Paris 11e, budget 400 000€' },
    { from: 'agent', agent: 'LÉA', text: "Bonjour ! J'ai 3 biens correspondant à votre recherche. Souhaitez-vous planifier des visites cette semaine ?" },
    { from: 'client', text: 'Oui, plutôt jeudi ou vendredi matin' },
    { from: 'agent', agent: 'LÉA', text: 'Parfait. Je vous réserve jeudi à 10h et vendredi à 9h30. Confirmation envoyée sur votre email. ✅' },
    { from: 'client', text: 'Quels documents dois-je préparer ?' },
    { from: 'agent', agent: 'LÉA', text: "Je vous envoie la liste complète par email : pièce d'identité, justificatif de revenus, et avis d'imposition. 📄" },
  ],
}

const STATS = {
  ecommerce: [
    { label: 'Tickets traités', value: '847', suffix: '/mois', color: 'emerald' },
    { label: 'Taux de résolution', value: '94', suffix: '%', color: 'emerald' },
    { label: 'Temps de réponse', value: '<2', suffix: 'sec', color: 'cyan' },
  ],
  immobilier: [
    { label: 'Prospects qualifiés', value: '312', suffix: '/mois', color: 'violet' },
    { label: 'RDV confirmés', value: '+30', suffix: '%', color: 'violet' },
    { label: 'Réponse automatique', value: '<3', suffix: 'sec', color: 'purple' },
  ],
}

export const ChatMockup = ({ vertical }) => {
  const messages = CONVERSATIONS[vertical] || CONVERSATIONS.ecommerce
  const stats = STATS[vertical] || STATS.ecommerce
  const isImmo = vertical === 'immobilier'
  const agentName = isImmo ? 'LÉA' : 'SARA'
  const agentInitials = isImmo ? 'LÉ' : 'SA'

  const [visibleCount, setVisibleCount] = useState(0)
  const [isTyping, setIsTyping] = useState(false)
  const timerRef = useRef([])

  useEffect(() => {
    // Clear previous timers
    timerRef.current.forEach(clearTimeout)
    timerRef.current = []
    setVisibleCount(0)
    setIsTyping(false)

    let delay = 400
    messages.forEach((msg, i) => {
      if (msg.from === 'agent' && i > 0) {
        // Show typing before agent message
        const t1 = setTimeout(() => setIsTyping(true), delay)
        timerRef.current.push(t1)
        delay += 900
        const t2 = setTimeout(() => {
          setIsTyping(false)
          setVisibleCount(i + 1)
        }, delay)
        timerRef.current.push(t2)
        delay += 1200
      } else {
        const t = setTimeout(() => setVisibleCount(i + 1), delay)
        timerRef.current.push(t)
        delay += 1000
      }
    })

    return () => timerRef.current.forEach(clearTimeout)
  }, [vertical])

  return (
    <div className="grid md:grid-cols-2 gap-8 items-center max-w-5xl mx-auto">
      {/* Phone mockup */}
      <div className="flex justify-center">
        <div className="w-80 bg-[#F9F7F1] rounded-[32px] border border-gray-200 overflow-hidden shadow-lg">
          {/* Status bar */}
          <div className="bg-gray-900 px-5 pt-4 pb-2 flex items-center justify-between">
            <span className="text-[11px] text-white/60 font-medium">09:41</span>
            <div className="flex gap-1.5">
              <div className="w-1 h-3 bg-white/40 rounded-full" />
              <div className="w-1 h-3 bg-white/70 rounded-full" />
              <div className="w-1 h-3 bg-white rounded-full" />
            </div>
          </div>

          {/* Chat header */}
          <div className="bg-gray-900 px-4 py-3 flex items-center gap-3 border-b border-gray-700">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-black bg-cta/20 text-[#003725]">
              {agentInitials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-[13px] font-bold leading-none mb-1">{agentName} — Agent IA</p>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cta animate-pulse" />
                <span className="text-[10px] text-gray-400">En ligne</span>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="p-4 space-y-2.5 min-h-[340px] flex flex-col justify-end bg-white">
            <AnimatePresence initial={false}>
              {messages.slice(0, visibleCount).map((msg, i) => (
                <motion.div
                  key={`${vertical}-${i}`}
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className={`flex ${msg.from === 'agent' ? 'justify-start' : 'justify-end'}`}
                >
                  <div className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-[12px] leading-relaxed border ${
                    msg.from === 'agent'
                      ? 'bg-[#F9F7F1] border-gray-200 text-gray-800 rounded-tl-sm'
                      : 'bg-cta/10 border-[#003725]/20 text-[#262626] rounded-tr-sm'
                  }`}>
                    {msg.agent && (
                      <p className="text-[9px] font-black tracking-widest uppercase mb-1 text-[#003725]">
                        {msg.agent}
                      </p>
                    )}
                    {msg.text}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Typing indicator */}
            <AnimatePresence>
              {isTyping && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="flex justify-start"
                >
                  <div className="bg-[#F9F7F1] border border-gray-200 px-4 py-3 rounded-2xl rounded-tl-sm flex gap-1 items-center">
                    {[0, 1, 2].map(i => (
                      <motion.span
                        key={i}
                        className="w-1.5 h-1.5 bg-gray-400 rounded-full block"
                        animate={{ y: [0, -4, 0] }}
                        transition={{ repeat: Infinity, duration: 0.5, delay: i * 0.12 }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Input bar */}
          <div className="bg-[#F9F7F1] px-4 py-3 flex items-center gap-3 border-t border-gray-200">
            <div className="flex-1 bg-white rounded-full px-4 py-2 border border-gray-200">
              <span className="text-[11px] text-gray-400">Tapez un message...</span>
            </div>
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-cta/10">
              <svg className="w-4 h-4 text-[#003725]" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Stats & description */}
      <div className="space-y-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] mb-3 text-[#003725]">
            En action 24h/24
          </p>
          <h3 className="text-3xl md:text-4xl font-bold text-[#262626] leading-tight mb-4">
            {isImmo
              ? <>Vos agents IA qualifient<br />chaque prospect<br /><span className="text-[#003725]">instantanément.</span></>
              : <>Votre support client<br />répond en quelques<br /><span className="text-[#003725]">secondes.</span></>
            }
          </h3>
          <p className="text-[#716D5C] font-medium leading-relaxed">
            {isImmo
              ? "L'agent LÉA qualifie, planifie et confirme automatiquement. Chaque prospect est contacté immédiatement, sans intervention humaine."
              : "L'agent SARA traite les demandes récurrentes (suivi commande, retours, remboursements) sans jamais s'arrêter. Votre équipe se concentre sur ce qui crée de la valeur."
            }
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {stats.map((stat, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-2xl p-4 text-center">
              <p className="text-2xl font-black tracking-tight text-[#262626]">
                {stat.value}<span className="text-sm font-bold text-[#716D5C]">{stat.suffix}</span>
              </p>
              <p className="text-[10px] font-bold text-[#716D5C] uppercase tracking-wider mt-1 leading-tight">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
