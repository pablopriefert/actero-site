import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { User, Users, Bell, CreditCard, LifeBuoy, Gift, Code, ChevronRight, Award, Cog, Download, Loader2, Slack, ExternalLink } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../ui/Toast'

/**
 * Settings Hub — refondu avril 2026.
 *
 * Avant : liste de liens groupés, aucun signal dynamique.
 * Après : header strip unifié + per-item signals (plan actuel, team size,
 * notifications state, etc.). User voit l'état de chaque surface avant de
 * cliquer.
 *
 * Pattern cohérent avec Overview / Automation / Insights / KB.
 */
export const SettingsHubView = ({ clientId, onNavigate }) => {
  const { success: toastSuccess, error: toastError } = useToast()
  const queryClient = useQueryClient()
  const [exporting, setExporting] = useState(null) // 'json' | 'csv' | null
  const [slackOpsBusy, setSlackOpsBusy] = useState(false)

  const handleExport = async (format) => {
    try {
      setExporting(format)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toastError('Session expirée — reconnectez-vous')
        return
      }
      const res = await fetch(`/api/client/export-data?format=${format}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) throw new Error('Export failed (' + res.status + ')')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const a = document.createElement('a')
      a.href = url
      a.download = `actero-export-${stamp}.${format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 250)
      toastSuccess('Export téléchargé')
    } catch (e) {
      console.error('Export error', e)
      toastError('Erreur lors de l\'export')
    } finally {
      setExporting(null)
    }
  }

  const { data: hubSignals } = useQuery({
    queryKey: ['settings-hub-signals', clientId],
    queryFn: async () => {
      if (!clientId) return null
      const [clientRow, teamRes, settingsRes] = await Promise.all([
        supabase.from('clients').select('plan, company_name').eq('id', clientId).maybeSingle(),
        supabase.from('team_members').select('id', { count: 'exact', head: true }).eq('client_id', clientId),
        supabase.from('client_settings').select('notifications_enabled, email_notifications_enabled').eq('client_id', clientId).maybeSingle(),
      ])
      const plan = clientRow.data?.plan || 'free'
      const planLabel = plan === 'free' ? 'Free'
        : plan === 'starter' ? 'Starter'
        : plan === 'pro' ? 'Pro'
        : plan === 'enterprise' ? 'Entreprise'
        : plan.charAt(0).toUpperCase() + plan.slice(1)
      const teamCount = (teamRes.count || 0) + 1 // +1 for owner
      const notifsOn = settingsRes.data?.notifications_enabled !== false
      const emailNotifsOn = settingsRes.data?.email_notifications_enabled !== false
      return {
        plan,
        planLabel,
        companyName: clientRow.data?.company_name,
        teamCount,
        notifsOn,
        emailNotifsOn,
      }
    },
    enabled: !!clientId,
  })

  const planLabel = hubSignals?.planLabel || '—'
  const teamCount = hubSignals?.teamCount ?? 1
  const notifsOn = hubSignals?.notifsOn !== false
  const emailNotifsOn = hubSignals?.emailNotifsOn !== false

  // Slack Ops Canvas — live operational dashboard pinned in the merchant's Slack.
  // Shown as a dedicated card; only actionable when a Slack integration exists.
  const { data: slackOps } = useQuery({
    queryKey: ['slack-ops', clientId],
    queryFn: async () => {
      if (!clientId) return null
      const [integration, settings] = await Promise.all([
        supabase
          .from('client_integrations')
          .select('id')
          .eq('client_id', clientId)
          .eq('provider', 'slack')
          .eq('status', 'active')
          .maybeSingle(),
        supabase
          .from('client_settings')
          .select('slack_ops_enabled, slack_ops_canvas_id, slack_ops_last_refreshed_at')
          .eq('client_id', clientId)
          .maybeSingle(),
      ])
      return {
        slackConnected: !!integration.data,
        enabled: settings.data?.slack_ops_enabled === true,
        canvasId: settings.data?.slack_ops_canvas_id || null,
        lastRefreshedAt: settings.data?.slack_ops_last_refreshed_at || null,
      }
    },
    enabled: !!clientId,
  })

  const toggleSlackOps = async () => {
    if (!clientId || slackOpsBusy) return
    if (!slackOps?.slackConnected) {
      toastError('Connecte Slack d\'abord depuis l\'onglet Intégrations')
      return
    }
    setSlackOpsBusy(true)
    const next = !slackOps.enabled
    queryClient.setQueryData(['slack-ops', clientId], (prev) => ({ ...(prev || {}), enabled: next }))
    const { error } = await supabase
      .from('client_settings')
      .upsert({ client_id: clientId, slack_ops_enabled: next }, { onConflict: 'client_id' })
    if (error) {
      queryClient.setQueryData(['slack-ops', clientId], (prev) => ({ ...(prev || {}), enabled: !next }))
      toastError('Impossible de mettre à jour le réglage')
    } else {
      toastSuccess(next ? 'Live Ops activé — premier refresh sous 15 min' : 'Live Ops désactivé')
      queryClient.invalidateQueries({ queryKey: ['slack-ops', clientId] })
    }
    setSlackOpsBusy(false)
  }

  const groups = [
    {
      title: 'Compte',
      items: [
        {
          id: 'profile',
          label: 'Mon compte',
          description: 'Email, mot de passe, préférences',
          icon: User,
          signal: hubSignals?.companyName,
        },
        {
          id: 'team',
          label: 'Équipe',
          description: 'Inviter des collaborateurs, rôles',
          icon: Users,
          signal: `${teamCount} membre${teamCount > 1 ? 's' : ''}`,
        },
        {
          id: 'notifications',
          label: 'Notifications',
          description: 'Emails et alertes',
          icon: Bell,
          signal: notifsOn && emailNotifsOn
            ? 'Toutes actives'
            : (!notifsOn && !emailNotifsOn
                ? 'Toutes désactivées'
                : 'Partiellement activées'),
          signalState: notifsOn && emailNotifsOn ? 'ok' : 'warn',
        },
      ],
    },
    {
      title: 'Facturation',
      items: [
        {
          id: 'billing',
          label: 'Facturation',
          description: 'Plan, factures, moyens de paiement',
          icon: CreditCard,
          signal: `Plan ${planLabel}`,
          signalState: hubSignals?.plan === 'free' ? 'warn' : 'ok',
        },
        {
          id: 'referral',
          label: 'Parrainage',
          description: '1 mois offert par filleul',
          icon: Gift,
          badge: '1 mois offert',
        },
      ],
    },
    {
      title: 'Développeur',
      items: [
        {
          id: 'api-docs',
          label: 'API & Webhooks',
          description: 'Clés, documentation, webhooks',
          icon: Code,
        },
      ],
    },
    {
      title: 'Support',
      items: [
        {
          id: 'support',
          label: 'Centre d\'aide',
          description: 'Guides, FAQ, contact support',
          icon: LifeBuoy,
        },
        {
          id: 'partner',
          label: 'Actero Partners',
          description: 'Devenir partenaire agence',
          icon: Award,
        },
      ],
    },
  ]

  return (
    <div className="max-w-5xl mx-auto px-5 md:px-8 pt-6 pb-16 animate-fade-in-up">
      {/* ═══════ HEADER STRIP ═══════ */}
      <div className="bg-white border border-[#E5E2D7] rounded-2xl p-5 md:p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-cta/10 flex items-center justify-center">
                <Cog className="w-3.5 h-3.5 text-cta" />
              </div>
              <h1 className="text-lg font-bold text-[#1a1a1a]">Paramètres</h1>
            </div>
            <p className="text-[12px] text-[#71717a]">
              Gérez votre compte, votre équipe et la facturation.
            </p>
          </div>
          <div className="flex items-center gap-4 md:gap-6 flex-wrap">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wider">Plan</span>
              <span className={`text-[15px] font-bold tabular-nums leading-tight ${
                hubSignals?.plan === 'free' ? 'text-amber-700' : 'text-cta'
              }`}>
                {planLabel}
              </span>
              <span className="text-[10px] text-[#9ca3af]">actuel</span>
            </div>
            <div className="w-px h-10 bg-gray-200" />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wider">Équipe</span>
              <span className="text-[15px] font-bold text-[#1a1a1a] tabular-nums leading-tight">
                {teamCount}
              </span>
              <span className="text-[10px] text-[#9ca3af]">
                {teamCount === 1 ? 'membre' : 'membres'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════ DATA EXPORT (GDPR) ═══════ */}
      <div className="bg-white border border-[#E5E2D7] rounded-2xl p-5 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Download className="w-4 h-4 text-cta" />
              <h2 className="text-[14px] font-bold text-[#1a1a1a]">Export de mes données (RGPD)</h2>
            </div>
            <p className="text-[12px] text-[#71717a] max-w-xl">
              Téléchargez l'intégralité de vos conversations, tickets, métriques ROI, templates et base de connaissances. Vos données vous appartiennent.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleExport('json')}
              disabled={exporting === 'json'}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5E2D7] bg-white text-[12px] font-semibold text-[#1a1a1a] hover:bg-[#fafafa] disabled:opacity-50 transition"
            >
              {exporting === 'json' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              JSON
            </button>
            <button
              type="button"
              onClick={() => handleExport('csv')}
              disabled={exporting === 'csv'}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cta text-white text-[12px] font-semibold hover:bg-[#0a4a29] disabled:opacity-50 transition"
            >
              {exporting === 'csv' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              CSV
            </button>
          </div>
        </div>
      </div>

      {/* ═══════ SLACK OPS CANVAS ═══════ */}
      <div className="bg-white border border-[#E5E2D7] rounded-2xl p-5 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Slack className="w-4 h-4 text-cta" />
              <h2 className="text-[14px] font-bold text-[#1a1a1a]">Live Ops Canvas Slack</h2>
              {slackOps?.enabled && (
                <span className="text-[10px] font-bold text-cta uppercase tracking-wider">Actif</span>
              )}
            </div>
            <p className="text-[12px] text-[#71717a] max-w-xl">
              Une page Canvas Slack rafraîchie toutes les 15 min : tickets ouverts, top sujets, alertes actives, taux de résolution IA. Tu l'épingles dans ton workspace, c'est ta war room.
            </p>
            {slackOps?.lastRefreshedAt && (
              <p className="text-[11px] text-[#9ca3af] mt-1">
                Dernier refresh :{' '}
                {new Date(slackOps.lastRefreshedAt).toLocaleString('fr-FR', {
                  hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit',
                })}
                {' · '}
                <a
                  href="slack://open"
                  className="text-cta hover:underline inline-flex items-center gap-1"
                >
                  Ouvrir dans Slack <ExternalLink className="w-3 h-3" />
                </a>
              </p>
            )}
            {!slackOps?.slackConnected && (
              <p className="text-[11px] text-amber-700 mt-1">
                Connecte d'abord Slack depuis l'onglet Intégrations.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={toggleSlackOps}
            disabled={slackOpsBusy || !slackOps?.slackConnected}
            aria-pressed={slackOps?.enabled === true}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              slackOps?.enabled ? 'bg-cta' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                slackOps?.enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* ═══════ SETTINGS GROUPS ═══════ */}
      <div className="space-y-6">
        {groups.map((grp, gidx) => (
          <div key={grp.title}>
            <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#9ca3af] mb-2 px-1">
              {grp.title}
            </h2>
            <div className="bg-white rounded-2xl border border-[#E5E2D7] divide-y divide-gray-100 overflow-hidden">
              {grp.items.map((it, idx) => {
                const Icon = it.icon
                return (
                  <motion.button
                    key={it.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2, delay: 0.03 * (gidx * 3 + idx) }}
                    onClick={() => onNavigate && onNavigate(it.id)}
                    className="group w-full flex items-center gap-3 px-4 py-3.5 hover:bg-[#fafafa] transition-colors text-left"
                  >
                    <div className="w-9 h-9 rounded-lg bg-cta/10 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-cta" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-[#1a1a1a]">{it.label}</span>
                        {it.badge && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
                            {it.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[12px] text-[#71717a] truncate mt-0.5">{it.description}</p>
                    </div>
                    {it.signal && (
                      <span className={`text-[11px] font-semibold tabular-nums flex-shrink-0 truncate max-w-[140px] ${
                        it.signalState === 'warn'
                          ? 'text-amber-700'
                          : it.signalState === 'ok'
                            ? 'text-cta'
                            : 'text-[#71717a]'
                      }`}>
                        {it.signal}
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-[#9ca3af] group-hover:text-[#71717a] transition-colors flex-shrink-0" />
                  </motion.button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
