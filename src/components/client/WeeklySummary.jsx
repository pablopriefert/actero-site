import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Sparkles } from 'lucide-react'
import { supabase } from '../../lib/supabase'

/**
 * WeeklySummary — affiche une phrase resumee de la semaine en cours
 * (lundi -> dimanche). Lit metrics_daily + automation_events.
 */
export const WeeklySummary = ({ clientId, setActiveTab }) => {
  // Calcule bornes lundi -> dimanche
  const { startISO, endISO } = useMemo(() => {
    const now = new Date()
    const day = now.getDay() // 0=dim, 1=lun...
    const diffToMonday = day === 0 ? -6 : 1 - day
    const monday = new Date(now)
    monday.setDate(now.getDate() + diffToMonday)
    monday.setHours(0, 0, 0, 0)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    sunday.setHours(23, 59, 59, 999)
    return { startISO: monday.toISOString(), endISO: sunday.toISOString() }
  }, [])

  const startDate = startISO.split('T')[0]
  const endDate = endISO.split('T')[0]

  // Single source of truth: client_settings + automation_events (same as ROI page)
  const { data: weeklyData } = useQuery({
    queryKey: ['weekly-summary', clientId, startISO, endISO],
    queryFn: async () => {
      const [{ data: settings }, { data: events }, { count: pendingCount }] = await Promise.all([
        supabase
          .from('client_settings')
          .select('hourly_cost')
          .eq('client_id', clientId)
          .maybeSingle(),
        supabase
          .from('automation_events')
          .select('event_category, time_saved_seconds')
          .eq('client_id', clientId)
          .eq('event_category', 'ticket_resolved')
          .gte('created_at', startISO)
          .lte('created_at', endISO),
        supabase
          .from('ai_conversations')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', clientId)
          .eq('status', 'escalated')
          .is('human_response', null),
      ])
      return {
        hourlyCost: parseFloat(settings?.hourly_cost) || 25,
        events: events || [],
        pending: pendingCount || 0,
      }
    },
    enabled: !!clientId,
  })

  const stats = useMemo(() => {
    if (!weeklyData) {
      return { ticketsResolved: 0, hoursSaved: 0, valueSaved: 0, pending: 0, hasActivity: false }
    }
    const ticketsResolved = weeklyData.events.length
    const totalSec = weeklyData.events.reduce((s, e) => s + (Number(e.time_saved_seconds) || 0), 0)
    const hoursSaved = totalSec / 3600
    const valueSaved = hoursSaved * weeklyData.hourlyCost
    return {
      ticketsResolved,
      hoursSaved: Math.round(hoursSaved * 10) / 10,
      valueSaved: Math.round(valueSaved),
      pending: weeklyData.pending,
      hasActivity: ticketsResolved > 0 || weeklyData.pending > 0,
    }
  }, [weeklyData])

  // Formatte les heures : 2h ou 2h30
  const formatHours = (h) => {
    if (!h) return '0h'
    const whole = Math.floor(h)
    const min = Math.round((h - whole) * 60)
    if (min === 0) return `${whole}h`
    return `${whole}h${String(min).padStart(2, '0')}`
  }

  return (
    <div
      className="rounded-2xl border border-cta/15 p-4 md:p-5 mb-6 flex items-start gap-3"
      style={{
        background: 'linear-gradient(135deg, rgba(15,95,53,0.05) 0%, rgba(15,95,53,0.02) 100%)',
      }}
    >
      <div className="w-9 h-9 rounded-xl bg-cta/10 flex items-center justify-center flex-shrink-0">
        <Sparkles className="w-[18px] h-[18px] text-cta" strokeWidth={2.2} />
      </div>
      <div className="flex-1 min-w-0 pt-1">
        {!stats.hasActivity ? (
          <p className="text-[14px] text-[#1a1a1a] leading-relaxed">
            Votre agent est prêt — aucun message reçu cette semaine.
          </p>
        ) : (
          <p className="text-[14px] text-[#1a1a1a] leading-relaxed">
            Cette semaine, votre agent a résolu{' '}
            <span className="font-bold text-cta">{stats.ticketsResolved} ticket{stats.ticketsResolved > 1 ? 's' : ''}</span>
            , économisé{' '}
            <span className="font-bold text-cta">
              {formatHours(stats.hoursSaved)} dont {stats.valueSaved.toLocaleString('fr-FR')}€
            </span>
            {stats.pending > 0 ? (
              <>
                , et{' '}
                <button
                  type="button"
                  onClick={() => setActiveTab && setActiveTab('escalations')}
                  className="font-bold text-[#c2410c] hover:underline cursor-pointer"
                >
                  {stats.pending} cas
                </button>{' '}
                vous attendent dans 'À traiter'.
              </>
            ) : (
              <>.</>
            )}
          </p>
        )}
      </div>
    </div>
  )
}

export default WeeklySummary
