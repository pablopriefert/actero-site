import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { getPlanConfig, canAccess, getLimit, isInTrial, getTrialDaysLeft } from '../lib/plans'

export function usePlan(clientId) {
  // Fetch client plan + trial info
  const { data: client } = useQuery({
    queryKey: ['client-plan', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('clients')
        .select('plan, trial_ends_at, plan_updated_at')
        .eq('id', clientId)
        .maybeSingle()
      return data || { plan: 'free' }
    },
    enabled: !!clientId,
    staleTime: 60_000, // 1 min cache
  })

  // Fetch current month usage
  const period = new Date().toISOString().slice(0, 7)
  const { data: usage } = useQuery({
    queryKey: ['client-usage', clientId, period],
    queryFn: async () => {
      const { data } = await supabase
        .from('usage_counters')
        .select('tickets_used, voice_minutes_used, overage_tickets')
        .eq('client_id', clientId)
        .eq('period', period)
        .maybeSingle()
      return data || { tickets_used: 0, voice_minutes_used: 0, overage_tickets: 0 }
    },
    enabled: !!clientId,
    refetchInterval: 30_000, // refresh every 30s
  })

  const planId = client?.plan || 'free'
  const config = getPlanConfig(planId)
  const inTrial = isInTrial(client)
  const trialDaysLeft = getTrialDaysLeft(client)
  const ticketsUsed = usage?.tickets_used || 0
  const ticketsLimit = config.limits.tickets_per_month
  const ticketsPercent = ticketsLimit === Infinity ? 0 : Math.round((ticketsUsed / ticketsLimit) * 100)
  const isOverLimit = ticketsLimit !== Infinity && ticketsUsed >= ticketsLimit

  return {
    planId,
    planName: config.name,
    config,
    inTrial,
    trialDaysLeft,
    // Usage
    ticketsUsed,
    ticketsLimit,
    ticketsPercent,
    isOverLimit,
    voiceMinutesUsed: usage?.voice_minutes_used || 0,
    voiceMinutesLimit: config.limits.voice_minutes,
    // Feature access
    canAccess: (feature) => canAccess(planId, feature) || inTrial,
    getLimit: (key) => getLimit(planId, key),
    // Helpers
    isFreePlan: planId === 'free',
    isPaidPlan: planId !== 'free',
    // Raw
    client,
    usage,
  }
}
