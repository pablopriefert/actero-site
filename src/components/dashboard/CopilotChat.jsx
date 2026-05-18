import React, { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { formatCurrency } from '../../lib/format'
import {
  Sparkles,
  Send,
  Loader2,
  User,
  RotateCcw,
  TrendingUp,
  Clock,
  DollarSign,
  Activity,
} from 'lucide-react'

// ============================================================
// SUGGESTED PROMPTS
// ============================================================
const SUGGESTIONS = {
  ecommerce: [
    "Comment améliorer mon ROI ce mois-ci ?",
    "Quelles automatisations me recommandes-tu ?",
    "Analyse mes performances et donne-moi un plan d'action",
    "Comment réduire mon temps de traitement SAV ?",
  ],
  immobilier: [
    "Comment améliorer ma conversion de leads ?",
    "Quelles automatisations me recommandes-tu ?",
    "Analyse mes performances agence ce mois-ci",
    "Comment réduire mon temps de réponse aux prospects ?",
  ],
}

// ============================================================
// MESSAGE BUBBLE
// ============================================================
const MessageBubble = ({ message, theme }) => {
  const isLight = theme === 'light'
  const isUser = message.role === 'user'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
        isUser
          ? (isLight ? 'bg-slate-200' : 'bg-white/10')
          : (isLight ? 'bg-gradient-to-br from-violet-100 to-indigo-100 border border-violet-200' : 'bg-gradient-to-br from-violet-500/20 to-indigo-500/15 border border-violet-500/20')
      }`}>
        {isUser
          ? <User className={`w-4 h-4 ${isLight ? 'text-slate-600' : 'text-zinc-400'}`} />
          : <Sparkles className={`w-4 h-4 ${isLight ? 'text-violet-600' : 'text-violet-400'}`} />
        }
      </div>

      {/* Content */}
      <div className={`max-w-[80%] ${isUser ? 'text-right' : ''}`}>
        <p className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 ${isLight ? 'text-slate-400' : 'text-zinc-600'}`}>
          {isUser ? 'Vous' : 'Actero Copilot'}
        </p>
        <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? (isLight ? 'bg-slate-900 text-white rounded-tr-md' : 'bg-white/10 text-white rounded-tr-md')
            : (isLight ? 'bg-white border border-slate-200 text-slate-700 rounded-tl-md shadow-sm' : 'bg-[#0a0a0a] border border-white/10 text-zinc-300 rounded-tl-md')
        }`}>
          {message.content}
        </div>
      </div>
    </motion.div>
  )
}

// ============================================================
// TYPING INDICATOR
// ============================================================
const TypingIndicator = ({ theme }) => {
  const isLight = theme === 'light'
  return (
    <div className="flex gap-3">
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
        isLight ? 'bg-gradient-to-br from-violet-100 to-indigo-100 border border-violet-200' : 'bg-gradient-to-br from-violet-500/20 to-indigo-500/15 border border-violet-500/20'
      }`}>
        <Sparkles className={`w-4 h-4 ${isLight ? 'text-violet-600' : 'text-violet-400'}`} />
      </div>
      <div>
        <p className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 ${isLight ? 'text-slate-400' : 'text-zinc-600'}`}>
          Actero Copilot
        </p>
        <div className={`px-4 py-3 rounded-2xl rounded-tl-md ${
          isLight ? 'bg-white border border-slate-200 shadow-sm' : 'bg-[#0a0a0a] border border-white/10'
        }`}>
          <div className="flex items-center gap-1.5">
            {[0, 1, 2].map(i => (
              <motion.div
                key={i}
                className={`w-2 h-2 rounded-full ${isLight ? 'bg-violet-400' : 'bg-violet-500'}`}
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// DATA CONTEXT PILLS
// ============================================================
const DataPills = ({ metrics: _metrics, periodStats, theme }) => {
  const isLight = theme === 'light'
  const pills = [
    { icon: Clock, label: `${periodStats?.time_saved || 0}h économisées`, color: 'emerald' },
    { icon: DollarSign, label: `${formatCurrency(periodStats?.roi || 0)} ROI`, color: 'amber' },
    { icon: Activity, label: `${periodStats?.tasks_executed || 0} actions IA`, color: 'blue' },
  ]

  return (
    <div className="flex flex-wrap gap-2">
      {pills.map((pill, i) => (
        <div key={i} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold ${
          isLight
            ? 'bg-slate-50 border border-slate-200 text-slate-600'
            : 'bg-white/5 border border-white/10 text-zinc-400'
        }`}>
          <pill.icon className="w-3 h-3" />
          {pill.label}
        </div>
      ))}
    </div>
  )
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export const CopilotChat = ({ client, metrics, periodStats, theme }) => {
  const isLight = theme === 'light'
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const clientType = client?.client_type || 'ecommerce'
  const suggestions = SUGGESTIONS[clientType] || SUGGESTIONS.ecommerce

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading])

  const sendMessage = async (text) => {
    if (!text.trim() || loading || !client?.id) return

    const userMessage = { role: 'user', content: text.trim() }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const response = await fetch('/api/copilot-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: client.id,
          message: text.trim(),
          history: messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erreur Copilot')

      setMessages(prev => [...prev, { role: 'assistant', content: data.response }])
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Désolé, une erreur s'est produite. Réessayez dans quelques instants.\n\n(${err.message})`,
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    sendMessage(input)
  }

  const handleSuggestion = (text) => {
    sendMessage(text)
  }

  const resetChat = () => {
    setMessages([])
    setInput('')
  }

  const isEmpty = messages.length === 0

  return (
    <div className="max-w-4xl mx-auto h-full flex flex-col animate-fade-in-up" style={{ minHeight: 'calc(100vh - 120px)' }}>
      {/* Empty state / Welcome */}
      {isEmpty && (
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="text-center max-w-lg"
          >
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 ${
              isLight
                ? 'bg-gradient-to-br from-violet-100 to-indigo-100 border border-violet-200 shadow-lg shadow-violet-100'
                : 'bg-gradient-to-br from-violet-500/20 to-indigo-500/15 border border-violet-500/20 shadow-lg shadow-violet-500/5'
            }`}>
              <Sparkles className={`w-8 h-8 ${isLight ? 'text-violet-600' : 'text-violet-400'}`} />
            </div>
            <h2 className={`text-2xl font-bold mb-2 tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
              Actero Copilot
            </h2>
            <p className={`text-sm mb-2 ${isLight ? 'text-slate-500' : 'text-zinc-500'}`}>
              Votre conseiller de croissance IA. Posez vos questions sur vos performances, vos automatisations et vos opportunités.
            </p>
            <p className={`text-xs mb-8 ${isLight ? 'text-slate-400' : 'text-zinc-600'}`}>
              Le Copilot a accès à vos données en temps réel.
            </p>

            {/* Data context */}
            <div className="flex justify-center mb-8">
              <DataPills metrics={metrics} periodStats={periodStats} theme={theme} />
            </div>

            {/* Suggestions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestion(s)}
                  className={`text-left p-4 rounded-2xl border text-sm transition-all hover:scale-[1.02] ${
                    isLight
                      ? 'bg-white border-slate-200 text-slate-700 hover:border-violet-300 hover:shadow-md'
                      : 'bg-[#0a0a0a] border-white/10 text-zinc-300 hover:border-violet-500/30 hover:shadow-lg'
                  }`}
                >
                  <TrendingUp className={`w-4 h-4 mb-2 ${isLight ? 'text-violet-500' : 'text-violet-400'}`} />
                  {s}
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      )}

      {/* Messages */}
      {!isEmpty && (
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
          {/* Data context at top */}
          <div className="flex items-center justify-between">
            <DataPills metrics={metrics} periodStats={periodStats} theme={theme} />
            <button
              onClick={resetChat}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors ${
                isLight
                  ? 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                  : 'text-zinc-600 hover:text-zinc-400 hover:bg-white/5'
              }`}
            >
              <RotateCcw className="w-3 h-3" />
              Nouvelle conversation
            </button>
          </div>

          {messages.map((msg, i) => (
            <MessageBubble key={i} message={msg} theme={theme} />
          ))}
          {loading && <TypingIndicator theme={theme} />}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Input */}
      <div className={`sticky bottom-0 px-4 pb-4 pt-3 ${
        !isEmpty ? (isLight ? 'border-t border-slate-200 bg-slate-50/80 backdrop-blur-sm' : 'border-t border-white/10 bg-[#030303]/80 backdrop-blur-sm') : ''
      }`}>
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all ${
            isLight
              ? 'bg-white border-slate-200 focus-within:border-violet-300 focus-within:shadow-lg focus-within:shadow-violet-100/50'
              : 'bg-[#0a0a0a] border-white/10 focus-within:border-violet-500/30 focus-within:shadow-lg focus-within:shadow-violet-500/5'
          }`}>
            <Sparkles className={`w-4 h-4 shrink-0 ${isLight ? 'text-violet-500' : 'text-violet-400'}`} />
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Posez une question sur vos données, performances, automatisations..."
              disabled={loading}
              className={`flex-1 bg-transparent text-sm outline-none placeholder-opacity-50 ${
                isLight
                  ? 'text-slate-900 placeholder-slate-400'
                  : 'text-white placeholder-zinc-600'
              }`}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all shrink-0 ${
                input.trim() && !loading
                  ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-500/20'
                  : (isLight ? 'bg-slate-100 text-slate-400' : 'bg-white/5 text-zinc-600')
              }`}
            >
              {loading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Send className="w-4 h-4" />
              }
            </button>
          </div>
          <p className={`text-center text-[10px] mt-2 ${isLight ? 'text-slate-400' : 'text-zinc-700'}`}>
            Actero Copilot analyse vos données réelles pour ses réponses.
          </p>
        </form>
      </div>
    </div>
  )
}
