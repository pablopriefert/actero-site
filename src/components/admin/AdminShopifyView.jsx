import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Send, Loader2, CheckCircle2, ShoppingBag, Link2, AlertCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export function AdminShopifyView() {
  const [selectedClientId, setSelectedClientId] = useState('')
  const [installUrl, setInstallUrl] = useState('')
  const [sending, setSending] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(null)

  // Fetch e-commerce clients only
  const { data: clients = [] } = useQuery({
    queryKey: ['ecommerce-clients-shopify'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, brand_name, contact_email')
        .eq('client_type', 'ecommerce')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })

  // Check which clients already have Shopify connected
  const { data: connections = [] } = useQuery({
    queryKey: ['shopify-connections'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_shopify_connections')
        .select('client_id, shop_domain, created_at')
      if (error) throw error
      return data
    },
  })

  const connectedIds = new Set(connections.map(c => c.client_id))
  const selectedClient = clients.find(c => c.id === selectedClientId)

  const handleSend = async (e) => {
    e.preventDefault()
    if (!selectedClientId || !installUrl) return

    setSending(true)
    setError(null)
    setSuccess(false)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/send-shopify-install-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token && { Authorization: `Bearer ${session.access_token}` }),
        },
        body: JSON.stringify({
          email: selectedClient.contact_email,
          company_name: selectedClient.brand_name,
          install_url: installUrl,
        }),
      })

      if (!res.ok) {
        let msg = `Erreur ${res.status}`
        try { const d = await res.json(); msg = d.error || msg } catch {}
        throw new Error(msg)
      }

      setSuccess(true)
      setTimeout(() => setSuccess(false), 4000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto animate-fade-in-up space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-[24px] font-bold text-[#1a1a1a] mb-2 flex items-center gap-3">
          <ShoppingBag className="w-6 h-6 text-emerald-500" />
          App Shopify
        </h2>
        <p className="text-[#71717a] text-[13px]">
          Envoyez le lien d'installation de l'app Shopify à vos clients e-commerce.
        </p>
      </div>

      {/* Send form */}
      <form onSubmit={handleSend} className="bg-[#ffffff] border border-[#f0f0f0] rounded-2xl p-6 space-y-5">
        <h3 className="text-[#1a1a1a] font-bold text-[15px]">Envoyer un lien d'installation</h3>

        {/* Client dropdown */}
        <div>
          <label className="block text-[12px] font-bold text-[#71717a] uppercase tracking-wider mb-2">
            Client *
          </label>
          <select
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            required
            className="w-full bg-[#ffffff] border border-[#f0f0f0] rounded-xl px-4 py-3 text-[#1a1a1a] text-[13px] focus:outline-none focus:border-emerald-500/50 transition-colors"
          >
            <option value="" className="bg-white">Sélectionner un client...</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id} className="bg-white">
                {c.brand_name} — {c.contact_email || 'pas d\'email'}
                {connectedIds.has(c.id) ? ' ✓ Shopify connecté' : ''}
              </option>
            ))}
          </select>
          {selectedClient && !selectedClient.contact_email && (
            <p className="mt-2 text-[12px] text-red-400 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Ce client n'a pas d'email de contact. Ajoutez-en un dans la fiche client.
            </p>
          )}
        </div>

        {/* Install URL */}
        <div>
          <label className="block text-[12px] font-bold text-[#71717a] uppercase tracking-wider mb-2">
            Lien d'installation Shopify *
          </label>
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-[#71717a] shrink-0" />
            <input
              type="url"
              value={installUrl}
              onChange={(e) => setInstallUrl(e.target.value)}
              placeholder="https://admin.shopify.com/oauth/install_custom_app?client_id=..."
              required
              className="flex-1 bg-[#ffffff] border border-[#f0f0f0] rounded-xl px-4 py-3 text-[#1a1a1a] text-[13px] placeholder:text-[#71717a] focus:outline-none focus:border-emerald-500/50 transition-colors"
            />
          </div>
          <p className="mt-2 text-[12px] text-[#71717a]">
            Copiez le lien depuis Shopify Partners → App Actero → Distribution
          </p>
        </div>

        {/* Error / Success */}
        {error && (
          <div className="flex items-center gap-2 text-red-400 text-[13px] bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 text-emerald-500 text-[13px] bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            Email envoyé avec succès !
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={sending || !selectedClientId || !installUrl || !selectedClient?.contact_email}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-[13px] px-6 py-3 rounded-xl transition-colors"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {sending ? 'Envoi en cours...' : 'Envoyer le lien d\'installation'}
        </button>
      </form>

      {/* Connected clients table */}
      <div className="bg-[#ffffff] border border-[#f0f0f0] rounded-2xl p-6">
        <h3 className="text-[#1a1a1a] font-bold text-[15px] mb-4">Connexions Shopify actives</h3>
        {connections.length === 0 ? (
          <p className="text-[#71717a] text-[13px]">Aucun client n'a encore connecté Shopify.</p>
        ) : (
          <div className="space-y-3">
            {connections.map((conn) => {
              const client = clients.find(c => c.id === conn.client_id)
              return (
                <div key={conn.client_id} className="flex items-center justify-between bg-[#ffffff] border border-[#f0f0f0] rounded-xl px-4 py-3">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span className="text-[#1a1a1a] text-[13px] font-medium">{client?.brand_name || 'Client inconnu'}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-[#71717a] text-[12px]">{conn.shop_domain}</span>
                    <span className="text-[#71717a] text-[12px]">
                      {new Date(conn.created_at).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
