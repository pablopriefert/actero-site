import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Link2, Mail, Copy, Check, RotateCcw,
  Sparkles, X, Loader2, ExternalLink, Send
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

const STATUS_CONFIG = {
  draft: { label: 'Brouillon', color: 'bg-gray-500/10 text-gray-400 border-gray-500/20' },
  sent: { label: 'Email envoyé', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  paid: { label: 'Payé', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
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
    setup_price: 800,
    monthly_price: 800,
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
          setup_price: formData.setup_price,
          monthly_price: formData.monthly_price,
          message: formData.message || null,
          status: 'draft',
        }])
        .select()
        .single()

      if (insertError) throw insertError

      // 2. Send email via API
      const emailRes = await fetch('/api/send-funnel-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: client.id,
          company_name: formData.company_name,
          slug: formData.slug,
          email: formData.email,
          setup_price: formData.setup_price,
          monthly_price: formData.monthly_price,
          message: formData.message,
        }),
      })

      if (!emailRes.ok) {
        const errData = await emailRes.json()
        console.error('Email send failed:', errData)
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
        setup_price: 800,
        monthly_price: 800,
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
      const res = await fetch('/api/send-funnel-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: client.id,
          company_name: client.company_name,
          slug: client.slug,
          email: client.email,
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
          <h2 className="text-3xl font-bold mb-1">Funnel Clients</h2>
          <p className="text-gray-500">Liens de paiement privés post-call.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-white text-black px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-gray-200 transition-colors"
        >
          <Plus className="w-4 h-4" /> Nouveau client
        </button>
      </div>

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative bg-[#0a0a0a] border border-white/10 rounded-2xl p-8 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowForm(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-bold mb-6">Nouveau client funnel</h3>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                  Nom entreprise *
                </label>
                <input
                  type="text"
                  required
                  value={formData.company_name}
                  onChange={(e) => handleCompanyNameChange(e.target.value)}
                  placeholder="Brand X"
                  className="w-full px-4 py-3 bg-[#030303] border border-white/10 rounded-xl text-sm outline-none focus:border-white/20 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                  Slug (URL)
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 shrink-0">/start/</span>
                  <input
                    type="text"
                    required
                    value={formData.slug}
                    onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                    className="w-full px-4 py-3 bg-[#030303] border border-white/10 rounded-xl text-sm outline-none focus:border-white/20 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="contact@brand-x.com"
                  className="w-full px-4 py-3 bg-[#030303] border border-white/10 rounded-xl text-sm outline-none focus:border-white/20 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                    Prix setup (EUR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.setup_price}
                    onChange={(e) => setFormData(prev => ({ ...prev, setup_price: parseInt(e.target.value) || 0 }))}
                    className="w-full px-4 py-3 bg-[#030303] border border-white/10 rounded-xl text-sm outline-none focus:border-white/20 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                    Prix mensuel (EUR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.monthly_price}
                    onChange={(e) => setFormData(prev => ({ ...prev, monthly_price: parseInt(e.target.value) || 0 }))}
                    className="w-full px-4 py-3 bg-[#030303] border border-white/10 rounded-xl text-sm outline-none focus:border-white/20 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                  Message personnalisé (optionnel)
                </label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                  rows={3}
                  placeholder="Un mot pour le client..."
                  className="w-full px-4 py-3 bg-[#030303] border border-white/10 rounded-xl text-sm outline-none focus:border-white/20 transition-all resize-none"
                />
              </div>

              {formError && (
                <p className="text-sm text-red-400">{formError}</p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-white text-black py-3 rounded-xl font-bold text-sm hover:bg-gray-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
          <Sparkles className="w-8 h-8 animate-pulse text-gray-400" />
        </div>
      ) : funnelClients.length === 0 ? (
        <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-16 text-center flex flex-col items-center">
          <Link2 className="w-12 h-12 text-gray-600 mb-4" />
          <h3 className="text-xl font-bold mb-2">Aucun client funnel</h3>
          <p className="text-gray-500 mb-4">Créez votre premier lien de paiement privé.</p>
          <button
            onClick={() => setShowForm(true)}
            className="bg-white text-black px-5 py-2.5 rounded-xl text-sm font-bold"
          >
            Nouveau client
          </button>
        </div>
      ) : (
        <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="border-b border-white/5 bg-[#030303]">
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Entreprise</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Email</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Pricing</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Statut</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Date</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm">
              {funnelClients.map((client) => {
                const status = STATUS_CONFIG[client.status] || STATUS_CONFIG.draft
                return (
                  <tr key={client.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-white">{client.company_name}</div>
                      <div className="text-xs text-gray-600 mt-0.5">/start/{client.slug}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-400">{client.email}</td>
                    <td className="px-6 py-4">
                      <div className="text-white font-mono text-xs">
                        {client.setup_price}€ + {client.monthly_price}€/m
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`${status.color} border px-2.5 py-1 rounded-md text-[10px] font-bold uppercase`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-xs">
                      {new Date(client.created_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        {/* Copy link */}
                        <button
                          onClick={() => copyLink(client.slug, client.id)}
                          className="p-2 text-gray-500 hover:text-white transition-colors rounded-lg hover:bg-white/5"
                          title="Copier le lien"
                        >
                          {copiedId === client.id ? (
                            <Check className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>

                        {/* Open link */}
                        <a
                          href={`${siteUrl}/start/${client.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-gray-500 hover:text-white transition-colors rounded-lg hover:bg-white/5"
                          title="Ouvrir le lien"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>

                        {/* Resend email */}
                        <button
                          onClick={() => handleResendEmail(client)}
                          disabled={sendingId === client.id}
                          className="p-2 text-gray-500 hover:text-white transition-colors rounded-lg hover:bg-white/5 disabled:opacity-40"
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
