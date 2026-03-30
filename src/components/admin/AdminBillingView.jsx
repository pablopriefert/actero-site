import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { motion } from 'framer-motion'
import {
  DollarSign, CreditCard, Receipt, TrendingUp, AlertCircle,
  ExternalLink, CheckCircle2, XCircle, Clock, RefreshCw
} from 'lucide-react'

const statusLabels = {
  active: { label: 'Actif', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  past_due: { label: 'En retard', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
  canceled: { label: 'Annulé', color: 'text-[#716D5C]', bg: 'bg-gray-500/10 border-gray-500/20' },
  trialing: { label: 'Essai', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  incomplete: { label: 'Incomplet', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  unpaid: { label: 'Impayé', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
}

const invoiceStatusLabels = {
  paid: { label: 'Payée', icon: CheckCircle2, color: 'text-emerald-400' },
  open: { label: 'En attente', icon: Clock, color: 'text-amber-400' },
  void: { label: 'Annulée', icon: XCircle, color: 'text-[#716D5C]' },
  draft: { label: 'Brouillon', icon: Receipt, color: 'text-[#716D5C]' },
  uncollectible: { label: 'Irrécupérable', icon: AlertCircle, color: 'text-red-400' },
}

export const AdminBillingView = () => {
  const [view, setView] = useState('overview') // overview | invoices

  const { data, isLoading, error } = useQuery({
    queryKey: ['stripe-billing'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/stripe-billing', {
        headers: { 'Authorization': `Bearer ${session?.access_token}` },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erreur API Stripe')
      }
      return res.json()
    },
    refetchInterval: 60000,
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <RefreshCw className="w-8 h-8 animate-spin text-[#716D5C]" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto text-center py-20 bg-[#F9F7F1] rounded-2xl border border-red-500/20">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-red-400">Impossible de charger les données Stripe</h3>
        <p className="text-sm text-[#716D5C] mt-2">{error.message}</p>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#262626]">Facturation</h2>
          <p className="text-sm text-[#716D5C] mt-1">Suivi des abonnements et paiements Stripe</p>
        </div>
        <div className="flex p-1 rounded-xl bg-gray-50 border border-gray-200">
          {[
            { id: 'overview', label: 'Abonnements' },
            { id: 'invoices', label: 'Factures' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setView(tab.id)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                view === tab.id
                  ? 'bg-gray-50 text-[#262626] shadow-lg'
                  : 'text-[#716D5C] hover:text-[#716D5C]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'MRR', value: `${(data?.mrr || 0).toLocaleString('fr-FR')}€`, icon: TrendingUp, iconClass: 'text-emerald-400' },
          { label: 'Abonnements actifs', value: data?.activeSubscriptions || 0, icon: CreditCard, iconClass: 'text-blue-400' },
          { label: 'Solde disponible', value: `${(data?.availableBalance || 0).toLocaleString('fr-FR')}€`, icon: DollarSign, iconClass: 'text-amber-400' },
          { label: 'En attente', value: `${(data?.pendingBalance || 0).toLocaleString('fr-FR')}€`, icon: Clock, iconClass: 'text-violet-400' },
        ].map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-[#F9F7F1] rounded-2xl border border-gray-200 p-5"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-[#716D5C] uppercase tracking-wider">{kpi.label}</span>
              <kpi.icon className={`w-4 h-4 ${kpi.iconClass}`} />
            </div>
            <span className="text-2xl font-bold text-[#262626] font-mono">{kpi.value}</span>
          </motion.div>
        ))}
      </div>

      {view === 'overview' && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-[#716D5C]">Abonnements ({data?.subscriptions?.length || 0})</h3>
          {(data?.subscriptions || []).map((sub, i) => {
            const s = statusLabels[sub.status] || statusLabels.active
            return (
              <motion.div
                key={sub.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="bg-[#F9F7F1] border border-gray-200 rounded-xl p-4 flex items-center gap-4 hover:border-gray-300 transition-colors"
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${s.bg}`}>
                  <CreditCard className={`w-4 h-4 ${s.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#262626] truncate">{sub.customer_name}</p>
                  <p className="text-[10px] text-[#716D5C]">{sub.customer_email}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-[#262626] font-mono">{(sub.amount / 100).toLocaleString('fr-FR')}€/{sub.interval === 'month' ? 'mois' : 'an'}</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${s.bg} ${s.color}`}>
                    {s.label.toUpperCase()}
                  </span>
                </div>
                {sub.cancel_at_period_end && (
                  <span className="text-[10px] text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                    Annulation prévue
                  </span>
                )}
              </motion.div>
            )
          })}
          {(!data?.subscriptions || data.subscriptions.length === 0) && (
            <div className="text-center py-12 bg-[#F9F7F1] rounded-2xl border border-gray-200">
              <CreditCard className="w-10 h-10 text-[#716D5C] mx-auto mb-3" />
              <p className="text-sm text-[#716D5C]">Aucun abonnement</p>
            </div>
          )}
        </div>
      )}

      {view === 'invoices' && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-[#716D5C]">Dernières factures ({data?.invoices?.length || 0})</h3>
          <div className="bg-[#F9F7F1] border border-gray-200 rounded-2xl overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-5 py-3 text-[10px] font-bold text-[#716D5C] uppercase tracking-widest">Facture</th>
                  <th className="px-5 py-3 text-[10px] font-bold text-[#716D5C] uppercase tracking-widest">Client</th>
                  <th className="px-5 py-3 text-[10px] font-bold text-[#716D5C] uppercase tracking-widest">Montant</th>
                  <th className="px-5 py-3 text-[10px] font-bold text-[#716D5C] uppercase tracking-widest">Statut</th>
                  <th className="px-5 py-3 text-[10px] font-bold text-[#716D5C] uppercase tracking-widest">Date</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {(data?.invoices || []).map(inv => {
                  const s = invoiceStatusLabels[inv.status] || invoiceStatusLabels.draft
                  const StatusIcon = s.icon
                  return (
                    <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 text-xs font-mono text-[#716D5C]">{inv.number || '—'}</td>
                      <td className="px-5 py-3">
                        <p className="text-xs font-medium text-[#262626]">{inv.customer_name}</p>
                      </td>
                      <td className="px-5 py-3 text-xs font-bold text-[#262626] font-mono">
                        {(inv.amount_due / 100).toLocaleString('fr-FR')}€
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${s.color}`}>
                          <StatusIcon className="w-3 h-3" /> {s.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-[10px] text-[#716D5C]">
                        {new Date(inv.created * 1000).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-5 py-3">
                        {inv.hosted_invoice_url && (
                          <a
                            href={inv.hosted_invoice_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#716D5C] hover:text-[#262626] transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {(!data?.invoices || data.invoices.length === 0) && (
              <div className="text-center py-12">
                <Receipt className="w-10 h-10 text-[#716D5C] mx-auto mb-3" />
                <p className="text-sm text-[#716D5C]">Aucune facture</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
