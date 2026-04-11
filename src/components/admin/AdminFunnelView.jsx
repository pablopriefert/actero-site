import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Link2, Mail, Copy, Check, RotateCcw,
  Sparkles, X, Loader2, ExternalLink, Send
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

const STATUS_CONFIG = {
  draft: { label: 'Brouillon', color: 'bg-[#fafafa]0/10 text-[#71717a] border-gray-500/20' },
  sent: { label: 'Email envoyé', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  paid: { label: 'Payé — Actif', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  canceled: { label: 'Annulé', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
}

function generateSlug(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function AdminFunnelView() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [copiedId, setCopiedId] = useState(null)
  const [sendingId, setSendingId] = useState(null)
  const [formData, setFormData] = useState({
    company_name: '',
    slug: '',
    email: '',
    client_type: 'ecommerce',
    setup_price: 800,
    monthly_price: 800,
    hourly_cost: '',
    avg_ticket_time: '',
    actero_monthly_price: '',
    message: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState(null)

  const { data: funnelClients = [], isLoading } = useQuery({
    queryKey: ['funnel-clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('funnel_clients')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
  })

  const handleCompanyNameChange = (value) => {
    setFormData(prev => ({
      ...prev,
      company_name: value,
      slug: generateSlug(value),
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setFormError(null)

    try {
      // 1. Insert into Supabase
      const { data: client, error: insertError } = await supabase
        .from('funnel_clients')
        .insert([{
          company_name: formData.company_name,
          slug: formData.slug,
          email: formData.email,
          client_type: formData.client_type,
          setup_price: formData.setup_price,
          monthly_price: formData.monthly_price,
          hourly_cost: formData.hourly_cost ? parseFloat(formData.hourly_cost) : (formData.client_type === 'immobilier' ? 30 : 25),
          avg_ticket_time_min: formData.avg_ticket_time ? parseInt(formData.avg_ticket_time) : (formData.client_type === 'immobilier' ? 8 : 5),
          actero_monthly_price: formData.actero_monthly_price ? parseFloat(formData.actero_monthly_price) : formData.monthly_price,
          message: formData.message || null,
          status: 'draft',
        }])
        .select()
        .single()

      if (insertError) throw insertError

      // 2. Send email via API (pass JWT for auth)
      const { data: { session } } = await supabase.auth.getSession()
      const emailRes = await fetch('/api/send-funnel-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token && { Authorization: `Bearer ${session.access_token}` }),
        },
        body: JSON.stringify({
          id: client.id,
          company_name: formData.company_name,
          slug: formData.slug,
          email: formData.email,
          client_type: formData.client_type,
          setup_price: formData.setup_price,
          monthly_price: formData.monthly_price,
          message: formData.message,
        }),
      })

      if (!emailRes.ok) {
        let errMsg = `Email send failed (${emailRes.status})`
        try { const errData = await emailRes.json(); errMsg = errData.error || errMsg } catch {}
        console.error(errMsg)
        // Client created but email failed — don't throw, just warn
      } else {
        // 3. Update status to sent
        await supabase
          .from('funnel_clients')
          .update({ status: 'sent' })
          .eq('id', client.id)
      }

      queryClient.invalidateQueries({ queryKey: ['funnel-clients'] })
      setShowForm(false)
      setFormData({
        company_name: '',
        slug: '',
        email: '',
        client_type: 'ecommerce',
        setup_price: 800,
        monthly_price: 800,
        hourly_cost: '',
        avg_ticket_time: '',
        actero_monthly_price: '',
        message: '',
      })
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleResendEmail = async (client) => {
    setSendingId(client.id)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/send-funnel-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token && { Authorization: `Bearer ${session.access_token}` }),
        },
        body: JSON.stringify({
          id: client.id,
          company_name: client.company_name,
          slug: client.slug,
          email: client.email,
          client_type: client.client_type,
          setup_price: client.setup_price,
          monthly_price: client.monthly_price,
          message: client.message,
        }),
      })
      if (res.ok) {
        await supabase
          .from('funnel_clients')
          .update({ status: 'sent' })
          .eq('id', client.id)
        queryClient.invalidateQueries({ queryKey: ['funnel-clients'] })
      }
    } catch (err) {
      console.error('Resend failed:', err)
    } finally {
      setSendingId(null)
    }
  }

  const copyLink = (slug, id) => {
    navigator.clipboard.writeText(`https://actero.fr/start/${slug}`)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const siteUrl = 'https://actero.fr'

  return (
    <div className="max-w-6xl mx-auto animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h2 className="text-[30px] font-bold mb-1">Funnel Clients</h2>
          <p className="text-[#71717a]">Liens de paiement privés post-call.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-white text-[#1a1a1a] px-5 py-2.5 rounded-xl text-[13px] font-bold flex items-center gap-2 hover:bg-gray-200 transition-colors"
        >
          <Plus className="w-4 h-4" /> Nouveau client
        </button>
      </div>

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-white/60 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative bg-[#ffffff] border border-[#f0f0f0] rounded-2xl p-8 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowForm(false)}
              className="absolute top-4 right-4 text-[#71717a] hover:text-[#1a1a1a] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-[18px] font-bold mb-6">Nouveau client funnel</h3>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-[12px] font-bold text-[#71717a] uppercase tracking-widest mb-2">
                  Nom entreprise *
                </label>
                <input
                  type="text"
                  required
                  value={formData.company_name}
                  onChange={(e) => handleCompanyNameChange(e.target.value)}
                  placeholder="Brand X"
                  className="w-full px-4 py-3 bg-white border border-[#f0f0f0] rounded-xl text-[13px] outline-none focus:border-gray-300 transition-all"
                />
              </div>

              <div>
                <label className="block text-[12px] font-bold text-[#71717a] uppercase tracking-widest mb-2">
                  Slug (URL)
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-[12px] text-[#71717a] shrink-0">/start/</span>
                  <input
                    type="text"
                    required
                    value={formData.slug}
                    onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                    className="w-full px-4 py-3 bg-white border border-[#f0f0f0] rounded-xl text-[13px] outline-none focus:border-gray-300 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-bold text-[#71717a] uppercase tracking-widest mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="contact@brand-x.com"
                  className="w-full px-4 py-3 bg-white border border-[#f0f0f0] rounded-xl text-[13px] outline-none focus:border-gray-300 transition-all"
                />
              </div>

              <div>
                <label className="block text-[12px] font-bold text-[#71717a] uppercase tracking-widest mb-2">
                  Type de client *
                </label>
                <select
                  required
                  value={formData.client_type}
                  onChange={(e) => {
                    const newType = e.target.value;
                    setFormData(prev => ({
                      ...prev,
                      client_type: newType,
                      hourly_cost: '',
                      avg_ticket_time: '',
                    }));
                  }}
                  className="w-full px-4 py-3 bg-white border border-[#f0f0f0] rounded-xl text-[13px] outline-none focus:border-gray-300 transition-all appearance-none cursor-pointer"
                >
                  <option value="ecommerce">🛒 E-commerce (Shopify)</option>
                  <option value="immobilier">🏠 Agence Immobilière</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-bold text-[#71717a] uppercase tracking-widest mb-2">
                    Prix setup (EUR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.setup_price}
                    onChange={(e) => setFormData(prev => ({ ...prev, setup_price: parseInt(e.target.value) || 0 }))}
                    className="w-full px-4 py-3 bg-white border border-[#f0f0f0] rounded-xl text-[13px] outline-none focus:border-gray-300 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-bold text-[#71717a] uppercase tracking-widest mb-2">
                    Prix mensuel (EUR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.monthly_price}
                    onChange={(e) => setFormData(prev => ({ ...prev, monthly_price: parseInt(e.target.value) || 0 }))}
                    className="w-full px-4 py-3 bg-white border border-[#f0f0f0] rounded-xl text-[13px] outline-none focus:border-gray-300 transition-all"
                  />
                </div>
              </div>

              <div className="border-t border-[#f0f0f0] pt-5 mt-1">
                <div className="flex items-center gap-3 mb-4">
                  <p className="text-[12px] font-bold text-[#71717a] uppercase tracking-widest">Configuration ROI (optionnel)</p>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    formData.client_type === 'immobilier'
                      ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
                      : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                  }`}>
                    {formData.client_type === 'immobilier' ? '🏠 Immo' : '🛒 E-com'}
                  </span>
                </div>
                {formData.client_type === 'immobilier' ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[12px] font-bold text-[#71717a] uppercase tracking-widest mb-2">
                        Coût horaire agent (€/h)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.hourly_cost}
                        onChange={(e) => setFormData(prev => ({ ...prev, hourly_cost: e.target.value }))}
                        placeholder="30"
                        className="w-full px-4 py-3 bg-white border border-[#f0f0f0] rounded-xl text-[13px] outline-none focus:border-gray-300 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-bold text-[#71717a] uppercase tracking-widest mb-2">
                        Temps moyen / lead (min)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={formData.avg_ticket_time}
                        onChange={(e) => setFormData(prev => ({ ...prev, avg_ticket_time: e.target.value }))}
                        placeholder="8"
                        className="w-full px-4 py-3 bg-white border border-[#f0f0f0] rounded-xl text-[13px] outline-none focus:border-gray-300 transition-all"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[12px] font-bold text-[#71717a] uppercase tracking-widest mb-2">
                        Coût horaire support (€/h)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.hourly_cost}
                        onChange={(e) => setFormData(prev => ({ ...prev, hourly_cost: e.target.value }))}
                        placeholder="25"
                        className="w-full px-4 py-3 bg-white border border-[#f0f0f0] rounded-xl text-[13px] outline-none focus:border-gray-300 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-bold text-[#71717a] uppercase tracking-widest mb-2">
                        Temps moyen / ticket (min)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={formData.avg_ticket_time}
                        onChange={(e) => setFormData(prev => ({ ...prev, avg_ticket_time: e.target.value }))}
                        placeholder="5"
                        className="w-full px-4 py-3 bg-white border border-[#f0f0f0] rounded-xl text-[13px] outline-none focus:border-gray-300 transition-all"
                      />
                    </div>
                  </div>
                )}
              </div>

              {formError && (
                <p className="text-[13px] text-red-400">{formError}</p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-white text-[#1a1a1a] py-3 rounded-xl font-bold text-[13px] hover:bg-gray-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Création en cours...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Créer et envoyer l'email
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Sparkles className="w-8 h-8 animate-pulse text-[#71717a]" />
        </div>
      ) : funnelClients.length === 0 ? (
        <div className="bg-[#ffffff] border border-[#f0f0f0] rounded-2xl p-16 text-center flex flex-col items-center">
          <Link2 className="w-12 h-12 text-[#71717a] mb-4" />
          <h3 className="text-[18px] font-bold mb-2">Aucun client funnel</h3>
          <p className="text-[#71717a] mb-4">Créez votre premier lien de paiement privé.</p>
          <button
            onClick={() => setShowForm(true)}
            className="bg-white text-[#1a1a1a] px-5 py-2.5 rounded-xl text-[13px] font-bold"
          >
            Nouveau client
          </button>
        </div>
      ) : (
        <div className="bg-[#ffffff] border border-[#f0f0f0] rounded-2xl overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="border-b border-[#f0f0f0] bg-white">
                <th className="px-6 py-4 text-[12px] font-bold text-[#71717a] uppercase tracking-widest">Entreprise</th>
                <th className="px-6 py-4 text-[12px] font-bold text-[#71717a] uppercase tracking-widest">Type</th>
                <th className="px-6 py-4 text-[12px] font-bold text-[#71717a] uppercase tracking-widest">Email</th>
                <th className="px-6 py-4 text-[12px] font-bold text-[#71717a] uppercase tracking-widest">Pricing</th>
                <th className="px-6 py-4 text-[12px] font-bold text-[#71717a] uppercase tracking-widest">Statut</th>
                <th className="px-6 py-4 text-[12px] font-bold text-[#71717a] uppercase tracking-widest">Date</th>
                <th className="px-6 py-4 text-[12px] font-bold text-[#71717a] uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-[13px]">
              {funnelClients.map((client) => {
                const status = STATUS_CONFIG[client.status] || STATUS_CONFIG.draft
                return (
                  <tr key={client.id} className="hover:bg-[#fafafa] transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-[#1a1a1a]">{client.company_name}</div>
                      <div className="text-[12px] text-[#71717a] mt-0.5">/start/{client.slug}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase border ${
                        client.client_type === 'immobilier'
                          ? 'bg-violet-500/10 text-violet-400 border-violet-500/20'
                          : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                      }`}>
                        {client.client_type === 'immobilier' ? '🏠 Immo' : '🛒 E-com'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[#71717a]">{client.email}</td>
                    <td className="px-6 py-4">
                      <div className="text-[#1a1a1a] font-mono text-[12px]">
                        {client.setup_price}€ + {client.monthly_price}€/m
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`${status.color} border px-2.5 py-1 rounded-md text-[10px] font-bold uppercase`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[#71717a] text-[12px]">
                      {new Date(client.created_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        {/* Copy link */}
                        <button
                          onClick={() => copyLink(client.slug, client.id)}
                          className="p-2 text-[#71717a] hover:text-[#1a1a1a] transition-colors rounded-lg hover:bg-[#fafafa]"
                          title="Copier le lien"
                        >
                          {copiedId === client.id ? (
                            <Check className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>

                        {/* Open link */}
                        <a
                          href={`${siteUrl}/start/${client.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-[#71717a] hover:text-[#1a1a1a] transition-colors rounded-lg hover:bg-[#fafafa]"
                          title="Ouvrir le lien"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>

                        {/* Resend email */}
                        <button
                          onClick={() => handleResendEmail(client)}
                          disabled={sendingId === client.id}
                          className="p-2 text-[#71717a] hover:text-[#1a1a1a] transition-colors rounded-lg hover:bg-[#fafafa] disabled:opacity-40"
                          title="Renvoyer l'email"
                        >
                          {sendingId === client.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <RotateCcw className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
