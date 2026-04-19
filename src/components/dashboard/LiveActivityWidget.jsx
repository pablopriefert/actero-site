import React, { useState } from 'react'
import { Inbox } from 'lucide-react'
import { useLiveActivityFeed, formatEvent, formatRelativeTime } from './ActivityView'

/**
 * FeedbackButtons — 👍/👎 inline per-event feedback.
 * Extracted from ClientDashboard so the widget can be reused in the
 * refondu Overview (src/components/client/overview/OverviewHome.jsx).
 */
export const FeedbackButtons = ({ eventId, currentFeedback, supabase }) => {
  const [feedback, setFeedback] = useState(currentFeedback || null)
  const [saving, setSaving] = useState(false)

  const handleFeedback = async (value) => {
    if (saving) return
    const prev = feedback
    const newValue = feedback === value ? null : value
    setSaving(true)
    setFeedback(newValue) // optimistic
    try {
      const { error } = await supabase
        .from('automation_events')
        .update({ feedback: newValue, feedback_at: newValue ? new Date().toISOString() : null })
        .eq('id', eventId)
      if (error) throw error
    } catch (err) {
      console.error('[FeedbackButtons] feedback update failed:', err)
      setFeedback(prev)
    }
    setSaving(false)
  }

  return (
    <div className="flex items-center gap-0.5 flex-shrink-0">
      <button
        onClick={(e) => { e.stopPropagation(); handleFeedback('positive') }}
        className={`p-1 rounded transition-colors ${feedback === 'positive' ? 'text-[#003725] bg-emerald-50' : 'text-gray-300 hover:text-[#003725] hover:bg-emerald-50'}`}
        title="Bonne réponse"
      >
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" /></svg>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); handleFeedback('negative') }}
        className={`p-1 rounded transition-colors ${feedback === 'negative' ? 'text-red-500 bg-red-50' : 'text-gray-300 hover:text-red-500 hover:bg-red-50'}`}
        title="Mauvaise réponse"
      >
        <svg className="w-3.5 h-3.5 rotate-180" fill="currentColor" viewBox="0 0 20 20"><path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" /></svg>
      </button>
    </div>
  )
}

/**
 * LiveActivityWidget — feed temps réel des automation_events, affiché
 * dans l'Overview refondu (Signals zone, 2/3 width) et ailleurs.
 *
 * Connection pulse + link to activity tab. Rendered in a compact card
 * (bg-white, border, rounded-2xl) — le parent décide du wrapping.
 */
export const LiveActivityWidget = ({ supabase, setActiveTab, compact = false }) => {
  const { events, isConnected } = useLiveActivityFeed(supabase)
  const recent = events.slice(0, compact ? 5 : 6)

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-cta animate-pulse' : 'bg-red-500'}`} />
            <h3 className="font-bold text-[#1a1a1a] text-sm">Activité récente</h3>
          </div>
          <span className="text-[10px] font-bold text-[#71717a] uppercase tracking-widest px-2 py-0.5 bg-[#F9F7F1] rounded-full">
            LIVE
          </span>
        </div>
        <button
          onClick={() => setActiveTab?.('activity')}
          className="text-xs font-bold text-[#003725] hover:underline"
        >
          Tout voir →
        </button>
      </div>
      <div className="divide-y divide-gray-100">
        {recent.length === 0 ? (
          <div className="px-5 py-10 flex flex-col items-center justify-center text-center">
            <div className="w-10 h-10 rounded-xl bg-[#fafafa] flex items-center justify-center mb-3">
              <Inbox className="w-5 h-5 text-[#9ca3af]" />
            </div>
            <p className="text-[13px] font-medium text-[#1a1a1a]">Aucune activité aujourd'hui</p>
            <p className="text-[11px] text-[#9ca3af] mt-0.5">C'est calme — votre agent veille en arrière-plan.</p>
          </div>
        ) : (
          recent.map((event, i) => {
            const formatted = formatEvent(event)
            const Icon = formatted.IconComponent
            return (
              <div key={event.id || i} className="flex items-center gap-3 px-5 py-3 hover:bg-[#fafafa] transition-colors">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${formatted.bg}`}>
                  <Icon className={`w-3.5 h-3.5 ${formatted.color}`} />
                </div>
                <p className="text-[13px] text-[#1a1a1a] flex-1 truncate">{formatted.message}</p>
                <FeedbackButtons eventId={event.id} currentFeedback={event.feedback} supabase={supabase} />
                <span className="text-[10px] text-[#999] flex-shrink-0 whitespace-nowrap">
                  {formatRelativeTime(event.created_at)}
                </span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
