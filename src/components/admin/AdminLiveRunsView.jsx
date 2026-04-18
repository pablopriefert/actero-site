import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Activity, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../ui/PageHeader'
import { ListItem } from '../ui/ListItem'
import { StatusPill } from '../ui/StatusPill'
import { EmptyState } from '../ui/EmptyState'

const MAX_RUNS = 100

const FILTERS = [
  { id: 'all', label: 'Tous' },
  { id: 'completed', label: 'Success' },
  { id: 'needs_review', label: 'Needs Review' },
  { id: 'error', label: 'Errors' },
]

function iconForStatus(status) {
  if (status === 'completed')
    return <CheckCircle2 className="w-4 h-4 text-[#10b981]" />
  if (status === 'needs_review')
    return <AlertTriangle className="w-4 h-4 text-[#f59e0b]" />
  if (status === 'error')
    return <XCircle className="w-4 h-4 text-[#ef4444]" />
  return <Activity className="w-4 h-4 text-[#9ca3af]" />
}

function relativeTime(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 5) return "a l'instant"
  if (s < 60) return `il y a ${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `il y a ${m}min`
  const h = Math.floor(m / 60)
  if (h < 24) return `il y a ${h}h`
  const d = Math.floor(h / 24)
  return `il y a ${d}j`
}

export const AdminLiveRunsView = () => {
  const [runs, setRuns] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(false)
  const listRef = useRef(null)

  // Initial fetch
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('engine_runs_v2')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
      if (!cancelled) {
        if (!error && data) setRuns(data)
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('admin-live-runs')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'engine_runs_v2' },
        (payload) => {
          const newRun = payload.new
          if (!newRun) return
          setRuns((prev) => {
            const next = [newRun, ...prev.filter((r) => r.id !== newRun.id)]
            return next.slice(0, MAX_RUNS)
          })
          // Auto scroll to top
          if (listRef.current) {
            listRef.current.scrollTo({ top: 0, behavior: 'smooth' })
          }
        }
      )
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED')
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const filtered = useMemo(() => {
    if (filter === 'all') return runs
    if (filter === 'error') return runs.filter((r) => r.error != null)
    return runs.filter((r) => r.status === filter)
  }, [runs, filter])

  const liveBadge = (
    <StatusPill variant={connected ? 'success' : 'neutral'} dot size="sm">
      LIVE
    </StatusPill>
  )

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Live Run Stream"
        subtitle="Flux temps reel des runs Brain"
        badge={liveBadge}
      />

      {/* Filters */}
      <div className="px-6 py-3 bg-white border-b border-[#f0f0f0] flex items-center gap-2">
        {FILTERS.map((f) => {
          const active = filter === f.id
          const count =
            f.id === 'all' ? runs.length : f.id === 'error' ? runs.filter((r) => r.error != null).length : runs.filter((r) => r.status === f.id).length
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors ${
                active
                  ? 'bg-cta text-white'
                  : 'bg-[#fafafa] text-[#71717a] hover:bg-[#f0f0f0] border border-[#f0f0f0]'
              }`}
            >
              {f.label}
              <span
                className={`ml-1.5 tabular-nums ${
                  active ? 'opacity-80' : 'text-[#9ca3af]'
                }`}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Stream */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto bg-white"
      >
        {loading ? (
          <div className="p-6 space-y-2">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="h-14 rounded-xl bg-[#fafafa] animate-pulse"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="Aucun run pour l'instant"
            description="Les runs apparaitront ici des qu'ils seront executes."
          />
        ) : (
          <AnimatePresence initial={false}>
            {filtered.map((run) => {
              const confidence = typeof run.confidence === 'number'
                ? `${(run.confidence * 100).toFixed(0)}%`
                : '—'
              const latency = run.duration_ms
              const costPill = typeof run.cost_usd === 'number' && run.cost_usd > 0 ? (
                <StatusPill variant="neutral" size="sm">
                  {`$${Number(run.cost_usd).toFixed(4)}`}
                </StatusPill>
              ) : null
              return (
                <motion.div
                  key={run.id}
                  layout
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <ListItem
                    icon={iconForStatus(run.status)}
                    title={`${run.classification || 'run'} -> ${
                      run.agent_used || 'general'
                    }`}
                    subtitle={`${latency ? `${latency}ms` : '—'} - confidence ${confidence}`}
                    meta={
                      <div className="flex items-center gap-2 justify-end">
                        <span className="text-[#9ca3af]">{relativeTime(run.created_at)}</span>
                        {costPill}
                      </div>
                    }
                  />
                </motion.div>
              )
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}

export default AdminLiveRunsView
