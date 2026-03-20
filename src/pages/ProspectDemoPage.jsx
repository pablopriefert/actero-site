import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Clock,
  DollarSign,
  Activity,
  TrendingUp,
  ArrowRight,
  ArrowUpRight,
  Target,
  BarChart3,
  Sparkles,
  Shield,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Users,
  UserCheck,
  Phone,
  Mail,
  ShoppingCart,
  Ticket,
  CalendarCheck,
  ChevronRight,
} from 'lucide-react'

// ============================================================
// PROSPECT PROFILES (customizable per vertical)
// ============================================================
const PROSPECT_PROFILES = {
  ecommerce: {
    name: 'Votre boutique',
    vertical: 'E-commerce',
    badge: '🛒',
    leads: 500,
    monthlyRevenue: 80000,
    ticketsPerMonth: 300,
    avgResponseTime: '4h',
    cartAbandonRate: 75,
    kpis: [
      { label: 'Temps économisé', value: '62h', variation: '+45%', icon: Clock, color: 'emerald' },
      { label: 'ROI Généré', value: '8 450€', variation: '+71%', icon: DollarSign, color: 'amber' },
      { label: 'Tickets résolus auto', value: '247', variation: '+120%', icon: Ticket, color: 'violet' },
      { label: 'Actions IA', value: '1 280', variation: '+55%', icon: Activity, color: 'blue' },
    ],
    objectives: [
      { label: 'Tickets résolus', current: 247, target: 300, icon: '🎫' },
      { label: 'ROI généré', current: 8450, target: 10000, unit: '€', icon: '💰' },
      { label: 'Temps économisé', current: 62, target: 80, unit: 'h', icon: '⏱️' },
    ],
    benchmarks: [
      { label: 'Temps de réponse SAV', yours: '< 2 min', sector: '4h', improvement: '120x' },
      { label: 'Taux résolution auto', yours: '85%', sector: '15%', improvement: '+70pts' },
      { label: 'Récupération paniers', yours: '12%', sector: '3%', improvement: '4x' },
      { label: 'Satisfaction client', yours: '94%', sector: '72%', improvement: '+22pts' },
    ],
    logs: [
      { text: 'Ticket #4928 résolu automatiquement — "Où est ma commande ?" → tracking envoyé', category: 'ticket', time: "à l'instant" },
      { text: 'Panier abandonné récupéré — Email envoyé à marc.d*** (+89€)', category: 'cart', time: 'il y a 3 min' },
      { text: 'Email post-achat envoyé — Commande #5102 livrée, avis demandé', category: 'email', time: 'il y a 8 min' },
      { text: 'Ticket SAV escaladé — Demande de remboursement > 200€', category: 'escalation', time: 'il y a 15 min' },
      { text: '3 tickets "retard livraison" résolus en batch — tracking Colissimo mis à jour', category: 'ticket', time: 'il y a 22 min' },
    ],
  },
  immobilier: {
    name: 'Votre agence',
    vertical: 'Immobilier',
    badge: '🏠',
    leads: 500,
    monthlyRevenue: 45000,
    mandats: 25,
    avgResponseTime: '4h',
    kpis: [
      { label: 'Temps économisé', value: '48h', variation: '+52%', icon: Clock, color: 'emerald' },
      { label: 'ROI Généré', value: '12 800€', variation: '+65%', icon: DollarSign, color: 'amber' },
      { label: 'Leads qualifiés', value: '342', variation: '+88%', icon: UserCheck, color: 'violet' },
      { label: 'Actions IA', value: '890', variation: '+40%', icon: Activity, color: 'blue' },
    ],
    objectives: [
      { label: 'Leads qualifiés', current: 342, target: 500, icon: '🎯' },
      { label: 'ROI généré', current: 12800, target: 15000, unit: '€', icon: '💰' },
      { label: 'Temps économisé', current: 48, target: 60, unit: 'h', icon: '⏱️' },
    ],
    benchmarks: [
      { label: 'Temps de réponse leads', yours: '< 2 min', sector: '4h', improvement: '120x' },
      { label: 'Taux de qualification', yours: '70%', sector: '35%', improvement: '2x' },
      { label: 'Conversion visite', yours: '30%', sector: '12%', improvement: '2.5x' },
      { label: 'Relances automatiques', yours: '100%', sector: '40%', improvement: '+60pts' },
    ],
    logs: [
      { text: 'Lead SeLoger qualifié — Score 92/100, budget 350K€, RDV proposé', category: 'lead', time: "à l'instant" },
      { text: 'Relance SMS envoyée — Mme Dupont, visite T3 Marseille demain 14h', category: 'sms', time: 'il y a 5 min' },
      { text: 'Visite automatiquement planifiée — M. Martin, appartement rue Paradis', category: 'visit', time: 'il y a 12 min' },
      { text: 'Email de suivi mandat envoyé — Rapport hebdo performance à M. Leroy', category: 'email', time: 'il y a 20 min' },
      { text: 'Lead LeBonCoin scoré — Budget insuffisant, archivé automatiquement', category: 'scoring', time: 'il y a 35 min' },
    ],
  },
}

