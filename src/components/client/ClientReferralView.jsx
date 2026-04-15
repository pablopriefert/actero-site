import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Gift, Copy, Check, Mail, Users, CreditCard, Clock,
  ExternalLink, Loader2, CheckCircle2, XCircle, Eye, Sparkles
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

const STATUS_CONFIG = {
  pending: { label: 'En attente', color: 'text-[#71717a] bg-gray-100', icon: Clock },
  clicked: { label: 'Lien cliqué', color: 'text-blue-600 bg-blue-50', icon: Eye },
  signed_up: { label: 'Inscrit', color: 'text-amber-600 bg-amber-50', icon: Users },
  paid: { label: 'Abonné', color: 'text-emerald-600 bg-emerald-50', icon: CreditCard },
  rewarded: { label: 'Validé', color: 'text-emerald-600 bg-emerald-50', icon: CheckCircle2 },
  expired: { label: 'Expiré', color: 'text-red-500 bg-red-50', icon: XCircle },
  cancelled: { label: 'Annulé', color: 'text-red-500 bg-red-50', icon: XCircle },
}

export const ClientReferralView = ({ clientId, theme = 'light' }) => {
  const [copied, setCopied] = useState(false)

  // Fetch or generate referral code
  const { data: codeData, isLoading: codeLoading } = useQuery({
    queryKey: ['referral-code', clientId],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Non authentifié')
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

  const referralLink = codeData?.link || ''
  const totalSent = referrals.length
  const totalConverted = referrals.filter(r => ['paid', 'rewarded'].includes(r.status)).length
  const totalCredits = referrals.filter(r => r.status === 'rewarded').length

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* fallback */ }
  }

  const handleShareEmail = () => {
    const subject = encodeURIComponent('Découvrez Actero — 1 mois offert')
    const body = encodeURIComponent(
      `Salut,\n\nJe te recommande Actero pour automatiser ton support client e-commerce avec l'IA.\n\nEn passant par mon lien, ton premier mois est offert :\n${referralLink}\n\nÀ bientôt !`
    )
    window.open(`mailto:?subject=${subject}&body=${body}`)
  }

  const handleShareLinkedIn = () => {
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(referralLink)}`, '_blank')
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in-up">
      {/* Hero banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-8"
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center flex-shrink-0">
            <Gift className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-[#1a1a1a] mb-1">Parrainez, gagnez</h2>
            <p className="text-[#71717a] text-sm leading-relaxed max-w-lg">
              Partagez votre lien et offrez <strong className="text-emerald-600">1 mois gratuit</strong> à vos contacts.
              Pour chaque filleul qui souscrit, vous recevez <strong className="text-emerald-600">1 mois de crédit</strong> sur votre abonnement.
            </p>
          </div>
        </div>

        {/* Share link */}
        <div className="mt-6">
          {codeLoading ? (
            <div className="flex items-center gap-2 text-[#71717a]">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Génération du lien...</span>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 p-2 rounded-xl border border-gray-200 bg-white">
                <input
                  readOnly
                  value={referralLink}
                  className="flex-1 bg-transparent text-sm font-mono text-[#1a1a1a] outline-none px-2"
                />
                <button
                  onClick={handleCopy}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    copied
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-[#0F5F35] text-white hover:bg-[#003725]'
                  }`}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copié !' : 'Copier'}
                </button>
              </div>

              <div className="flex flex-wrap gap-2 mt-3">
                <button onClick={handleShareEmail} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border border-gray-200 text-[#71717a] hover:bg-gray-50 transition-all">
                  <Mail className="w-3.5 h-3.5" /> Email
                </button>
                <button onClick={handleShareLinkedIn} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border border-gray-200 text-[#71717a] hover:bg-gray-50 transition-all">
                  <ExternalLink className="w-3.5 h-3.5" /> LinkedIn
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Invitations envoyées', value: totalSent, icon: Users, color: 'text-blue-500', bg: 'bg-blue-50' },
          { label: 'Filleuls abonnés', value: totalConverted, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50' },
          { label: 'Mois de crédit gagnés', value: totalCredits, icon: Sparkles, color: 'text-amber-500', bg: 'bg-amber-50' },
        ].map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-2xl border border-gray-200 bg-white p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#71717a]">{kpi.label}</span>
              <div className={`w-8 h-8 rounded-lg ${kpi.bg} flex items-center justify-center`}>
                <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
              </div>
            </div>
            <span className="text-3xl font-bold text-[#1a1a1a]">{kpi.value}</span>
          </motion.div>
        ))}
      </div>

      {/* How it works */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="rounded-2xl border border-gray-200 bg-white p-6"
      >
        <h3 className="text-base font-bold text-[#1a1a1a] mb-5">Comment ça marche ?</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { step: '1', title: 'Partagez votre lien', desc: 'Envoyez votre lien de parrainage à vos contacts e-commerçants.' },
            { step: '2', title: 'Ils s\'inscrivent', desc: 'Votre filleul bénéficie de 30 jours gratuits sur n\'importe quel plan.' },
            { step: '3', title: 'Vous gagnez', desc: 'Dès qu\'il souscrit, vous recevez 1 mois de crédit sur votre abonnement.' },
          ].map((s) => (
            <div key={s.step} className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-[#0F5F35] flex items-center justify-center flex-shrink-0">
                <span className="text-white text-sm font-bold">{s.step}</span>
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#1a1a1a]">{s.title}</h4>
                <p className="text-xs mt-1 text-[#71717a] leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Referrals table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl border border-gray-200 bg-white overflow-hidden"
      >
        <div className="p-6 pb-4">
          <h3 className="text-base font-bold text-[#1a1a1a]">Mes parrainages</h3>
        </div>

        {referrals.length === 0 ? (
          <div className="px-6 pb-8 text-center">
            <Gift className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="text-sm text-[#71717a]">Aucun parrainage pour le moment. Partagez votre lien !</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-t border-gray-100">
                  <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider text-[#71717a]">Date</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider text-[#71717a]">Statut</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider text-[#71717a]">Crédit</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((ref) => {
                  const statusConf = STATUS_CONFIG[ref.status] || STATUS_CONFIG.pending
                  const StatusIcon = statusConf.icon
                  return (
                    <tr key={ref.id} className="border-t border-gray-100">
                      <td className="px-6 py-4 text-sm text-[#1a1a1a]">
                        {new Date(ref.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${statusConf.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {statusConf.label}
                        </span>
                      </td>
                      <td className={`px-6 py-4 text-sm font-medium ${ref.status === 'rewarded' ? 'text-emerald-600' : 'text-[#71717a]'}`}>
                        {ref.status === 'rewarded' ? '1 mois offert' : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  )
}
