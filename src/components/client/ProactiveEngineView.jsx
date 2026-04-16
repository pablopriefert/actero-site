import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Shield, Zap, CheckCircle2, AlertTriangle, Loader2, Play, Mail, Package,
  Sparkles, Clock, DollarSign, ChevronRight, PlayCircle, RefreshCw, Settings as SettingsIcon,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

/**
 * Proactive Engine Dashboard — "L'agent qui contacte avant le problème"
 *
 * 3 sections :
 *   1. Hero premium avec KPIs (tickets évités, €uros économisés)
 *   2. Liste des règles activables avec toggle + config
 *   3. Log des dernières actions proactives prises
 */

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token || ''}`,
  }
}

const RULE_ICONS = {
  shipment_delayed: Package,
  failed_payment: DollarSign,
  silent_vip: Sparkles,
}

const RULE_COLORS = {
  shipment_delayed: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  failed_payment: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  silent_vip: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
}

export const ProactiveEngineView = ({ clientId }) => {
  const queryClient = useQueryClient()
  const [configRule, setConfigRule] = useState(null) // rule_name or null

  const { data: rulesData, isLoading: loadingRules } = useQuery({
    queryKey: ['proactive-rules', clientId],
    queryFn: async () => {
      const res = await fetch(`/api/proactive/rules?client_id=${clientId}`, { headers: await authHeaders() })
      if (!res.ok) throw new Error('Erreur chargement')
      return res.json()
    },
    enabled: !!clientId,
  })

  const { data: eventsData } = useQuery({
    queryKey: ['proactive-events', clientId],
    queryFn: async () => {
      const res = await fetch(`/api/proactive/events?client_id=${clientId}`, { headers: await authHeaders() })
      if (!res.ok) throw new Error('Erreur')
      return res.json()
    },
    enabled: !!clientId,
    refetchInterval: 30_000,
  })

  const toggleMutation = useMutation({
    mutationFn: async ({ rule_name, is_active, config }) => {
      const res = await fetch('/api/proactive/rules', {
        method: 'PATCH',
        headers: await authHeaders(),
        body: JSON.stringify({ client_id: clientId, rule_name, is_active, config }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Erreur')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proactive-rules', clientId] })
    },
  })

  const checkNow = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/proactive/trigger-check', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ client_id: clientId }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Erreur')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proactive-events', clientId] })
      queryClient.invalidateQueries({ queryKey: ['proactive-rules', clientId] })
    },
  })

  const rules = rulesData?.rules || []
  const activeRulesCount = rules.filter(r => r.is_active).length
  const stats = eventsData?.stats || { tickets_avoided_week: 0, tickets_avoided_month: 0, euro_saved_month: 0, total_all_time: 0 }

  return (
    <div className="max-w-6xl mx-auto px-5 md:px-8 pt-6 pb-16 animate-fade-in-up space-y-6">

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0F5F35] via-[#0F5F35] to-[#003725] text-white p-6 md:p-8"
      >
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-72 h-72 bg-white/5 rounded-full blur-3xl" />

        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white/90 bg-white/10 px-2.5 py-1 rounded-full border border-white/20">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              Surveillance active
            </span>
          </div>
          <h1 className="text-[28px] md:text-[34px] font-bold tracking-tight mb-2 leading-tight">
            Le support qui voit les problèmes venir.
          </h1>
          <p className="text-[14px] md:text-[15px] text-white/75 max-w-2xl leading-relaxed mb-6">
            Au lieu d'attendre que vos clients se plaignent, Actero surveille en continu vos commandes, paiements, livraisons et les contacte <strong className="text-white">avant</strong> qu'un problème ne s'aggrave.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiTile icon={CheckCircle2} label="Tickets évités 7j" value={stats.tickets_avoided_week} />
            <KpiTile icon={Shield} label="Tickets évités 30j" value={stats.tickets_avoided_month} />
            <KpiTile icon={DollarSign} label="€ économisés 30j" value={`${stats.euro_saved_month}€`} sub="~2€/ticket évité" />
            <KpiTile icon={Zap} label="Règles actives" value={activeRulesCount} sub={`sur ${rules.length}`} />
          </div>
        </div>
      </motion.div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] text-[#71717a]">
          Vérification automatique toutes les 15 minutes. Vous pouvez aussi déclencher manuellement.
        </p>
        <button
          onClick={() => checkNow.mutate()}
          disabled={checkNow.isPending || activeRulesCount === 0}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold bg-white border border-[#f0f0f0] text-[#71717a] hover:bg-zinc-50 transition-all disabled:opacity-50"
        >
          {checkNow.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Vérifier maintenant
        </button>
      </div>

      {checkNow.isSuccess && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-[12px] text-emerald-800">
          ✓ Vérification terminée : {checkNow.data.detections} détection{checkNow.data.detections !== 1 ? 's' : ''}
          {checkNow.data.sent > 0 && <>, {checkNow.data.sent} email{checkNow.data.sent > 1 ? 's' : ''} envoyé{checkNow.data.sent > 1 ? 's' : ''}</>}
          {checkNow.data.failed > 0 && <>, {checkNow.data.failed} échec{checkNow.data.failed > 1 ? 's' : ''}</>}
        </div>
      )}
      {checkNow.isError && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-[12px] text-red-800">
          ✗ {checkNow.error?.message || 'Erreur'}
        </div>
      )}

      {/* Rules list */}
      <div>
        <h2 className="text-[16px] font-bold text-[#1a1a1a] mb-3">Signaux surveillés</h2>
        {loadingRules ? (
          <div className="flex items-center gap-2 text-[13px] text-[#71717a]">
            <Loader2 className="w-4 h-4 animate-spin" /> Chargement…
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {rules.map((rule) => (
              <RuleCard
                key={rule.rule_name}
                rule={rule}
                onToggle={(is_active) => toggleMutation.mutate({ rule_name: rule.rule_name, is_active })}
                onConfigure={() => setConfigRule(rule.rule_name)}
                toggling={toggleMutation.isPending}
              />
            ))}
          </div>
        )}
      </div>

      {/* Recent events */}
      <div>
        <h2 className="text-[16px] font-bold text-[#1a1a1a] mb-3">Historique des actions</h2>
        <div className="bg-white rounded-2xl border border-[#f0f0f0] overflow-hidden">
          {(eventsData?.recent || []).length === 0 ? (
            <div className="px-5 py-10 text-center text-[12px] text-[#9ca3af]">
              Aucune action proactive encore. Activez au moins une règle et le système surveillera en continu.
            </div>
          ) : (
            <div className="divide-y divide-[#f0f0f0]">
              {(eventsData?.recent || []).map((ev) => {
                const Icon = RULE_ICONS[ev.rule_name] || Shield
                const label = RULE_LABELS[ev.rule_name] || ev.rule_name
                const statusBadge = {
                  sent: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Envoyé' },
                  failed: { bg: 'bg-red-50', text: 'text-red-700', label: 'Échoué' },
                  skipped: { bg: 'bg-zinc-100', text: 'text-zinc-600', label: 'Ignoré' },
                  pending: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'En cours' },
                }[ev.action_status] || { bg: 'bg-zinc-100', text: 'text-zinc-600', label: ev.action_status }
                return (
                  <div key={ev.id} className="px-5 py-3 hover:bg-zinc-50 transition-colors">
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[11px] text-[#9ca3af] font-mono flex-shrink-0">
                          {new Date(ev.created_at).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <Icon className="w-3.5 h-3.5 text-[#71717a] flex-shrink-0" />
                        <span className="text-[13px] font-semibold text-[#1a1a1a]">{label}</span>
                      </div>
                      <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded flex-shrink-0 ${statusBadge.bg} ${statusBadge.text}`}>
                        {statusBadge.label}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#71717a] truncate">
                      Vers <span className="font-mono">{ev.customer_email}</span>
                      {ev.action_subject && <> · <span className="italic">{ev.action_subject}</span></>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const RULE_LABELS = {
  shipment_delayed: 'Colis retardé',
  failed_payment: 'Paiement échoué',
  silent_vip: 'Client VIP silencieux',
}

/* -------------------------------------------------------------------------- */
/*  Rule Card                                                                  */
/* -------------------------------------------------------------------------- */

function RuleCard({ rule, onToggle, onConfigure, toggling }) {
  const Icon = RULE_ICONS[rule.rule_name] || Shield
  const colors = RULE_COLORS[rule.rule_name] || { bg: 'bg-zinc-50', text: 'text-zinc-700', border: 'border-zinc-200' }
  const canToggle = rule.ready || rule.is_active

  return (
    <div className={`bg-white rounded-2xl border ${rule.is_active ? 'border-[#0F5F35]/30 shadow-[0_2px_10px_rgba(15,95,53,0.08)]' : 'border-[#f0f0f0]'} p-5 transition-all`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={`w-10 h-10 rounded-xl ${colors.bg} border ${colors.border} flex items-center justify-center flex-shrink-0`}>
            <Icon className={`w-5 h-5 ${colors.text}`} />
          </div>
          <div className="min-w-0">
            <h3 className="text-[14px] font-semibold text-[#1a1a1a] flex items-center gap-2">
              {rule.label}
              {rule.is_active && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
            </h3>
            <p className="text-[11px] text-[#71717a] mt-0.5 line-clamp-2">{rule.description}</p>
          </div>
        </div>
        <ToggleSwitch
          value={rule.is_active}
          onChange={(v) => onToggle(v)}
          disabled={!canToggle || toggling}
        />
      </div>

      {!rule.ready && !rule.is_active && (
        <div className="mt-3 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
          <AlertTriangle className="w-3 h-3 inline mr-1" />
          Nécessite : {rule.missing_providers.join(', ')} à connecter
        </div>
      )}

      {rule.is_active && rule.config && (
        <div className="mt-3 pt-3 border-t border-[#f0f0f0] flex items-center justify-between text-[11px]">
          <div className="text-[#71717a]">
            {rule.rule_name === 'shipment_delayed' && `Seuil : ${rule.config.threshold_hours}h sans mise à jour`}
            {rule.rule_name === 'failed_payment' && `Seuil : ${rule.config.threshold_hours}h sans paiement`}
            {rule.rule_name === 'silent_vip' && `CLV min : ${rule.config.min_clv_euros}€ · Silence : ${rule.config.silent_days}j`}
          </div>
          <button
            onClick={onConfigure}
            className="inline-flex items-center gap-1 text-[#0F5F35] hover:text-[#003725] font-semibold"
          >
            <SettingsIcon className="w-3 h-3" /> Configurer
          </button>
        </div>
      )}
    </div>
  )
}

function ToggleSwitch({ value, onChange, disabled }) {
  return (
    <button
      onClick={() => onChange(!value)}
      disabled={disabled}
      className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${value ? 'bg-[#0F5F35]' : 'bg-zinc-300'}`}
      aria-pressed={value}
    >
      <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
  )
}

function KpiTile({ icon: Icon, label, value, sub }) {
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/15">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center">
          <Icon className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="text-[11px] font-semibold text-white/75 uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-[24px] md:text-[28px] font-bold text-white leading-none tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-white/65 mt-1.5">{sub}</div>}
    </div>
  )
}
