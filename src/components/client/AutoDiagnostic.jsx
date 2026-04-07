import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity, CheckCircle2, XCircle, AlertTriangle, Loader2,
  RefreshCw, Wifi, Database, Plug, Shield, ChevronDown, ChevronUp,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

const CHECK_STATUS = {
  pass: { icon: CheckCircle2, color: 'text-[#003725]', bg: 'bg-emerald-50', label: 'OK' },
  warn: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', label: 'Attention' },
  fail: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50', label: 'Erreur' },
  loading: { icon: Loader2, color: 'text-[#716D5C]', bg: 'bg-gray-50', label: 'Test...' },
}

export const AutoDiagnostic = ({ clientId, clientType, theme }) => {
  const queryClient = useQueryClient()
  const [running, setRunning] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [results, setResults] = useState(null)

  const runDiagnostic = async () => {
    setRunning(true)
    setResults(null)
    const checks = []

    // 1. Check Supabase connection
    try {
      const start = Date.now()
      const { error } = await supabase.from('clients').select('id').eq('id', clientId).single()
      const latency = Date.now() - start
      checks.push({
        name: 'Base de donnees',
        icon: Database,
        status: error ? 'fail' : latency > 2000 ? 'warn' : 'pass',
        detail: error ? error.message : `Connecte (${latency}ms)`,
      })
    } catch (err) {
      checks.push({ name: 'Base de donnees', icon: Database, status: 'fail', detail: err.message })
    }

    // 2. Check auth session
    try {
      const { data: { session } } = await supabase.auth.getSession()
      checks.push({
        name: 'Session utilisateur',
        icon: Shield,
        status: session ? 'pass' : 'fail',
        detail: session ? `Connecte (expire ${new Date(session.expires_at * 1000).toLocaleTimeString('fr-FR')})` : 'Session expiree — reconnectez-vous',
      })
    } catch {
      checks.push({ name: 'Session utilisateur', icon: Shield, status: 'fail', detail: 'Impossible de verifier la session' })
    }

    // 3. Check integrations
    try {
      const { data: integrations } = await supabase
        .from('client_integrations')
        .select('id, provider, provider_label, status, last_checked_at')
        .eq('client_id', clientId)

      if (!integrations || integrations.length === 0) {
        checks.push({
          name: 'Integrations',
          icon: Plug,
          status: 'warn',
          detail: 'Aucune integration connectee — allez dans Integrations pour connecter vos outils',
        })
      } else {
        const active = integrations.filter(i => i.status === 'active').length
        const errored = integrations.filter(i => i.status === 'error' || i.status === 'expired').length
        checks.push({
          name: 'Integrations',
          icon: Plug,
          status: errored > 0 ? 'fail' : active > 0 ? 'pass' : 'warn',
          detail: `${active} active${active > 1 ? 's' : ''}${errored > 0 ? `, ${errored} en erreur` : ''}`,
          sub: integrations.map(i => ({
            name: i.provider_label || i.provider,
            status: i.status === 'active' ? 'pass' : i.status === 'error' ? 'fail' : 'warn',
            detail: i.status === 'active' ? 'Connecte' : i.status,
          })),
        })
      }
    } catch {
      checks.push({ name: 'Integrations', icon: Plug, status: 'fail', detail: 'Impossible de verifier' })
    }

    // 4. Check Shopify (e-commerce only)
    if (clientType === 'ecommerce') {
      try {
        const { data: shopify } = await supabase
          .from('client_shopify_connections')
          .select('id, shop_domain')
          .eq('client_id', clientId)
          .maybeSingle()

        checks.push({
          name: 'Shopify',
          icon: Wifi,
          status: shopify ? 'pass' : 'fail',
          detail: shopify ? `Connecte (${shopify.shop_domain})` : 'Non connecte — installez l\'app Shopify',
        })
      } catch {
        checks.push({ name: 'Shopify', icon: Wifi, status: 'fail', detail: 'Impossible de verifier' })
      }
    }

    // 5. Check client settings (ROI config)
    try {
      const { data: settings } = await supabase
        .from('client_settings')
        .select('hourly_cost, avg_ticket_time_min, actero_monthly_price')
        .eq('client_id', clientId)
        .maybeSingle()

      const configured = settings?.hourly_cost && settings?.avg_ticket_time_min
      checks.push({
        name: 'Configuration ROI',
        icon: Activity,
        status: configured ? 'pass' : 'warn',
        detail: configured
          ? `Cout: ${settings.hourly_cost}EUR/h, ${settings.avg_ticket_time_min}min/ticket`
          : 'Non configure — le calcul de ROI sera imprecis',
      })
    } catch {
      checks.push({ name: 'Configuration ROI', icon: Activity, status: 'warn', detail: 'Impossible de verifier' })
    }

    // 6. Check recent events (automation activity)
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const { data: events, count } = await supabase
        .from('automation_events')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientId)
        .gte('created_at', sevenDaysAgo)

      checks.push({
        name: 'Activite IA (7 derniers jours)',
        icon: Activity,
        status: (count || 0) > 0 ? 'pass' : 'warn',
        detail: (count || 0) > 0 ? `${count} evenements traites` : 'Aucune activite recente — verifiez vos workflows',
      })
    } catch {
      checks.push({ name: 'Activite IA', icon: Activity, status: 'warn', detail: 'Impossible de verifier' })
    }

    setResults(checks)
    setRunning(false)
  }

  const overallStatus = results
    ? results.some(r => r.status === 'fail') ? 'fail'
      : results.some(r => r.status === 'warn') ? 'warn'
      : 'pass'
    : null

  const overallConfig = overallStatus ? CHECK_STATUS[overallStatus] : null

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            overallConfig ? overallConfig.bg : 'bg-gray-50'
          }`}>
            <Activity className={`w-5 h-5 ${overallConfig ? overallConfig.color : 'text-[#716D5C]'}`} />
          </div>
          <div>
            <h3 className="font-bold text-[#262626] text-sm">Diagnostic systeme</h3>
            <p className="text-xs text-[#716D5C]">
              {results
                ? `${results.filter(r => r.status === 'pass').length}/${results.length} checks OK`
                : 'Verifiez la sante de votre configuration'
              }
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={runDiagnostic}
            disabled={running}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0F5F35] text-white rounded-lg text-xs font-bold hover:bg-[#003725] transition-colors disabled:opacity-50"
          >
            {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {running ? 'Analyse...' : results ? 'Relancer' : 'Lancer le diagnostic'}
          </button>
          {results && (
            <button onClick={() => setCollapsed(!collapsed)} className="p-1.5 rounded-lg hover:bg-gray-50 text-[#716D5C]">
              {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <AnimatePresence>
        {results && !collapsed && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-2">
              {results.map((check, i) => {
                const cfg = CHECK_STATUS[check.status]
                const Icon = check.icon || cfg.icon
                return (
                  <div key={i}>
                    <div className={`flex items-center gap-3 p-3 rounded-xl ${cfg.bg}`}>
                      <Icon className={`w-4 h-4 ${cfg.color} flex-shrink-0 ${check.status === 'loading' ? 'animate-spin' : ''}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#262626]">{check.name}</p>
                        <p className="text-xs text-[#716D5C]">{check.detail}</p>
                      </div>
                      <span className={`text-[10px] font-bold ${cfg.color}`}>{cfg.label}</span>
                    </div>
                    {/* Sub-checks (integrations detail) */}
                    {check.sub && (
                      <div className="ml-10 mt-1 space-y-1">
                        {check.sub.map((s, j) => {
                          const scfg = CHECK_STATUS[s.status]
                          return (
                            <div key={j} className="flex items-center gap-2 text-xs py-1 px-2">
                              <scfg.icon className={`w-3 h-3 ${scfg.color}`} />
                              <span className="text-[#262626] font-medium">{s.name}</span>
                              <span className="text-[#716D5C]">{s.detail}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
