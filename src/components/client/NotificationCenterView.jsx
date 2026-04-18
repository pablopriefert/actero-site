import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Bell, Mail, MessageSquare, Volume2, Smartphone,
  AlertTriangle, BarChart3, Trophy, Clock, CheckCircle2,
  Loader2, Zap, Shield, TrendingUp,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../ui/Toast'

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6)

const CHANNELS = [
  { id: 'email', label: 'Email', icon: Mail, desc: 'Recevez les notifications par email' },
  { id: 'slack', label: 'Slack', icon: MessageSquare, desc: 'Alertes dans votre canal Slack' },
  { id: 'vocal', label: 'Rapport vocal', icon: Volume2, desc: 'Resume audio hebdomadaire' },
  { id: 'push', label: 'Push navigateur', icon: Smartphone, desc: 'Notifications en temps reel' },
]

const NOTIFICATION_TYPES = [
  {
    section: 'Alertes critiques',
    icon: AlertTriangle,
    color: 'text-red-500',
    items: [
      { key: 'escalation_alert', label: 'Ticket escaladé', desc: 'Quand un ticket nécessite votre intervention', channels: ['email', 'slack', 'push'], defaultChannels: ['email'] },
      { key: 'urgent_ticket_alert', label: 'Ticket urgent / agressif', desc: 'Message détecté comme agressif ou urgent', channels: ['email', 'slack', 'push'], defaultChannels: ['email'] },
      { key: 'anomaly_alert', label: 'Anomalie détectée', desc: 'Pic de tickets ou baisse de performance soudaine', channels: ['email', 'slack', 'push'], defaultChannels: ['email'] },
      { key: 'security_alert', label: 'Tentative d\'injection', desc: 'Un message suspect a été bloqué par la sécurité IA', channels: ['email', 'slack'], defaultChannels: [] },
      { key: 'negative_sentiment', label: 'Sentiment très négatif', desc: 'Un client avec un score sentiment < 3/10', channels: ['email', 'slack', 'push'], defaultChannels: [] },
    ],
  },
  {
    section: 'Rapports',
    icon: BarChart3,
    color: 'text-blue-500',
    items: [
      { key: 'daily_summary', label: 'Résumé quotidien', desc: 'Email chaque matin avec les performances de la veille', channels: ['email'], defaultChannels: ['email'] },
      { key: 'weekly_summary', label: 'Résumé hebdomadaire', desc: 'Rapport chaque lundi avec tendances et insights', channels: ['email', 'vocal'], defaultChannels: [] },
      { key: 'monthly_report', label: 'Rapport mensuel PDF', desc: 'Rapport détaillé en fin de mois avec ROI et KPIs', channels: ['email'], defaultChannels: ['email'] },
      { key: 'voice_report', label: 'Rapport vocal', desc: 'Résumé audio de 90 secondes de vos métriques', channels: ['vocal'], defaultChannels: [] },
    ],
  },
  {
    section: 'Activité',
    icon: TrendingUp,
    color: 'text-emerald-500',
    items: [
      { key: 'new_integration', label: 'Intégration connectée', desc: 'Quand une nouvelle intégration est activée', channels: ['email', 'slack'], defaultChannels: [] },
      { key: 'agent_improvement', label: 'Suggestion d\'amélioration', desc: 'L\'IA a identifié un pattern à corriger', channels: ['email'], defaultChannels: ['email'] },
      { key: 'milestone_alert', label: 'Jalon atteint', desc: '100h économisées, 1000 tickets résolus, etc.', channels: ['email', 'push'], defaultChannels: ['email'] },
    ],
  },
]

const Toggle = ({ isOn, onToggle, small }) => (
  <button
    onClick={onToggle}
    className={`relative rounded-full transition-colors flex-shrink-0 ${
      isOn ? 'bg-cta' : 'bg-[#e5e5e5]'
    } ${small ? 'w-8 h-[18px]' : 'w-11 h-6'}`}
  >
    <div className={`absolute top-0.5 rounded-full bg-white shadow transition-transform ${
      small
        ? `w-3.5 h-3.5 ${isOn ? 'translate-x-[14px]' : 'translate-x-0.5'}`
        : `w-5 h-5 ${isOn ? 'translate-x-5' : 'translate-x-0.5'}`
    }`} />
  </button>
)

