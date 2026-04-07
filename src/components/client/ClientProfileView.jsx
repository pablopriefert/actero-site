import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  User, Mail, Building2, Lock, Save, CheckCircle2, AlertCircle,
  ShoppingBag, Calendar, Shield, CreditCard, ExternalLink, Loader2,
  Bell, Clock as ClockIcon
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../ui/Toast'

const NOTIFICATION_TOGGLES = [
  { section: 'Alertes', items: [
    { key: 'escalation_alert', label: 'Tickets escalades', desc: 'Email immediat quand un ticket necessite votre intervention', defaultVal: true },
    { key: 'anomaly_alert', label: 'Alertes anomalie', desc: 'Notification si un pic de tickets ou une baisse de performance est detecte', defaultVal: true },
    { key: 'urgent_ticket_alert', label: 'Tickets urgents', desc: 'Email immediat pour les tickets detectes comme urgents ou agressifs', defaultVal: true },
  ]},
  { section: 'Rapports', items: [
    { key: 'daily_summary', label: 'Resume quotidien', desc: 'Email chaque matin avec les performances de la veille', defaultVal: true },
    { key: 'weekly_summary', label: 'Resume hebdomadaire', desc: 'Rapport chaque lundi matin', defaultVal: false },
    { key: 'monthly_report', label: 'Rapport mensuel', desc: 'Rapport detaille en fin de mois', defaultVal: true },
  ]},
  { section: 'Celebrations', items: [
    { key: 'milestone_alert', label: 'Jalons atteints', desc: 'Quand vous atteignez un nouveau palier (100h economisees, etc.)', defaultVal: true },
  ]},
]

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6) // 6h to 22h

