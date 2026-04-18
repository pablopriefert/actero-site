import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Key, Copy, Check, Code2, Webhook, Server, Plus, Trash2,
  Eye, EyeOff, Shield, Zap, MessageSquare, BarChart3,
  ArrowRight, ExternalLink, Sparkles
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { usePlan } from '../../hooks/usePlan'
import { useToast } from '../ui/Toast'
import { WebhooksManager } from './WebhooksManager'

function generateApiKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return 'ak_' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

const CodeBlock = ({ code, id, onCopy, copiedId }) => (
  <div className="relative group">
    <pre className="bg-[#18181b] text-[#a1a1aa] rounded-xl p-4 text-[12px] font-mono overflow-x-auto leading-relaxed scrollbar-thin">
      {code}
    </pre>
    <button
      onClick={() => onCopy(code, id)}
      className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-white/5 hover:bg-white/15 transition-all opacity-0 group-hover:opacity-100"
    >
      {copiedId === id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-white/50" />}
    </button>
  </div>
)

export function ApiDocsView({ clientId }) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const { canAccess } = usePlan(clientId)
  const [copiedId, setCopiedId] = useState(null)
  const [visibleKeys, setVisibleKeys] = useState({})
  const [creating, setCreating] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [expandedEndpoint, setExpandedEndpoint] = useState(null)

  const { data: apiKeys = [], isLoading } = useQuery({
    queryKey: ['client-api-keys', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('client_api_keys')
        .select('*')
        .eq('client_id', clientId)
        .eq('is_active', true)
        .order('created_at', { ascending: true })
      return data || []
    },
    enabled: !!clientId,
  })

  const firstKey = apiKeys[0]?.key_value || 'VOTRE_CLÉ_API'

  const handleCopy = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      toast.success('Copié !')
      setTimeout(() => setCopiedId(null), 2000)
    } catch {}
  }

  const toggleVisibility = (id) => setVisibleKeys(prev => ({ ...prev, [id]: !prev[id] }))
  const maskKey = (key) => key ? key.slice(0, 8) + '•'.repeat(12) + key.slice(-4) : ''

  const handleCreate = async () => {
    const label = newLabel.trim() || `Clé ${apiKeys.length + 1}`
    setCreating(true)
    try {
      const key = generateApiKey()
      const { error } = await supabase.from('client_api_keys').insert({ client_id: clientId, key_value: key, label })
      if (error) throw error
      if (apiKeys.length === 0) {
        await supabase.from('client_settings').update({ widget_api_key: key }).eq('client_id', clientId)
      }
      queryClient.invalidateQueries({ queryKey: ['client-api-keys', clientId] })
      toast.success(`Clé "${label}" créée`)
      setNewLabel('')
      setShowCreateForm(false)
      setTimeout(() => setVisibleKeys(prev => ({ ...prev, [key]: true })), 300)
    } catch (err) {
      toast.error('Erreur: ' + err.message)
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (keyId, label) => {
    if (!window.confirm(`Supprimer la clé "${label}" ? Elle sera immédiatement invalidée.`)) return
    try {
      await supabase.from('client_api_keys').update({ is_active: false }).eq('id', keyId)
      queryClient.invalidateQueries({ queryKey: ['client-api-keys', clientId] })
      toast.success(`Clé "${label}" supprimée`)
    } catch (err) {
      toast.error('Erreur: ' + err.message)
    }
  }

  const endpoints = [
    {
      id: 'send',
      icon: MessageSquare,
      method: 'POST',
      label: 'Envoyer un message',
      description: 'Envoyez un message à votre agent IA et recevez sa réponse instantanément.',
      url: '/api/engine/webhooks/widget',
      curl: `curl -X POST https://actero.fr/api/engine/webhooks/widget \\
  -H "Content-Type: application/json" \\
  -d '{"api_key": "${firstKey}", "message": "Où est ma commande #1234 ?", "session_id": "session_001"}'`,
    },
    {
      id: 'usage',
      icon: BarChart3,
      method: 'GET',
      label: 'Consulter la consommation',
      description: 'Récupérez vos statistiques d\'utilisation du mois en cours.',
      url: '/api/billing/usage',
      curl: `curl https://actero.fr/api/billing/usage?client_id=${clientId || 'VOTRE_CLIENT_ID'} \\
  -H "Authorization: Bearer VOTRE_JWT_TOKEN"`,
    },
  ]

  const quickLinks = [
    { icon: Server, label: 'Serveur MCP', desc: 'Claude Desktop, Cursor, etc.', color: 'bg-violet-50 text-violet-600' },
    { icon: Code2, label: 'Widget Chat', desc: 'Intégrez le chat sur votre site', color: 'bg-blue-50 text-blue-600' },
    { icon: Webhook, label: 'Webhooks', desc: 'Événements en temps réel', color: 'bg-amber-50 text-amber-600' },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in-up">
      {/* Hero */}
      <div>
        <h2 className="text-2xl font-bold text-[#1a1a1a] tracking-tight">API & Intégrations</h2>
        <p className="text-sm text-[#71717a] mt-1">
          Connectez Actero à vos outils, automatisez vos workflows, et développez sur notre API.
        </p>
      </div>

      {/* Quick access cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {quickLinks.map((link, i) => (
          <motion.button
            key={link.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => {
              const el = document.getElementById(link.label === 'Serveur MCP' ? 'mcp-section' : link.label === 'Widget Chat' ? 'widget-section' : 'webhook-section')
              el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}
            className="flex items-center gap-3 p-4 rounded-2xl border border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm transition-all text-left"
          >
            <div className={`w-10 h-10 rounded-xl ${link.color} flex items-center justify-center flex-shrink-0`}>
              <link.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#1a1a1a]">{link.label}</p>
              <p className="text-xs text-[#71717a]">{link.desc}</p>
            </div>
          </motion.button>
        ))}
      </div>

      {/* API Keys Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-gray-200 bg-white overflow-hidden"
      >
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                <Key className="w-4.5 h-4.5 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#1a1a1a]">Clés API</h3>
                <p className="text-xs text-[#71717a]">{apiKeys.length} clé{apiKeys.length !== 1 ? 's' : ''} active{apiKeys.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            {!showCreateForm && (
              <button
                onClick={() => setShowCreateForm(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cta text-white text-xs font-semibold hover:bg-[#003725] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Nouvelle clé
              </button>
            )}
          </div>
        </div>

        <div className="p-6 space-y-3">
          {isLoading ? (
            <div className="text-xs text-[#9ca3af] py-4 text-center">Chargement...</div>
          ) : apiKeys.length === 0 && !showCreateForm ? (
            <div className="text-center py-6">
              <Key className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-[#1a1a1a]">Aucune clé API</p>
              <p className="text-xs text-[#71717a] mt-1">Créez votre première clé pour commencer.</p>
            </div>
          ) : (
            apiKeys.map((k) => (
              <div key={k.id} className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 group">
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-[#71717a] uppercase tracking-wider mb-0.5">{k.label}</p>
                  <code className="text-sm font-mono text-[#1a1a1a] truncate block">
                    {visibleKeys[k.key_value] ? k.key_value : maskKey(k.key_value)}
                  </code>
                </div>
                <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => toggleVisibility(k.key_value)} className="p-2 rounded-lg hover:bg-white transition-colors">
                    {visibleKeys[k.key_value] ? <EyeOff className="w-4 h-4 text-[#71717a]" /> : <Eye className="w-4 h-4 text-[#71717a]" />}
                  </button>
                  <button onClick={() => handleCopy(k.key_value, k.id)} className="p-2 rounded-lg hover:bg-white transition-colors">
                    {copiedId === k.id ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-[#71717a]" />}
                  </button>
                  <button onClick={() => handleDelete(k.id, k.label)} className="p-2 rounded-lg hover:bg-red-50 transition-colors">
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </div>
            ))
          )}

          {showCreateForm && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Nom de la clé (ex: Production, Staging...)"
                className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-cta/20 focus:border-cta"
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                autoFocus
              />
              <button onClick={handleCreate} disabled={creating} className="px-4 py-2.5 rounded-xl bg-cta text-white text-sm font-semibold hover:bg-[#003725] disabled:opacity-50 transition-colors">
                {creating ? '...' : 'Créer'}
              </button>
              <button onClick={() => { setShowCreateForm(false); setNewLabel('') }} className="px-3 py-2.5 rounded-xl text-sm text-[#71717a] hover:bg-gray-50 transition-colors">
                Annuler
              </button>
            </div>
          )}

          <p className="text-[10px] text-[#9ca3af] flex items-center gap-1 pt-1">
            <Shield className="w-3 h-3" />
            Chaque clé donne un accès complet à votre agent IA. Ne les partagez jamais publiquement.
          </p>
        </div>
      </motion.div>

      {/* Widget Section */}
      {apiKeys.length > 0 && (
        <motion.div
          id="widget-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-gray-200 bg-white p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
              <Code2 className="w-4.5 h-4.5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#1a1a1a]">Widget Chat</h3>
              <p className="text-xs text-[#71717a]">Ajoutez le chat IA sur votre site en une ligne</p>
            </div>
          </div>
          <CodeBlock
            code={`<script src="https://actero.fr/widget.js" data-actero-key="${apiKeys[0]?.key_value}"></script>`}
            id="widget"
            onCopy={handleCopy}
            copiedId={copiedId}
          />
          <p className="text-[11px] text-[#71717a] mt-3">
            Collez avant la balise {'</body>'} — compatible Shopify, WooCommerce, Webflow et tout site web.
          </p>
        </motion.div>
      )}

      {/* Endpoints */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="rounded-2xl border border-gray-200 bg-white overflow-hidden"
      >
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center">
              <Zap className="w-4.5 h-4.5 text-orange-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#1a1a1a]">Endpoints API</h3>
              <p className="text-xs text-[#71717a]">Interagissez avec votre agent par programmation</p>
            </div>
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {endpoints.map((ep) => (
            <div key={ep.id} className="p-5">
              <button
                onClick={() => setExpandedEndpoint(expandedEndpoint === ep.id ? null : ep.id)}
                className="flex items-center justify-between w-full text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
                    <ep.icon className="w-4 h-4 text-[#71717a]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                        ep.method === 'POST' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'
                      }`}>{ep.method}</span>
                      <code className="text-sm font-mono text-[#1a1a1a] font-medium">{ep.url}</code>
                    </div>
                    <p className="text-xs text-[#71717a] mt-0.5">{ep.description}</p>
                  </div>
                </div>
                <ArrowRight className={`w-4 h-4 text-[#71717a] transition-transform ${expandedEndpoint === ep.id ? 'rotate-90' : ''}`} />
              </button>

              {expandedEndpoint === ep.id && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-4 ml-11"
                >
                  <CodeBlock code={ep.curl} id={ep.id} onCopy={handleCopy} copiedId={copiedId} />
                </motion.div>
              )}
            </div>
          ))}
        </div>
      </motion.div>

      {/* MCP Server */}
      <motion.div
        id="mcp-section"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50/50 to-white p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center">
            <Sparkles className="w-4.5 h-4.5 text-violet-600" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#1a1a1a]">Serveur MCP</h3>
            <p className="text-xs text-[#71717a]">Claude Desktop, Cursor, ou tout client MCP compatible</p>
          </div>
        </div>

        <p className="text-sm text-[#71717a] leading-relaxed mb-4">
          Connectez votre agent Actero directement dans Claude ou Cursor. L'authentification se fait automatiquement via OAuth.
        </p>

        <div className="flex items-center gap-2 p-3 rounded-xl border border-gray-200 bg-white mb-4">
          <code className="flex-1 text-sm font-mono text-[#1a1a1a] truncate">https://actero.fr/api/mcp</code>
          <button
            onClick={() => handleCopy('https://actero.fr/api/mcp', 'mcp')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
              copiedId === 'mcp' ? 'bg-emerald-50 text-emerald-600' : 'bg-cta text-white hover:bg-[#003725]'
            }`}
          >
            {copiedId === 'mcp' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedId === 'mcp' ? 'Copié' : 'Copier'}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {['actero_send_message', 'actero_get_usage', 'actero_list_escalations', 'actero_get_conversations'].map(t => (
            <code key={t} className="text-[11px] font-mono text-violet-600 bg-violet-50 border border-violet-100 px-2.5 py-1 rounded-lg">{t}</code>
          ))}
        </div>
      </motion.div>

      {/* Webhooks */}
      <motion.div
        id="webhook-section"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="rounded-2xl border border-gray-200 bg-white p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
            <Webhook className="w-4.5 h-4.5 text-amber-600" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#1a1a1a]">Webhooks sortants</h3>
            <p className="text-xs text-[#71717a]">Recevez les événements Actero en temps réel</p>
          </div>
        </div>

        {canAccess('api_webhooks') ? (
          <WebhooksManager clientId={clientId} />
        ) : (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-50 border border-amber-100">
            <Zap className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-medium text-amber-700">Disponible à partir du plan Pro</span>
          </div>
        )}
      </motion.div>
    </div>
  )
}