export const NotificationCenterView = ({ clientId, theme }) => {
  const toast = useToast()
  const queryClient = useQueryClient()
  const isLight = theme === 'light'

  // Fetch existing preferences
  const { data: prefs, isLoading } = useQuery({
    queryKey: ['notification-prefs-full', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('client_notification_preferences')
        .select('*')
        .eq('client_id', clientId)
        .maybeSingle()
      if (!data) {
        const { data: created } = await supabase
          .from('client_notification_preferences')
          .insert({ client_id: clientId })
          .select()
          .single()
        return created
      }
      return data
    },
    enabled: !!clientId,
  })

  // Local state for channel preferences (stored as JSON in notification_channels column)
  const [channelPrefs, setChannelPrefs] = useState({})
  const [preferredHour, setPreferredHour] = useState(8)
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false)
  const [quietStart, setQuietStart] = useState(22)
  const [quietEnd, setQuietEnd] = useState(7)

  useEffect(() => {
    if (prefs) {
      setPreferredHour(prefs.preferred_hour ?? 8)
      // Load channel prefs from JSON or build from existing toggles
      if (prefs.notification_channels) {
        try {
          setChannelPrefs(typeof prefs.notification_channels === 'string' ? JSON.parse(prefs.notification_channels) : prefs.notification_channels)
        } catch {
          buildDefaultChannelPrefs()
        }
      } else {
        buildDefaultChannelPrefs()
      }
      setQuietHoursEnabled(prefs.quiet_hours_enabled ?? false)
      setQuietStart(prefs.quiet_hours_start ?? 22)
      setQuietEnd(prefs.quiet_hours_end ?? 7)
    }
  }, [prefs])

  const buildDefaultChannelPrefs = () => {
    const defaults = {}
    NOTIFICATION_TYPES.forEach(section => {
      section.items.forEach(item => {
        defaults[item.key] = {}
        item.channels.forEach(ch => {
          defaults[item.key][ch] = item.defaultChannels.includes(ch) || (prefs?.[item.key] ?? false)
        })
      })
    })
    setChannelPrefs(defaults)
  }

  const updatePref = useMutation({
    mutationFn: async (updates) => {
      if (!prefs?.id) return
      const { error } = await supabase
        .from('client_notification_preferences')
        .update(updates)
        .eq('id', prefs.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-prefs-full', clientId] })
    },
  })

  const toggleChannel = (notifKey, channel) => {
    const updated = {
      ...channelPrefs,
      [notifKey]: {
        ...(channelPrefs[notifKey] || {}),
        [channel]: !(channelPrefs[notifKey]?.[channel] ?? false),
      },
    }
    setChannelPrefs(updated)
    // Also update the legacy toggle key for backwards compat
    const anyEnabled = Object.values(updated[notifKey] || {}).some(v => v)
    updatePref.mutate({
      notification_channels: updated,
      [notifKey]: anyEnabled,
    })
  }

  const isChannelEnabled = (notifKey, channel) => {
    return channelPrefs[notifKey]?.[channel] ?? false
  }

  const activeCount = Object.values(channelPrefs).reduce((sum, channels) => {
    return sum + Object.values(channels || {}).filter(v => v).length
  }, 0)

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-[#9ca3af]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-cta/10 flex items-center justify-center">
          <Bell className="w-5 h-5 text-cta" />
        </div>
        <div>
          <h2 className="text-[22px] font-semibold text-[#1a1a1a]">Notifications</h2>
          <p className="text-sm text-[#9ca3af]">{activeCount} notification{activeCount > 1 ? 's' : ''} active{activeCount > 1 ? 's' : ''} — choisissez quoi recevoir et ou</p>
        </div>
      </div>

      {/* Channel legend */}
      <div className="flex flex-wrap gap-3">
        {CHANNELS.map(ch => {
          const Icon = ch.icon
          return (
            <div key={ch.id} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-[#f0f0f0] rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
              <Icon className="w-3.5 h-3.5 text-[#9ca3af]" />
              <span className="text-xs font-medium text-[#1a1a1a]">{ch.label}</span>
            </div>
          )
        })}
      </div>

      {/* Notification sections */}
      {NOTIFICATION_TYPES.map((section, sIdx) => {
        const SectionIcon = section.icon
        return (
          <motion.div
            key={section.section}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: sIdx * 0.05 }}
            className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-[#f0f0f0] overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-[#f0f0f0] flex items-center gap-2">
              <SectionIcon className={`w-4 h-4 ${section.color}`} />
              <h3 className="text-sm font-bold text-[#1a1a1a]">{section.section}</h3>
            </div>

            <div className="divide-y divide-gray-50">
              {section.items.map(item => (
                <div key={item.key} className="px-5 py-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1a1a1a]">{item.label}</p>
                    <p className="text-xs text-[#9ca3af] mt-0.5">{item.desc}</p>
                  </div>

                  {/* Channel toggles */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {item.channels.map(ch => {
                      const ChIcon = CHANNELS.find(c => c.id === ch)?.icon || Mail
                      const enabled = isChannelEnabled(item.key, ch)
                      return (
                        <button
                          key={ch}
                          onClick={() => toggleChannel(item.key, ch)}
                          className={`p-2 rounded-lg border transition-all ${
                            enabled
                              ? 'bg-cta/10 border-cta/30 text-cta'
                              : 'bg-[#fafafa] border-[#f0f0f0] text-[#e5e5e5] hover:text-[#9ca3af] hover:border-[#ebebeb]'
                          }`}
                          title={`${CHANNELS.find(c => c.id === ch)?.label}: ${enabled ? 'Actif' : 'Inactif'}`}
                        >
                          <ChIcon className="w-4 h-4" />
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )
      })}

      {/* Timing preferences */}
      <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-[#f0f0f0] p-5 space-y-5">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-cta" />
          <h3 className="text-sm font-bold text-[#1a1a1a]">Horaires</h3>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-[#1a1a1a]">Heure d'envoi des rapports</p>
            <p className="text-xs text-[#9ca3af]">Les resumes quotidiens et hebdomadaires seront envoyes a cette heure</p>
          </div>
          <select
            value={preferredHour}
            onChange={(e) => {
              const val = parseInt(e.target.value)
              setPreferredHour(val)
              updatePref.mutate({ preferred_hour: val })
            }}
            className="px-3 py-2 bg-[#fafafa] border border-[#ebebeb] rounded-xl text-sm text-[#1a1a1a] outline-none"
          >
            {HOURS.map(h => (
              <option key={h} value={h}>{h}h00</option>
            ))}
          </select>
        </div>

        <div className="border-t border-[#f0f0f0] pt-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-medium text-[#1a1a1a]">Mode silencieux</p>
              <p className="text-xs text-[#9ca3af]">Pas de notifications push entre ces heures</p>
            </div>
            <Toggle
              isOn={quietHoursEnabled}
              onToggle={() => {
                const val = !quietHoursEnabled
                setQuietHoursEnabled(val)
                updatePref.mutate({ quiet_hours_enabled: val })
              }}
            />
          </div>

          {quietHoursEnabled && (
            <div className="flex items-center gap-3 pl-4">
              <span className="text-xs text-[#9ca3af]">De</span>
              <select
                value={quietStart}
                onChange={(e) => {
                  const val = parseInt(e.target.value)
                  setQuietStart(val)
                  updatePref.mutate({ quiet_hours_start: val })
                }}
                className="px-2 py-1.5 bg-[#fafafa] border border-[#ebebeb] rounded-lg text-sm text-[#1a1a1a] outline-none"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>{i}h00</option>
                ))}
              </select>
              <span className="text-xs text-[#9ca3af]">a</span>
              <select
                value={quietEnd}
                onChange={(e) => {
                  const val = parseInt(e.target.value)
                  setQuietEnd(val)
                  updatePref.mutate({ quiet_hours_end: val })
                }}
                className="px-2 py-1.5 bg-[#fafafa] border border-[#ebebeb] rounded-lg text-sm text-[#1a1a1a] outline-none"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>{i}h00</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
