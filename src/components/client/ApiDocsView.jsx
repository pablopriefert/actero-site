import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Key, Copy, Check, Terminal, Webhook, Server, RefreshCw, Shield, Eye, EyeOff } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { SectionCard } from '../ui/SectionCard'
import { usePlan } from '../../hooks/usePlan'
import { useToast } from '../ui/Toast'

export function ApiDocsView({ clientId }) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const { planId, planName, canAccess } = usePlan(clientId)
  const [copiedKey, setCopiedKey] = useState(null)
  const [showKey, setShowKey] = useState(false)
  const [rotating, setRotating] = useState(false)

  const { data: settings, isLoading } = useQuery({
    queryKey: ['client-settings-api', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('client_settings')
        .select('widget_api_key, client_id')
        .eq('client_id', clientId)
        .maybeSingle()
      return data
    },
    enabled: !!clientId,
  })

  // Use widget_api_key if available, fallback to client_id
  const apiKey = settings?.widget_api_key || clientId || ''
  const maskedKey = apiKey ? apiKey.slice(0, 8) + '••••••••••••••••' + apiKey.slice(-4) : ''

  const handleCopy = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(id)
      setTimeout(() => setCopiedKey(null), 2000)
    } catch {}
  }

  const handleRotateKey = async () => {
    if (!window.confirm('Etes-vous sur ? L\'ancienne cle sera immediatement invalidee. Vous devrez mettre a jour tous vos scripts et integrations.')) return
    setRotating(true)
    try {
      // Generate new key client-side (crypto.randomUUID is available in modern browsers)
      const newKey = 'ak_' + Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0')).join('')

      const { error } = await supabase
        .from('client_settings')
        .update({ widget_api_key: newKey, updated_at: new Date().toISOString() })
        .eq('client_id', clientId)

      if (error) throw error

      queryClient.invalidateQueries({ queryKey: ['client-settings-api', clientId] })
      toast.success('Cle API regeneree avec succes')
      setShowKey(true) // Show the new key
    } catch (err) {
      toast.error('Erreur: ' + err.message)
    } finally {
      setRotating(false)
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
    "api_key": "${apiKey || 'VOTRE_CLE_API'}",
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
      {/* Header */}
      <div>
        <h2 className="text-[22px] font-semibold text-[#1a1a1a]">API Actero</h2>
        <p className="text-[13px] text-[#9ca3af] mt-1">Integrez Actero dans vos outils et workflows</p>
      </div>

      {/* Cle API */}
      <SectionCard title="Votre cle API" icon={Key}>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <code className="flex-1 bg-[#fafafa] border border-[#f0f0f0] rounded-xl px-4 py-3 text-[13px] font-mono text-[#1a1a1a] truncate">
              {isLoading ? 'Chargement...' : showKey ? apiKey : maskedKey}
            </code>
            <button
              onClick={() => setShowKey(!showKey)}
              className="p-2.5 rounded-lg border border-[#f0f0f0] hover:bg-[#fafafa] transition-colors"
              title={showKey ? 'Masquer' : 'Afficher'}
            >
              {showKey ? <EyeOff className="w-4 h-4 text-[#71717a]" /> : <Eye className="w-4 h-4 text-[#71717a]" />}
            </button>
            <button
              onClick={() => handleCopy(apiKey, 'main')}
              disabled={!apiKey || isLoading}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#0F5F35] text-white text-[13px] font-medium hover:bg-[#003725] transition-colors disabled:opacity-50"
            >
              {copiedKey === 'main' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiedKey === 'main' ? 'Copie !' : 'Copier'}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-[12px] text-[#9ca3af]">
              <Shield className="w-3 h-3 inline mr-1" />
              Ne partagez jamais cette cle publiquement. Elle donne acces a votre agent IA.
            </p>
            <button
              onClick={handleRotateKey}
              disabled={rotating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-[11px] font-semibold hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${rotating ? 'animate-spin' : ''}`} />
              {rotating ? 'Regeneration...' : 'Regenerer la cle'}
            </button>
          </div>
        </div>
      </SectionCard>

      {/* Widget snippet */}
      <SectionCard title="Integrer le widget chat" icon={Terminal}>
        <div className="space-y-3">
          <p className="text-[13px] text-[#71717a]">
            Ajoutez cette ligne dans le code de votre site (avant {'</body>'}) pour activer le chat IA :
          </p>
          <div className="relative">
            <pre className="bg-[#1a1a1a] text-[#e4e4e7] rounded-xl p-4 text-[12px] font-mono overflow-x-auto">
{`<script src="https://actero.fr/widget.js" data-actero-key="${apiKey || 'VOTRE_CLE_API'}"></script>`}
            </pre>
            <button
              onClick={() => handleCopy(`<script src="https://actero.fr/widget.js" data-actero-key="${apiKey}"></script>`, 'widget')}
              className="absolute top-2 right-2 p-1.5 rounded bg-white/10 hover:bg-white/20 transition-colors"
            >
              {copiedKey === 'widget' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-white/70" />}
            </button>
          </div>
          <p className="text-[11px] text-[#9ca3af]">
            Compatible Shopify, WooCommerce, Webflow, et tout site web.
          </p>
        </div>
      </SectionCard>

      {/* Endpoints */}
      <SectionCard title="Endpoints API" icon={Terminal}>
        <div className="space-y-6">
          {endpoints.map((ep) => (
            <div key={ep.url} className="space-y-2">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                  ep.method === 'POST' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'
                }`}>
                  {ep.method}
                </span>
                <code className="text-[13px] font-mono text-[#1a1a1a] font-medium">{ep.url}</code>
              </div>
              <p className="text-[13px] text-[#71717a]">{ep.description}</p>
              <div className="relative">
                <pre className="bg-[#1a1a1a] text-[#e4e4e7] rounded-xl p-4 text-[12px] font-mono overflow-x-auto leading-relaxed">
                  {ep.curl}
                </pre>
                <button
                  onClick={() => handleCopy(ep.curl, ep.url)}
                  className="absolute top-2 right-2 p-1.5 rounded bg-white/10 hover:bg-white/20 transition-colors"
                >
                  {copiedKey === ep.url ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-white/70" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* MCP Server */}
      <SectionCard title="MCP Server" icon={Server}>
        <div className="space-y-3">
          <p className="text-[13px] text-[#71717a] leading-relaxed">
            Connectez votre agent IA a Claude Desktop, Cursor, ou tout client MCP compatible.
          </p>
          <div className="flex items-center gap-3">
            <code className="flex-1 bg-[#fafafa] border border-[#f0f0f0] rounded-xl px-4 py-2.5 text-[13px] font-mono text-[#1a1a1a] truncate">
              {`https://actero.fr/api/mcp/${apiKey || '{api_key}'}`}
            </code>
            <button
              onClick={() => handleCopy(`https://actero.fr/api/mcp/${apiKey}`, 'mcp')}
              disabled={!apiKey}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-[#0F5F35] text-white text-[13px] font-medium hover:bg-[#003725] transition-colors disabled:opacity-50"
            >
              {copiedKey === 'mcp' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              Copier
            </button>
          </div>
        </div>
      </SectionCard>

      {/* Webhooks sortants */}
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
              <span className="text-[12px] font-medium text-[#0F5F35]">
                Disponible sur votre plan ({planName}) — contactez le support pour activer
              </span>
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  )
}
