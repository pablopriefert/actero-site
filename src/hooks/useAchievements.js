import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { ACHIEVEMENTS } from '../lib/achievements-catalog'

/**
 * useAchievements — compute, persist and return the user's unlocked badges.
 *
 * Returns: { unlockedBadges, allBadges, progress, newlyUnlocked, stats, loading, refetch }
 */
export function useAchievements(clientId) {
  const queryClient = useQueryClient()
  const [newlyUnlocked, setNewlyUnlocked] = useState([])

  // 1. Aggregate stats from multiple tables
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['achievement-stats', clientId],
    queryFn: async () => {
      if (!clientId) return null

      // Setup checklist-ish signals via client_settings + client_shopify_connections
      const [
        { data: settings },
        { data: shopifyConn },
        { data: integrations },
        { count: activePlaybooks },
      ] = await Promise.all([
        supabase
          .from('client_settings')
          .select('brand_tone, hourly_cost, tested_agent')
          .eq('client_id', clientId)
          .maybeSingle(),
        supabase
          .from('client_shopify_connections')
          .select('id')
          .eq('client_id', clientId)
          .maybeSingle(),
        supabase
          .from('client_integrations')
          .select('id, provider, status')
          .eq('client_id', clientId),
        supabase
          .from('engine_client_playbooks')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', clientId)
          .eq('is_active', true),
      ])

      // Resolved tickets + savings via automation_events
      const { data: resolvedRows } = await supabase
        .from('automation_events')
        .select('time_saved_seconds, revenue_amount')
        .eq('client_id', clientId)
        .eq('event_category', 'ticket_resolved')

      const resolvedTickets = (resolvedRows || []).length
      const totalTimeSavedSec = (resolvedRows || []).reduce(
        (s, e) => s + (Number(e.time_saved_seconds) || 0),
        0
      )
      const timeSavedHours = totalTimeSavedSec / 3600
      const hourlyCost = Number(settings?.hourly_cost) || 25
      const eurosReported = (resolvedRows || []).reduce(
        (s, e) => s + (Number(e.revenue_amount) || 0),
        0
      )
      const totalSavings = eurosReported > 0 ? eurosReported : timeSavedHours * hourlyCost

      // Setup steps computed cheaply — mirror the dashboard logic
      const smtp = (integrations || []).find(
        (i) => i.provider === 'smtp_imap' && i.status === 'active'
      )
      const completedSetupSteps = [
        !!shopifyConn,
        !!smtp,
        !!(settings?.brand_tone && settings.brand_tone.trim().length > 0),
        !!(settings?.hourly_cost && Number(settings.hourly_cost) > 0),
        (activePlaybooks || 0) > 0,
        settings?.tested_agent === true,
      ].filter(Boolean).length

      return {
        completedSetupSteps,
        activePlaybooks: activePlaybooks || 0,
        resolvedTickets,
        totalSavings,
        timeSavedHours,
        shopifyConnected: !!shopifyConn,
        testedAgent: settings?.tested_agent === true,
      }
    },
    enabled: !!clientId,
    staleTime: 60 * 1000,
  })

  // 2. Badges already unlocked in DB
  const {
    data: unlockedRows = [],
    isLoading: unlockedLoading,
    refetch,
  } = useQuery({
    queryKey: ['client-achievements', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_achievements')
        .select('achievement_key, unlocked_at, metadata')
        .eq('client_id', clientId)
        .order('unlocked_at', { ascending: false })
      if (error) throw error
      return data || []
    },
    enabled: !!clientId,
  })

  const unlockedKeys = useMemo(
    () => new Set(unlockedRows.map((r) => r.achievement_key)),
    [unlockedRows]
  )

  // 3. Detect new badges and insert them
  useEffect(() => {
    if (!clientId || !stats) return

    const candidates = ACHIEVEMENTS.filter((a) => {
      try {
        return a.check(stats) && !unlockedKeys.has(a.key)
      } catch {
        return false
      }
    })
    if (candidates.length === 0) return

    let cancelled = false
    ;(async () => {
      const payload = candidates.map((a) => ({
        client_id: clientId,
        achievement_key: a.key,
        metadata: { tier: a.tier },
      }))
      const { error } = await supabase
        .from('client_achievements')
        .insert(payload)
      if (cancelled) return
      if (!error) {
        setNewlyUnlocked(candidates)
        queryClient.invalidateQueries({ queryKey: ['client-achievements', clientId] })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [clientId, stats, unlockedKeys, queryClient])

  // 4. Build merged list
  const unlockedBadges = useMemo(() => {
    const map = new Map(unlockedRows.map((r) => [r.achievement_key, r]))
    return ACHIEVEMENTS.filter((a) => map.has(a.key)).map((a) => ({
      ...a,
      unlocked: true,
      unlocked_at: map.get(a.key)?.unlocked_at,
    }))
  }, [unlockedRows])

  const allBadges = useMemo(() => {
    const map = new Map(unlockedRows.map((r) => [r.achievement_key, r]))
    return ACHIEVEMENTS.map((a) => ({
      ...a,
      unlocked: map.has(a.key),
      unlocked_at: map.get(a.key)?.unlocked_at || null,
    }))
  }, [unlockedRows])

  const progress = useMemo(() => {
    const total = ACHIEVEMENTS.length
    const unlocked = unlockedBadges.length
    return {
      unlocked,
      total,
      pct: total > 0 ? Math.round((unlocked / total) * 100) : 0,
    }
  }, [unlockedBadges])

  return {
    unlockedBadges,
    allBadges,
    progress,
    newlyUnlocked,
    stats,
    loading: statsLoading || unlockedLoading,
    refetch,
    dismissNewlyUnlocked: () => setNewlyUnlocked([]),
  }
}
