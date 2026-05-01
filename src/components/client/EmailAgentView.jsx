import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Mail, Clock, CheckCircle2, AlertTriangle, Loader2, Save, Plus, X, Moon,
  Volume2, Power, Shield, Sparkles, ChevronRight, Settings as SettingsIcon,
  RefreshCw,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { EmptyState } from '../ui/EmptyState'
import { LivePulseDot } from '../ui/LivePulseDot'

/**
 * Email Agent View — the dashboard shown when a client connects IMAP/SMTP.
 *
 * 3 sections:
 *   1. Status hero (enabled/disabled + weekly stats + last poll)
 *   2. Auto-reply settings (toggle, confidence, quiet hours, delay, signature)
 *   3. Recent activity (last 10 inbound emails with outcome)
 */

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token || ''}`,
  }
}

export const EmailAgentView = ({ clientId }) => {
  const queryClient = useQueryClient()

  // Check if Gmail OAuth OR IMAP integration is connected
  const { data: integration, isLoading: loadingIntegration } = useQuery({
    queryKey: ['email-provider', clientId],
    queryFn: async () => {
      if (!clientId) return null
      // Prefer Gmail when both are connected
      const { data: gmail } = await supabase
        .from('client_integrations')
        .select('provider, status, extra_config, connected_at')
        .eq('client_id', clientId)
        .eq('provider', 'gmail')
        .eq('status', 'active')
        .maybeSingle()
      if (gmail) return gmail
      const { data: imap } = await supabase
        .from('client_integrations')
        .select('provider, status, extra_config, connected_at')
        .eq('client_id', clientId)
        .eq('provider', 'smtp_imap')
        .eq('status', 'active')
        .maybeSingle()
      return imap
    },
    enabled: !!clientId,
  })

  const { data: settingsData, isLoading: loadingSettings } = useQuery({
    queryKey: ['email-agent-settings', clientId],
    queryFn: async () => {
      const res = await fetch(`/api/email/settings?client_id=${clientId}`, { headers: await authHeaders() })
      if (!res.ok) throw new Error('Erreur chargement')
      return res.json()
    },
    enabled: !!clientId,
  })

  const { data: activity } = useQuery({
    queryKey: ['email-activity', clientId],
    queryFn: async () => {
      const res = await fetch(`/api/email/recent-activity?client_id=${clientId}&limit=10`, { headers: await authHeaders() })
      if (!res.ok) throw new Error('Erreur')
      return res.json()
    },
    enabled: !!clientId,
    refetchInterval: 30_000,
  })

  const settings = settingsData?.settings || {}
  const isConnected = integration?.status === 'active'
  const providerKind = integration?.provider // 'gmail' or 'smtp_imap'

  const updateMutation = useMutation({
    mutationFn: async (patch) => {
      const res = await fetch('/api/email/settings', {
        method: 'PATCH',
        headers: await authHeaders(),
        body: JSON.stringify({ client_id: clientId, ...patch }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Erreur')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-agent-settings', clientId] })
    },
  })

  if (loadingIntegration || loadingSettings) {
    return (
      <div className="max-w-5xl mx-auto px-5 md:px-8 pt-6 pb-16 animate-fade-in-up">
        <div className="flex items-center gap-2 text-[#71717a]">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Chargement…</span>
        </div>
      </div>
    )
  }

  if (!isConnected) {
    return (
      <div className="max-w-3xl mx-auto px-5 md:px-8 pt-6 pb-16 animate-fade-in-up">
        <div className="bg-white rounded-2xl border border-[#f0f0f0]">
          <EmptyState
            icon={Mail}
            tone="cta"
            title="Connecte ta boîte mail"
            description="Ton agent lit automatiquement tes emails entrants et répond aux questions clients courantes (livraison, retours, produits) 24h/24, avec ton ton de marque."
            action={{
              label: 'Connecter Gmail (recommandé)',
              onClick: () => { window.location.href = '/client/integrations' },
            }}
            secondaryAction={{
              label: 'Configurer SMTP/IMAP',
              onClick: () => { window.location.href = '/client/integrations' },
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-5 md:px-8 pt-6 pb-16 animate-fade-in-up space-y-6">
      <StatusHero
        clientId={clientId}
        settings={settings}
        activity={activity}
        integration={integration}
        onToggle={(v) => updateMutation.mutate({ email_agent_enabled: v })}
        toggling={updateMutation.isPending}
        queryClient={queryClient}
      />
      <AutoReplyConfig settings={settings} onUpdate={(patch) => updateMutation.mutate(patch)} saving={updateMutation.isPending} />
      <RecentActivity activity={activity} />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Status Hero                                                                */
/* -------------------------------------------------------------------------- */

function StatusHero({ clientId, settings, activity, integration, onToggle, toggling, queryClient }) {
  const enabled = settings?.email_agent_enabled
  const lastPoll = settings?.email_last_polled_at
  const lastError = settings?.email_last_error
  const consecutiveFailures = settings?.email_consecutive_failures || 0
  // Mirrors CIRCUIT_BREAKER_THRESHOLD in api/cron/poll-inbound-emails.js
  const circuitOpen = consecutiveFailures >= 10
  const mailbox = integration?.extra_config?.email || integration?.extra_config?.username || '—'
  const week = activity?.week || { total: 0, auto: 0, escalated: 0, auto_rate: 0 }

  const minsAgo = lastPoll ? Math.floor((Date.now() - new Date(lastPoll).getTime()) / 60000) : null

  const resetCircuit = useMutation({
    mutationFn: async () => {
      // Resetting via REST is gated by RLS (`client members update own conversations`
      // / equivalent on client_settings) so users only ever clear their own row.
      const { error } = await supabase
        .from('client_settings')
        .update({ email_consecutive_failures: 0, email_last_error: null, email_last_error_at: null })
        .eq('client_id', clientId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-agent-settings', clientId] })
    },
  })

  const pollNow = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/email/poll-now', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ client_id: clientId }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Erreur')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-activity', clientId] })
      queryClient.invalidateQueries({ queryKey: ['email-agent-settings', clientId] })
    },
  })

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border p-5 ${
        enabled
          ? 'bg-gradient-to-br from-emerald-50/60 to-white border-emerald-100'
          : 'bg-white border-[#f0f0f0]'
      }`}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
            enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-500'
          }`}>
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-[18px] font-bold text-[#1a1a1a] tracking-tight">Agent Email</h1>
              <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-100 text-zinc-600'
              }`}>
                {enabled ? <LivePulseDot color="emerald" /> : <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />}
                {enabled ? 'Actif' : 'Désactivé'}
              </span>
            </div>
            <p className="text-[12px] text-[#71717a] mt-0.5 truncate">
              {integration?.provider === 'gmail' ? (
                <>
                  <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded mr-1.5">
                    Gmail
                  </span>
                  <span className="font-mono">{integration?.extra_config?.email || mailbox}</span>
                </>
              ) : (
                <>Boîte : <span className="font-mono">{mailbox}</span></>
              )}
              {minsAgo !== null && <> · Dernier poll il y a {minsAgo} min</>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {enabled && (
            <button
              onClick={() => pollNow.mutate()}
              disabled={pollNow.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold bg-white border border-[#f0f0f0] text-[#71717a] hover:bg-zinc-50 transition-all disabled:opacity-50"
              title="Relever la boîte mail maintenant"
            >
              {pollNow.isPending ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Relève en cours…</>
              ) : (
                <><RefreshCw className="w-3.5 h-3.5" /> Relever maintenant</>
              )}
            </button>
          )}
          <button
            onClick={() => onToggle(!enabled)}
            disabled={toggling}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12px] font-semibold transition-all disabled:opacity-50 ${
              enabled
                ? 'bg-white border border-[#f0f0f0] text-[#71717a] hover:bg-zinc-50'
                : 'bg-cta text-white hover:bg-[#003725]'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            {enabled ? 'Mettre en pause' : 'Activer l\'agent'}
          </button>
        </div>

        {pollNow.isSuccess && (
          <div className="w-full mt-2 space-y-1.5">
            <div className="text-[11px] text-emerald-700 font-medium">
              ✓ Relève terminée — {pollNow.data.processed} nouvel{pollNow.data.processed > 1 ? 's' : ''} email{pollNow.data.processed > 1 ? 's' : ''} traité{pollNow.data.processed > 1 ? 's' : ''}
            </div>
            {pollNow.data.diagnostics && (
              <details className="text-[11px] bg-zinc-50 rounded-md p-2 border border-[#f0f0f0]">
                <summary className="cursor-pointer font-semibold text-[#71717a]">
                  Diagnostics IMAP — {pollNow.data.diagnostics.mailbox_total} emails dans INBOX, {pollNow.data.diagnostics.unread_count} non-lus
                </summary>
                <div className="mt-2 space-y-1">
                  <div className="text-[#71717a]">5 derniers emails reçus :</div>
                  {pollNow.data.diagnostics.last_5?.length > 0 ? (
                    <ul className="space-y-1">
                      {pollNow.data.diagnostics.last_5.map((m) => (
                        <li key={m.uid} className="flex items-start gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${m.unread ? 'bg-emerald-500' : 'bg-zinc-300'}`} title={m.unread ? 'Non-lu' : 'Déjà lu'} />
                          <span className="text-[#1a1a1a]">
                            <span className="font-mono text-[10px]">{m.from}</span> · <span className="italic">{m.subject || '(sans objet)'}</span>
                            {!m.unread && <span className="text-[#9ca3af] ml-1">(déjà lu, ignoré)</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-[#9ca3af] italic">Aucun email dans INBOX</div>
                  )}
                  <div className="text-[10px] text-[#9ca3af] mt-2 pt-2 border-t border-[#f0f0f0]">
                    💡 Actero ne lit que les emails <strong>non-lus</strong> (point vert). Si tu ouvres ton webmail, les emails passent en "lu" et sont ignorés. Envoie un nouveau test sans ouvrir ton webmail.
                  </div>
                  {pollNow.data.diagnostics.folders?.length > 0 && (
                    <details className="mt-2 pt-2 border-t border-[#f0f0f0]">
                      <summary className="cursor-pointer text-[10px] text-[#9ca3af] font-medium">
                        Dossiers disponibles sur le serveur IMAP ({pollNow.data.diagnostics.folders.length})
                      </summary>
                      <ul className="mt-1 space-y-0.5 text-[10px] text-[#71717a]">
                        {pollNow.data.diagnostics.folders.map((f, i) => (
                          <li key={i} className="font-mono">
                            {f.path} {f.specialUse && <span className="text-[#9ca3af]">({f.specialUse})</span>}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              </details>
            )}
          </div>
        )}
        {pollNow.isError && (
          <div className="w-full mt-2 text-[11px] text-red-700 font-medium">
            ✗ {pollNow.error?.message || 'Erreur'}
          </div>
        )}

        {enabled && lastError && (
          <div className={`w-full mt-2 rounded-lg border p-3 text-[12px] ${
            circuitOpen ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
          }`}>
            <div className="flex items-start gap-2">
              <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${circuitOpen ? 'text-red-700' : 'text-amber-700'}`} />
              <div className="flex-1 min-w-0">
                <div className={`font-semibold ${circuitOpen ? 'text-red-900' : 'text-amber-900'}`}>
                  {circuitOpen
                    ? `Relève désactivée — ${consecutiveFailures} échecs consécutifs`
                    : `Dernière relève en échec (${consecutiveFailures} de suite)`}
                </div>
                <div className={`mt-1 font-mono text-[11px] break-words ${circuitOpen ? 'text-red-800' : 'text-amber-800'}`}>
                  {lastError}
                </div>
                <div className={`mt-1.5 text-[11px] ${circuitOpen ? 'text-red-700' : 'text-amber-700'}`}>
                  {circuitOpen
                    ? 'Vérifie ton mot de passe IMAP / re-connecte Gmail puis clique « Reprendre la relève » ci-dessous.'
                    : 'Si l\'erreur persiste, vérifie ton mot de passe IMAP ou re-connecte Gmail.'}
                </div>
                {circuitOpen && (
                  <button
                    onClick={() => resetCircuit.mutate()}
                    disabled={resetCircuit.isPending}
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold bg-white border border-red-300 text-red-700 hover:bg-red-100 transition disabled:opacity-50"
                  >
                    {resetCircuit.isPending ? (
                      <><Loader2 className="w-3 h-3 animate-spin" /> Réinitialisation…</>
                    ) : (
                      <><RefreshCw className="w-3 h-3" /> Reprendre la relève</>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Weekly stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Emails reçus (7j)" value={week.total} icon={Mail} />
        <StatCard label="Auto-résolus" value={week.auto} icon={CheckCircle2} color="text-emerald-600" />
        <StatCard label="Escaladés" value={week.escalated} icon={AlertTriangle} color="text-amber-600" />
        <StatCard label="Taux auto" value={`${week.auto_rate}%`} icon={Sparkles} color="text-cta" />
      </div>
    </motion.div>
  )
}

function StatCard({ label, value, icon: Icon, color = 'text-[#1a1a1a]' }) {
  return (
    <div className="bg-white rounded-xl border border-[#f0f0f0] p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#9ca3af] mb-1">
        <Icon className={`w-3 h-3 ${color}`} />
        {label}
      </div>
      <div className={`text-[20px] font-bold ${color}`}>{value}</div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Auto-reply config                                                          */
/* -------------------------------------------------------------------------- */

function AutoReplyConfig({ settings, onUpdate, saving }) {
  const [expanded, setExpanded] = useState(false)
  const [sig, setSig] = useState(settings.email_signature || '')
  const [excl, setExcl] = useState(() => Array.isArray(settings.email_exclusions) ? settings.email_exclusions : [])
  const [newExcl, setNewExcl] = useState('')

  // Sync with props when settings load
  React.useEffect(() => {
    setSig(settings.email_signature || '')
    setExcl(Array.isArray(settings.email_exclusions) ? settings.email_exclusions : [])
  }, [settings.email_signature, settings.email_exclusions])

  return (
    <div className="bg-white rounded-2xl border border-[#f0f0f0] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-zinc-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-cta/10 flex items-center justify-center">
            <SettingsIcon className="w-4 h-4 text-cta" />
          </div>
          <div className="text-left">
            <h3 className="text-[14px] font-semibold text-[#1a1a1a]">Configuration auto-réponse</h3>
            <p className="text-[12px] text-[#71717a] mt-0.5">Seuil de confiance, horaires, exclusions, signature</p>
          </div>
        </div>
        <ChevronRight className={`w-4 h-4 text-[#9ca3af] transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>

      {expanded && (
        <div className="px-5 pb-5 pt-1 space-y-5 border-t border-[#f0f0f0]">
          {/* Auto-reply toggle */}
          <ToggleRow
            label="Répondre automatiquement aux emails"
            description="L'IA envoie la réponse directement. Sinon, escalade à l'équipe."
            value={!!settings.email_auto_reply_enabled}
            onChange={(v) => onUpdate({ email_auto_reply_enabled: v })}
          />

          {/* Confidence threshold */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[13px] font-semibold text-[#1a1a1a]">Seuil de confiance IA</label>
              <span className="text-[12px] font-semibold text-cta">{settings.email_confidence_threshold ?? 80}%</span>
            </div>
            <input
              type="range"
              min={50}
              max={100}
              step={5}
              value={settings.email_confidence_threshold ?? 80}
              onChange={(e) => onUpdate({ email_confidence_threshold: parseInt(e.target.value, 10) })}
              className="w-full accent-cta"
            />
            <p className="text-[11px] text-[#9ca3af] mt-1">
              En dessous de ce seuil, l'email est escaladé à l'équipe. 80% = équilibré.
            </p>
          </div>

          {/* Quiet hours */}
          <div>
            <label className="flex items-center gap-2 text-[13px] font-semibold text-[#1a1a1a] mb-2">
              <Moon className="w-3.5 h-3.5" />
              Heures silencieuses (pas de réponse auto)
            </label>
            <div className="flex items-center gap-2 text-[12px]">
              <span className="text-[#71717a]">De</span>
              <input
                type="number" min={0} max={23} value={settings.email_quiet_hours_start ?? ''}
                onChange={(e) => onUpdate({ email_quiet_hours_start: e.target.value === '' ? null : parseInt(e.target.value, 10) })}
                placeholder="22"
                className="w-16 px-2 py-1 border border-[#f0f0f0] rounded-md text-center"
              />
              <span className="text-[#71717a]">h à</span>
              <input
                type="number" min={0} max={23} value={settings.email_quiet_hours_end ?? ''}
                onChange={(e) => onUpdate({ email_quiet_hours_end: e.target.value === '' ? null : parseInt(e.target.value, 10) })}
                placeholder="8"
                className="w-16 px-2 py-1 border border-[#f0f0f0] rounded-md text-center"
              />
              <span className="text-[#71717a]">h (Paris)</span>
            </div>
            <p className="text-[11px] text-[#9ca3af] mt-1">Laissez vide pour répondre 24/7.</p>
          </div>

          {/* Send delay */}
          <div>
            <label className="flex items-center gap-2 text-[13px] font-semibold text-[#1a1a1a] mb-2">
              <Clock className="w-3.5 h-3.5" />
              Délai artificiel avant envoi
            </label>
            <div className="flex items-center gap-2 text-[12px]">
              <input
                type="number" min={0} max={300}
                value={settings.email_send_delay_seconds ?? 0}
                onChange={(e) => onUpdate({ email_send_delay_seconds: parseInt(e.target.value, 10) || 0 })}
                className="w-20 px-2 py-1 border border-[#f0f0f0] rounded-md text-center"
              />
              <span className="text-[#71717a]">secondes (pour paraître humain)</span>
            </div>
          </div>

          {/* Voice attachment */}
          <ToggleRow
            label="Joindre un message vocal aux réponses"
            description="Feature premium ElevenLabs — l'agent ajoute un audio naturel à chaque email envoyé."
            value={!!settings.email_attach_voice}
            onChange={(v) => onUpdate({ email_attach_voice: v })}
            icon={Volume2}
          />

          {/* Signature */}
          <div>
            <label className="text-[13px] font-semibold text-[#1a1a1a] mb-2 block">Signature email</label>
            <textarea
              value={sig}
              onChange={(e) => setSig(e.target.value)}
              onBlur={() => {
                if (sig !== (settings.email_signature || '')) onUpdate({ email_signature: sig })
              }}
              placeholder="—&#10;L'équipe Actero&#10;support@actero.fr"
              rows={3}
              className="w-full px-3 py-2 border border-[#f0f0f0] rounded-lg text-[12px] font-mono resize-none focus:outline-none focus:border-cta/30"
            />
            <p className="text-[11px] text-[#9ca3af] mt-1">Ajoutée au bas de chaque email envoyé.</p>
          </div>

          {/* Exclusions */}
          <div>
            <label className="flex items-center gap-2 text-[13px] font-semibold text-[#1a1a1a] mb-2">
              <Shield className="w-3.5 h-3.5" />
              Expéditeurs exclus
            </label>
            <p className="text-[11px] text-[#9ca3af] mb-2">
              Aucune réponse auto pour ces emails ou domaines (ex: @votreboite.com, newsletter@…).
            </p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {excl.map((e, i) => (
                <span key={i} className="inline-flex items-center gap-1 text-[11px] bg-zinc-100 text-[#1a1a1a] px-2 py-0.5 rounded-md">
                  {e}
                  <button
                    onClick={() => {
                      const next = excl.filter((_, k) => k !== i)
                      setExcl(next)
                      onUpdate({ email_exclusions: next })
                    }}
                    className="hover:text-red-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={newExcl}
                onChange={(e) => setNewExcl(e.target.value)}
                placeholder="@example.com ou email exact"
                className="flex-1 px-3 py-1.5 border border-[#f0f0f0] rounded-lg text-[12px]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newExcl.trim()) {
                    const next = [...excl, newExcl.trim()]
                    setExcl(next)
                    onUpdate({ email_exclusions: next })
                    setNewExcl('')
                  }
                }}
              />
              <button
                onClick={() => {
                  if (!newExcl.trim()) return
                  const next = [...excl, newExcl.trim()]
                  setExcl(next)
                  onUpdate({ email_exclusions: next })
                  setNewExcl('')
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-cta text-white hover:bg-[#003725]"
              >
                <Plus className="w-3 h-3" /> Ajouter
              </button>
            </div>
          </div>

          {saving && (
            <div className="flex items-center gap-1.5 text-[11px] text-[#71717a]">
              <Loader2 className="w-3 h-3 animate-spin" />
              Sauvegarde en cours…
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ToggleRow({ label, description, value, onChange, icon: Icon }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <label className="flex items-center gap-2 text-[13px] font-semibold text-[#1a1a1a]">
          {Icon && <Icon className="w-3.5 h-3.5" />}
          {label}
        </label>
        {description && <p className="text-[11px] text-[#71717a] mt-0.5 leading-relaxed">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${value ? 'bg-cta' : 'bg-zinc-300'}`}
        aria-pressed={value}
      >
        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </button>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Recent activity                                                            */
/* -------------------------------------------------------------------------- */

function RecentActivity({ activity }) {
  const items = activity?.recent || []
  return (
    <div className="bg-white rounded-2xl border border-[#f0f0f0] overflow-hidden">
      <div className="px-5 py-4 border-b border-[#f0f0f0] flex items-center justify-between">
        <h3 className="text-[14px] font-semibold text-[#1a1a1a]">Activité récente</h3>
        <span className="text-[11px] text-[#9ca3af]">Temps réel — refresh auto 30s</span>
      </div>
      {items.length === 0 ? (
        <EmptyState
          icon={Mail}
          tone="neutral"
          title="Aucun email traité pour le moment"
          description="Dès qu'un client t'écrira à l'adresse connectée, ton agent lira le message et répondra ici — tu verras l'historique en temps réel."
        />
      ) : (
        <div className="divide-y divide-[#f0f0f0]">
          {items.map((it) => {
            const isAuto = it.status === 'resolved' && it.ai_response
            const isEscalated = it.status === 'escalated'
            const color = isAuto ? 'text-emerald-600 bg-emerald-50' : isEscalated ? 'text-amber-600 bg-amber-50' : 'text-[#71717a] bg-zinc-50'
            const label = isAuto ? 'Auto-répondu' : isEscalated ? 'Escaladé' : 'Reçu'
            return (
              <div key={it.id} className="px-5 py-3 hover:bg-zinc-50 transition-colors">
                <div className="flex items-center justify-between gap-3 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[11px] text-[#9ca3af] font-mono flex-shrink-0">
                      {new Date(it.created_at).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="text-[13px] font-semibold text-[#1a1a1a] truncate">{it.subject || '(sans objet)'}</span>
                  </div>
                  <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded flex-shrink-0 ${color}`}>
                    {label}
                  </span>
                </div>
                <div className="text-[11px] text-[#71717a] truncate">
                  De : <span className="font-mono">{it.customer_email}</span>
                  {isEscalated && it.escalation_reason && <> · <span className="italic">{it.escalation_reason}</span></>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
