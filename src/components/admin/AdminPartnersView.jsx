import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, Search, Handshake, Mail, Phone, Building2,
  CheckCircle2, XCircle, Clock, Eye, Loader2, MoreVertical,
  Briefcase, ChevronDown, Filter, X, AlertCircle, Plus, Trash2,
  Send, CreditCard,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../ui/Toast'

const PaymentLinkForm = ({ email, name }) => {
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)

  const handleSend = async () => {
    if (!amount) return
    setSending(true)
    setResult(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/partner/send-payment-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          partner_email: email,
          partner_name: name,
          amount_eur: parseFloat(amount),
          description: description || undefined,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setResult({ ok: true, message: `Lien envoye a ${email}` })
        setAmount('')
        setDescription('')
      } else {
        setResult({ ok: false, message: data.error || 'Erreur' })
      }
    } catch {
      setResult({ ok: false, message: 'Erreur reseau' })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-200">
      <div className="flex items-center gap-2 mb-2">
        <CreditCard className="w-3.5 h-3.5 text-[#003725]" />
        <span className="text-xs font-bold text-[#262626]">Envoyer un lien de paiement</span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="number"
          placeholder="Montant (EUR)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-28 px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-[#262626] outline-none focus:ring-1 focus:ring-gray-300"
        />
        <input
          type="text"
          placeholder="Description (optionnel)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="flex-1 min-w-[150px] px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-[#262626] outline-none focus:ring-1 focus:ring-gray-300"
        />
        <button
          onClick={handleSend}
          disabled={!amount || sending}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0F5F35] text-white rounded-lg text-xs font-bold hover:bg-[#003725] transition-colors disabled:opacity-50"
        >
          {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
          Envoyer
        </button>
      </div>
      {result && (
        <p className={`text-xs mt-2 font-medium ${result.ok ? 'text-[#003725]' : 'text-red-500'}`}>
          {result.ok ? '✓' : '✗'} {result.message}
        </p>
      )}
    </div>
  )
}

const STATUS_MAP = {
  new: { label: 'Nouveau', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  contacted: { label: 'Contacté', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  qualified: { label: 'Qualifié', color: 'bg-green-500/10 text-green-400 border-green-500/20' },
  rejected: { label: 'Rejeté', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
}

const StatusBadge = ({ status }) => {
  const s = STATUS_MAP[status] || STATUS_MAP.new
  return (
    <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${s.color}`}>
      {s.label}
    </span>
  )
}

export const AdminPartnersView = () => {
  const toast = useToast();
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [expandedRow, setExpandedRow] = useState(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newPartner, setNewPartner] = useState({ first_name: '', last_name: '', email: '', company_name: '', phone: '', activity_type: '', potential_clients: '' })
  const [creating, setCreating] = useState(false)

  const { data: partners = [], isLoading } = useQuery({
    queryKey: ['admin-partners'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partner_applications')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
  })

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }) => {
      const { error } = await supabase
        .from('partner_applications')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-partners'] })
    },
  })

  const handleCreate = async () => {
    if (!newPartner.first_name || !newPartner.last_name || !newPartner.email) return
    setCreating(true)
    try {
      const { error } = await supabase.from('partner_applications').insert([{
        ...newPartner,
        status: 'new',
        source: 'admin_manual',
      }])
      if (error) throw error
      queryClient.invalidateQueries({ queryKey: ['admin-partners'] })
      setNewPartner({ first_name: '', last_name: '', email: '', company_name: '', phone: '', activity_type: '', potential_clients: '' })
      setShowCreateForm(false)
    } catch (err) {
      toast.error('Erreur: ' + err.message)
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id, name) => {
    if (!confirm(`Supprimer le partenaire ${name} ?`)) return
    const { error } = await supabase.from('partner_applications').delete().eq('id', id)
    if (!error) queryClient.invalidateQueries({ queryKey: ['admin-partners'] })
  }

  const filtered = partners.filter((p) => {
    const matchesSearch =
      !search ||
      `${p.first_name} ${p.last_name} ${p.email} ${p.company_name}`
        .toLowerCase()
        .includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const statCounts = {
    total: partners.length,
    new: partners.filter((p) => p.status === 'new').length,
    contacted: partners.filter((p) => p.status === 'contacted').length,
    qualified: partners.filter((p) => p.status === 'qualified').length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <Handshake className="w-7 h-7 text-indigo-400" />
            Partenaires
          </h2>
          <p className="text-sm text-[#716D5C] mt-1">
            Candidatures du programme partenaire B2B
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#0F5F35] text-white rounded-full text-sm font-semibold hover:bg-[#003725] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Ajouter
        </button>
      </div>

      {/* Create form */}
      <AnimatePresence>
        {showCreateForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-6 rounded-xl bg-[#F9F7F1] border border-gray-200 space-y-4">
              <h3 className="text-sm font-bold text-[#262626]">Nouveau partenaire</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  type="text"
                  placeholder="Prenom *"
                  value={newPartner.first_name}
                  onChange={(e) => setNewPartner(p => ({ ...p, first_name: e.target.value }))}
                  className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-[#262626] outline-none focus:ring-1 focus:ring-gray-300"
                />
                <input
                  type="text"
                  placeholder="Nom *"
                  value={newPartner.last_name}
                  onChange={(e) => setNewPartner(p => ({ ...p, last_name: e.target.value }))}
                  className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-[#262626] outline-none focus:ring-1 focus:ring-gray-300"
                />
                <input
                  type="email"
                  placeholder="Email *"
                  value={newPartner.email}
                  onChange={(e) => setNewPartner(p => ({ ...p, email: e.target.value }))}
                  className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-[#262626] outline-none focus:ring-1 focus:ring-gray-300"
                />
                <input
                  type="text"
                  placeholder="Societe"
                  value={newPartner.company_name}
                  onChange={(e) => setNewPartner(p => ({ ...p, company_name: e.target.value }))}
                  className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-[#262626] outline-none focus:ring-1 focus:ring-gray-300"
                />
                <input
                  type="text"
                  placeholder="Telephone"
                  value={newPartner.phone}
                  onChange={(e) => setNewPartner(p => ({ ...p, phone: e.target.value }))}
                  className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-[#262626] outline-none focus:ring-1 focus:ring-gray-300"
                />
                <input
                  type="text"
                  placeholder="Type d'activite"
                  value={newPartner.activity_type}
                  onChange={(e) => setNewPartner(p => ({ ...p, activity_type: e.target.value }))}
                  className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-[#262626] outline-none focus:ring-1 focus:ring-gray-300"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleCreate}
                  disabled={creating || !newPartner.first_name || !newPartner.last_name || !newPartner.email}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#0F5F35] text-white rounded-xl text-sm font-semibold hover:bg-[#003725] transition-colors disabled:opacity-50"
                >
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Creer le partenaire
                </button>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2.5 text-sm font-semibold text-[#716D5C] hover:text-[#262626] transition-colors"
                >
                  Annuler
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: statCounts.total, icon: Users, color: 'text-[#716D5C]' },
          { label: 'Nouveaux', value: statCounts.new, icon: Clock, color: 'text-blue-400' },
          { label: 'Contactés', value: statCounts.contacted, icon: Mail, color: 'text-amber-400' },
          { label: 'Qualifiés', value: statCounts.qualified, icon: CheckCircle2, color: 'text-green-400' },
        ].map((stat, i) => (
          <div key={i} className="p-4 rounded-xl bg-gray-50 border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
              <span className="text-xs text-[#716D5C]">{stat.label}</span>
            </div>
            <div className="text-2xl font-bold">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#716D5C]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom, email, société..."
            className="w-full pl-10 pr-4 py-2.5 bg-[#F9F7F1] border border-gray-200 rounded-xl text-sm text-[#262626] placeholder-gray-600 outline-none focus:border-indigo-500/40"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 bg-[#F9F7F1] border border-gray-200 rounded-xl text-sm text-[#262626] outline-none focus:border-indigo-500/40 appearance-none cursor-pointer"
        >
          <option value="all" className="bg-[#F9F7F1]">Tous les statuts</option>
          {Object.entries(STATUS_MAP).map(([key, val]) => (
            <option key={key} value={key} className="bg-[#F9F7F1]">{val.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-[#716D5C]">
          <AlertCircle className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p>Aucune candidature trouvée.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#716D5C] uppercase tracking-wider">Candidat</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#716D5C] uppercase tracking-wider">Société</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#716D5C] uppercase tracking-wider">Activité</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#716D5C] uppercase tracking-wider">Potentiel</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#716D5C] uppercase tracking-wider">Statut</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#716D5C] uppercase tracking-wider">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#716D5C] uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <React.Fragment key={p.id}>
                    <tr
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => setExpandedRow(expandedRow === p.id ? null : p.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium">{p.first_name} {p.last_name}</div>
                        <div className="text-xs text-[#716D5C]">{p.email}</div>
                      </td>
                      <td className="px-4 py-3 text-[#716D5C]">{p.company_name}</td>
                      <td className="px-4 py-3 text-[#716D5C]">{p.activity_type || '—'}</td>
                      <td className="px-4 py-3 text-[#716D5C]">{p.potential_clients || '—'}</td>
                      <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                      <td className="px-4 py-3 text-[#716D5C] text-xs">
                        {new Date(p.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <select
                            value={p.status}
                            onChange={(e) => {
                              e.stopPropagation()
                              updateStatusMutation.mutate({ id: p.id, status: e.target.value })
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="px-2 py-1 bg-[#F9F7F1] border border-gray-200 rounded-lg text-xs text-[#262626] outline-none cursor-pointer"
                          >
                            {Object.entries(STATUS_MAP).map(([key, val]) => (
                              <option key={key} value={key} className="bg-[#F9F7F1]">{val.label}</option>
                            ))}
                          </select>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(p.id, `${p.first_name} ${p.last_name}`)
                            }}
                            className="p-1.5 rounded-lg text-[#716D5C] hover:text-red-500 hover:bg-red-50 transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    <AnimatePresence>
                      {expandedRow === p.id && (
                        <tr>
                          <td colSpan={7}>
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="px-6 py-4 bg-gray-50/50 border-b border-gray-200 space-y-2">
                                {p.phone && (
                                  <div className="flex items-center gap-2 text-sm text-[#716D5C]">
                                    <Phone className="w-3.5 h-3.5" />
                                    {p.phone}
                                  </div>
                                )}
                                {p.message && (
                                  <div className="text-sm text-[#716D5C]">
                                    <span className="text-[#716D5C] font-medium">Message :</span> {p.message}
                                  </div>
                                )}
                                <div className="text-xs text-[#716D5C]">
                                  Source : {p.source} — Mis à jour : {new Date(p.updated_at).toLocaleString('fr-FR')}
                                </div>
                                <PaymentLinkForm email={p.email} name={p.first_name} />
                              </div>
                            </motion.div>
                          </td>
                        </tr>
                      )}
                    </AnimatePresence>
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
