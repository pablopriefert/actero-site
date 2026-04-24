import React, { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Phone, Clock, CheckCircle2, AlertTriangle, X, Loader2,
  PlayCircle, PauseCircle, Smile, Frown, Meh, Volume2,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

const formatDuration = (seconds) => {
  if (!seconds || seconds < 0) return '0s'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m === 0) return `${s}s`
  return `${m}m ${s.toString().padStart(2, '0')}s`
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now - d
  const minutes = Math.floor(diffMs / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (minutes < 1) return 'a l\'instant'
  if (minutes < 60) return `il y a ${minutes} min`
  if (hours < 24) return `il y a ${hours}h`
  if (days < 7) return `il y a ${days}j`
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

const sentimentMeta = (sentiment) => {
  if (!sentiment) return { label: 'Neutre', color: 'text-[#9ca3af] bg-[#f5f5f5]', Icon: Meh }
  const s = String(sentiment).toLowerCase()
  if (s.includes('positive') || s.includes('good') || s === '5' || s === '4') {
    return { label: 'Positif', color: 'text-emerald-700 bg-emerald-50', Icon: Smile }
  }
  if (s.includes('negative') || s.includes('bad') || s === '1' || s === '2') {
    return { label: 'Negatif', color: 'text-red-600 bg-red-50', Icon: Frown }
  }
  return { label: 'Neutre', color: 'text-[#9ca3af] bg-[#f5f5f5]', Icon: Meh }
}

const statusMeta = (status) => {
  const s = String(status || '').toLowerCase()
  if (s === 'escalated') return { label: 'Escalade', color: 'text-amber-700 bg-amber-50 border-amber-200' }
  if (s === 'failed' || s === 'error') return { label: 'Echec', color: 'text-red-600 bg-red-50 border-red-200' }
  if (s === 'completed' || s === 'resolved') return { label: 'Resolu', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' }
  return { label: status || 'Inconnu', color: 'text-[#9ca3af] bg-[#f5f5f5] border-[#ebebeb]' }
}

export const VoiceCallsView = ({ clientId }) => {
  const [selectedCall, setSelectedCall] = useState(null)

  const { data: calls = [], isLoading } = useQuery({
    queryKey: ['voice-calls', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('voice_calls')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) {
        console.error('[VoiceCallsView]', error)
        return []
      }
      return data || []
    },
    enabled: !!clientId,
  })

  const stats = useMemo(() => {
    const now = new Date()
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthCalls = calls.filter(c => new Date(c.created_at) >= startMonth)
    const totalDuration = monthCalls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0)
    const avgDuration = monthCalls.length > 0 ? Math.round(totalDuration / monthCalls.length) : 0
    const escalated = monthCalls.filter(c => String(c.status).toLowerCase() === 'escalated').length
    const resolved = monthCalls.length - escalated
    const resolutionRate = monthCalls.length > 0 ? Math.round((resolved / monthCalls.length) * 100) : 0
    return {
      total: monthCalls.length,
      avgDuration,
      resolutionRate,
      escalated,
    }
  }, [calls])

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-[#9ca3af]" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h2
          className="text-2xl italic tracking-tight text-[#1a1a1a]"
          style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontWeight: 400 }}
        >
          Appels vocaux
        </h2>
        <p className="text-[15px] text-[#5A5A5A] mt-1">
          Suivi en temps réel des appels gérés par ton agent vocal IA.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={Phone}
          label="Appels ce mois"
          value={stats.total}
          iconColor="text-violet-600"
          iconBg="bg-violet-50"
        />
        <StatCard
          icon={Clock}
          label="Duree moyenne"
          value={formatDuration(stats.avgDuration)}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
        />
        <StatCard
          icon={CheckCircle2}
          label="Taux de resolution"
          value={`${stats.resolutionRate}%`}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
        />
        <StatCard
          icon={AlertTriangle}
          label="Appels escalades"
          value={stats.escalated}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
        />
      </div>

      {/* Calls list */}
      <div className="bg-white rounded-xl border border-[#f0f0f0] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#f0f0f0] flex items-center justify-between">
          <h3 className="text-[14px] font-semibold text-[#1a1a1a]">Historique des appels</h3>
          <span className="text-[11px] text-[#9ca3af]">{calls.length} appel{calls.length > 1 ? 's' : ''}</span>
        </div>

        {calls.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-[#fafafa] flex items-center justify-center mx-auto mb-3">
              <Phone className="w-5 h-5 text-[#9ca3af]" />
            </div>
            <p className="text-[13px] text-[#1a1a1a] font-medium">Aucun appel pour le moment</p>
            <p className="text-[11px] text-[#9ca3af] mt-1">Les appels de vos clients apparaitront ici des que votre agent sera actif.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#f5f5f5]">
            {calls.map(call => {
              const st = statusMeta(call.status)
              const sent = sentimentMeta(call.sentiment)
              const SentIcon = sent.Icon
              return (
                <button
                  key={call.id}
                  onClick={() => setSelectedCall(call)}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-[#fafafa] transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-violet-50 flex items-center justify-center flex-shrink-0">
                    <Phone className="w-4 h-4 text-violet-600" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-semibold text-[#1a1a1a] truncate">
                        {call.customer_name || call.customer_phone || 'Appel anonyme'}
                      </p>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${st.color}`}>
                        {st.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#9ca3af] mt-0.5 truncate">
                      {call.summary || (call.transcript ? call.transcript.substring(0, 80) + '...' : 'Pas de resume')}
                    </p>
                  </div>

                  <div className="hidden md:flex items-center gap-3 flex-shrink-0">
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${sent.color}`}>
                      <SentIcon className="w-3 h-3" />
                      <span className="text-[10px] font-semibold">{sent.label}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] font-semibold text-[#1a1a1a]">{formatDuration(call.duration_seconds)}</p>
                      <p className="text-[10px] text-[#9ca3af]">{formatDate(call.created_at)}</p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Drawer */}
      <AnimatePresence>
        {selectedCall && (
          <CallDrawer call={selectedCall} onClose={() => setSelectedCall(null)} />
        )}
      </AnimatePresence>
    </div>
  )
}

const StatCard = ({ icon: Icon, label, value, iconColor, iconBg }) => (
  <div className="bg-white rounded-xl border border-[#f0f0f0] p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
    <div className="flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconBg}`}>
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-[#9ca3af] uppercase tracking-wider font-semibold">{label}</p>
        <p className="text-[18px] font-semibold text-[#1a1a1a] leading-tight mt-0.5">{value}</p>
      </div>
    </div>
  </div>
)

const CallDrawer = ({ call, onClose }) => {
  const [playing, setPlaying] = useState(false)
  const audioRef = React.useRef(null)

  const togglePlay = () => {
    if (!audioRef.current) return
    if (playing) {
      audioRef.current.pause()
      setPlaying(false)
    } else {
      audioRef.current.play()
      setPlaying(true)
    }
  }

  const st = statusMeta(call.status)
  const sent = sentimentMeta(call.sentiment)
  const SentIcon = sent.Icon

  // Parse transcript into messages if it's structured
  const messages = useMemo(() => {
    if (!call.transcript) return []
    return call.transcript
      .split('\n')
      .filter(line => line.trim())
      .map((line, idx) => {
        const match = line.match(/^(Agent|Client)\s*:\s*(.+)$/)
        if (match) {
          return { role: match[1] === 'Agent' ? 'agent' : 'user', text: match[2], id: idx }
        }
        return { role: 'text', text: line, id: idx }
      })
  }, [call.transcript])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex justify-end"
      onClick={onClose}
    >
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-white h-full overflow-y-auto shadow-2xl"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-[#f0f0f0] px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-violet-50 flex items-center justify-center">
              <Phone className="w-4 h-4 text-violet-600" />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-[#1a1a1a]">
                {call.customer_name || call.customer_phone || 'Appel anonyme'}
              </p>
              <p className="text-[11px] text-[#9ca3af]">
                {formatDate(call.created_at)} - {formatDuration(call.duration_seconds)}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[#fafafa] rounded-lg">
            <X className="w-4 h-4 text-[#9ca3af]" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Meta badges */}
          <div className="flex flex-wrap gap-2">
            <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${st.color}`}>
              {st.label}
            </span>
            <span className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full ${sent.color}`}>
              <SentIcon className="w-3 h-3" />
              Sentiment {sent.label.toLowerCase()}
            </span>
            {call.customer_phone && (
              <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-[#fafafa] text-[#1a1a1a] border border-[#ebebeb]">
                {call.customer_phone}
              </span>
            )}
          </div>

          {/* Recording player */}
          {call.recording_url && (
            <div className="p-4 bg-[#fafafa] rounded-xl border border-[#f0f0f0]">
              <div className="flex items-center gap-3">
                <button
                  onClick={togglePlay}
                  className="w-10 h-10 rounded-full bg-violet-600 hover:bg-violet-700 text-white flex items-center justify-center flex-shrink-0"
                >
                  {playing ? <PauseCircle className="w-5 h-5" /> : <PlayCircle className="w-5 h-5" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-[#1a1a1a]">Enregistrement audio</p>
                  <p className="text-[11px] text-[#9ca3af]">{formatDuration(call.duration_seconds)}</p>
                </div>
                <Volume2 className="w-4 h-4 text-[#9ca3af]" />
              </div>
              <audio
                ref={audioRef}
                src={call.recording_url}
                onEnded={() => setPlaying(false)}
                onPause={() => setPlaying(false)}
                onPlay={() => setPlaying(true)}
                className="hidden"
              />
            </div>
          )}

          {/* Summary */}
          {call.summary && (
            <div>
              <p className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-2">Resume</p>
              <div className="p-4 bg-violet-50/40 rounded-xl border border-violet-100">
                <p className="text-[13px] text-[#1a1a1a] leading-relaxed">{call.summary}</p>
              </div>
            </div>
          )}

          {/* Transcript */}
          <div>
            <p className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-2">Transcription</p>
            {messages.length === 0 ? (
              <div className="p-4 bg-[#fafafa] rounded-xl text-[12px] text-[#9ca3af] italic">
                Aucune transcription disponible.
              </div>
            ) : (
              <div className="space-y-2.5">
                {messages.map(msg => {
                  if (msg.role === 'text') {
                    return (
                      <p key={msg.id} className="text-[12px] text-[#9ca3af] italic px-1">{msg.text}</p>
                    )
                  }
                  const isAgent = msg.role === 'agent'
                  return (
                    <div key={msg.id} className={`flex ${isAgent ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl ${
                        isAgent
                          ? 'bg-[#fafafa] text-[#1a1a1a] rounded-tl-sm'
                          : 'bg-violet-600 text-white rounded-tr-sm'
                      }`}>
                        <p className={`text-[10px] font-semibold mb-0.5 ${isAgent ? 'text-[#9ca3af]' : 'text-white/70'}`}>
                          {isAgent ? 'Agent IA' : 'Client'}
                        </p>
                        <p className="text-[12px] leading-relaxed">{msg.text}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Metadata */}
          {call.conversation_id && (
            <div className="pt-3 border-t border-[#f0f0f0]">
              <p className="text-[10px] text-[#9ca3af]">
                ID conversation : <code className="font-mono">{call.conversation_id}</code>
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
