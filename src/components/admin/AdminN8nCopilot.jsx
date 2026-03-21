import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bot, Send, Loader2, Zap, CheckCircle2, AlertTriangle,
  Play, X, Sparkles, Plus, Minus, Trash2, Copy, Power,
  Rocket, PenLine, HelpCircle, ArrowUp
} from 'lucide-react'

const SUGGESTIONS = [
  { icon: Rocket, text: "Déploie le template SAV pour un client" },
  { icon: PenLine, text: "Ajoute un node Slack au workflow SAV" },
  { icon: Plus, text: "Crée un workflow de notification email" },
  { icon: Trash2, text: "Supprime le workflow de test" },
  { icon: Power, text: "Désactive le workflow SAV Demo" },
  { icon: HelpCircle, text: "Quels workflows ont des erreurs ?" },
]

const INTENT_CONFIG = {
  modify: { label: 'Modifier', icon: PenLine, color: 'blue', confirmLabel: 'Appliquer les modifications' },
  create: { label: 'Créer', icon: Plus, color: 'emerald', confirmLabel: 'Créer le workflow' },
  duplicate: { label: 'Déployer', icon: Copy, color: 'emerald', confirmLabel: 'Déployer le workflow' },
  delete: { label: 'Supprimer', icon: Trash2, color: 'red', confirmLabel: 'Confirmer la suppression' },
  toggle: { label: 'Basculer', icon: Power, color: 'amber', confirmLabel: 'Confirmer' },
  info: { label: 'Info', icon: HelpCircle, color: 'violet', confirmLabel: null },
}

