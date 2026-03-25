import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, DollarSign, TrendingUp, Search, Award,
  CheckCircle2, XCircle, Clock, Eye, Loader2, MoreVertical,
  UserPlus, Briefcase, Mail, Phone, Copy, Check, X,
  ArrowRight, FileText, AlertCircle, RefreshCw, ChevronDown
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

const AMBASSADOR_STATUS_CONFIG = {
  pending: { label: 'En attente', color: 'text-amber-400 bg-amber-400/10 border-amber-400/20' },
  active: { label: 'Actif', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
  suspended: { label: 'Suspendu', color: 'text-red-400 bg-red-400/10 border-red-400/20' },
  inactive: { label: 'Inactif', color: 'text-gray-400 bg-gray-400/10 border-gray-400/20' },
}

const LEAD_STATUS_CONFIG = {
  submitted: { label: 'Soumis', color: 'text-gray-400 bg-gray-400/10 border-gray-400/20' },
  contacted: { label: 'Contacte', color: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
  qualified: { label: 'Qualifie', color: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20' },
  audit_booked: { label: 'Audit reserve', color: 'text-violet-400 bg-violet-400/10 border-violet-400/20' },
  audit_done: { label: 'Audit fait', color: 'text-purple-400 bg-purple-400/10 border-purple-400/20' },
  closing_in_progress: { label: 'Closing', color: 'text-amber-400 bg-amber-400/10 border-amber-400/20' },
  won: { label: 'Gagne', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
  lost: { label: 'Perdu', color: 'text-red-400 bg-red-400/10 border-red-400/20' },
}

const COMMISSION_STATUS_CONFIG = {
  pending: { label: 'En attente', color: 'text-gray-400 bg-gray-400/10 border-gray-400/20' },
  waiting_30_days: { label: 'Delai 30j', color: 'text-amber-400 bg-amber-400/10 border-amber-400/20' },
  eligible: { label: 'Eligible', color: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20' },
  approved: { label: 'Approuve', color: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
  paid: { label: 'Paye', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
  cancelled: { label: 'Annule', color: 'text-red-400 bg-red-400/10 border-red-400/20' },
}

const APPLICATION_STATUS_CONFIG = {
  new: { label: 'Nouveau', color: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
  reviewed: { label: 'Examine', color: 'text-amber-400 bg-amber-400/10 border-amber-400/20' },
  approved: { label: 'Approuve', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
  rejected: { label: 'Rejete', color: 'text-red-400 bg-red-400/10 border-red-400/20' },
}

const SUB_TABS = [
  { id: 'ambassadors', label: 'Ambassadeurs', icon: Users },
  { id: 'leads', label: 'Leads', icon: Briefcase },
  { id: 'commissions', label: 'Commissions', icon: DollarSign },
]

async function getAuthToken() {
  const { data } = await supabase.auth.getSession()
  return data?.session?.access_token
}

export const AdminAmbassadorsView = () => {
  const queryClient = useQueryClient()
  const [subTab, setSubTab] = useState('ambassadors')
  const [searchQuery, setSearchQuery] = useState('')
  const [actionMenuId, setActionMenuId] = useState(null)
  const [showCommissionModal, setShowCommissionModal] = useState(null)
  const [commissionForm, setCommissionForm] = useState({ amount: '', client_payment_date: '' })
  const [showLeadStatusMenu, setShowLeadStatusMenu] = useState(null)
  const [copiedCode, setCopiedCode] = useState(null)

  // Fetch ambassadors with stats
  const { data: ambassadors = [], isLoading: ambLoading } = useQuery({
    queryKey: ['admin-ambassadors'],
    queryFn: async () => {
      const token = await getAuthToken()
      const res = await fetch('/api/ambassador/admin/ambassadors', {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Erreur chargement ambassadeurs')
      const data = await res.json()
      return data.ambassadors || []
    },
  })

  // Fetch ambassador leads
  const { data: leads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ['admin-ambassador-leads'],
    queryFn: async () => {
      const token = await getAuthToken()
      const res = await fetch('/api/ambassador/admin/leads', {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Erreur chargement leads')
      const data = await res.json()
      return data.leads || []
    },
  })

  // Fetch commissions
  const { data: commissions = [], isLoading: commissionsLoading } = useQuery({
    queryKey: ['admin-ambassador-commissions'],
    queryFn: async () => {
      const token = await getAuthToken()
      const res = await fetch('/api/ambassador/admin/commissions', {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Erreur chargement commissions')
      const data = await res.json()
      return data.commissions || []
    },
  })

  // Fetch applications
  const { data: applications = [], isLoading: appsLoading } = useQuery({
    queryKey: ['admin-ambassador-applications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ambassador_applications')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
  })

  // Update ambassador status
  const updateAmbassadorMutation = useMutation({
    mutationFn: async ({ id, status, notes_admin }) => {
      const token = await getAuthToken()
      const res = await fetch('/api/ambassador/admin/ambassadors', {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status, notes_admin }),
      })
      if (!res.ok) throw new Error('Erreur mise a jour')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-ambassadors'] })
      setActionMenuId(null)
    },
  })

  // Update lead status
  const updateLeadMutation = useMutation({
    mutationFn: async ({ id, status, status_note, admin_note, client_id }) => {
      const token = await getAuthToken()
      const res = await fetch('/api/ambassador/admin/leads', {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status, status_note, admin_note, client_id }),
      })
      if (!res.ok) throw new Error('Erreur mise a jour')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-ambassador-leads'] })
      setShowLeadStatusMenu(null)
    },
  })

  // Create commission
  const createCommissionMutation = useMutation({
    mutationFn: async ({ ambassador_id, lead_id, client_id, amount, client_payment_date }) => {
      const token = await getAuthToken()
      const res = await fetch('/api/ambassador/admin/commissions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ambassador_id, lead_id, client_id, amount: Number(amount), client_payment_date }),
      })
      if (!res.ok) throw new Error('Erreur creation commission')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-ambassador-commissions'] })
      setShowCommissionModal(null)
      setCommissionForm({ amount: '', client_payment_date: '' })
    },
  })

  // Update commission status
  const updateCommissionMutation = useMutation({
    mutationFn: async ({ id, status, admin_note, client_payment_date }) => {
      const token = await getAuthToken()
      const res = await fetch('/api/ambassador/admin/commissions', {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status, admin_note, client_payment_date }),
      })
      if (!res.ok) throw new Error('Erreur mise a jour')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-ambassador-commissions'] })
      setActionMenuId(null)
    },
  })

  // Process eligibility
  const processEligibilityMutation = useMutation({
    mutationFn: async () => {
      const token = await getAuthToken()
      const res = await fetch('/api/ambassador/admin/process-eligibility', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Erreur traitement')
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-ambassador-commissions'] })
      if (data.processed > 0) alert(`${data.processed} commission(s) passee(s) en eligible`)
    },
  })

  // Approve application
  const approveApplicationMutation = useMutation({
    mutationFn: async (applicationId) => {
      const token = await getAuthToken()
      const res = await fetch('/api/ambassador/register', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ application_id: applicationId }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erreur approbation')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-ambassador-applications'] })
      queryClient.invalidateQueries({ queryKey: ['admin-ambassadors'] })
    },
  })

  // Reject application
  const rejectApplicationMutation = useMutation({
    mutationFn: async (applicationId) => {
      await supabase
        .from('ambassador_applications')
        .update({ status: 'rejected' })
        .eq('id', applicationId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-ambassador-applications'] })
    },
  })

  // Stats
  const totalAmbassadors = ambassadors.length
  const activeAmbassadors = ambassadors.filter(a => a.status === 'active').length
  const totalLeads = leads.length
  const wonLeads = leads.filter(l => l.status === 'won').length
  const totalCommissions = commissions.reduce((s, c) => s + (Number(c.amount) || 0), 0)
  const paidCommissions = commissions.filter(c => c.status === 'paid').reduce((s, c) => s + (Number(c.amount) || 0), 0)
  const pendingApplications = applications.filter(a => a.status === 'new').length

  const isLoading = ambLoading || leadsLoading || commissionsLoading

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-gray-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Programme Ambassadeurs</h2>
          <p className="text-sm text-gray-500 mt-1">{totalAmbassadors} ambassadeur{totalAmbassadors > 1 ? 's' : ''} &middot; {totalLeads} lead{totalLeads > 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 bg-[#0a0a0a] border border-white/10 rounded-xl text-sm w-64 outline-none focus:border-white/20 transition-all text-white"
            />
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Ambassadeurs actifs', value: activeAmbassadors, total: totalAmbassadors, icon: Users, color: 'emerald' },
          { label: 'Leads total', value: totalLeads, sub: `${wonLeads} gagnes`, icon: Briefcase, color: 'blue' },
          { label: 'Commissions total', value: `${totalCommissions.toLocaleString('fr-FR')}`, suffix: 'EUR', icon: DollarSign, color: 'violet' },
          { label: 'Commissions payees', value: `${paidCommissions.toLocaleString('fr-FR')}`, suffix: 'EUR', icon: TrendingUp, color: 'amber' },
        ].map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="relative bg-[#0a0a0a] rounded-2xl border border-white/10 p-5 overflow-hidden group hover:border-white/20 transition-colors"
          >
            <div className={`absolute -top-6 -right-6 w-20 h-20 bg-${kpi.color}-500/10 rounded-full blur-2xl group-hover:bg-${kpi.color}-500/20 transition-colors`} />
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{kpi.label}</span>
              <kpi.icon className={`w-4 h-4 text-${kpi.color}-400`} />
            </div>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold text-white font-mono tracking-tight">{kpi.value}</span>
              {kpi.suffix && <span className="text-sm font-medium text-gray-500 mb-0.5">{kpi.suffix}</span>}
              {kpi.total !== undefined && <span className="text-sm font-medium text-gray-500 mb-0.5">/ {kpi.total}</span>}
            </div>
            {kpi.sub && <p className="text-xs text-gray-500 mt-1">{kpi.sub}</p>}
          </motion.div>
        ))}
      </div>

      {/* Applications section (if any pending) */}
      {pendingApplications > 0 && (
        <div className="bg-[#0a0a0a] rounded-2xl border border-amber-500/20 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <UserPlus className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Candidatures en attente</h3>
              <p className="text-xs text-gray-500">{pendingApplications} nouvelle{pendingApplications > 1 ? 's' : ''} candidature{pendingApplications > 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="space-y-3">
            {applications.filter(a => a.status === 'new').map((app) => (
              <div key={app.id} className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{app.first_name} {app.last_name}</p>
                  <p className="text-xs text-gray-500">{app.email}{app.phone ? ` | ${app.phone}` : ''}</p>
                  {app.network_type && <p className="text-xs text-gray-600 mt-0.5">Reseau: {app.network_type}</p>}
                  {app.message && <p className="text-xs text-gray-600 mt-1 line-clamp-2">{app.message}</p>}
                  <p className="text-[10px] text-gray-600 mt-1">{new Date(app.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => approveApplicationMutation.mutate(app.id)}
                    disabled={approveApplicationMutation.isPending}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                  >
                    {approveApplicationMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Approuver'}
                  </button>
                  <button
                    onClick={() => rejectApplicationMutation.mutate(app.id)}
                    disabled={rejectApplicationMutation.isPending}
                    className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-bold hover:bg-red-500/20 transition-colors disabled:opacity-50"
                  >
                    Rejeter
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex items-center gap-1 bg-[#0a0a0a] rounded-xl border border-white/10 p-1 w-fit">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              subTab === tab.id
                ? 'bg-white/10 text-white'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Ambassadeurs sub-tab */}
      {subTab === 'ambassadors' && (
        <div className="space-y-3">
          {ambassadors
            .filter(a => {
              if (!searchQuery) return true
              const q = searchQuery.toLowerCase()
              return (
                a.first_name?.toLowerCase().includes(q) ||
                a.last_name?.toLowerCase().includes(q) ||
                a.email?.toLowerCase().includes(q) ||
                a.ambassador_code?.toLowerCase().includes(q)
              )
            })
            .map((amb, i) => {
              const st = AMBASSADOR_STATUS_CONFIG[amb.status] || AMBASSADOR_STATUS_CONFIG.pending
              return (
                <motion.div
                  key={amb.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-emerald-400">{amb.first_name?.[0]}{amb.last_name?.[0]}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <p className="text-sm font-bold text-white">{amb.first_name} {amb.last_name}</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${st.color}`}>
                          {st.label.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 flex-wrap">
                        <span className="text-xs text-gray-500 flex items-center gap-1"><Mail className="w-3 h-3" /> {amb.email}</span>
                        {amb.phone && <span className="text-xs text-gray-500 flex items-center gap-1"><Phone className="w-3 h-3" /> {amb.phone}</span>}
                        <span className="text-xs text-gray-600">{amb.network_type || '—'}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-xs font-mono text-emerald-400/80 bg-emerald-500/5 px-2 py-0.5 rounded">{amb.ambassador_code}</span>
                        <button
                          onClick={() => { navigator.clipboard.writeText(amb.ambassador_code); setCopiedCode(amb.id); setTimeout(() => setCopiedCode(null), 2000); }}
                          className="p-0.5 rounded hover:bg-white/10 transition-colors"
                        >
                          {copiedCode === amb.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-gray-600" />}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 flex-shrink-0 text-center">
                      <div>
                        <p className="text-lg font-bold font-mono text-white">{amb.stats?.leads_count || 0}</p>
                        <p className="text-[10px] text-gray-500">Leads</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold font-mono text-emerald-400">{amb.stats?.won_count || 0}</p>
                        <p className="text-[10px] text-gray-500">Gagnes</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold font-mono text-violet-400">{(amb.stats?.commissions_total || 0).toLocaleString('fr-FR')}</p>
                        <p className="text-[10px] text-gray-500">Commissions</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold font-mono text-amber-400">{(amb.stats?.commissions_paid || 0).toLocaleString('fr-FR')}</p>
                        <p className="text-[10px] text-gray-500">Paye</p>
                      </div>
                    </div>
                    <div className="relative flex-shrink-0">
                      <button
                        onClick={() => setActionMenuId(actionMenuId === amb.id ? null : amb.id)}
                        className="p-2 rounded-lg hover:bg-white/5 transition-colors text-gray-500"
                      >
                        <MoreVertical className="w-5 h-5" />
                      </button>
                      {actionMenuId === amb.id && (
                        <div className="absolute right-0 top-10 bg-[#111] border border-white/10 rounded-xl shadow-xl z-20 py-1 min-w-[160px]">
                          {amb.status !== 'active' && (
                            <button
                              onClick={() => updateAmbassadorMutation.mutate({ id: amb.id, status: 'active' })}
                              className="w-full text-left px-4 py-2 text-sm text-emerald-400 hover:bg-white/5 transition-colors"
                            >
                              Activer
                            </button>
                          )}
                          {amb.status !== 'suspended' && (
                            <button
                              onClick={() => updateAmbassadorMutation.mutate({ id: amb.id, status: 'suspended' })}
                              className="w-full text-left px-4 py-2 text-sm text-amber-400 hover:bg-white/5 transition-colors"
                            >
                              Suspendre
                            </button>
                          )}
                          {amb.status !== 'inactive' && (
                            <button
                              onClick={() => updateAmbassadorMutation.mutate({ id: amb.id, status: 'inactive' })}
                              className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-white/5 transition-colors"
                            >
                              Desactiver
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          {ambassadors.length === 0 && (
            <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-16 text-center">
              <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500">Aucun ambassadeur pour le moment</p>
            </div>
          )}
        </div>
      )}

      {/* Leads sub-tab */}
      {subTab === 'leads' && (
        <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="border-b border-white/5 bg-[#030303]">
                  <th className="px-5 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Ambassadeur</th>
                  <th className="px-5 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Prospect</th>
                  <th className="px-5 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Entreprise</th>
                  <th className="px-5 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Niche</th>
                  <th className="px-5 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Source</th>
                  <th className="px-5 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Statut</th>
                  <th className="px-5 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Date</th>
                  <th className="px-5 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm">
                {leads
                  .filter(l => {
                    if (!searchQuery) return true
                    const q = searchQuery.toLowerCase()
                    return (
                      l.prospect_name?.toLowerCase().includes(q) ||
                      l.company_name?.toLowerCase().includes(q) ||
                      l.ambassadors?.first_name?.toLowerCase().includes(q) ||
                      l.ambassadors?.last_name?.toLowerCase().includes(q)
                    )
                  })
                  .map((lead) => {
                    const st = LEAD_STATUS_CONFIG[lead.status] || LEAD_STATUS_CONFIG.submitted
                    const ambName = lead.ambassadors ? `${lead.ambassadors.first_name} ${lead.ambassadors.last_name}` : '—'
                    return (
                      <tr key={lead.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-3">
                          <p className="font-medium text-white text-xs">{ambName}</p>
                          <p className="text-[10px] text-gray-600">{lead.ambassadors?.ambassador_code || ''}</p>
                        </td>
                        <td className="px-5 py-3">
                          <p className="font-medium text-white text-xs">{lead.prospect_name}</p>
                          {lead.prospect_email && <p className="text-[10px] text-gray-500">{lead.prospect_email}</p>}
                        </td>
                        <td className="px-5 py-3 text-xs text-gray-300">{lead.company_name}</td>
                        <td className="px-5 py-3 text-xs text-gray-500 capitalize">{lead.company_niche || '—'}</td>
                        <td className="px-5 py-3 text-xs text-gray-500">{lead.source}</td>
                        <td className="px-5 py-3">
                          <div className="relative">
                            <button
                              onClick={() => setShowLeadStatusMenu(showLeadStatusMenu === lead.id ? null : lead.id)}
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${st.color} cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-1`}
                            >
                              {st.label.toUpperCase()}
                              <ChevronDown className="w-3 h-3" />
                            </button>
                            {showLeadStatusMenu === lead.id && (
                              <div className="absolute left-0 top-7 bg-[#111] border border-white/10 rounded-xl shadow-xl z-20 py-1 min-w-[170px]">
                                {Object.entries(LEAD_STATUS_CONFIG).map(([key, cfg]) => (
                                  <button
                                    key={key}
                                    onClick={() => updateLeadMutation.mutate({ id: lead.id, status: key })}
                                    className={`w-full text-left px-4 py-1.5 text-xs hover:bg-white/5 transition-colors ${key === lead.status ? 'text-white font-bold' : 'text-gray-400'}`}
                                  >
                                    {cfg.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-xs text-gray-500">{new Date(lead.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-1">
                            {lead.status === 'won' && !commissions.find(c => c.lead_id === lead.id) && (
                              <button
                                onClick={() => setShowCommissionModal(lead)}
                                className="text-[10px] font-bold px-2 py-1 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 transition-colors"
                              >
                                + Commission
                              </button>
                            )}
                            {commissions.find(c => c.lead_id === lead.id) && (
                              <span className="text-[10px] font-bold text-emerald-400/60 px-2 py-1">Commission creee</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                {leads.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-16 text-center text-gray-500 text-sm">Aucun lead ambassadeur</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Commissions sub-tab */}
      {subTab === 'commissions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-end">
            <button
              onClick={() => processEligibilityMutation.mutate()}
              disabled={processEligibilityMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-xs font-bold hover:bg-cyan-500/20 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${processEligibilityMutation.isPending ? 'animate-spin' : ''}`} />
              Traiter eligibilite 30j
            </button>
          </div>
          <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="border-b border-white/5 bg-[#030303]">
                    <th className="px-5 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Ambassadeur</th>
                    <th className="px-5 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Prospect</th>
                    <th className="px-5 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Montant</th>
                    <th className="px-5 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Paiement client</th>
                    <th className="px-5 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Eligibilite</th>
                    <th className="px-5 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Statut</th>
                    <th className="px-5 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                  {commissions
                    .filter(c => {
                      if (!searchQuery) return true
                      const q = searchQuery.toLowerCase()
                      return (
                        c.ambassadors?.first_name?.toLowerCase().includes(q) ||
                        c.ambassadors?.last_name?.toLowerCase().includes(q) ||
                        c.ambassador_leads?.company_name?.toLowerCase().includes(q)
                      )
                    })
                    .map((comm) => {
                      const st = COMMISSION_STATUS_CONFIG[comm.status] || COMMISSION_STATUS_CONFIG.pending
                      const ambName = comm.ambassadors ? `${comm.ambassadors.first_name} ${comm.ambassadors.last_name}` : '—'
                      return (
                        <tr key={comm.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-5 py-3 text-xs font-medium text-white">{ambName}</td>
                          <td className="px-5 py-3">
                            <p className="text-xs text-white">{comm.ambassador_leads?.prospect_name || '—'}</p>
                            <p className="text-[10px] text-gray-600">{comm.ambassador_leads?.company_name || ''}</p>
                          </td>
                          <td className="px-5 py-3 text-sm font-bold font-mono text-white">{Number(comm.amount).toLocaleString('fr-FR')} {comm.currency}</td>
                          <td className="px-5 py-3 text-xs text-gray-500">
                            {comm.client_payment_date ? new Date(comm.client_payment_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                          </td>
                          <td className="px-5 py-3 text-xs text-gray-500">
                            {comm.eligibility_date ? new Date(comm.eligibility_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                          </td>
                          <td className="px-5 py-3">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${st.color}`}>
                              {st.label.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <div className="relative">
                              <button
                                onClick={() => setActionMenuId(actionMenuId === comm.id ? null : comm.id)}
                                className="p-1.5 rounded-lg hover:bg-white/5 transition-colors text-gray-500"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
                              {actionMenuId === comm.id && (
                                <div className="absolute right-0 top-8 bg-[#111] border border-white/10 rounded-xl shadow-xl z-20 py-1 min-w-[160px]">
                                  {(comm.status === 'eligible' || comm.status === 'pending') && (
                                    <button
                                      onClick={() => updateCommissionMutation.mutate({ id: comm.id, status: 'approved' })}
                                      className="w-full text-left px-4 py-2 text-xs text-blue-400 hover:bg-white/5 transition-colors"
                                    >
                                      Approuver
                                    </button>
                                  )}
                                  {(comm.status === 'approved' || comm.status === 'eligible') && (
                                    <button
                                      onClick={() => updateCommissionMutation.mutate({ id: comm.id, status: 'paid' })}
                                      className="w-full text-left px-4 py-2 text-xs text-emerald-400 hover:bg-white/5 transition-colors"
                                    >
                                      Marquer paye
                                    </button>
                                  )}
                                  {comm.status !== 'cancelled' && comm.status !== 'paid' && (
                                    <button
                                      onClick={() => updateCommissionMutation.mutate({ id: comm.id, status: 'cancelled' })}
                                      className="w-full text-left px-4 py-2 text-xs text-red-400 hover:bg-white/5 transition-colors"
                                    >
                                      Annuler
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  {commissions.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-16 text-center text-gray-500 text-sm">Aucune commission</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Commission creation modal */}
      <AnimatePresence>
        {showCommissionModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowCommissionModal(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 max-w-md w-full"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white">Creer une commission</h3>
                <button onClick={() => setShowCommissionModal(null)} className="text-gray-500 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Lead</p>
                  <p className="text-sm text-white font-medium">{showCommissionModal.prospect_name} — {showCommissionModal.company_name}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Montant (EUR)</label>
                  <input
                    type="number"
                    value={commissionForm.amount}
                    onChange={(e) => setCommissionForm({ ...commissionForm, amount: e.target.value })}
                    placeholder="500"
                    className="w-full px-4 py-2.5 bg-[#111] border border-white/10 rounded-xl text-sm text-white outline-none focus:border-white/20"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Date paiement client (optionnel)</label>
                  <input
                    type="date"
                    value={commissionForm.client_payment_date}
                    onChange={(e) => setCommissionForm({ ...commissionForm, client_payment_date: e.target.value })}
                    className="w-full px-4 py-2.5 bg-[#111] border border-white/10 rounded-xl text-sm text-white outline-none focus:border-white/20"
                  />
                </div>
                <button
                  onClick={() => {
                    if (!commissionForm.amount) return alert('Montant requis')
                    createCommissionMutation.mutate({
                      ambassador_id: showCommissionModal.ambassador_id,
                      lead_id: showCommissionModal.id,
                      client_id: showCommissionModal.client_id,
                      amount: commissionForm.amount,
                      client_payment_date: commissionForm.client_payment_date || null,
                    })
                  }}
                  disabled={createCommissionMutation.isPending}
                  className="w-full py-2.5 rounded-xl bg-white text-black font-bold text-sm hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  {createCommissionMutation.isPending ? 'Creation...' : 'Creer la commission'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Click outside to close menus */}
      {(actionMenuId || showLeadStatusMenu) && (
        <div className="fixed inset-0 z-10" onClick={() => { setActionMenuId(null); setShowLeadStatusMenu(null); }} />
      )}
    </div>
  )
}
