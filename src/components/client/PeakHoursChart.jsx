import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Clock } from 'lucide-react'
import { supabase } from '../../lib/supabase'

/**
 * PeakHoursChart — volume horaire des messages sur les 30 derniers jours.
 * Agrege `ai_conversations` + `automation_events` par heure locale (0-23)
 * et highlight la tranche de pic en vert.
 */
export const PeakHoursChart = ({ clientId }) => {
  const { data: conversations = [] } = useQuery({
    queryKey: ['peak-hours-convs', clientId],
    queryFn: async () => {
      const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const { data, error } = await supabase
        .from('ai_conversations')
        .select('created_at')
        .eq('client_id', clientId)
        .gte('created_at', start)
      if (error) return []
      return data || []
    },
    enabled: !!clientId,
  })

  const { data: events = [] } = useQuery({
    queryKey: ['peak-hours-events', clientId],
    queryFn: async () => {
      const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const { data, error } = await supabase
        .from('automation_events')
        .select('created_at')
        .eq('client_id', clientId)
        .gte('created_at', start)
      if (error) return []
      return data || []
    },
    enabled: !!clientId,
  })

  const { hourly, peakStart, peakEnd, peakHour, total } = useMemo(() => {
    const buckets = Array.from({ length: 24 }, (_, h) => ({ hour: h, label: `${h}h`, count: 0 }))
    const all = [...(conversations || []), ...(events || [])]
    all.forEach(row => {
      if (!row.created_at) return
      const d = new Date(row.created_at)
      const h = d.getHours()
      if (h >= 0 && h < 24) buckets[h].count += 1
    })

    // Sliding window de 3h (fenetre = meilleur moment)
    let bestStart = 0
    let bestSum = 0
    for (let h = 0; h < 24; h++) {
      const sum = buckets[h].count + buckets[(h + 1) % 24].count + buckets[(h + 2) % 24].count
      if (sum > bestSum) {
        bestSum = sum
        bestStart = h
      }
    }

    // Pic unique
    const maxHour = buckets.reduce((a, b) => (b.count > a.count ? b : a), buckets[0])

    return {
      hourly: buckets,
      peakStart: bestStart,
      peakEnd: (bestStart + 3) % 24,
      peakHour: maxHour.hour,
      total: buckets.reduce((s, b) => s + b.count, 0),
    }
  }, [conversations, events])

  const peakSet = new Set([peakStart, (peakStart + 1) % 24, (peakStart + 2) % 24])

  const formatHourRange = (start, end) => `${start}h et ${end}h`

  if (total === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-[#f0f0f0] p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-cta" />
          <h3 className="text-[14px] font-semibold text-[#1a1a1a]">Heures de pic (30 jours)</h3>
        </div>
        <p className="text-[13px] text-[#9ca3af]">
          Pas assez de donnees pour determiner vos heures de pic. Le graphique apparaitra apres quelques messages.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-[#f0f0f0] p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-cta" />
          <h3 className="text-[14px] font-semibold text-[#1a1a1a]">Heures de pic</h3>
        </div>
        <span className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider bg-[#f5f5f5] px-2 py-0.5 rounded">
          30 jours
        </span>
      </div>

      <div className="h-[180px] -ml-2">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={150}>
          <BarChart data={hourly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <XAxis
              dataKey="label"
              interval={2}
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={24} />
            <Tooltip
              cursor={{ fill: '#f9fafb' }}
              contentStyle={{
                background: '#fff',
                border: '1px solid #f0f0f0',
                borderRadius: 10,
                fontSize: 12,
                boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
              }}
              formatter={(value) => [`${value} message${value > 1 ? 's' : ''}`, 'Volume']}
              labelFormatter={(label) => `Heure ${label}`}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {hourly.map((entry) => (
                <Cell
                  key={entry.hour}
                  fill={peakSet.has(entry.hour) ? '#0E653A' : '#e5e7eb'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="text-[13px] text-[#1a1a1a] mt-4 leading-relaxed">
        Vos clients sont les plus actifs entre{' '}
        <span className="font-bold text-cta">
          {formatHourRange(peakStart, (peakStart + 3) % 24)}
        </span>
        . C'est le meilleur moment pour rester disponible aux escalades.
      </p>
    </div>
  )
}

export default PeakHoursChart