export const AdminN8nCopilot = () => {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [pendingAction, setPendingAction] = useState(null)
  const [applying, setApplying] = useState(false)
  const chatEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const addMsg = (role, content, data = null) => {
    setMessages(prev => [...prev, { role, content, data, ts: Date.now() }])
  }

  const handleSend = async (text = input) => {
    if (!text.trim() || loading) return
    const userMsg = text.trim()
    setInput('')
    addMsg('user', userMsg)
    setLoading(true)
    setPendingAction(null)

    try {
      const routerRes = await fetch('/api/n8n-copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'chat', prompt: userMsg }),
      })
      if (!routerRes.ok) throw new Error((await routerRes.json()).error || 'Erreur')
      const { intent } = await routerRes.json()

      if (intent.intent === 'info') {
        addMsg('assistant', intent.message, { type: 'info' })
      }
      else if (intent.intent === 'modify') {
        addMsg('assistant', `${intent.message}\n\nAnalyse du workflow en cours...`)
        const modRes = await fetch('/api/n8n-copilot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'modify', workflowId: intent.workflowId, prompt: intent.description }),
        })
        if (!modRes.ok) throw new Error((await modRes.json()).error || 'Erreur')
        const modData = await modRes.json()

        const diffLines = []
        if (modData.diff.added.length) diffLines.push(`+${modData.diff.added.length} node(s) : ${modData.diff.added.join(', ')}`)
        if (modData.diff.removed.length) diffLines.push(`-${modData.diff.removed.length} node(s) : ${modData.diff.removed.join(', ')}`)
        if (!modData.diff.added.length && !modData.diff.removed.length) diffLines.push('Configuration des nodes modifiée')
        diffLines.push(`${modData.diff.before} → ${modData.diff.after} nodes au total`)

        setMessages(prev => [...prev.slice(0, -1)])
        addMsg('assistant', `Voici les modifications proposées pour **${intent.workflowName || 'le workflow'}** :\n\n${diffLines.join('\n')}`, {
          type: 'modify', diff: modData.diff,
        })
        setPendingAction({ type: 'modify', workflowId: intent.workflowId, workflow: modData.modifiedWorkflow })
      }
      else if (intent.intent === 'create') {
        addMsg('assistant', `${intent.message}\n\nGénération en cours...`)
        const createRes = await fetch('/api/n8n-copilot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create', prompt: intent.description }),
        })
        if (!createRes.ok) throw new Error((await createRes.json()).error || 'Erreur')
        const createData = await createRes.json()

        setMessages(prev => [...prev.slice(0, -1)])
        addMsg('assistant', `Workflow **"${createData.preview.name}"** généré avec ${createData.preview.nodeCount} nodes :\n\n${createData.preview.nodes.map(n => `• ${n.name}`).join('\n')}`, {
          type: 'create', preview: createData.preview,
        })
        setPendingAction({ type: 'create', workflow: createData.workflow })
      }
      else if (intent.intent === 'duplicate') {
        addMsg('assistant', `${intent.message}\n\nPréparation du template...`)
        const dupRes = await fetch('/api/n8n-copilot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'duplicate', clientName: intent.clientName, clientId: intent.workflowId }),
        })
        if (!dupRes.ok) throw new Error((await dupRes.json()).error || 'Erreur')
        const dupData = await dupRes.json()

        setMessages(prev => [...prev.slice(0, -1)])
        addMsg('assistant', `Template prêt pour **${dupData.preview.clientName || 'le client'}** — ${dupData.preview.nodeCount} nodes.`, {
          type: 'duplicate', preview: dupData.preview,
        })
        setPendingAction({ type: 'duplicate', workflow: dupData.workflow })
      }
      else if (intent.intent === 'delete') {
        addMsg('assistant', intent.message, { type: 'delete', workflowName: intent.workflowName })
        setPendingAction({ type: 'delete', workflowId: intent.workflowId, workflowName: intent.workflowName })
      }
      else if (intent.intent === 'toggle') {
        addMsg('assistant', intent.message, { type: 'toggle' })
        setPendingAction({ type: 'toggle', workflowId: intent.workflowId, active: intent.activate })
      }
    } catch (err) {
      addMsg('assistant', `Erreur : ${err.message}`, { type: 'error' })
    }

    setLoading(false)
  }

  const handleConfirm = async () => {
    if (!pendingAction || applying) return
    setApplying(true)
    try {
      let result
      if (pendingAction.type === 'modify') {
        result = await fetch('/api/n8n-copilot', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'apply', workflowId: pendingAction.workflowId, workflow: pendingAction.workflow }) })
      } else if (pendingAction.type === 'create' || pendingAction.type === 'duplicate') {
        result = await fetch('/api/n8n-copilot', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'apply', workflow: pendingAction.workflow }) })
      } else if (pendingAction.type === 'delete') {
        result = await fetch('/api/n8n-copilot', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete', workflowId: pendingAction.workflowId }) })
      } else if (pendingAction.type === 'toggle') {
        result = await fetch('/api/n8n-copilot', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'toggle', workflowId: pendingAction.workflowId, active: pendingAction.active }) })
      }
      if (!result.ok) throw new Error((await result.json()).error || 'Erreur')
      const labels = { modify: 'modifié', create: 'créé', duplicate: 'déployé', delete: 'supprimé', toggle: 'mis à jour' }
      addMsg('assistant', `Workflow ${labels[pendingAction.type]} avec succès !`, { type: 'success' })
      setPendingAction(null)
    } catch (err) {
      addMsg('assistant', `Erreur : ${err.message}`, { type: 'error' })
    }
    setApplying(false)
  }

  const handleCancel = () => {
    setPendingAction(null)
    addMsg('assistant', 'Action annulée.', { type: 'info' })
  }

  const cfg = pendingAction ? INTENT_CONFIG[pendingAction.type] : null
  const isEmpty = messages.length === 0

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6">
          {/* Empty state — centered like ChatGPT */}
          {isEmpty && (
            <div className="flex flex-col items-center justify-center min-h-[50vh]">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/20 to-violet-600/10 border border-violet-500/20 flex items-center justify-center mb-6">
                <Bot className="w-7 h-7 text-violet-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Actero Copilot for n8n</h2>
              <p className="text-sm text-gray-500 mb-8 text-center max-w-md">
                Créez, modifiez, supprimez et déployez vos workflows n8n en langage naturel.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 w-full max-w-2xl">
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(s.text)}
                    className="text-left p-3 rounded-xl border border-white/5 bg-white/[0.02] text-xs text-gray-400 hover:bg-white/[0.05] hover:border-white/10 hover:text-gray-300 transition-all flex items-start gap-2.5"
                  >
                    <s.icon className="w-4 h-4 mt-0.5 text-gray-600 flex-shrink-0" />
                    <span className="leading-relaxed">{s.text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chat messages */}
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`py-4 ${i > 0 ? 'border-t border-white/[0.03]' : ''}`}
            >
              <div className="flex gap-4">
                {/* Avatar */}
                <div className="flex-shrink-0 mt-1">
                  {msg.role === 'user' ? (
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                      <span className="text-xs font-bold text-white">P</span>
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500/30 to-violet-600/20 border border-violet-500/20 flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-violet-400" />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-bold mb-1.5 ${msg.role === 'user' ? 'text-white' : 'text-violet-400'}`}>
                    {msg.role === 'user' ? 'Vous' : 'Actero Copilot'}
                  </p>
                  <div className="text-sm text-gray-300 leading-relaxed space-y-1.5">
                    {msg.content.split('\n').map((line, j) => (
                      <p key={j}>
                        {line.split('**').map((part, k) =>
                          k % 2 === 1 ? <strong key={k} className="text-white font-semibold">{part}</strong> : part
                        )}
                      </p>
                    ))}
                  </div>

                  {/* Diff badges */}
                  {msg.data?.type === 'modify' && msg.data.diff && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {msg.data.diff.added?.map((n, j) => (
                        <span key={j} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400">
                          <Plus className="w-2.5 h-2.5" /> {n}
                        </span>
                      ))}
                      {msg.data.diff.removed?.map((n, j) => (
                        <span key={j} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-500/10 border border-red-500/20 text-[10px] text-red-400">
                          <Minus className="w-2.5 h-2.5" /> {n}
                        </span>
                      ))}
                    </div>
                  )}

                  {msg.data?.type === 'delete' && (
                    <div className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      <span className="text-xs text-red-400 font-medium">Suppression irréversible</span>
                    </div>
                  )}

                  {msg.data?.type === 'success' && (
                    <div className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-xs text-emerald-400 font-medium">Déployé sur n8n</span>
                    </div>
                  )}

                  {msg.data?.type === 'error' && (
                    <div className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                      <span className="text-xs text-red-400 font-medium">Échec</span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}

          {/* Loading */}
          {loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-4 border-t border-white/[0.03]">
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500/30 to-violet-600/20 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-4 h-4 text-violet-400 animate-pulse" />
                </div>
                <div className="flex-1 pt-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Confirm/Cancel bar */}
      <AnimatePresence>
        {pendingAction && cfg && (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
            className="border-t border-white/5"
          >
            <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
              <button
                onClick={handleConfirm}
                disabled={applying}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 ${
                  cfg.color === 'red'
                    ? 'bg-red-600 text-white hover:bg-red-500'
                    : 'bg-white text-black hover:bg-gray-100'
                }`}
              >
                {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <cfg.icon className="w-4 h-4" />}
                {cfg.confirmLabel}
              </button>
              <button
                onClick={handleCancel}
                disabled={applying}
                className="px-4 py-2.5 rounded-xl border border-white/10 text-sm font-medium text-gray-400 hover:bg-white/5 transition-all disabled:opacity-50"
              >
                Annuler
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input — ChatGPT style */}
      <div className="border-t border-white/5 bg-[#0a0a0a]">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="relative flex items-end bg-white/[0.05] border border-white/10 rounded-2xl focus-within:border-white/20 transition-colors">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px'
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder="Décrivez ce que vous voulez faire..."
              disabled={loading}
              rows={1}
              className="flex-1 bg-transparent px-4 py-3 text-sm text-white placeholder-gray-500 outline-none resize-none disabled:opacity-30 max-h-[150px]"
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || loading}
              className="m-2 p-2 rounded-xl bg-white text-black hover:bg-gray-200 transition-all disabled:opacity-20 disabled:hover:bg-white flex-shrink-0"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[10px] text-gray-600 text-center mt-2">
            Actero Copilot peut faire des erreurs. Vérifiez les modifications avant de les appliquer.
          </p>
        </div>
      </div>
    </div>
  )
}
