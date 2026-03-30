import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Gift, Users, DollarSign, TrendingUp, Search, Filter,
  CheckCircle2, XCircle, Clock, Eye, RotateCcw, ArrowUpRight,
  ArrowDownRight, Loader2, MoreVertical
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

const STATUS_CONFIG = {
  pending: { label: 'En attente', color: 'text-gray-400 bg-gray-400/10' },
  clicked: { label: 'Clique', color: 'text-blue-400 bg-blue-400/10' },
  signed_up: { label: 'Inscrit', color: 'text-amber-400 bg-amber-400/10' },
  paid: { label: 'Paye', color: 'text-emerald-400 bg-emerald-400/10' },
  rewarded: { label: 'Recompense', color: 'text-emerald-400 bg-emerald-500/10' },
  expired: { label: 'Expire', color: 'text-red-400 bg-red-400/10' },
  cancelled: { label: 'Annule', color: 'text-red-400 bg-red-400/10' },
}

export const AdminReferralsView = () => {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [actionMenuId, setActionMenuId] = useState(null)

  // Fetch all referrals with client info
  const { data: referrals = [], isLoading } = useQuery({
    queryKey: ['admin-referrals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('referrals')
        .select('*, clients!referrals_referrer_client_id_fkey(brand_name)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
  })

  // Fetch all rewards
  const { data: rewards = [] } = useQuery({
    queryKey: ['admin-referral-rewards'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('referral_rewards')
        .select('*, clients(brand_name)')
        .order('applied_at', { ascending: false })
      if (error) throw error
      return data || []
    },
  })

  // Manual validate mutation
  const validateMutation = useMutation({
    mutationFn: async (referralId) => {
      const referral = referrals.find(r => r.id === referralId)
      if (!referral) throw new Error('Referral not found')

      // Count existing rewarded for this referrer
      const existing = referrals.filter(
        r => r.referrer_client_id === referral.referrer_client_id && r.status === 'rewarded'
      ).length
      const rewardCents = existing >= 2 ? 160000 : 80000

      await supabase
        .from('referrals')
        .update({
          status: 'rewarded',
          referrer_credit_amount: rewardCents,
          rewarded_at: new Date().toISOString(),
        })
        .eq('id', referralId)

      await supabase
        .from('referral_rewards')
        .insert({
          referral_id: referralId,
          client_id: referral.referrer_client_id,
          reward_type: 'manual',
          amount_cents: rewardCents,
        })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-referrals'] })
      queryClient.invalidateQueries({ queryKey: ['admin-referral-rewards'] })
      setActionMenuId(null)
    },
  })

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: async (referralId) => {
      await supabase
        .from('referrals')
        .update({ status: 'cancelled' })
        .eq('id', referralId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-referrals'] })
      setActionMenuId(null)
    },
  })

  // Filter referrals
  const filteredReferrals = referrals.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const brand = r.clients?.brand_name?.toLowerCase() || ''
      const code = r.referral_code?.toLowerCase() || ''
      if (!brand.includes(q) && !code.includes(q)) return false
    }
    return true
  })

  // Stats
  const totalRewarded = referrals.filter(r => r.status === 'rewarded').length
  const totalCreditsDistributed = rewards.reduce((sum, r) => sum + (r.amount_cents || 0), 0)
  const totalClicks = referrals.filter(r => r.clicked_at).length
  const conversionRate = totalClicks > 0 ? ((totalRewarded / totalClicks) * 100).toFixed(1) : 0

  // Top referrers
  const referrerMap = {}
  referrals.forEach(r => {
    if (r.status === 'rewarded') {
      const name = r.clients?.brand_name || 'Inconnu'
      referrerMap[name] = (referrerMap[name] || 0) + 1
    }
  })
  const topReferrers = Object.entries(referrerMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-gray-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in-up">
      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Parrainages reussis', value: totalRewarded, icon: CheckCircle2, color: 'emerald' },
          { label: 'Credits distribues', value: `${(totalCreditsDistributed / 100).toLocaleString()}€`, icon: DollarSign, color: 'amber' },
          { label: 'Top parrain', value: topReferrers[0]?.[0] || '—', icon: TrendingUp, color: 'violet', isText: true },
          { label: 'Taux de conversion', value: `${conversionRate}%`, icon: ArrowUpRight, color: 'blue' },
        ].map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-[#0E1424] rounded-2xl border border-white/10 p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{kpi.label}</span>
              <kpi.icon className={`w-4 h-4 text-${kpi.color}-400`} />
            </div>
            <span className={`${kpi.isText ? 'text-lg' : 'text-3xl'} font-bold text-white font-mono tracking-tight`}>
              {kpi.value}
            </span>
          </motion.div>
        ))}
      </div>

      {/* Top referrers */}
      {topReferrers.length > 0 && (
        <div className="bg-[#0E1424] rounded-2xl border border-white/10 p-6">
          <h3 className="text-sm font-bold text-white mb-4">Top parrains</h3>
          <div className="flex flex-wrap gap-3">
            {topReferrers.map(([name, count], i) => (
              <div
                key={name}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10"
              >
                <span className="text-xs font-bold text-emerald-400">{i + 1}.</span>
                <span className="text-sm font-medium text-white">{name}</span>
                <span className="text-xs text-gray-500">{count} parrainage{count > 1 ? 's' : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Rechercher par client ou code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#0E1424] border border-white/10 rounded-xl text-sm text-white placeholder:text-gray-600 outline-none focus:border-white/20"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {['all', 'clicked', 'paid', 'rewarded', 'expired', 'cancelled'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                statusFilter === s
                  ? 'bg-white/10 text-white'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {s === 'all' ? 'Tous' : (STATUS_CONFIG[s]?.label || s)}
            </button>
          ))}
        </div>
      </div>

      {/* Referrals table */}
      <div className="bg-[#0E1424] rounded-2xl border border-white/10 overflow-hidden">
        {filteredReferrals.length === 0 ? (
          <div className="p-12 text-center">
            <Gift className="w-10 h-10 mx-auto mb-3 text-gray-700" />
            <p className="text-sm text-gray-500">Aucun parrainage trouve</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Parrain</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Code</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Statut</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Credit</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredReferrals.map((ref) => {
                  const statusConf = STATUS_CONFIG[ref.status] || STATUS_CONFIG.pending
                  return (
                    <tr key={ref.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                      <td className="px-6 py-4 text-sm font-medium text-white">
                        {ref.clients?.brand_name || 'Inconnu'}
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-gray-400">
                        {ref.referral_code}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${statusConf.color}`}>
                          {statusConf.label}
                        </span>
                      </td>
                      <td className={`px-6 py-4 text-sm font-mono ${ref.referrer_credit_amount ? 'text-emerald-400' : 'text-gray-600'}`}>
                        {ref.referrer_credit_amount ? `${ref.referrer_credit_amount / 100}€` : '—'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(ref.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-4">
                        <div className="relative">
                          <button
                            onClick={() => setActionMenuId(actionMenuId === ref.id ? null : ref.id)}
                            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                          >
                            <MoreVertical className="w-4 h-4 text-gray-500" />
                          </button>
                          {actionMenuId === ref.id && (
                            <div className="absolute right-0 top-8 z-10 bg-[#111] border border-white/10 rounded-xl shadow-xl py-1 min-w-[160px]">
                              {ref.status !== 'rewarded' && ref.status !== 'cancelled' && (
                                <button
                                  onClick={() => validateMutation.mutate(ref.id)}
                                  className="w-full text-left px-4 py-2 text-sm text-emerald-400 hover:bg-white/5 flex items-center gap-2"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Valider
                                </button>
                              )}
                              {ref.status !== 'cancelled' && ref.status !== 'rewarded' && (
                                <button
                                  onClick={() => cancelMutation.mutate(ref.id)}
                                  className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-white/5 flex items-center gap-2"
                                >
                                  <XCircle className="w-3.5 h-3.5" /> Annuler
                                </button>
                              )}
                              <button
                                onClick={() => setActionMenuId(null)}
                                className="w-full text-left px-4 py-2 text-sm text-gray-400 hover:bg-white/5"
                              >
                                Fermer
                              </button>
                            </div>
                          )}
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
    </div>
  )
}
