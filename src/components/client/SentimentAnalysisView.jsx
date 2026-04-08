import React, { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Heart, BarChart3, MessageSquare, AlertTriangle, TrendingUp, Bell,
  ShieldAlert, Clock, User, ChevronRight
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../ui/Toast'

const SENTIMENT_DISTRIBUTION = [
  { label: 'Tres positif', percent: 34, color: '#10b981', bg: 'bg-emerald-500' },
  { label: 'Positif', percent: 28, color: '#6ee7b7', bg: 'bg-emerald-300' },
  { label: 'Neutre', percent: 22, color: '#9ca3af', bg: 'bg-gray-400' },
  { label: 'Negatif', percent: 12, color: '#f97316', bg: 'bg-orange-500' },
  { label: 'Tres negatif', percent: 4, color: '#ef4444', bg: 'bg-red-500' },
]

const MOCK_ALERTS = [
  {
    id: 1,
    timestamp: '08 avr. 2026 — 14:32',
    customer: 'Marie Dupont',
    score: 2.1,
    reason: 'Sentiment tres negatif detecte',
    excerpt: '"Je suis extremement decu du service, cela fait 3 semaines que j\'attends une reponse..."',
  },
  {
    id: 2,
    timestamp: '08 avr. 2026 — 11:17',
    customer: 'Jean-Pierre Martin',
    score: 3.0,
    reason: 'Sentiment en dessous du seuil',
    excerpt: '"Le produit ne correspond pas du tout a la description, je souhaite un remboursement immediat."',
  },
  {
    id: 3,
    timestamp: '07 avr. 2026 — 18:45',
    customer: 'Sophie Bernard',
    score: 1.8,
    reason: 'Escalade automatique declenchee',
    excerpt: '"C\'est inadmissible ! Troisieme fois que je contacte le support sans aucune resolution..."',
  },
  {
    id: 4,
    timestamp: '07 avr. 2026 — 09:22',
    customer: 'Luc Moreau',
    score: 2.5,
    reason: 'Sentiment negatif persistant',
    excerpt: '"Livraison en retard de 10 jours, aucun suivi, je suis tres mecontent de cette experience."',
  },
  {
    id: 5,
    timestamp: '06 avr. 2026 — 16:08',
    customer: 'Claire Petit',
    score: 2.9,
    reason: 'Sentiment en dessous du seuil',
    excerpt: '"Le chatbot tourne en boucle et ne repond jamais a ma question. Tres frustrant."',
  },
]

const STATS = [
  { label: 'Conversations analysees', value: '2 847', icon: MessageSquare, color: 'text-blue-500' },
  { label: 'Sentiment moyen', value: '7.2/10', icon: Heart, color: 'text-emerald-500' },
  { label: 'Alertes declenchees', value: '12', icon: AlertTriangle, color: 'text-orange-500' },
  { label: 'Tendance', value: '\u2191 +0.4', icon: TrendingUp, color: 'text-emerald-500' },
]

const StatCard = ({ label, value, icon: Icon, color, theme }) => {
  const isLight = theme === 'light'
  return (
    <div className={`rounded-2xl border p-5 ${isLight ? 'bg-white border-gray-100 shadow-sm' : 'bg-white border-gray-100 shadow-sm'}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-[10px] font-bold text-[#716D5C] uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-bold text-[#262626]">{value}</p>
    </div>
  )
}

const SentimentGauge = ({ score, theme }) => {
  const percentage = (score / 10) * 100
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-full max-w-md">
        <div className="text-center mb-4">
          <span className="text-5xl font-bold text-[#262626]">{score}</span>
          <span className="text-xl font-normal text-[#716D5C]">/10</span>
        </div>
        <div className="h-4 rounded-full overflow-hidden w-full"
          style={{ background: 'linear-gradient(to right, #ef4444, #f97316, #facc15, #6ee7b7, #10b981)' }}>
        </div>
        <motion.div
          className="absolute bottom-0 w-1 h-6 bg-[#262626] rounded-full"
          style={{ left: `${percentage}%`, transform: 'translateX(-50%)' }}
          initial={{ left: '0%' }}
          animate={{ left: `${percentage}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </div>
      <p className="text-sm font-medium text-[#716D5C]">Sentiment moyen ce mois-ci</p>
    </div>
  )
}

const Toggle = ({ enabled, onToggle, label }) => (
  <div className="flex items-center justify-between py-3">
    <span className="text-sm text-[#262626] font-medium">{label}</span>
    <button
      onClick={onToggle}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${enabled ? 'bg-[#0F5F35]' : 'bg-gray-300'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${enabled ? 'translate-x-5' : 'translate-x-0'}`}
      />
    </button>
  </div>
)

const scoreColor = (score) => {
  if (score <= 2) return 'text-red-500'
  if (score <= 3) return 'text-orange-500'
  return 'text-yellow-500'
}

export const SentimentAnalysisView = ({ clientId, theme = 'light' }) => {
  const isLight = theme === 'light'
  const toast = useToast()

  const [threshold, setThreshold] = useState(3)
  const [realtimeNotif, setRealtimeNotif] = useState(true)
  const [autoEscalate, setAutoEscalate] = useState(false)

  // Fetch real sentiment logs
  const { data: sentimentLogs = [] } = useQuery({
    queryKey: ['sentiment-logs', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sentiment_logs')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      return data || []
    },
    enabled: !!clientId,
  })

  // Fetch settings
  const { data: sentimentSettings } = useQuery({
    queryKey: ['sentiment-settings', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('sentiment_settings')
        .select('*')
        .eq('client_id', clientId)
        .maybeSingle()
      return data
    },
    enabled: !!clientId,
  })

  useEffect(() => {
    if (sentimentSettings) {
      setThreshold(sentimentSettings.alert_threshold ?? 3)
      setRealtimeNotif(sentimentSettings.realtime_notification ?? true)
      setAutoEscalate(sentimentSettings.auto_escalate_negative ?? false)
    }
  }, [sentimentSettings])

  // Compute real stats from logs
  const realStats = useMemo(() => {
    if (sentimentLogs.length === 0) return null
    const avg = sentimentLogs.reduce((s, l) => s + (l.score || 5), 0) / sentimentLogs.length
    const alerts = sentimentLogs.filter(l => l.score <= 3).length
    return {
      total: sentimentLogs.length,
      avg: avg.toFixed(1),
      alerts,
    }
  }, [sentimentLogs])

  // Compute real distribution
  const realDistribution = useMemo(() => {
    if (sentimentLogs.length === 0) return null
    const cats = { tres_positif: 0, positif: 0, neutre: 0, negatif: 0, tres_negatif: 0 }
    sentimentLogs.forEach(l => {
      if (l.category && cats[l.category] !== undefined) cats[l.category]++
    })
    const total = sentimentLogs.length
    return Object.entries(cats).map(([key, count]) => ({
      category: key,
      pct: total > 0 ? Math.round((count / total) * 100) : 0,
    }))
  }, [sentimentLogs])

  const saveSettings = async (updates) => {
    if (!clientId) return
    await supabase.from('sentiment_settings').upsert({
      client_id: clientId,
      alert_threshold: updates.threshold ?? threshold,
      realtime_notification: updates.realtimeNotif ?? realtimeNotif,
      auto_escalate_negative: updates.autoEscalate ?? autoEscalate,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'client_id' })
  }

  const handleThresholdChange = (e) => {
    const val = Number(e.target.value)
    setThreshold(val)
    saveSettings({ threshold: val })
    toast.success(`Seuil d'alerte mis a jour : ${val}/5`)
  }

  const handleToggleRealtime = () => {
    const newVal = !realtimeNotif
    setRealtimeNotif(newVal)
    saveSettings({ realtimeNotif: newVal })
    toast.success(newVal ? 'Notifications en temps reel activees' : 'Notifications en temps reel desactivees')
  }

  const handleToggleEscalate = () => {
    const newVal = !autoEscalate
    setAutoEscalate(newVal)
    saveSettings({ autoEscalate: newVal })
    toast.success(newVal ? 'Escalade automatique activee' : 'Escalade automatique desactivee')
  }

  return (
    <div className={`min-h-screen p-6 ${isLight ? 'bg-[#F5F5F0]' : 'bg-[#F5F5F0]'}`}>
      {/* Header */}
      <motion.div
        className="flex items-center gap-3 mb-8"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="w-10 h-10 rounded-xl bg-[#0F5F35] flex items-center justify-center">
          <Heart className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#262626]">Analyse de Sentiment</h1>
          <p className="text-sm text-[#716D5C]">Suivi en temps reel du ressenti de vos clients</p>
        </div>
      </motion.div>

      {/* Sentiment gauge */}
      <motion.div
        className="bg-white border border-gray-100 rounded-2xl shadow-sm p-8 mb-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <SentimentGauge score={7.2} theme={theme} />
      </motion.div>

      {/* Stats cards */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        {STATS.map((s) => (
          <StatCard key={s.label} {...s} theme={theme} />
        ))}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Sentiment distribution */}
        <motion.div
          className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <div className="flex items-center gap-2 mb-5">
            <BarChart3 className="w-4 h-4 text-[#0F5F35]" />
            <span className="text-[10px] font-bold text-[#716D5C] uppercase tracking-wider">
              Distribution des sentiments
            </span>
          </div>
          <div className="space-y-4">
            {SENTIMENT_DISTRIBUTION.map((item) => (
              <div key={item.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-[#262626]">{item.label}</span>
                  <span className="text-sm font-bold text-[#262626]">{item.percent}%</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: item.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${item.percent}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Alert configuration */}
        <motion.div
          className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35 }}
        >
          <div className="flex items-center gap-2 mb-5">
            <Bell className="w-4 h-4 text-[#0F5F35]" />
            <span className="text-[10px] font-bold text-[#716D5C] uppercase tracking-wider">
              Configuration des alertes
            </span>
          </div>

          {/* Threshold slider */}
          <div className="mb-6">
            <label className="text-sm font-medium text-[#262626] block mb-3">
              Alerter si sentiment &lt; <span className="font-bold text-[#0F5F35]">{threshold}</span>/5
            </label>
            <input
              type="range"
              min={1}
              max={5}
              step={0.5}
              value={threshold}
              onChange={handleThresholdChange}
              className="w-full h-2 rounded-full appearance-none cursor-pointer accent-[#0F5F35]"
              style={{
                background: `linear-gradient(to right, #0F5F35 ${((threshold - 1) / 4) * 100}%, #e5e7eb ${((threshold - 1) / 4) * 100}%)`,
              }}
            />
            <div className="flex justify-between text-[10px] text-[#716D5C] mt-1">
              <span>1</span>
              <span>2</span>
              <span>3</span>
              <span>4</span>
              <span>5</span>
            </div>
          </div>

          {/* Toggles */}
          <div className="border-t border-gray-100 pt-4 space-y-1">
            <Toggle
              enabled={realtimeNotif}
              onToggle={handleToggleRealtime}
              label="Notification en temps reel"
            />
            <Toggle
              enabled={autoEscalate}
              onToggle={handleToggleEscalate}
              label="Escalade automatique si tres negatif"
            />
          </div>
        </motion.div>
      </div>

      {/* Recent sentiment alerts */}
      <motion.div
        className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
      >
        <div className="flex items-center gap-2 mb-5">
          <ShieldAlert className="w-4 h-4 text-[#0F5F35]" />
          <span className="text-[10px] font-bold text-[#716D5C] uppercase tracking-wider">
            Alertes recentes
          </span>
        </div>

        <div className="space-y-4">
          {MOCK_ALERTS.map((alert) => (
            <motion.div
              key={alert.id}
              className="border border-gray-100 rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer"
              whileHover={{ scale: 1.005 }}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                    <User className="w-4 h-4 text-[#716D5C]" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#262626]">{alert.customer}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Clock className="w-3 h-3 text-[#716D5C]" />
                      <span className="text-[10px] text-[#716D5C]">{alert.timestamp}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-bold ${scoreColor(alert.score)}`}>
                    {alert.score.toFixed(1)}
                  </span>
                  <span className="text-[10px] text-[#716D5C]">/5</span>
                </div>
              </div>
              <div className="ml-11">
                <span className="inline-block text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full mb-2">
                  {alert.reason}
                </span>
                <p className="text-sm text-[#716D5C] italic leading-relaxed">{alert.excerpt}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