const NotificationPreferences = ({ clientId, isLight }) => {
  const queryClient = useQueryClient()
  const [notifStatus, setNotifStatus] = useState(null)

  const { data: prefs, isLoading: prefsLoading } = useQuery({
    queryKey: ['notification-prefs', clientId],
    queryFn: async () => {
      if (!clientId) return null
      const { data, error } = await supabase
        .from('client_notification_preferences')
        .select('*')
        .eq('client_id', clientId)
        .maybeSingle()
      if (error && error.code !== 'PGRST116') {
        console.warn('Notification prefs fetch error:', error.message)
        return null
      }
      if (!data) {
        // Auto-create default preferences
        const { data: newPrefs, error: insertError } = await supabase
          .from('client_notification_preferences')
          .insert({ client_id: clientId })
          .select()
          .single()
        if (insertError) {
          console.warn('Could not create notification prefs:', insertError.message)
          return null
        }
        return newPrefs
      }
      return data
    },
    enabled: !!clientId,
  })

  const updatePrefMutation = useMutation({
    mutationFn: async ({ key, value }) => {
      if (!prefs?.id) return
      const { error } = await supabase
        .from('client_notification_preferences')
        .update({ [key]: value })
        .eq('id', prefs.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-prefs', clientId] })
      setNotifStatus('success')
      setTimeout(() => setNotifStatus(null), 2000)
    },
    onError: () => {
      setNotifStatus('error')
      setTimeout(() => setNotifStatus(null), 2000)
    },
  })

  if (!clientId) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className={`rounded-2xl border p-6 space-y-5 ${isLight ? 'bg-white border-gray-200' : 'bg-white border-gray-100 shadow-sm'}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLight ? 'bg-[#003725]/10 text-[#003725]' : 'bg-blue-500/10 text-blue-400'}`}>
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h3 className={`text-lg font-bold ${isLight ? 'text-[#262626]' : 'text-[#262626]'}`}>Notifications</h3>
            <p className={`text-xs ${isLight ? 'text-[#716D5C]' : 'text-[#716D5C]'}`}>Configurez les emails que vous recevez</p>
          </div>
        </div>
        {notifStatus === 'success' && (
          <span className="text-xs text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Enregistre
          </span>
        )}
      </div>

      {prefsLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-[#716D5C]" />
        </div>
      ) : (
        <div className="space-y-6">
          {NOTIFICATION_TOGGLES.map((group) => (
            <div key={group.section}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#716D5C] mb-3">{group.section}</p>
              <div className="space-y-3">
                {group.items.map((toggle) => {
                  const isOn = prefs ? (prefs[toggle.key] ?? toggle.defaultVal) : toggle.defaultVal
                  return (
                    <div key={toggle.key} className="flex items-center justify-between">
                      <div className="flex-1 mr-4">
                        <p className="text-sm font-medium text-[#262626]">{toggle.label}</p>
                        <p className="text-xs mt-0.5 text-[#716D5C]">{toggle.desc}</p>
                      </div>
                      <button
                        onClick={() => updatePrefMutation.mutate({ key: toggle.key, value: !isOn })}
                        disabled={updatePrefMutation.isPending}
                        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${isOn ? 'bg-[#0F5F35]' : 'bg-gray-200'}`}
                      >
                        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${isOn ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Preferred hour */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <div className="flex-1 mr-4">
              <p className={`text-sm font-medium ${isLight ? 'text-slate-700' : 'text-[#716D5C]'}`}>
                <ClockIcon className="w-3 h-3 inline mr-1" /> Heure d&apos;envoi preferee
              </p>
            </div>
            <select
              value={prefs?.preferred_hour ?? 8}
              onChange={(e) => updatePrefMutation.mutate({ key: 'preferred_hour', value: parseInt(e.target.value) })}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium outline-none ${
                isLight
                  ? 'bg-[#F9F7F1] border border-gray-200 text-slate-700'
                  : 'bg-gray-50 border border-gray-200 text-[#262626]'
              }`}
            >
              {HOURS.map(h => (
                <option key={h} value={h} className="bg-white">{h}h00</option>
              ))}
            </select>
          </div>
        </div>
      )}
    </motion.div>
  )
}

const StripePortalButton = ({ clientId, isLight }) => {
  const toast = useToast();
  const [loading, setLoading] = useState(false)

  const openPortal = async () => {
    if (!clientId) return
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/create-portal-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ client_id: clientId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur')
      window.open(data.url, '_blank')
    } catch (err) {
      toast.error('Impossible d\'accéder au portail : ' + err.message)
    }
    setLoading(false)
  }

  return (
    <button
      onClick={openPortal}
      disabled={loading || !clientId}
      className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-full text-sm font-bold bg-[#0F5F35] text-white hover:bg-[#003725] transition-all disabled:opacity-50"
    >
      {loading ? (
        <><Loader2 className="w-4 h-4 animate-spin" /> Chargement...</>
      ) : (
        <><ExternalLink className="w-4 h-4" /> Gérer mon abonnement</>
      )}
    </button>
  )
}

export const ClientProfileView = ({ theme = 'dark' }) => {
  const queryClient = useQueryClient()
  const isLight = theme === 'light'
  const [form, setForm] = useState({ brand_name: '', contact_email: '' })
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' })
  const [saveStatus, setSaveStatus] = useState(null)
  const [passwordStatus, setPasswordStatus] = useState(null)

  const { data: session } = useQuery({
    queryKey: ['profile-session'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      return session
    },
  })

  const { data: client } = useQuery({
    queryKey: ['profile-client'],
    queryFn: async () => {
      if (!session?.user?.id) return null
      const { data: link } = await supabase
        .from('client_users')
        .select('client_id')
        .eq('user_id', session.user.id)
        .maybeSingle()

      const clientId = link?.client_id
      if (!clientId) {
        const { data } = await supabase
          .from('clients')
          .select('*')
          .eq('owner_user_id', session.user.id)
          .single()
        return data
      }

      const { data } = await supabase.from('clients').select('*').eq('id', clientId).single()
      return data
    },
    enabled: !!session,
  })

  useEffect(() => {
    if (client) {
      setForm({
        brand_name: client.brand_name || '',
        contact_email: client.contact_email || '',
      })
    }
  }, [client])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('clients')
        .update({
          brand_name: form.brand_name,
          contact_email: form.contact_email,
        })
        .eq('id', client.id)
      if (error) throw error
    },
    onSuccess: () => {
      setSaveStatus('success')
      queryClient.invalidateQueries({ queryKey: ['profile-client'] })
      setTimeout(() => setSaveStatus(null), 3000)
    },
    onError: (err) => {
      setSaveStatus('error')
      console.error(err)
      setTimeout(() => setSaveStatus(null), 3000)
    },
  })

  const changePassword = async () => {
    if (passwordForm.new !== passwordForm.confirm) {
      setPasswordStatus('mismatch')
      setTimeout(() => setPasswordStatus(null), 3000)
      return
    }
    if (passwordForm.new.length < 6) {
      setPasswordStatus('too_short')
      setTimeout(() => setPasswordStatus(null), 3000)
      return
    }

    try {
      const { error } = await supabase.auth.updateUser({ password: passwordForm.new })
      if (error) throw error
      setPasswordStatus('success')
      setPasswordForm({ current: '', new: '', confirm: '' })
      setTimeout(() => setPasswordStatus(null), 3000)
    } catch (err) {
      setPasswordStatus('error')
      console.error(err)
      setTimeout(() => setPasswordStatus(null), 3000)
    }
  }

  const inputClass = `w-full px-4 py-3 rounded-xl text-sm font-medium outline-none transition-all ${
    isLight
      ? 'bg-[#F9F7F1] border border-gray-200 text-[#262626] focus:border-blue-400 focus:ring-2 focus:ring-blue-100'
      : 'bg-gray-50 border border-gray-200 text-[#262626] focus:border-gray-400 focus:ring-2 focus:ring-white/5'
  }`

  const labelClass = `block text-xs font-bold uppercase tracking-wider mb-2 ${isLight ? 'text-[#716D5C]' : 'text-[#716D5C]'}`

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in-up">
      <div>
        <h2 className={`text-2xl font-bold ${isLight ? 'text-[#262626]' : 'text-[#262626]'}`}>Mon profil</h2>
        <p className={`text-sm mt-1 ${isLight ? 'text-[#716D5C]' : 'text-[#716D5C]'}`}>Gérez les informations de votre compte</p>
      </div>

      {/* Account info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-2xl border p-6 space-y-5 ${isLight ? 'bg-white border-gray-200' : 'bg-white border-gray-100 shadow-sm'}`}
      >
        <div className="flex items-center gap-3 mb-2">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLight ? 'bg-[#003725]/10 text-[#003725]' : 'bg-gray-50 text-[#262626]'}`}>
            <User className="w-5 h-5" />
          </div>
          <h3 className={`text-lg font-bold ${isLight ? 'text-[#262626]' : 'text-[#262626]'}`}>Informations générales</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className={labelClass}>
              <Building2 className="w-3 h-3 inline mr-1" /> Nom de l'entreprise
            </label>
            <input
              type="text"
              value={form.brand_name}
              onChange={(e) => setForm(f => ({ ...f, brand_name: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>
              <Mail className="w-3 h-3 inline mr-1" /> Email de contact
            </label>
            <input
              type="email"
              value={form.contact_email}
              onChange={(e) => setForm(f => ({ ...f, contact_email: e.target.value }))}
              className={inputClass}
            />
          </div>
        </div>

        {/* Read-only info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className={labelClass}>
              <Mail className="w-3 h-3 inline mr-1" /> Email du compte
            </label>
            <div className={`px-4 py-3 rounded-xl text-sm ${isLight ? 'bg-gray-100 text-[#716D5C]' : 'bg-gray-50 text-[#716D5C]'}`}>
              {session?.user?.email || '—'}
            </div>
          </div>
          <div>
            <label className={labelClass}>
              {client?.client_type === 'immobilier'
                ? <><Building2 className="w-3 h-3 inline mr-1" /> Type</>
                : <><ShoppingBag className="w-3 h-3 inline mr-1" /> Type</>}
            </label>
            <div className={`px-4 py-3 rounded-xl text-sm capitalize ${isLight ? 'bg-gray-100 text-[#716D5C]' : 'bg-gray-50 text-[#716D5C]'}`}>
              {client?.client_type || 'ecommerce'}
            </div>
          </div>
        </div>

        <div>
          <label className={labelClass}>
            <Calendar className="w-3 h-3 inline mr-1" /> Membre depuis
          </label>
          <div className={`px-4 py-3 rounded-xl text-sm ${isLight ? 'bg-gray-100 text-[#716D5C]' : 'bg-gray-50 text-[#716D5C]'}`}>
            {client?.created_at ? new Date(client.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div>
            {saveStatus === 'success' && (
              <span className="text-xs text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Sauvegardé
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="text-xs text-red-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Erreur
              </span>
            )}
          </div>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
              isLight
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-white text-[#262626] hover:bg-gray-100'
            } disabled:opacity-50`}
          >
            <Save className="w-4 h-4" /> Enregistrer
          </button>
        </div>
      </motion.div>

      {/* Subscription management */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className={`rounded-2xl border p-6 space-y-5 ${isLight ? 'bg-white border-gray-200' : 'bg-white border-gray-100 shadow-sm'}`}
      >
        <div className="flex items-center gap-3 mb-2">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLight ? 'bg-emerald-50 text-emerald-600' : 'bg-emerald-500/10 text-emerald-400'}`}>
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h3 className={`text-lg font-bold ${isLight ? 'text-[#262626]' : 'text-[#262626]'}`}>Abonnement</h3>
            <p className={`text-xs ${isLight ? 'text-[#716D5C]' : 'text-[#716D5C]'}`}>Gérez votre abonnement, moyen de paiement et factures</p>
          </div>
        </div>

        <div className={`rounded-xl p-4 ${isLight ? 'bg-[#F9F7F1] border border-gray-200' : 'bg-gray-50 border border-gray-100'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium ${isLight ? 'text-slate-700' : 'text-[#716D5C]'}`}>Portail client Stripe</p>
              <p className={`text-xs mt-1 ${isLight ? 'text-[#716D5C]' : 'text-[#716D5C]'}`}>
                Consultez vos factures, mettez à jour votre carte bancaire ou modifiez votre abonnement.
              </p>
            </div>
          </div>
        </div>

        <StripePortalButton clientId={client?.id} isLight={isLight} />
      </motion.div>

      {/* Notification Preferences */}
      <NotificationPreferences clientId={client?.id} isLight={isLight} />

      {/* Password change */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className={`rounded-2xl border p-6 space-y-5 ${isLight ? 'bg-white border-gray-200' : 'bg-white border-gray-100 shadow-sm'}`}
      >
        <div className="flex items-center gap-3 mb-2">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLight ? 'bg-amber-50 text-amber-600' : 'bg-gray-50 text-[#262626]'}`}>
            <Shield className="w-5 h-5" />
          </div>
          <h3 className={`text-lg font-bold ${isLight ? 'text-[#262626]' : 'text-[#262626]'}`}>Sécurité</h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className={labelClass}>
              <Lock className="w-3 h-3 inline mr-1" /> Nouveau mot de passe
            </label>
            <input
              type="password"
              value={passwordForm.new}
              onChange={(e) => setPasswordForm(f => ({ ...f, new: e.target.value }))}
              placeholder="••••••••"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>
              <Lock className="w-3 h-3 inline mr-1" /> Confirmer le mot de passe
            </label>
            <input
              type="password"
              value={passwordForm.confirm}
              onChange={(e) => setPasswordForm(f => ({ ...f, confirm: e.target.value }))}
              placeholder="••••••••"
              className={inputClass}
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div>
            {passwordStatus === 'success' && (
              <span className="text-xs text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Mot de passe mis à jour
              </span>
            )}
            {passwordStatus === 'mismatch' && (
              <span className="text-xs text-red-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Les mots de passe ne correspondent pas
              </span>
            )}
            {passwordStatus === 'too_short' && (
              <span className="text-xs text-red-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Minimum 6 caractères
              </span>
            )}
            {passwordStatus === 'error' && (
              <span className="text-xs text-red-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Erreur
              </span>
            )}
          </div>
          <button
            onClick={changePassword}
            disabled={!passwordForm.new || !passwordForm.confirm}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
              isLight
                ? 'bg-[#F9F7F1] text-[#262626] hover:bg-gray-50'
                : 'bg-gray-50 text-[#262626] hover:bg-gray-100 border border-gray-200'
            } disabled:opacity-30`}
          >
            <Lock className="w-4 h-4" /> Changer le mot de passe
          </button>
        </div>
      </motion.div>
    </div>
  )
}
