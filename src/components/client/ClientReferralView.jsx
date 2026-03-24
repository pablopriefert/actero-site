import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Gift, Copy, Check, Mail, Share2, Users, DollarSign, Clock,
  ExternalLink, ArrowRight, Loader2, CheckCircle2, XCircle, Eye
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

const STATUS_CONFIG = {
  pending: { label: 'En attente', color: 'text-gray-400 bg-gray-400/10', icon: Clock },
  clicked: { label: 'Lien clique', color: 'text-blue-400 bg-blue-400/10', icon: Eye },
  signed_up: { label: 'Inscrit', color: 'text-amber-400 bg-amber-400/10', icon: Users },
  paid: { label: 'A paye', color: 'text-emerald-400 bg-emerald-400/10', icon: DollarSign },
  rewarded: { label: 'Valide', color: 'text-emerald-400 bg-emerald-400/10', icon: CheckCircle2 },
  expired: { label: 'Expire', color: 'text-red-400 bg-red-400/10', icon: XCircle },
  cancelled: { label: 'Annule', color: 'text-red-400 bg-red-400/10', icon: XCircle },
}

export const ClientReferralView = ({ clientId, theme = 'dark' }) => {
  const queryClient = useQueryClient()
  const [copied, setCopied] = useState(false)
  const isLight = theme === 'light'

  // Fetch or generate referral code
  const { data: codeData, isLoading: codeLoading } = useQuery({
    queryKey: ['referral-code', clientId],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Non authentifie')

      const res = await fetch('/api/referral/generate-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      return data
    },
    enabled: !!clientId,
  })

  // Fetch referrals
  const { data: referrals = [] } = useQuery({
    queryKey: ['referrals', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('referrals')
        .select('*')
        .eq('referrer_client_id', clientId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
    enabled: !!clientId,
  })

  // Fetch rewards
  const { data: rewards = [] } = useQuery({
    queryKey: ['referral-rewards', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('referral_rewards')
        .select('*')
        .eq('client_id', clientId)
        .order('applied_at', { ascending: false })
      if (error) throw error
      return data || []
    },
    enabled: !!clientId,
  })

  const referralLink = codeData?.link || ''
  const referralCode = codeData?.code || ''

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
    }
  }

  const handleShareEmail = () => {
    const subject = encodeURIComponent('Decouvrez Actero — automatisez votre business avec l\'IA')
    const body = encodeURIComponent(`Salut,\n\nJe te recommande Actero pour automatiser ton support client avec l'IA. En passant par mon lien, tu beneficies de 800€ de frais de setup offerts :\n\n${referralLink}\n\nA bientot !`)
    window.open(`mailto:?subject=${subject}&body=${body}`)
  }

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(`Je te recommande Actero pour automatiser ton business avec l'IA. 800€ de setup offerts avec mon lien : ${referralLink}`)
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  const handleShareLinkedIn = () => {
    const url = encodeURIComponent(referralLink)
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, '_blank')
  }

  // KPIs
  const totalSent = referrals.length
  const totalRewarded = referrals.filter(r => r.status === 'rewarded').length
  const totalCredits = rewards.reduce((sum, r) => sum + (r.amount_cents || 0), 0)

  // Tier progress
  const nextTierThreshold = totalRewarded < 3 ? 3 : totalRewarded + 1
  const currentReward = totalRewarded < 3 ? 800 : 1600
  const nextReward = 1600

  const cardBg = isLight ? 'bg-white border-slate-200' : 'bg-[#0a0a0a] border-white/10'
  const textPrimary = isLight ? 'text-slate-900' : 'text-white'
  const textSecondary = isLight ? 'text-slate-500' : 'text-gray-400'
  const inputBg = isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10'

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in-up">
      {/* Header */}
      <div>
        <h2 className={`text-3xl font-bold tracking-tight ${textPrimary}`}>Parrainage</h2>
        <p className={`mt-1 ${textSecondary}`}>
          Parrainez vos contacts et gagnez des credits sur votre abonnement.
        </p>
      </div>

      {/* Section 1: My Link */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-2xl border p-6 ${cardBg}`}
      >
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <Gift className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className={`text-lg font-bold ${textPrimary}`}>Mon lien de parrainage</h3>
            <p className={`text-sm ${textSecondary}`}>Partagez ce lien pour offrir le setup gratuit a vos contacts</p>
          </div>
        </div>

        {codeLoading ? (
          <div className="flex items-center gap-2 text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Generation du code...</span>
          </div>
        ) : (
          <>
            <div className={`flex items-center gap-3 p-3 rounded-xl border ${inputBg}`}>
              <input
                readOnly
                value={referralLink}
                className={`flex-1 bg-transparent text-sm font-mono ${textPrimary} outline-none`}
              />
              <button
                onClick={handleCopy}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  copied
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : isLight
                      ? 'bg-slate-900 text-white hover:bg-slate-800'
                      : 'bg-white text-black hover:bg-gray-100'
                }`}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copie !' : 'Copier'}
              </button>
            </div>

            <div className="flex flex-wrap gap-3 mt-4">
              <button
                onClick={handleShareEmail}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                  isLight
                    ? 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    : 'border-white/10 text-gray-300 hover:bg-white/5'
                }`}
              >
                <Mail className="w-4 h-4" /> Email
              </button>
              <button
                onClick={handleShareWhatsApp}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                  isLight
                    ? 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    : 'border-white/10 text-gray-300 hover:bg-white/5'
                }`}
              >
                <Share2 className="w-4 h-4" /> WhatsApp
              </button>
              <button
                onClick={handleShareLinkedIn}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                  isLight
                    ? 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    : 'border-white/10 text-gray-300 hover:bg-white/5'
                }`}
              >
                <ExternalLink className="w-4 h-4" /> LinkedIn
              </button>
            </div>
          </>
        )}
      </motion.div>

      {/* Section 2: KPIs + Progress */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            label: 'Parrainages envoyes',
            value: totalSent,
            icon: Users,
            color: 'blue',
          },
          {
            label: 'Parrainages reussis',
            value: totalRewarded,
            icon: CheckCircle2,
            color: 'emerald',
          },
          {
            label: 'Credits gagnes',
            value: `${(totalCredits / 100).toLocaleString()}€`,
            icon: DollarSign,
            color: 'amber',
          },
        ].map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`rounded-2xl border p-5 ${cardBg}`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className={`text-xs font-semibold uppercase tracking-wider ${textSecondary}`}>
                {kpi.label}
              </span>
              <kpi.icon className={`w-4 h-4 text-${kpi.color}-400`} />
            </div>
            <span className={`text-3xl font-bold ${textPrimary} font-mono`}>{kpi.value}</span>
          </motion.div>
        ))}
      </div>

      {/* Progress bar for tiers */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className={`rounded-2xl border p-6 ${cardBg}`}
      >
        <h3 className={`text-sm font-bold mb-4 ${textPrimary}`}>Progression des paliers</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className={textSecondary}>
              Palier actuel : <span className="text-emerald-400 font-bold">{currentReward}€ / parrainage</span>
            </span>
            {totalRewarded < 3 && (
              <span className={textSecondary}>
                Prochain palier a 3 parrainages : <span className="text-amber-400 font-bold">1 600€ / parrainage</span>
              </span>
            )}
          </div>
          <div className={`h-3 rounded-full ${isLight ? 'bg-slate-100' : 'bg-white/5'}`}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: totalRewarded >= 3 ? '100%' : `${(totalRewarded / 3) * 100}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
            />
          </div>
          <div className="flex justify-between text-xs">
            <span className={textSecondary}>0</span>
            <span className={totalRewarded >= 1 ? 'text-emerald-400 font-bold' : textSecondary}>1</span>
            <span className={totalRewarded >= 2 ? 'text-emerald-400 font-bold' : textSecondary}>2</span>
            <span className={totalRewarded >= 3 ? 'text-amber-400 font-bold' : textSecondary}>3+</span>
          </div>
        </div>
      </motion.div>

      {/* Section 3: Referral table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className={`rounded-2xl border overflow-hidden ${cardBg}`}
      >
        <div className="p-6 pb-4">
          <h3 className={`text-lg font-bold ${textPrimary}`}>Mes parrainages</h3>
        </div>

        {referrals.length === 0 ? (
          <div className="px-6 pb-8 text-center">
            <Gift className={`w-10 h-10 mx-auto mb-3 ${isLight ? 'text-slate-300' : 'text-gray-700'}`} />
            <p className={`text-sm ${textSecondary}`}>
              Aucun parrainage pour le moment. Partagez votre lien pour commencer !
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-t ${isLight ? 'border-slate-100' : 'border-white/5'}`}>
                  <th className={`text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider ${textSecondary}`}>Date</th>
                  <th className={`text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider ${textSecondary}`}>Statut</th>
                  <th className={`text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider ${textSecondary}`}>Credit</th>
                  <th className={`text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider ${textSecondary}`}>Expiration</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((ref) => {
                  const statusConf = STATUS_CONFIG[ref.status] || STATUS_CONFIG.pending
                  const StatusIcon = statusConf.icon
                  return (
                    <tr key={ref.id} className={`border-t ${isLight ? 'border-slate-100' : 'border-white/5'}`}>
                      <td className={`px-6 py-4 text-sm ${textPrimary}`}>
                        {new Date(ref.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${statusConf.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {statusConf.label}
                        </span>
                      </td>
                      <td className={`px-6 py-4 text-sm font-mono ${ref.referrer_credit_amount ? 'text-emerald-400' : textSecondary}`}>
                        {ref.referrer_credit_amount ? `${ref.referrer_credit_amount / 100}€` : '—'}
                      </td>
                      <td className={`px-6 py-4 text-sm ${textSecondary}`}>
                        {ref.expires_at ? new Date(ref.expires_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Section 4: Rewards history */}
      {rewards.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className={`rounded-2xl border overflow-hidden ${cardBg}`}
        >
          <div className="p-6 pb-4">
            <h3 className={`text-lg font-bold ${textPrimary}`}>Historique des recompenses</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-t ${isLight ? 'border-slate-100' : 'border-white/5'}`}>
                  <th className={`text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider ${textSecondary}`}>Date</th>
                  <th className={`text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider ${textSecondary}`}>Type</th>
                  <th className={`text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider ${textSecondary}`}>Montant</th>
                </tr>
              </thead>
              <tbody>
                {rewards.map((reward) => (
                  <tr key={reward.id} className={`border-t ${isLight ? 'border-slate-100' : 'border-white/5'}`}>
                    <td className={`px-6 py-4 text-sm ${textPrimary}`}>
                      {new Date(reward.applied_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className={`px-6 py-4 text-sm ${textSecondary}`}>Credit Stripe</td>
                    <td className="px-6 py-4 text-sm font-mono text-emerald-400 font-bold">
                      {reward.amount_cents / 100}€
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* How it works */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className={`rounded-2xl border p-6 ${cardBg}`}
      >
        <h3 className={`text-lg font-bold mb-4 ${textPrimary}`}>Comment ca marche ?</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { step: '1', title: 'Partagez votre lien', desc: 'Envoyez votre lien de parrainage a vos contacts.' },
            { step: '2', title: 'Ils souscrivent', desc: 'Votre contact beneficie du setup offert (800€).' },
            { step: '3', title: 'Vous gagnez', desc: 'Recevez 800€ a 1 600€ de credit sur votre facture.' },
          ].map((s) => (
            <div key={s.step} className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                <span className="text-emerald-400 text-sm font-bold">{s.step}</span>
              </div>
              <div>
                <h4 className={`text-sm font-bold ${textPrimary}`}>{s.title}</h4>
                <p className={`text-xs mt-1 ${textSecondary}`}>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
