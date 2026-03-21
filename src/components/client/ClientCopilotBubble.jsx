import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, X, Send, Loader2, Sparkles, ArrowUp, Volume2, Square } from 'lucide-react'

const QUICK_QUESTIONS_ECOMMERCE = [
  "Comment fonctionne le SAV automatique ?",
  "Comment sont relancés les paniers abandonnés ?",
  "Pourquoi mon ROI a changé ?",
  "Comment lire mes métriques ?",
]

const QUICK_QUESTIONS_IMMOBILIER = [
  "Comment fonctionne la qualification des leads ?",
  "Comment sont planifiées les visites automatiquement ?",
  "Pourquoi mon nombre de leads qualifiés a baissé ?",
  "Comment lire mes métriques ?",
]

export const ClientCopilotBubble = ({ clientId, clientType, theme = 'dark' }) => {
  const quickQuestions = clientType === 'immobilier' ? QUICK_QUESTIONS_IMMOBILIER : QUICK_QUESTIONS_ECOMMERCE;
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [playingIdx, setPlayingIdx] = useState(null)
  const [loadingAudio, setLoadingAudio] = useState(null)
  const audioRef = useRef(null)
  const chatEndRef = useRef(null)
  const inputRef = useRef(null)
  const isLight = theme === 'light'

  const playMessage = async (text, idx) => {
    // Stop if already playing
    if (playingIdx === idx) {
      audioRef.current?.pause()
      audioRef.current = null
      setPlayingIdx(null)
      return
    }

    // Stop any current playback
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }

    setLoadingAudio(idx)
    try {
      const res = await fetch('/api/text-to-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) throw new Error('TTS error')

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio

      audio.onended = () => {
        setPlayingIdx(null)
        audioRef.current = null
        URL.revokeObjectURL(url)
      }

      audio.play()
      setPlayingIdx(idx)
    } catch {
      // Silent fail — button just won't play
    }
    setLoadingAudio(null)
  }

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (isOpen) inputRef.current?.focus()
  }, [isOpen])

  const handleSend = async (text = input) => {
    if (!text.trim() || loading || !clientId) return
    const userMsg = text.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setLoading(true)

    try {
      // Build history string from last 6 messages
      const historyStr = messages.slice(-6).map(m =>
        `${m.role === 'user' ? 'Client' : 'Actero'}: ${m.content}`
      ).join('\n')

      const res = await fetch('/api/client-copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, message: userMsg, history: historyStr }),
      })

      if (!res.ok) throw new Error('Erreur')
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: "Désolé, je rencontre un problème. Réessayez ou contactez le support via l'onglet Support & Demandes." }])
    }

    setLoading(false)
  }

  return (
    <>
      {/* Floating bubble */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-violet-600 text-white shadow-lg shadow-violet-600/30 hover:bg-violet-500 transition-colors flex items-center justify-center"
          >
            <MessageCircle className="w-6 h-6" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className={`fixed bottom-6 right-6 z-50 w-[380px] h-[520px] rounded-2xl shadow-2xl flex flex-col overflow-hidden border ${
              isLight
                ? 'bg-white border-slate-200 shadow-slate-200/50'
                : 'bg-[#0a0a0a] border-white/10 shadow-black/50'
            }`}
          >
            {/* Header */}
            <div className={`flex items-center justify-between px-4 py-3 border-b ${
              isLight ? 'border-slate-100 bg-slate-50' : 'border-white/5 bg-[#111]'
            }`}>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-violet-400" />
                </div>
                <div>
                  <h3 className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>Actero Copilot</h3>
                  <p className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>Posez-moi vos questions</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className={`p-1.5 rounded-lg transition-colors ${
                  isLight ? 'hover:bg-slate-100 text-slate-400' : 'hover:bg-white/5 text-gray-500'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {/* Welcome message */}
              {messages.length === 0 && (
                <div className="space-y-3">
                  <div className="flex gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                    </div>
                    <div className={`px-3 py-2.5 rounded-2xl rounded-bl-md text-xs leading-relaxed ${
                      isLight ? 'bg-slate-100 text-slate-700' : 'bg-white/5 text-gray-300'
                    }`}>
                      {clientType === 'immobilier'
                        ? "Bonjour ! Je suis votre assistant Actero. Je peux vous aider à comprendre vos leads, visites, métriques et répondre à vos questions sur vos automatisations immobilières."
                        : "Bonjour ! Je suis votre assistant Actero. Je peux vous aider à comprendre vos métriques SAV, paniers récupérés et répondre à vos questions sur vos automatisations e-commerce."
                      }
                    </div>
                  </div>

                  <div className="pl-9 space-y-1.5">
                    {quickQuestions.map((q, i) => (
                      <button
                        key={i}
                        onClick={() => handleSend(q)}
                        className={`block w-full text-left px-3 py-2 rounded-lg text-[11px] transition-all border ${
                          isLight
                            ? 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                            : 'bg-white/[0.02] border-white/5 text-gray-400 hover:bg-white/[0.05] hover:border-white/10'
                        }`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Chat messages */}
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : ''}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                    </div>
                  )}
                  <div>
                    <div className={`max-w-[80%] px-3 py-2.5 rounded-2xl text-xs leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-violet-600 text-white rounded-br-md'
                        : isLight
                          ? 'bg-slate-100 text-slate-700 rounded-bl-md'
                          : 'bg-white/5 text-gray-300 rounded-bl-md'
                    }`}>
                      {msg.content.split('\n').map((line, j) => (
                        <p key={j} className={j > 0 ? 'mt-1.5' : ''}>
                          {line.split('**').map((part, k) =>
                            k % 2 === 1
                              ? <strong key={k} className={msg.role === 'user' ? 'font-semibold' : `font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>{part}</strong>
                              : part
                          )}
                        </p>
                      ))}
                    </div>
                    {/* Voice button for assistant messages */}
                    {msg.role === 'assistant' && (
                      <button
                        onClick={() => playMessage(msg.content, i)}
                        disabled={loadingAudio === i}
                        className={`mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all border ${
                          playingIdx === i
                            ? 'bg-violet-500/20 border-violet-500/30 text-violet-400'
                            : loadingAudio === i
                              ? 'bg-violet-500/10 border-violet-500/20 text-violet-400'
                              : isLight
                                ? 'bg-white border-slate-200 text-slate-500 hover:bg-violet-50 hover:border-violet-300 hover:text-violet-600 shadow-sm'
                                : 'bg-white/5 border-white/10 text-gray-400 hover:bg-violet-500/10 hover:border-violet-500/20 hover:text-violet-400'
                        }`}
                      >
                        {loadingAudio === i ? (
                          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Chargement...</>
                        ) : playingIdx === i ? (
                          <><Square className="w-3.5 h-3.5" /> Arrêter</>
                        ) : (
                          <><Volume2 className="w-3.5 h-3.5" /> Écouter la réponse</>
                        )}
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}

              {/* Loading */}
              {loading && (
                <div className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-3.5 h-3.5 text-violet-400 animate-pulse" />
                  </div>
                  <div className={`px-3 py-2.5 rounded-2xl rounded-bl-md ${isLight ? 'bg-slate-100' : 'bg-white/5'}`}>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className={`px-3 py-3 border-t ${isLight ? 'border-slate-100' : 'border-white/5'}`}>
              <div className={`flex items-end rounded-xl border transition-colors ${
                isLight
                  ? 'bg-slate-50 border-slate-200 focus-within:border-violet-300'
                  : 'bg-white/5 border-white/10 focus-within:border-violet-500/40'
              }`}>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value)
                    e.target.style.height = 'auto'
                    e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px'
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                  placeholder="Posez votre question..."
                  disabled={loading}
                  rows={1}
                  className={`flex-1 bg-transparent px-3 py-2.5 text-xs outline-none resize-none max-h-[80px] disabled:opacity-30 ${
                    isLight ? 'text-slate-900 placeholder-slate-400' : 'text-white placeholder-gray-500'
                  }`}
                />
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || loading}
                  className="m-1.5 p-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-500 transition-all disabled:opacity-20 flex-shrink-0"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
