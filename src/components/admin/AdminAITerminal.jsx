import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Loader2, Sparkles, Database, Trash2, Terminal } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const SUGGESTIONS = [
  'Combien de clients actifs par plan ?',
  'Quels sont les clients avec le plus de tickets ce mois ?',
  'Montre les dernières escalations non traitées',
  'Quel est le MRR actuel ?',
  'Quels clients Free sont proches de la limite de 50 tickets ?',
  'Liste les engine runs en erreur cette semaine',
]

export const AdminAITerminal = () => {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const sendMessage = async (text) => {
    if (!text.trim() || loading) return

    const userMsg = { role: 'user', content: text.trim() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/ai-terminal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          message: text.trim(),
          history: messages.slice(-20),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setMessages(prev => [...prev, { role: 'assistant', content: `Erreur: ${data.error}`, error: true }])
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.response,
          query: data.query_executed || null,
        }])
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Erreur réseau: ${err.message}`, error: true }])
    }

    setLoading(false)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const clearHistory = () => {
    setMessages([])
  }

  // Simple markdown-like rendering
  const renderContent = (text) => {
    // Code blocks
    const parts = text.split(/(```[\s\S]*?```)/g)
    return parts.map((part, i) => {
      if (part.startsWith('```')) {
        const code = part.replace(/```\w*\n?/, '').replace(/```$/, '')
        return (
          <pre key={i} className="bg-gray-900 text-gray-100 rounded-lg p-3 my-2 text-xs font-mono overflow-x-auto">
            {code}
          </pre>
        )
      }
      // Bold
      const formatted = part.split(/(\*\*.*?\*\*)/g).map((seg, j) => {
        if (seg.startsWith('**') && seg.endsWith('**')) {
          return <strong key={j}>{seg.slice(2, -2)}</strong>
        }
        return seg
      })
      return <span key={i}>{formatted}</span>
    })
  }

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <Terminal className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#1a1a1a]">Terminal IA</h2>
            <p className="text-xs text-[#71717a]">Claude Sonnet 4 avec contexte Actero complet</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearHistory}
            className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-[#71717a] hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" /> Effacer
          </button>
        )}
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-4 pb-4 pr-1"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-violet-500" />
            </div>
            <h3 className="text-lg font-bold text-[#1a1a1a] mb-1">Assistant Admin Actero</h3>
            <p className="text-sm text-[#71717a] mb-6 max-w-md">
              Posez des questions sur vos clients, métriques, ou l'état du système. Je peux interroger la base de données en temps réel.
            </p>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="px-3 py-2 text-xs font-medium text-[#71717a] bg-white border border-gray-200 rounded-lg hover:border-violet-300 hover:text-violet-600 transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-cta text-white rounded-br-md'
                    : msg.error
                    ? 'bg-red-50 text-red-700 border border-red-200 rounded-bl-md'
                    : 'bg-white border border-gray-200 text-[#1a1a1a] rounded-bl-md shadow-sm'
                }`}
              >
                {msg.role === 'assistant' && msg.query && (
                  <div className="flex items-center gap-1.5 text-[10px] font-medium text-violet-500 mb-2">
                    <Database className="w-3 h-3" />
                    Requête sur {msg.query.table} — {msg.query.result_count} résultat{msg.query.result_count !== 1 ? 's' : ''}
                  </div>
                )}
                <div className="whitespace-pre-wrap">{renderContent(msg.content)}</div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2 text-[#71717a]">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs">Réflexion en cours...</span>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Input */}
      <div className="pt-3 border-t border-gray-100">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Demandez quelque chose..."
              rows={1}
              className="w-full px-4 py-3 pr-12 bg-white border border-gray-200 rounded-xl text-sm text-[#1a1a1a] placeholder:text-[#71717a]/60 focus:outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100 resize-none transition-all"
              style={{ minHeight: '44px', maxHeight: '120px' }}
              onInput={(e) => {
                e.target.style.height = '44px'
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
              }}
            />
          </div>
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white flex items-center justify-center hover:from-violet-600 hover:to-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-[#71717a] mt-2 text-center">
          Claude Sonnet 4 — Lecture seule sur la base de données
        </p>
      </div>
    </div>
  )
}