// ============================================================
// URL PARAMS
// ============================================================
function getProspectConfig() {
  const params = new URLSearchParams(window.location.search)
  const vertical = params.get('vertical') || 'ecommerce'
  const name = params.get('name')
  const leads = params.get('leads')
  const revenue = params.get('revenue')

  const base = PROSPECT_PROFILES[vertical] || PROSPECT_PROFILES.ecommerce
  return {
    ...base,
    name: name || base.name,
    leads: leads ? parseInt(leads) : base.leads,
    monthlyRevenue: revenue ? parseInt(revenue) : base.monthlyRevenue,
  }
}

// ============================================================
// MINI COMPONENTS
// ============================================================
const KPICard = ({ kpi }) => {
  const colorMap = {
    emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    amber: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
    violet: 'bg-violet-500/10 border-violet-500/20 text-violet-400',
    blue: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
  }
  const Icon = kpi.icon
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-5 rounded-2xl bg-[#0a0a0a] border border-white/10"
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center border mb-3 ${colorMap[kpi.color]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-2xl font-bold font-mono tracking-tighter text-white">{kpi.value}</p>
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mt-1">{kpi.label}</p>
      <p className="text-xs font-bold text-emerald-400 mt-2 flex items-center gap-1">
        <ArrowUpRight className="w-3 h-3" />{kpi.variation} vs mois dernier
      </p>
    </motion.div>
  )
}

const ObjectiveBar = ({ obj }) => {
  const pct = Math.min(100, Math.round((obj.current / obj.target) * 100))
  return (
    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span>{obj.icon}</span>
          <span className="text-xs font-bold text-zinc-300">{obj.label}</span>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
          pct >= 80 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
        }`}>{pct}%</span>
      </div>
      <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          className={`h-full rounded-full ${pct >= 80 ? 'bg-emerald-500' : 'bg-amber-500'}`}
        />
      </div>
      <p className="text-[10px] text-zinc-600 mt-1.5">
        {obj.current.toLocaleString()}{obj.unit || ''} / {obj.target.toLocaleString()}{obj.unit || ''}
      </p>
    </div>
  )
}

const BenchmarkRow = ({ b }) => (
  <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02]">
    <span className="text-xs font-medium text-zinc-400">{b.label}</span>
    <div className="flex items-center gap-3">
      <span className="text-sm font-bold text-violet-400">{b.yours}</span>
      <span className="text-[10px] text-zinc-600">vs {b.sector}</span>
      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
        {b.improvement}
      </span>
    </div>
  </div>
)

const LogItem = ({ log }) => {
  const categoryColors = {
    ticket: 'bg-emerald-500', cart: 'bg-violet-500', email: 'bg-blue-500',
    escalation: 'bg-amber-500', lead: 'bg-violet-500', sms: 'bg-emerald-500',
    visit: 'bg-amber-500', scoring: 'bg-blue-500',
  }
  return (
    <motion.div
      initial={{ x: 20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02]"
    >
      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${categoryColors[log.category] || 'bg-zinc-500'}`} />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-zinc-300 leading-relaxed">{log.text}</p>
        <p className="text-[10px] text-zinc-600 mt-0.5 flex items-center gap-1">
          <Clock className="w-2.5 h-2.5" />{log.time}
        </p>
      </div>
    </motion.div>
  )
}

