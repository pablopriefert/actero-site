import React, { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  DollarSign, Clock, Loader2, CheckCircle2, TrendingUp,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../ui/Toast'
import { HelpTooltip } from '../ui/HelpTooltip'

export const ROISettingsView = ({ clientId, theme }) => {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    hourly_cost: '',
    avg_ticket_time_min: '',
    actero_monthly_price: '',
  })

  const { data: settings, isLoading } = useQuery({
    queryKey: ['roi-settings', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('client_settings')
        .select('hourly_cost, avg_ticket_time_min, actero_monthly_price')
        .eq('client_id', clientId)
        .maybeSingle()
      return data
    },
    enabled: !!clientId,
  })

  // Fetch current month metrics for live ROI calc
  const { data: monthMetrics } = useQuery({
    queryKey: ['roi-month-metrics', clientId],
    queryFn: async () => {
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)
      const { data } = await supabase
        .from('automation_events')
        .select('time_saved_seconds')
        .eq('client_id', clientId)
        .eq('event_category', 'ticket_resolved')
        .gte('created_at', startOfMonth.toISOString())
      return data || []
    },
    enabled: !!clientId,
  })

  useEffect(() => {
    if (settings) {
      setForm({
        hourly_cost: settings.hourly_cost || '',
        avg_ticket_time_min: settings.avg_ticket_time_min || '',
        actero_monthly_price: settings.actero_monthly_price || '',
      })
    }
  }, [settings])

  const handleSave = async () => {
    setSaving(true)
    try {
      await supabase.from('client_settings').upsert({
        client_id: clientId,
        hourly_cost: parseFloat(form.hourly_cost) || 0,
        avg_ticket_time_min: parseFloat(form.avg_ticket_time_min) || 0,
        actero_monthly_price: parseFloat(form.actero_monthly_price) || 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'client_id' })
      queryClient.invalidateQueries({ queryKey: ['roi-settings', clientId] })
      toast.success('Paramètres ROI sauvegardés')
    } catch (err) {
      toast.error('Erreur: ' + err.message)
    }
    setSaving(false)
  }

  // Compute live ROI
  const totalTimeSavedSec = (monthMetrics || []).reduce((s, e) => s + (e.time_saved_seconds || 0), 0)
  const totalTimeSavedHours = totalTimeSavedSec / 3600
  const ticketsResolved = (monthMetrics || []).length
  const hourlyCost = parseFloat(form.hourly_cost) || 25
  const rawMonthlyPrice = parseFloat(form.actero_monthly_price)
  const hasMonthlyPrice = Number.isFinite(rawMonthlyPrice) && rawMonthlyPrice > 0
  const monthlyPrice = hasMonthlyPrice ? rawMonthlyPrice : 0
  const valueSaved = totalTimeSavedHours * hourlyCost
  const roi = hasMonthlyPrice ? valueSaved - monthlyPrice : null

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-[#9ca3af]" /></div>

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2
          className="text-2xl italic tracking-tight text-[#1a1a1a]"
          style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontWeight: 400 }}
        >
          Calcul du ROI
        </h2>
        <p className="text-[15px] text-[#5A5A5A] mt-1">Ces informations permettent de calculer le retour sur investissement de ton agent IA en temps réel.</p>
      </div>

      {/* Live ROI card */}
      <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-[#f0f0f0] p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-cta" />
          <h3 className="text-[15px] font-semibold text-[#1a1a1a]">ROI ce mois</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-[28px] font-bold text-[#1a1a1a] tabular-nums">{ticketsResolved}</p>
            <p className="text-[11px] text-[#9ca3af]">Résolutions</p>
          </div>
          <div>
            <p className="text-[28px] font-bold text-[#1a1a1a] tabular-nums">{totalTimeSavedHours.toFixed(1)}h</p>
            <p className="text-[11px] text-[#9ca3af]">Temps économisé</p>
          </div>
          <div>
            <p className="text-[28px] font-bold text-[#1a1a1a] tabular-nums">{valueSaved.toFixed(0)}€</p>
            <p className="text-[11px] text-[#9ca3af]">Valeur économisée</p>
          </div>
          <div>
            {roi === null ? (
              <>
                <p className="text-[28px] font-bold tabular-nums text-[#c4c4c4]">—</p>
                <p className="text-[11px] text-[#9ca3af]">Configurez votre prix Actero</p>
              </>
            ) : (
              <>
                <p className={`text-[28px] font-bold tabular-nums ${roi >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{roi >= 0 ? '+' : ''}{roi.toFixed(0)}€</p>
                <p className="text-[11px] text-[#9ca3af]">ROI net</p>
              </>
            )}
          </div>
        </div>
        <p className="text-[10px] text-[#c4c4c4] mt-3">ROI = (Temps économisé × Coût horaire) - Abonnement Actero</p>
      </div>

      {/* Settings form */}
      <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-[#f0f0f0] p-6 space-y-5">
        <h3 className="text-[15px] font-semibold text-[#1a1a1a]">Vos paramètres</h3>

        <div>
          <label className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider inline-flex items-center gap-1.5">Cout horaire de votre equipe support <HelpTooltip text="Coût horaire chargé d'un agent support (salaire brut + charges). Sert à valoriser le temps économisé par l'agent IA." /></label>
          <p className="text-[11px] text-[#c4c4c4] mb-1.5">Combien coute 1 heure de travail d'un agent support dans votre entreprise ?</p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={form.hourly_cost}
              onChange={(e) => setForm(f => ({ ...f, hourly_cost: e.target.value }))}
              placeholder="25"
              className="w-32 px-4 py-2.5 bg-[#fafafa] border border-[#ebebeb] rounded-lg text-[14px] text-[#1a1a1a] outline-none focus:ring-1 focus:ring-cta/30"
            />
            <span className="text-[13px] text-[#9ca3af]">€ / heure</span>
          </div>
        </div>

        <div>
          <label className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider inline-flex items-center gap-1.5">Temps moyen par ticket <HelpTooltip text="Durée moyenne de traitement d'un ticket par votre équipe avant l'automatisation. Utilisée pour estimer le temps économisé." /></label>
          <p className="text-[11px] text-[#c4c4c4] mb-1.5">Combien de temps prend le traitement d'un ticket en moyenne ?</p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={form.avg_ticket_time_min}
              onChange={(e) => setForm(f => ({ ...f, avg_ticket_time_min: e.target.value }))}
              placeholder="5"
              className="w-32 px-4 py-2.5 bg-[#fafafa] border border-[#ebebeb] rounded-lg text-[14px] text-[#1a1a1a] outline-none focus:ring-1 focus:ring-cta/30"
            />
            <span className="text-[13px] text-[#9ca3af]">minutes</span>
          </div>
        </div>

        <div>
          <label className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider inline-flex items-center gap-1.5">Votre abonnement Actero <HelpTooltip text="Le montant mensuel HT de votre abonnement Actero. Déduit du temps valorisé pour obtenir le ROI net." /></label>
          <p className="text-[11px] text-[#c4c4c4] mb-1.5">Le montant mensuel de votre abonnement Actero.</p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={form.actero_monthly_price}
              onChange={(e) => setForm(f => ({ ...f, actero_monthly_price: e.target.value }))}
              placeholder="0"
              className="w-32 px-4 py-2.5 bg-[#fafafa] border border-[#ebebeb] rounded-lg text-[14px] text-[#1a1a1a] outline-none focus:ring-1 focus:ring-cta/30"
            />
            <span className="text-[13px] text-[#9ca3af]">€ / mois</span>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-cta text-white text-[13px] font-semibold rounded-lg hover:bg-[#003725] disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          Sauvegarder
        </button>
      </div>
    </div>
  )
}
