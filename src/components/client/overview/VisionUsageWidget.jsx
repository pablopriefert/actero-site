import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'

export default function VisionUsageWidget({ clientId, planLimit }) {
  const period = new Date().toISOString().slice(0, 7)
  const start = `${period}-01T00:00:00Z`
  const { data } = useQuery({
    queryKey: ['vision-usage', clientId, period],
    queryFn: async () => {
      const { count } = await supabase
        .from('vision_analyses')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientId)
        .gte('created_at', start)
      return count || 0
    },
    enabled: !!clientId,
    staleTime: 60_000,
  })
  const used = data ?? 0
  const limit = planLimit ?? 0
  const isUnlimited = limit === Infinity
  const pct = !isUnlimited && limit > 0 ? Math.min(100, (used / limit) * 100) : 0

  return (
    <div className="rounded-2xl border border-[#E5E2D7] p-5 bg-white transition-all duration-200 hover:shadow-elev-3">
      <h3 className="text-sm font-semibold text-[#262626]">Analyses vision — ce mois</h3>
      <p className="text-3xl font-bold mt-1">
        {used} <span className="text-sm text-[#999]">/ {isUnlimited ? '∞' : limit}</span>
      </p>
      <div className="h-1.5 bg-gray-100 rounded-full mt-3 overflow-hidden">
        <div className="h-full bg-[#14A85C] transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