// ============================================================
// MAIN PAGE
// ============================================================
export const ProspectDemoPage = ({ onNavigate }) => {
  const config = useMemo(() => getProspectConfig(), [])
  const [activeLogs, setActiveLogs] = useState(config.logs.slice(0, 3))

  // Simulate real-time logs
  useEffect(() => {
    let logIndex = 3
    const interval = setInterval(() => {
      const newLog = {
        ...config.logs[logIndex % config.logs.length],
        time: "à l'instant",
      }
      setActiveLogs(prev => [newLog, ...prev].slice(0, 5))
      logIndex++
    }, 6000)
    return () => clearInterval(interval)
  }, [config.logs])

  return (
    <div className="min-h-screen bg-[#030303] text-white font-sans">
      {/* Demo Banner */}
      <div className="bg-violet-500/10 border-b border-violet-500/20 py-3 px-6 text-center sticky top-0 z-50 backdrop-blur-md">
        <div className="flex items-center justify-center gap-4">
          <p className="text-violet-300 text-sm font-bold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
            Simulation live — {config.name} ({config.vertical})
          </p>
          <button
            onClick={() => onNavigate('/audit')}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-bold hover:bg-violet-500 transition-all"
          >
            Obtenir mon vrai dashboard <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex h-[calc(100vh-45px)]">
        {/* Sidebar */}
        <div className="w-64 bg-[#0a0a0a] border-r border-white/5 p-6 hidden md:flex flex-col shrink-0">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-8 h-8 bg-white rounded flex items-center justify-center">
              <div className="w-3 h-3 bg-black rounded-sm rotate-45" />
            </div>
            <span className="font-bold text-lg tracking-tight">Actero OS</span>
          </div>

          <div className="space-y-1.5 flex-1">
            {[
              { label: "Vue d'ensemble", icon: LayoutDashboard, active: true },
              { label: 'Objectifs', icon: Target },
              { label: 'Benchmarks', icon: BarChart3 },
              { label: 'Activité IA', icon: Activity },
              { label: 'Rapports', icon: TrendingUp },
              { label: 'Actero Copilot', icon: Sparkles },
            ].map((item, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium ${
                  item.active
                    ? 'bg-white/5 text-white'
                    : 'text-zinc-600 cursor-default'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </div>
            ))}
          </div>

          <div className="mt-auto border-t border-white/5 pt-4">
            <div className="flex items-center gap-3 px-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-violet-500 to-blue-500 flex items-center justify-center text-xs font-bold">
                {config.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-bold text-white">{config.name}</p>
                <p className="text-[10px] text-zinc-600">{config.vertical}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-6xl mx-auto space-y-8">
            {/* Header */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="px-3 py-1 bg-violet-500/10 border border-violet-500/20 rounded-full text-xs font-bold uppercase tracking-widest text-violet-400">
                  {config.badge} {config.vertical}
                </span>
                <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-xs font-bold text-emerald-400">
                  Simulation avec vos {config.leads} leads/mois
                </span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight mb-2">
                Bonjour {config.name}, voici vos performances simulées.
              </h1>
              <p className="text-zinc-500 font-medium">
                Projection basée sur votre volume de {config.leads} leads/mois et un CA de {config.monthlyRevenue.toLocaleString()}€.
              </p>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {config.kpis.map((kpi, i) => (
                <KPICard key={i} kpi={kpi} />
              ))}
            </div>

            {/* Objectives + Benchmarks */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Objectives */}
              <div className="p-6 rounded-2xl bg-[#0a0a0a] border border-white/10">
                <div className="flex items-center gap-2 mb-4">
                  <Target className="w-4 h-4 text-violet-400" />
                  <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-600">
                    Objectifs du mois
                  </h3>
                  <span className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-500/10 text-[10px] font-bold text-violet-400">
                    <Sparkles className="w-3 h-3" /> Prédiction IA
                  </span>
                </div>
                <div className="space-y-3">
                  {config.objectives.map((obj, i) => (
                    <ObjectiveBar key={i} obj={obj} />
                  ))}
                </div>
              </div>

              {/* Benchmarks */}
              <div className="p-6 rounded-2xl bg-[#0a0a0a] border border-white/10">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-4 h-4 text-violet-400" />
                  <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-600">
                    Benchmarks sectoriels
                  </h3>
                  <span className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/5 text-[10px] font-bold text-zinc-500">
                    <Shield className="w-3 h-3" /> Anonymisé
                  </span>
                </div>
                <div className="space-y-2">
                  {config.benchmarks.map((b, i) => (
                    <BenchmarkRow key={i} b={b} />
                  ))}
                </div>
              </div>
            </div>

            {/* Live Activity Feed */}
            <div className="p-6 rounded-2xl bg-[#0a0a0a] border border-white/10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-600">
                    Activité IA en temps réel
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-bold text-zinc-600">Live</span>
                </div>
              </div>
              <div className="space-y-2">
                <AnimatePresence>
                  {activeLogs.map((log, i) => (
                    <LogItem key={`${log.text}-${i}`} log={log} />
                  ))}
                </AnimatePresence>
              </div>
            </div>

            {/* ROI Summary */}
            <div className="p-6 rounded-2xl bg-gradient-to-r from-violet-500/[0.06] to-emerald-500/[0.04] border border-violet-500/10">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">
                    Retour sur investissement projeté
                  </h3>
                  <p className="text-sm text-zinc-400">
                    Basé sur un abonnement Actero et vos volumes actuels
                  </p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold font-mono text-emerald-400">x8.5</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Multiplicateur ROI</p>
                  </div>
                  <button
                    onClick={() => onNavigate('/audit')}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-violet-600 text-white font-bold hover:bg-violet-500 transition-all text-sm"
                  >
                    Voir mon vrai potentiel <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
