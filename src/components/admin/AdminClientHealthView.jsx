import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Heart, AlertTriangle, CheckCircle2, TrendingDown, Send,
  ShoppingBag, Building2, Clock, Zap
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

function computeHealthScore(client, metrics, events, lastLogin) {
  let score = 0
  const factors = []

  // Factor 1: Has recent events (last 24h)
  const recentEvents = events.filter(e => {
    const diff = (Date.now() - new Date(e.created_at).getTime()) / (1000 * 3600)
    return diff <= 24
  })
  if (recentEvents.length > 0) {
    score += 30
    factors.push({ label: 'Workflows actifs', ok: true })
  } else {
    factors.push({ label: 'Aucun événement 24h', ok: false })
  }

  // Factor 2: Has metrics in last 7 days
  const recentMetrics = metrics.filter(m => {
    const diff = (Date.now() - new Date(m.date).getTime()) / (1000 * 3600 * 24)
    return diff <= 7
  })
  if (recentMetrics.length >= 5) {
    score += 25
    factors.push({ label: 'Métriques régulières', ok: true })
  } else if (recentMetrics.length > 0) {
    score += 15
    factors.push({ label: 'Métriques partielles', ok: true })
  } else {
    factors.push({ label: 'Pas de métriques 7j', ok: false })
  }

  // Factor 3: Active status
  if (client.status === 'active') {
    score += 20
    factors.push({ label: 'Abonnement actif', ok: true })
  } else {
    factors.push({ label: `Statut: ${client.status || 'inconnu'}`, ok: false })
  }

  // Factor 4: No errors in recent events
  const errorEvents = events.filter(e => e.event_category === 'ticket_escalated' || e.event_category === 'lead_escalated')
  const errorRate = events.length > 0 ? errorEvents.length / events.length : 0
  if (errorRate < 0.1) {
    score += 15
    factors.push({ label: 'Faible taux d\'erreur', ok: true })
  } else {
    factors.push({ label: `Taux escalade: ${Math.round(errorRate * 100)}%`, ok: false })
  }

  // Factor 5: ROI positive
  const totalRoi = metrics.reduce((s, m) => s + (Number(m.estimated_roi) || 0), 0)
  if (totalRoi > 0) {
    score += 10
    factors.push({ label: 'ROI positif', ok: true })
  } else {
    factors.push({ label: 'ROI nul', ok: false })
  }

  return { score: Math.min(score, 100), factors }
}

export const AdminClientHealthView = () => {
  const { data: clients = [] } = useQuery({
    queryKey: ['health-clients'],
    queryFn: async () => {
      const { data } = await supabase
        .from('clients')
        .select('id, brand_name, status, client_type, contact_email, created_at')
        .order('created_at', { ascending: false })
      return data || []
    },
  })

  const { data: allMetrics = [] } = useQuery({
    queryKey: ['health-metrics'],
    queryFn: async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().split('T')[0]
      const { data } = await supabase
        .from('metrics_daily')
        .select('client_id, date, estimated_roi, tasks_executed, time_saved_minutes')
        .gte('date', sevenDaysAgo)
      return data || []
    },
  })

  const { data: allEvents = [] } = useQuery({
    queryKey: ['health-events'],
    queryFn: async () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString()
      const { data } = await supabase
        .from('automation_events')
        .select('client_id, event_category, created_at')
        .gte('created_at', twoDaysAgo)
      return data || []
    },
  })

  // Compute health for each client
  const clientHealth = clients.map(client => {
    const metrics = allMetrics.filter(m => m.client_id === client.id)
    const events = allEvents.filter(e => e.client_id === client.id)
    const health = computeHealthScore(client, metrics, events)
    return { ...client, health, recentEvents: events.length }
  }).sort((a, b) => a.health.score - b.health.score) // Worst first

  const avgScore = clientHealth.length > 0
    ? Math.round(clientHealth.reduce((s, c) => s + c.health.score, 0) / clientHealth.length)
    : 0

  const atRisk = clientHealth.filter(c => c.health.score < 50)
  const healthy = clientHealth.filter(c => c.health.score >= 70)

  const [sending, setSending] = React.useState(null)

  const sendReport = async (clientId) => {
    setSending(clientId)
    try {
      const res = await fetch('/api/send-monthly-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId }),
      })
      if (!res.ok) throw new Error('Erreur envoi')
      alert('Rapport envoyé !')
    } catch (err) {
      alert('Erreur: ' + err.message)
    }
    setSending(null)
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in-up">
      <div>
        <h2 className="text-2xl font-bold text-white">Santé Clients</h2>
        <p className="text-sm text-gray-500 mt-1">Score basé sur l'activité, les métriques et le statut</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#0E1424] rounded-2xl border border-white/10 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Heart className="w-4 h-4 text-emerald-400" />
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Score moyen</span>
          </div>
          <p className={`text-3xl font-bold font-mono ${avgScore >= 70 ? 'text-emerald-400' : avgScore >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
            {avgScore}%
          </p>
        </div>
        <div className="bg-[#0E1424] rounded-2xl border border-white/10 p-5">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">À risque</span>
          </div>
          <p className="text-3xl font-bold font-mono text-red-400">{atRisk.length}</p>
        </div>
        <div className="bg-[#0E1424] rounded-2xl border border-white/10 p-5">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">En bonne santé</span>
          </div>
          <p className="text-3xl font-bold font-mono text-emerald-400">{healthy.length}</p>
        </div>
      </div>

      {/* Client list */}
      <div className="space-y-3">
        {clientHealth.map((client, i) => {
          const scoreClasses = client.health.score >= 70
            ? { box: 'bg-emerald-500/10 border-emerald-500/20', text: 'text-emerald-400', bar: 'bg-emerald-500' }
            : client.health.score >= 40
            ? { box: 'bg-amber-500/10 border-amber-500/20', text: 'text-amber-400', bar: 'bg-amber-500' }
            : { box: 'bg-red-500/10 border-red-500/20', text: 'text-red-400', bar: 'bg-red-500' }
          return (
            <motion.div
              key={client.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="bg-[#0E1424] border border-white/10 rounded-xl p-4 flex items-center gap-4 hover:border-white/20 transition-colors"
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${scoreClasses.box}`}>
                <span className={`text-lg font-bold font-mono ${scoreClasses.text}`}>{client.health.score}</span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-white truncate">{client.brand_name}</p>
                  {client.client_type === 'immobilier'
                    ? <Building2 className="w-3 h-3 text-violet-400" />
                    : <ShoppingBag className="w-3 h-3 text-emerald-400" />}
                </div>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  {client.health.factors.map((f, j) => (
                    <span key={j} className={`text-[10px] flex items-center gap-1 ${f.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                      {f.ok ? <CheckCircle2 className="w-2.5 h-2.5" /> : <AlertTriangle className="w-2.5 h-2.5" />}
                      {f.label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right hidden md:block">
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <Zap className="w-3 h-3" /> {client.recentEvents} évén. 48h
                  </div>
                </div>

                {/* Health bar */}
                <div className="w-20 h-2 bg-white/5 rounded-full overflow-hidden hidden lg:block">
                  <div
                    className={`h-full rounded-full ${scoreClasses.bar} transition-all`}
                    style={{ width: `${client.health.score}%` }}
                  />
                </div>

                {/* Send report button */}
                <button
                  onClick={() => sendReport(client.id)}
                  disabled={sending === client.id}
                  className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all disabled:opacity-50"
                  title="Envoyer rapport mensuel"
                >
                  <Send className={`w-3.5 h-3.5 ${sending === client.id ? 'animate-pulse text-blue-400' : 'text-gray-400'}`} />
                </button>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
