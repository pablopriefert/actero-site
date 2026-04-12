import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Key, Copy, Check, Terminal, Webhook, Server, Plus, Trash2, Eye, EyeOff, Shield } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { SectionCard } from '../ui/SectionCard'
import { usePlan } from '../../hooks/usePlan'
import { useToast } from '../ui/Toast'

function generateApiKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return 'ak_' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

export function ApiDocsView({ clientId }) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const { planName, canAccess } = usePlan(clientId)
  const [copiedId, setCopiedId] = useState(null)
  const [visibleKeys, setVisibleKeys] = useState({})
  const [creating, setCreating] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)

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

  const firstKey = apiKeys[0]?.key_value || ''

  const handleCopy = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {}
  }

  const toggleVisibility = (id) => {
    setVisibleKeys(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const maskKey = (key) => {
    if (!key) return ''
    return key.slice(0, 8) + '••••••••••••' + key.slice(-4)
  }

  const handleCreate = async () => {
    const label = newLabel.trim() || `Cle ${apiKeys.length + 1}`
    setCreating(true)
    try {
      const key = generateApiKey()
      const { error } = await supabase.from('client_api_keys').insert({
        client_id: clientId,
        key_value: key,
        label,
      })
      if (error) throw error

      // Also set as widget_api_key if it's the first key
      if (apiKeys.length === 0) {
        await supabase.from('client_settings')
          .update({ widget_api_key: key })
          .eq('client_id', clientId)
      }

      queryClient.invalidateQueries({ queryKey: ['client-api-keys', clientId] })
      toast.success(`Cle "${label}" creee`)
      setNewLabel('')
      setShowCreateForm(false)
      // Show the new key
      setTimeout(() => {
        setVisibleKeys(prev => ({ ...prev, [key]: true }))
      }, 300)
    } catch (err) {
      toast.error('Erreur: ' + err.message)
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (keyId, label) => {
    if (!window.confirm(`Supprimer la cle "${label}" ? Elle sera immediatement invalidee.`)) return
    try {
      await supabase.from('client_api_keys')
        .update({ is_active: false })
        .eq('id', keyId)
      queryClient.invalidateQueries({ queryKey: ['client-api-keys', clientId] })
      toast.success(`Cle "${label}" supprimee`)
    } catch (err) {
      toast.error('Erreur: ' + err.message)
    }
  }

  const endpoints = [
    {
      method: 'POST',
      url: '/api/engine/webhooks/widget',
      description: 'Envoyer un message a l\'agent IA',
      curl: `curl -X POST https://actero.fr/api/engine/webhooks/widget \\
  -H "Content-Type: application/json" \\
  -d '{
    "api_key": "${firstKey || 'VOTRE_CLE_API'}",
    "message": "Ou est ma commande #1234 ?",
    "session_id": "session_001"
  }'`,
    },
    {
      method: 'GET',
      url: '/api/billing/usage',
      description: 'Consulter votre consommation du mois',
      curl: `curl https://actero.fr/api/billing/usage?client_id=${clientId || 'VOTRE_CLIENT_ID'} \\
  -H "Authorization: Bearer VOTRE_JWT_TOKEN"`,
    },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-[22px] font-semibold text-[#1a1a1a]">API Actero</h2>
        <p className="text-[13px] text-[#9ca3af] mt-1">Integrez Actero dans vos outils et workflows</p>
      </div>

      {/* API Keys */}
      <SectionCard title="Cles API" icon={Key}>
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-[13px] text-[#9ca3af] py-4">Chargement...</div>
          ) : apiKeys.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-2xl bg-[#fafafa] border border-[#f0f0f0] flex items-center justify-center mx-auto mb-3">
                <Key className="w-6 h-6 text-[#9ca3af]" />
              </div>
              <p className="text-[14px] font-semibold text-[#1a1a1a]">Aucune cle API</p>
              <p className="text-[12px] text-[#9ca3af] mt-1 mb-4">Creez votre premiere cle pour integrer Actero dans vos outils.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {apiKeys.map((k) => (
                <div key={k.id} className="flex items-center gap-3 bg-[#fafafa] border border-[#f0f0f0] rounded-xl px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-[#71717a] mb-1">{k.label}</p>
                    <code className="text-[13px] font-mono text-[#1a1a1a] truncate block">
                      {visibleKeys[k.key_value] ? k.key_value : maskKey(k.key_value)}
                    </code>
                  </div>
                  <button onClick={() => toggleVisibility(k.key_value)} className="p-2 rounded-lg hover:bg-white transition-colors" title={visibleKeys[k.key_value] ? 'Masquer' : 'Afficher'}>
                    {visibleKeys[k.key_value] ? <EyeOff className="w-4 h-4 text-[#71717a]" /> : <Eye className="w-4 h-4 text-[#71717a]" />}
                  </button>
                  <button onClick={() => handleCopy(k.key_value, k.id)} className="p-2 rounded-lg hover:bg-white transition-colors" title="Copier">
                    {copiedId === k.id ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-[#71717a]" />}
                  </button>
                  <button onClick={() => handleDelete(k.id, k.label)} className="p-2 rounded-lg hover:bg-red-50 transition-colors" title="Supprimer">
                    <Trash2 className="w-4 h-4 text-red-400 hover:text-red-600" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Create form */}
          {showCreateForm ? (
            <div className="flex items-center gap-2 pt-2">
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Nom de la cle (ex: Production, Staging...)"
                className="flex-1 px-3 py-2 rounded-xl border border-[#f0f0f0] bg-white text-[13px] text-[#1a1a1a] placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#0F5F35]/20 focus:border-[#0F5F35]/30"
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                autoFocus
              />
              <button
                onClick={handleCreate}
                disabled={creating}
                className="px-4 py-2 rounded-xl bg-[#0F5F35] text-white text-[13px] font-semibold hover:bg-[#003725] transition-colors disabled:opacity-50"
              >
                {creating ? 'Creation...' : 'Creer'}
              </button>
              <button
                onClick={() => { setShowCreateForm(false); setNewLabel('') }}
                className="px-3 py-2 rounded-xl text-[13px] font-semibold text-[#71717a] hover:bg-[#fafafa] transition-colors"
              >
                Annuler
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-[#f0f0f0] text-[13px] font-semibold text-[#71717a] hover:border-[#0F5F35]/30 hover:text-[#0F5F35] transition-colors w-full justify-center"
            >
              <Plus className="w-4 h-4" />
              Creer une cle API
            </button>
          )}

          <p className="text-[11px] text-[#9ca3af] flex items-center gap-1">
            <Shield className="w-3 h-3" />
            Chaque cle donne acces complet a votre agent IA. Ne les partagez jamais publiquement.
          </p>
        </div>
      </SectionCard>

      {/* Widget snippet */}
      {firstKey && (
        <SectionCard title="Integrer le widget chat" icon={Terminal}>
          <div className="space-y-3">
            <p className="text-[13px] text-[#71717a]">
              Ajoutez cette ligne dans le code de votre site (avant {'</body>'}) pour activer le chat IA :
            </p>
            <div className="relative">
              <pre className="bg-[#1a1a1a] text-[#e4e4e7] rounded-xl p-4 text-[12px] font-mono overflow-x-auto">
{`<script src="https://actero.fr/widget.js" data-actero-key="${firstKey}"></script>`}
              </pre>
              <button
                onClick={() => handleCopy(`<script src="https://actero.fr/widget.js" data-actero-key="${firstKey}"></script>`, 'widget')}
                className="absolute top-2 right-2 p-1.5 rounded bg-white/10 hover:bg-white/20 transition-colors"
              >
                {copiedId === 'widget' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-white/70" />}
              </button>
            </div>
            <p className="text-[11px] text-[#9ca3af]">Compatible Shopify, WooCommerce, Webflow, et tout site web.</p>
          </div>
        </SectionCard>
      )}

      {/* Endpoints */}
      <SectionCard title="Endpoints API" icon={Terminal}>
        <div className="space-y-6">
          {endpoints.map((ep) => (
            <div key={ep.url} className="space-y-2">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                  ep.method === 'POST' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'
                }`}>{ep.method}</span>
                <code className="text-[13px] font-mono text-[#1a1a1a] font-medium">{ep.url}</code>
              </div>
              <p className="text-[13px] text-[#71717a]">{ep.description}</p>
              <div className="relative">
                <pre className="bg-[#1a1a1a] text-[#e4e4e7] rounded-xl p-4 text-[12px] font-mono overflow-x-auto leading-relaxed">{ep.curl}</pre>
                <button onClick={() => handleCopy(ep.curl, ep.url)} className="absolute top-2 right-2 p-1.5 rounded bg-white/10 hover:bg-white/20 transition-colors">
                  {copiedId === ep.url ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-white/70" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* MCP Server */}
      {(
        <SectionCard title="MCP Server (Claude Desktop, Cursor...)" icon={Server}>
          <div className="space-y-4">
            <p className="text-[13px] text-[#71717a] leading-relaxed">
              Connectez votre agent IA a Claude Desktop, Cursor, ou tout client MCP compatible. L'authentification se fait automatiquement via votre compte Actero (comme Slack).
            </p>

            <div>
              <p className="text-[12px] font-semibold text-[#1a1a1a] mb-2">URL du serveur MCP :</p>
              <div className="flex items-center gap-3">
                <code className="flex-1 bg-[#fafafa] border border-[#f0f0f0] rounded-xl px-4 py-2.5 text-[13px] font-mono text-[#1a1a1a] truncate">
                  {`https://actero.fr/api/mcp`}
                </code>
                <button onClick={() => handleCopy(`https://actero.fr/api/mcp`, 'mcp')} className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-[#0F5F35] text-white text-[13px] font-medium hover:bg-[#003725] transition-colors">
                  {copiedId === 'mcp' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  Copier
                </button>
              </div>
            </div>

            <div>
              <p className="text-[12px] font-semibold text-[#1a1a1a] mb-2">Configuration Claude Desktop :</p>
              <div className="relative">
                <pre className="bg-[#1a1a1a] text-[#e4e4e7] rounded-xl p-4 text-[12px] font-mono overflow-x-auto leading-relaxed">{`// claude_desktop_config.json
{
  "mcpServers": {
    "actero": {
      "url": "https://actero.fr/api/mcp"
    }
  }
}`}</pre>
                <button onClick={() => handleCopy(`{\n  "mcpServers": {\n    "actero": {\n      "url": "https://actero.fr/api/mcp"\n    }\n  }\n}`, 'mcp-config')} className="absolute top-2 right-2 p-1.5 rounded bg-white/10 hover:bg-white/20 transition-colors">
                  {copiedId === 'mcp-config' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-white/70" />}
                </button>
              </div>
            </div>

            <div className="bg-[#fafafa] border border-[#f0f0f0] rounded-xl p-3">
              <p className="text-[11px] font-semibold text-[#71717a] mb-1.5">Tools disponibles :</p>
              <div className="grid grid-cols-2 gap-1.5">
                {['actero_send_message', 'actero_get_usage', 'actero_list_escalations', 'actero_get_conversations'].map(t => (
                  <code key={t} className="text-[10px] font-mono text-[#0F5F35] bg-[#0F5F35]/5 px-2 py-1 rounded">{t}</code>
                ))}
              </div>
            </div>
          </div>
        </SectionCard>
      )}

      {/* Webhooks */}
      <SectionCard title="Webhooks sortants" icon={Webhook}>
        <div className="space-y-3">
          <p className="text-[13px] text-[#71717a] leading-relaxed">
            Recevez les evenements Actero en temps reel (ticket resolu, escalade, etc.) via webhook.
          </p>
          {canAccess('api_webhooks') ? (
            <div className="bg-[#fafafa] border border-[#f0f0f0] rounded-xl p-4">
              <p className="text-[13px] text-[#1a1a1a] font-medium">Configuration webhooks</p>
              <p className="text-[12px] text-[#9ca3af] mt-1">
                Contactez le support pour configurer vos webhooks sortants : support@actero.fr
              </p>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0F5F35]/10 border border-[#0F5F35]/20">
              <span className="text-[12px] font-medium text-[#0F5F35]">Disponible a partir du plan Starter</span>
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  )
}
