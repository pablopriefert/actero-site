import React, { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bot, Send, Loader2, Zap, CheckCircle2, AlertTriangle,
  Play, X, Sparkles, Plus, Minus, Trash2, Copy, Power,
  ArrowRight, Rocket, PenLine, HelpCircle
} from 'lucide-react'

const SUGGESTIONS = [
  { icon: Rocket, text: "Déploie le template SAV pour le client [nom]", color: "text-emerald-400" },
  { icon: PenLine, text: "Ajoute un node Slack au workflow SAV du client", color: "text-blue-400" },
  { icon: Plus, text: "Crée un workflow de notification email quand un ticket est escaladé", color: "text-violet-400" },
  { icon: Trash2, text: "Supprime le workflow de test", color: "text-red-400" },
  { icon: Power, text: "Désactive le workflow SAV Demo", color: "text-amber-400" },
  { icon: HelpCircle, text: "Quels workflows ont des erreurs récentes ?", color: "text-cyan-400" },
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

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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
      // Step 1: Ask the router what to do
      const routerRes = await fetch('/api/n8n-copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'chat', prompt: userMsg }),
      })
      if (!routerRes.ok) throw new Error((await routerRes.json()).error || 'Erreur')
      const { intent, workflows } = await routerRes.json()

      // Step 2: Handle by intent type
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
        if (modData.diff.added.length) diffLines.push(`**+${modData.diff.added.length} node(s):** ${modData.diff.added.join(', ')}`)
        if (modData.diff.removed.length) diffLines.push(`**-${modData.diff.removed.length} node(s):** ${modData.diff.removed.join(', ')}`)
        if (!modData.diff.added.length && !modData.diff.removed.length) diffLines.push('Configuration des nodes modifiée')
        diffLines.push(`\n**${modData.diff.before} → ${modData.diff.after} nodes**`)

        // Replace last message
        setMessages(prev => [...prev.slice(0, -1)])
        addMsg('assistant', `Modifications proposées pour **${intent.workflowName || 'le workflow'}** :\n\n${diffLines.join('\n')}`, {
          type: 'modify', diff: modData.diff,
        })
        setPendingAction({ type: 'modify', workflowId: intent.workflowId, workflow: modData.modifiedWorkflow })
      }
      else if (intent.intent === 'create') {
        addMsg('assistant', `${intent.message}\n\nGénération du workflow...`)
        const createRes = await fetch('/api/n8n-copilot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create', prompt: intent.description }),
        })
        if (!createRes.ok) throw new Error((await createRes.json()).error || 'Erreur')
        const createData = await createRes.json()

        setMessages(prev => [...prev.slice(0, -1)])
        addMsg('assistant', `Workflow **"${createData.preview.name}"** prêt (${createData.preview.nodeCount} nodes) :\n\n${createData.preview.nodes.map(n => `• ${n.name} *(${n.type.split('.').pop()})*`).join('\n')}`, {
          type: 'create', preview: createData.preview,
        })
        setPendingAction({ type: 'create', workflow: createData.workflow })
      }
      else if (intent.intent === 'duplicate') {
        addMsg('assistant', `${intent.message}\n\nPréparation du template...`)
        const dupRes = await fetch('/api/n8n-copilot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'duplicate',
            clientName: intent.clientName,
            clientId: intent.workflowId, // router may put client ID here
          }),
        })
        if (!dupRes.ok) throw new Error((await dupRes.json()).error || 'Erreur')
        const dupData = await dupRes.json()

        setMessages(prev => [...prev.slice(0, -1)])
        addMsg('assistant', `Template **"${dupData.preview.templateName}"** prêt pour **${dupData.preview.clientName || 'le client'}** (${dupData.preview.nodeCount} nodes).`, {
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
        result = await fetch('/api/n8n-copilot', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'apply', workflowId: pendingAction.workflowId, workflow: pendingAction.workflow }),
        })
      } else if (pendingAction.type === 'create' || pendingAction.type === 'duplicate') {
        result = await fetch('/api/n8n-copilot', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'apply', workflow: pendingAction.workflow }),
        })
      } else if (pendingAction.type === 'delete') {
        result = await fetch('/api/n8n-copilot', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete', workflowId: pendingAction.workflowId }),
        })
      } else if (pendingAction.type === 'toggle') {
        result = await fetch('/api/n8n-copilot', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'toggle', workflowId: pendingAction.workflowId, active: pendingAction.active }),
        })
      }

      if (!result.ok) throw new Error((await result.json()).error || 'Erreur')

      const labels = { modify: 'modifié', create: 'créé', duplicate: 'déployé', delete: 'supprimé', toggle: 'mis à jour' }
      addMsg('assistant', `Workflow ${labels[pendingAction.type]} avec succès sur n8n !`, { type: 'success' })
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

  return (
    <div className="bg-[#0a0a0a] rounded-2xl border border-white/10 overflow-hidden flex flex-col" style={{ height: '650px' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-gradient-to-r from-violet-500/5 to-transparent">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <Bot className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Actero Copilot for n8n</h3>
            <p className="text-[10px] text-gray-500">Créez, modifiez, supprimez et déployez vos workflows</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-violet-500/10 border border-violet-500/20">
          <Sparkles className="w-3 h-3 text-violet-400" />
          <span className="text-[10px] text-violet-400 font-bold">Gemini 2.0</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="space-y-4">
            <div className="text-center py-4">
              <Bot className="w-10 h-10 text-gray-700 mx-auto mb-3" />
              <p className="text-xs text-gray-500">Décrivez ce que vous voulez faire — je m'occupe du reste.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(s.text)}
                  className="text-left px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/5 text-[11px] text-gray-400 hover:bg-white/5 hover:border-white/10 hover:text-gray-300 transition-all flex items-start gap-2"
                >
                  <s.icon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${s.color}`} />
                  <span>{s.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot className="w-3.5 h-3.5 text-violet-400" />
              </div>
            )}
            <div className={`max-w-[85%]`}>
              <div className={`px-4 py-3 rounded-2xl text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-violet-600 text-white rounded-br-md'
                  : 'bg-white/5 text-gray-300 border border-white/5 rounded-bl-md'
              }`}>
                {msg.content.split('\n').map((line, j) => (
                  <p key={j} className={j > 0 ? 'mt-1' : ''}>
                    {line.split('**').map((part, k) =>
                      k % 2 === 1 ? <strong key={k} className="text-white font-bold">{part}</strong> : part
                    )}
                  </p>
                ))}
              </div>

              {/* Diff badges for modify */}
              {msg.data?.type === 'modify' && msg.data.diff && (
                <div className="mt-2 space-y-1">
                  {msg.data.diff.added?.map((n, j) => (
                    <div key={j} className="flex items-center gap-2 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <Plus className="w-3 h-3 text-emerald-400" /> <span className="text-[10px] text-emerald-400">{n}</span>
                    </div>
                  ))}
                  {msg.data.diff.removed?.map((n, j) => (
                    <div key={j} className="flex items-center gap-2 px-3 py-1 rounded-lg bg-red-500/10 border border-red-500/20">
                      <Minus className="w-3 h-3 text-red-400" /> <span className="text-[10px] text-red-400">{n}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Delete warning */}
              {msg.data?.type === 'delete' && (
                <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
                  <Trash2 className="w-4 h-4 text-red-400" />
                  <span className="text-[10px] text-red-400 font-bold">Suppression irréversible</span>
                </div>
              )}

              {/* Success */}
              {msg.data?.type === 'success' && (
                <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-[10px] text-emerald-400 font-bold">Déployé sur n8n</span>
                </div>
              )}

              {msg.data?.type === 'error' && (
                <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span className="text-[10px] text-red-400 font-bold">Échec</span>
                </div>
              )}
            </div>
          </motion.div>
        ))}

        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <Bot className="w-3.5 h-3.5 text-violet-400" />
            </div>
            <div className="px-4 py-3 rounded-2xl bg-white/5 border border-white/5 rounded-bl-md">
              <div className="flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin text-violet-400" />
                <span className="text-xs text-gray-400">Réflexion en cours...</span>
              </div>
            </div>
          </motion.div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Confirm/Cancel bar */}
      <AnimatePresence>
        {pendingAction && cfg && (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
            className="px-5 py-3 border-t border-white/10 flex items-center gap-3"
          >
            <button
              onClick={handleConfirm}
              disabled={applying}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50 ${
                cfg.color === 'red'
                  ? 'bg-red-600 text-white hover:bg-red-500'
                  : 'bg-emerald-600 text-white hover:bg-emerald-500'
              }`}
            >
              {applying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <cfg.icon className="w-3.5 h-3.5" />}
              {cfg.confirmLabel}
            </button>
            <button
              onClick={handleCancel}
              disabled={applying}
              className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-gray-400 hover:bg-white/10 transition-all disabled:opacity-50"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="px-5 py-3 border-t border-white/10">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Créer, modifier, supprimer, déployer un workflow..."
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-gray-600 outline-none focus:border-violet-500/50 transition-colors disabled:opacity-30"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            className="p-2.5 rounded-xl bg-violet-600 text-white hover:bg-violet-500 transition-all disabled:opacity-30"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
