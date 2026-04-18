import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Plus, Copy, Check, Trash2, Eye, EyeOff, Handshake, Clock, Users,
  Loader2, X, ExternalLink, Send, Mail
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../ui/Toast'

export const AdminPartnerTokensView = () => {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [showSendEmail, setShowSendEmail] = useState(false)
  const [copiedId, setCopiedId] = useState(null)
  const [form, setForm] = useState({
    agency_name: '',
    contact_name: '',
    contact_email: '',
    expires_in_days: 90,
    notes: '',
  })
  const [emailForm, setEmailForm] = useState({
    agency_name: '',
    contact_name: '',
    contact_email: '',
    expires_in_days: 90,
    notes: '',
  })

  const { data: tokens = [], isLoading } = useQuery({
    queryKey: ['admin-partner-tokens'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/partner-tokens', {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      return data.tokens || []
    },
  })

  const createMutation = useMutation({
    mutationFn: async (payload) => {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/partner-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-partner-tokens'] })
      toast.success('Lien partenaire créé')
      // Auto-copy the URL
      navigator.clipboard.writeText(data.url).catch(() => {})
      setShowCreate(false)
      setForm({ agency_name: '', contact_name: '', contact_email: '', expires_in_days: 90, notes: '' })
    },
    onError: (err) => toast.error(err.message),
  })

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }) => {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`/api/admin/partner-tokens?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ is_active }),
      })
      if (!res.ok) throw new Error('Échec')
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-partner-tokens'] }),
  })

  const sendEmailMutation = useMutation({
    mutationFn: async (payload) => {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/send-partner-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Échec de l\'envoi')
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-partner-tokens'] })
      toast.success(`Email envoyé à ${data.sent_to}`)
      setShowSendEmail(false)
      setEmailForm({ agency_name: '', contact_name: '', contact_email: '', expires_in_days: 90, notes: '' })
    },
    onError: (err) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`/api/admin/partner-tokens?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (!res.ok) throw new Error('Échec')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-partner-tokens'] })
      toast.success('Token supprimé')
    },
  })

  const copyUrl = (token) => {
    const url = `https://actero.fr/partner?token=${token}`
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(token)
      toast.success('Lien copié')
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#1a1a1a]">Liens partenaires privés</h2>
          <p className="text-sm text-[#71717a] mt-1">Générez des liens uniques pour les agences Shopify (envoi par cold email)</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white text-[#1a1a1a] text-sm font-semibold hover:bg-gray-50 transition-colors"
          >
            <Plus className="w-4 h-4" /> Nouveau lien
          </button>
          <button
            onClick={() => setShowSendEmail(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cta text-white text-sm font-semibold hover:bg-[#003725] transition-colors"
          >
            <Send className="w-4 h-4" /> Envoyer par email
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#71717a]">Liens créés</span>
            <Handshake className="w-4 h-4 text-indigo-500" />
          </div>
          <span className="text-3xl font-bold text-[#1a1a1a]">{tokens.length}</span>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#71717a]">Liens actifs</span>
            <Eye className="w-4 h-4 text-emerald-500" />
          </div>
          <span className="text-3xl font-bold text-[#1a1a1a]">{tokens.filter(t => t.is_active).length}</span>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#71717a]">Ouverts au moins 1×</span>
            <Users className="w-4 h-4 text-violet-500" />
          </div>
          <span className="text-3xl font-bold text-[#1a1a1a]">{tokens.filter(t => t.use_count > 0).length}</span>
        </div>
      </div>

      {/* Tokens table */}
      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-[#71717a]"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
        ) : tokens.length === 0 ? (
          <div className="p-12 text-center">
            <Handshake className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-[#1a1a1a]">Aucun lien partenaire</p>
            <p className="text-xs text-[#71717a] mt-1">Créez votre premier lien pour une agence Shopify.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider text-[#71717a]">Agence</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider text-[#71717a]">Contact</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider text-[#71717a]">Créé</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider text-[#71717a]">Usage</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider text-[#71717a]">Expire</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider text-[#71717a]">Statut</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold uppercase tracking-wider text-[#71717a]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tokens.map((t) => (
                  <tr key={t.id} className="border-b border-gray-100">
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-[#1a1a1a]">{t.agency_name}</p>
                      {t.notes && <p className="text-xs text-[#71717a]">{t.notes}</p>}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-[#1a1a1a]">{t.contact_name || '—'}</p>
                      <p className="text-xs text-[#71717a]">{t.contact_email || ''}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-[#71717a]">
                      {new Date(t.created_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-[#1a1a1a]">{t.use_count || 0}× ouvert</p>
                      {t.last_used_at && (
                        <p className="text-xs text-[#71717a]">dernière: {new Date(t.last_used_at).toLocaleDateString('fr-FR')}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-[#71717a]">
                      {t.expires_at ? new Date(t.expires_at).toLocaleDateString('fr-FR') : 'Jamais'}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => toggleMutation.mutate({ id: t.id, is_active: !t.is_active })}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                          t.is_active
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {t.is_active ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        {t.is_active ? 'Actif' : 'Inactif'}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => copyUrl(t.token)}
                          className="p-2 rounded-lg hover:bg-gray-50 transition-colors"
                          title="Copier le lien"
                        >
                          {copiedId === t.token ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-[#71717a]" />}
                        </button>
                        <a
                          href={`/partner?token=${t.token}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 rounded-lg hover:bg-gray-50 transition-colors"
                          title="Ouvrir"
                        >
                          <ExternalLink className="w-4 h-4 text-[#71717a]" />
                        </a>
                        <button
                          onClick={() => window.confirm(`Supprimer le lien de ${t.agency_name} ?`) && deleteMutation.mutate(t.id)}
                          className="p-2 rounded-lg hover:bg-red-50 transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full"
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-[#1a1a1a]">Nouveau lien partenaire</h3>
              <button onClick={() => setShowCreate(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X className="w-4 h-4 text-[#71717a]" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-[#71717a] uppercase tracking-wider">Nom de l'agence *</label>
                <input
                  type="text"
                  value={form.agency_name}
                  onChange={(e) => setForm({ ...form, agency_name: e.target.value })}
                  placeholder="Acme Shopify Agency"
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-cta/20"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#71717a] uppercase tracking-wider">Contact</label>
                  <input
                    type="text"
                    value={form.contact_name}
                    onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                    placeholder="Jean Dupont"
                    className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-cta/20"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#71717a] uppercase tracking-wider">Email</label>
                  <input
                    type="email"
                    value={form.contact_email}
                    onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                    placeholder="jean@acme.com"
                    className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-cta/20"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-[#71717a] uppercase tracking-wider">Expiration (jours)</label>
                <input
                  type="number"
                  value={form.expires_in_days}
                  onChange={(e) => setForm({ ...form, expires_in_days: parseInt(e.target.value) || 0 })}
                  min="0"
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-cta/20"
                />
                <p className="text-[10px] text-[#9ca3af] mt-1">0 = jamais</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-[#71717a] uppercase tracking-wider">Notes internes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  placeholder="Ex: rencontré à Shopify Unite 2026"
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-cta/20"
                />
              </div>
            </div>
            <button
              onClick={() => createMutation.mutate(form)}
              disabled={!form.agency_name || createMutation.isPending}
              className="w-full mt-5 py-2.5 rounded-xl bg-cta text-white text-sm font-semibold hover:bg-[#003725] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Créer et copier le lien
            </button>
          </motion.div>
        </div>
      )}

      {/* Send email modal */}
      {showSendEmail && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowSendEmail(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold text-[#1a1a1a] flex items-center gap-2">
                <Mail className="w-5 h-5 text-cta" />
                Envoyer une invitation
              </h3>
              <button onClick={() => setShowSendEmail(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X className="w-4 h-4 text-[#71717a]" />
              </button>
            </div>
            <p className="text-xs text-[#71717a] mb-5">
              Crée automatiquement un lien partenaire unique et envoie l'email depuis contact@actero.fr
            </p>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-[#71717a] uppercase tracking-wider">Email de l'agence *</label>
                <input
                  type="email"
                  value={emailForm.contact_email}
                  onChange={(e) => setEmailForm({ ...emailForm, contact_email: e.target.value })}
                  placeholder="contact@acme-agency.com"
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-cta/20"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#71717a] uppercase tracking-wider">Nom de l'agence *</label>
                <input
                  type="text"
                  value={emailForm.agency_name}
                  onChange={(e) => setEmailForm({ ...emailForm, agency_name: e.target.value })}
                  placeholder="Acme Shopify Agency"
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-cta/20"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#71717a] uppercase tracking-wider">Prénom contact</label>
                <input
                  type="text"
                  value={emailForm.contact_name}
                  onChange={(e) => setEmailForm({ ...emailForm, contact_name: e.target.value })}
                  placeholder="Jean (personnalise le Bonjour Jean)"
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-cta/20"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#71717a] uppercase tracking-wider">Expiration (jours)</label>
                <input
                  type="number"
                  value={emailForm.expires_in_days}
                  onChange={(e) => setEmailForm({ ...emailForm, expires_in_days: parseInt(e.target.value) || 0 })}
                  min="0"
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-cta/20"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#71717a] uppercase tracking-wider">Notes internes</label>
                <textarea
                  value={emailForm.notes}
                  onChange={(e) => setEmailForm({ ...emailForm, notes: e.target.value })}
                  rows={2}
                  placeholder="Ex: rencontré à Shopify Unite"
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-cta/20"
                />
              </div>
            </div>
            <button
              onClick={() => sendEmailMutation.mutate(emailForm)}
              disabled={!emailForm.agency_name || !emailForm.contact_email || sendEmailMutation.isPending}
              className="w-full mt-5 py-2.5 rounded-xl bg-cta text-white text-sm font-semibold hover:bg-[#003725] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {sendEmailMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Envoyer l'invitation
            </button>
            <p className="text-[10px] text-[#9ca3af] text-center mt-3">
              Email envoyé depuis contact@actero.fr avec le lien partenaire intégré
            </p>
          </motion.div>
        </div>
      )}
    </div>
  )
}
