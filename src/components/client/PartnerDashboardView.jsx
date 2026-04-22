import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Award,
  Copy,
  Check,
  DollarSign,
  Users,
  TrendingUp,
  ExternalLink,
  Edit3,
  Save,
  Loader2,
  Globe,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

/**
 * PartnerDashboardView
 * Rendered inside ClientDashboard when the authenticated user has a
 * matching row in the `partners` table. Shows stats, commissions,
 * the unique referral link, and a profile editor.
 */
export const PartnerDashboardView = ({ theme = 'light' }) => {
  const queryClient = useQueryClient()
  const [copied, setCopied] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(null)

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['partner-me'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Non authentifié')
      const res = await fetch('/api/partners/me', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erreur de chargement')
      return json
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (updates) => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Non authentifié')
      const res = await fetch('/api/partners/me', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(updates),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erreur de mise à jour')
      return json
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-me'] })
      setEditing(false)
    },
  })

  const startEdit = () => {
    if (!data?.partner) return
    setForm({
      bio: data.partner.bio || '',
      avatar_url: data.partner.avatar_url || '',
      website: data.partner.website || '',
      linkedin: data.partner.linkedin || '',
      company_name: data.partner.company_name || '',
      specialties: (data.partner.specialties || []).join(', '),
      industries: (data.partner.industries || []).join(', '),
    })
    setEditing(true)
  }

  const submitEdit = (e) => {
    e.preventDefault()
    const payload = {
      bio: form.bio,
      avatar_url: form.avatar_url || null,
      website: form.website || null,
      linkedin: form.linkedin || null,
      company_name: form.company_name || null,
      specialties: form.specialties
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      industries: form.industries
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    }
    updateMutation.mutate(payload)
  }

  const copyLink = async () => {
    if (!data?.referral_url) return
    try {
      await navigator.clipboard.writeText(data.referral_url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-[#71717a]" />
      </div>
    )
  }

  if (isError || !data?.partner) {
    return (
      <div className="p-8 text-center">
        {isError && <p className="text-red-500 mb-2">{error?.message}</p>}
        <p className="text-sm text-[#71717a]">
          Vous n avez pas encore de profil Actero Partner.
        </p>
      </div>
    )
  }

  const { partner, commissions, referral_url } = data
  const totalPaid = (commissions || [])
    .filter((c) => c.status === 'paid')
    .reduce((s, c) => s + Number(c.amount || 0), 0)
  const totalPending = (commissions || [])
    .filter((c) => c.status === 'pending')
    .reduce((s, c) => s + Number(c.amount || 0), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-600 text-xs font-bold uppercase tracking-widest mb-3">
            <Award className="w-3.5 h-3.5" />
            Actero Certified Partner
          </div>
          <h2 className="text-2xl font-bold">{partner.full_name}</h2>
          {partner.company_name && (
            <p className="text-sm text-[#71717a]">{partner.company_name}</p>
          )}
        </div>
        <a
          href={`/partners/${partner.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-full text-sm font-semibold hover:border-indigo-500/30 transition-colors"
        >
          <Globe className="w-4 h-4" />
          Voir mon profil public
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={Users}
          label="Clients référés"
          value={partner.total_referred || 0}
          color="text-indigo-500"
        />
        <StatCard
          icon={TrendingUp}
          label="Clients actifs"
          value={partner.active_clients || 0}
          color="text-emerald-500"
        />
        <StatCard
          icon={DollarSign}
          label="Commissions encaissées"
          value={`${totalPaid.toFixed(0)} €`}
          hint={totalPending > 0 ? `+${totalPending.toFixed(0)} € en attente` : null}
          color="text-amber-500"
        />
      </div>

      {/* Referral link */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
        <h3 className="font-bold text-lg mb-2">Votre lien de referral</h3>
        <p className="text-sm opacity-90 mb-4">
          Partagez ce lien à vos clients. Vous touchez 20% sur chaque abonnement à vie.
        </p>
        <div className="flex items-center gap-2 p-3 bg-white/15 backdrop-blur rounded-xl">
          <code className="flex-1 text-sm font-mono truncate">{referral_url}</code>
          <button
            onClick={copyLink}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-indigo-600 font-semibold rounded-lg text-xs hover:scale-105 transition-transform"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copié' : 'Copier'}
          </button>
        </div>
      </div>

      {/* Commissions table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-gray-200">
          <h3 className="font-bold">Historique des commissions</h3>
        </div>
        {(!commissions || commissions.length === 0) ? (
          <div className="p-8 text-center text-sm text-[#71717a]">
            Aucune commission pour le moment. Elles apparaîtront ici dès qu un
            client s inscrit via votre lien.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-[#71717a] text-xs uppercase">
                <tr>
                  <th className="text-left px-5 py-3 font-semibold">Date</th>
                  <th className="text-left px-5 py-3 font-semibold">Montant</th>
                  <th className="text-left px-5 py-3 font-semibold">%</th>
                  <th className="text-left px-5 py-3 font-semibold">Statut</th>
                </tr>
              </thead>
              <tbody>
                {commissions.map((c) => (
                  <tr key={c.id} className="border-t border-gray-100">
                    <td className="px-5 py-3">
                      {new Date(c.created_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-5 py-3 font-semibold">
                      {Number(c.amount).toFixed(2)} €
                    </td>
                    <td className="px-5 py-3">{c.percentage}%</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={c.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Profile editor */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold">Modifier mon profil</h3>
          {!editing && (
            <button
              onClick={startEdit}
              className="inline-flex items-center gap-1.5 text-sm text-indigo-500 font-semibold hover:underline"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Modifier
            </button>
          )}
        </div>

        {editing && form ? (
          <form onSubmit={submitEdit} className="space-y-4">
            <Field
              label="Bio"
              children={
                <textarea
                  rows={4}
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F9F7F1] border border-gray-200 rounded-lg text-sm outline-none focus:border-indigo-500/40 resize-none"
                />
              }
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field
                label="Avatar (URL)"
                children={
                  <input
                    type="url"
                    value={form.avatar_url}
                    onChange={(e) => setForm({ ...form, avatar_url: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F9F7F1] border border-gray-200 rounded-lg text-sm outline-none focus:border-indigo-500/40"
                  />
                }
              />
              <Field
                label="Entreprise"
                children={
                  <input
                    type="text"
                    value={form.company_name}
                    onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F9F7F1] border border-gray-200 rounded-lg text-sm outline-none focus:border-indigo-500/40"
                  />
                }
              />
              <Field
                label="Site web"
                children={
                  <input
                    type="url"
                    value={form.website}
                    onChange={(e) => setForm({ ...form, website: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F9F7F1] border border-gray-200 rounded-lg text-sm outline-none focus:border-indigo-500/40"
                  />
                }
              />
              <Field
                label="LinkedIn"
                children={
                  <input
                    type="url"
                    value={form.linkedin}
                    onChange={(e) => setForm({ ...form, linkedin: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F9F7F1] border border-gray-200 rounded-lg text-sm outline-none focus:border-indigo-500/40"
                  />
                }
              />
            </div>
            <Field
              label="Spécialités (séparées par des virgules)"
              children={
                <input
                  type="text"
                  value={form.specialties}
                  onChange={(e) => setForm({ ...form, specialties: e.target.value })}
                  placeholder="Shopify, SAV IA, Agent vocal"
                  className="w-full px-3 py-2 bg-[#F9F7F1] border border-gray-200 rounded-lg text-sm outline-none focus:border-indigo-500/40"
                />
              }
            />
            <Field
              label="Industries (séparées par des virgules)"
              children={
                <input
                  type="text"
                  value={form.industries}
                  onChange={(e) => setForm({ ...form, industries: e.target.value })}
                  placeholder="E-commerce, Mode, Beauté"
                  className="w-full px-3 py-2 bg-[#F9F7F1] border border-gray-200 rounded-lg text-sm outline-none focus:border-indigo-500/40"
                />
              }
            />
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={updateMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white font-semibold rounded-lg text-sm disabled:opacity-50"
              >
                {updateMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Enregistrer
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="px-4 py-2 bg-white border border-gray-200 text-[#71717a] font-semibold rounded-lg text-sm"
              >
                Annuler
              </button>
              {updateMutation.isError && (
                <span className="text-xs text-red-500">
                  {updateMutation.error?.message}
                </span>
              )}
            </div>
          </form>
        ) : (
          <div className="text-sm text-[#71717a] space-y-2">
            <p>
              <strong className="text-[#1a1a1a]">Bio:</strong>{' '}
              {partner.bio || <em className="text-gray-400">Non renseignée</em>}
            </p>
            <p>
              <strong className="text-[#1a1a1a]">Spécialités:</strong>{' '}
              {(partner.specialties || []).join(', ') || (
                <em className="text-gray-400">Aucune</em>
              )}
            </p>
            <p>
              <strong className="text-[#1a1a1a]">Industries:</strong>{' '}
              {(partner.industries || []).join(', ') || (
                <em className="text-gray-400">Aucune</em>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

const StatCard = ({ icon: Icon, label, value, hint, color }) => (
  <div className="p-5 bg-white border border-gray-200 rounded-2xl">
    <div className={`w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center mb-3 ${color}`}>
      <Icon className="w-5 h-5" />
    </div>
    <div className="text-2xl font-bold">{value}</div>
    <div className="text-xs text-[#71717a]">{label}</div>
    {hint && <div className="text-[11px] text-amber-600 mt-1">{hint}</div>}
  </div>
)

const StatusBadge = ({ status }) => {
  const cfg = {
    pending: { label: 'En attente', class: 'bg-amber-400/10 text-amber-600' },
    paid: { label: 'Payée', class: 'bg-emerald-400/10 text-emerald-600' },
    refunded: { label: 'Remboursée', class: 'bg-red-400/10 text-red-600' },
  }[status] || { label: status, class: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold ${cfg.class}`}>
      {cfg.label}
    </span>
  )
}

const Field = ({ label, children }) => (
  <div>
    <label className="block text-xs font-semibold text-[#71717a] mb-1">{label}</label>
    {children}
  </div>
)
