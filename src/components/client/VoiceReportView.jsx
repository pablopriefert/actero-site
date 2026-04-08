import React, { useState, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Volume2, FileAudio, Play, Pause, Clock, Calendar, Mail,
  Bell, ChevronDown, Sparkles, TrendingUp, AlertTriangle,
  BarChart3, Lightbulb, CheckCircle2, Loader2
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../ui/Toast'

const VOICE_OPTIONS = [
  { id: 'sophie', name: 'Sophie', style: 'Chaleureuse' },
  { id: 'lucas', name: 'Lucas', style: 'Professionnel' },
  { id: 'emma', name: 'Emma', style: 'Dynamique' },
]

const DAY_OPTIONS = [
  'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'
]

const HOUR_OPTIONS = [
  '6h00', '7h00', '8h00', '9h00', '10h00', '11h00', '12h00',
  '13h00', '14h00', '15h00', '16h00', '17h00', '18h00'
]

const CONTENT_OPTIONS = [
  { id: 'metrics', label: 'Metriques cles', icon: BarChart3 },
  { id: 'trends', label: 'Tendances', icon: TrendingUp },
  { id: 'alerts', label: 'Alertes', icon: AlertTriangle },
  { id: 'recommendations', label: 'Recommandations IA', icon: Lightbulb },
]

const LATEST_REPORT = {
  id: 'rpt-001',
  title: 'Semaine du 31 mars au 6 avril 2026',
  duration: '1 min 32 sec',
  durationSeconds: 92,
  generatedAt: 'Genere le lundi 7 avril a 8h00',
  highlights: [
    'Hausse de 12% des conversations par rapport a la semaine precedente',
    '3 escalades critiques detectees, toutes resolues en moins de 2h',
    'Nouveau pic d\'activite le mercredi entre 14h et 16h',
    'Score de satisfaction moyen : 4.6/5 (+0.3 vs semaine derniere)',
  ],
}

const PREVIOUS_REPORTS = [
  {
    id: 'rpt-002',
    title: 'Semaine du 24 au 30 mars 2026',
    duration: '1 min 18 sec',
    durationSeconds: 78,
  },
  {
    id: 'rpt-003',
    title: 'Semaine du 17 au 23 mars 2026',
    duration: '1 min 45 sec',
    durationSeconds: 105,
  },
  {
    id: 'rpt-004',
    title: 'Semaine du 10 au 16 mars 2026',
    duration: '1 min 22 sec',
    durationSeconds: 82,
  },
]

export function VoiceReportView({ clientId, theme }) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const audioRef = useRef(null)

  const [isPlaying, setIsPlaying] = useState(false)
  const [playingId, setPlayingId] = useState(null)
  const [progress, setProgress] = useState(0)
  const [selectedDay, setSelectedDay] = useState('Lundi')
  const [selectedHour, setSelectedHour] = useState('8h00')
  const [selectedVoice, setSelectedVoice] = useState('')
  const [contentChecks, setContentChecks] = useState({
    metrics: true,
    trends: true,
    alerts: true,
    recommendations: true,
  })
  const [sendEmail, setSendEmail] = useState(true)
  const [pushNotification, setPushNotification] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  // Fetch real reports from Supabase
  const { data: reports = [] } = useQuery({
    queryKey: ['voice-reports', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('voice_reports')
        .select('*')
        .eq('client_id', clientId)
        .order('generated_at', { ascending: false })
        .limit(10)
      if (error) throw error
      return data || []
    },
    enabled: !!clientId,
  })

  // Fetch available voices
  const { data: voices = [] } = useQuery({
    queryKey: ['elevenlabs-voices'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/elevenlabs/voices', {
        headers: { 'Authorization': `Bearer ${session?.access_token}` },
      })
      if (!res.ok) return []
      const data = await res.json()
      return data.voices || []
    },
    enabled: !!supabase,
    staleTime: 5 * 60 * 1000,
  })

  const handlePlay = (reportId) => {
    if (playingId === reportId && isPlaying) {
      audioRef.current?.pause()
      setIsPlaying(false)
      return
    }

    // Find report and play its audio
    const report = reports.find(r => r.id === reportId)
    if (report?.audio_base64) {
      if (audioRef.current) audioRef.current.pause()
      const audio = new Audio(`data:audio/mpeg;base64,${report.audio_base64}`)
      audioRef.current = audio
      audio.onended = () => { setIsPlaying(false); setPlayingId(null) }
      audio.play()
      setPlayingId(reportId)
      setIsPlaying(true)
      setProgress(0)
    } else {
      // Fallback for mock reports
      setPlayingId(reportId)
      setIsPlaying(true)
      setProgress(0)
    }
  }

  const toggleContent = (id) => {
    setContentChecks(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const handleGenerate = async () => {
    setIsGenerating(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const contentTypes = Object.entries(contentChecks).filter(([, v]) => v).map(([k]) => k)
      const res = await fetch('/api/elevenlabs/generate-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          client_id: clientId,
          voice_id: selectedVoice || undefined,
          content_types: contentTypes,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erreur generation')
      }
      const data = await res.json()

      // Play the generated audio
      if (data.audio_base64) {
        if (audioRef.current) audioRef.current.pause()
        const audio = new Audio(`data:audio/mpeg;base64,${data.audio_base64}`)
        audioRef.current = audio
        audio.play()
      }

      toast.success('Rapport vocal genere avec succes !')
      queryClient.invalidateQueries({ queryKey: ['voice-reports', clientId] })
    } catch (err) {
      toast.error('Erreur: ' + err.message)
    }
    setIsGenerating(false)
  }

  const formatProgress = (seconds, pct) => {
    const current = Math.floor((pct / 100) * seconds)
    const cm = Math.floor(current / 60)
    const cs = current % 60
    const tm = Math.floor(seconds / 60)
    const ts = seconds % 60
    return `${cm}:${cs.toString().padStart(2, '0')} / ${tm}:${ts.toString().padStart(2, '0')}`
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3"
      >
        <div className="w-10 h-10 rounded-xl bg-[#003725]/10 flex items-center justify-center">
          <Volume2 className="w-5 h-5 text-[#003725]" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#262626]">Rapport Vocal Hebdomadaire</h2>
          <p className="text-sm text-[#716D5C]">Resume audio automatique de vos metriques et insights</p>
        </div>
      </motion.div>

      {/* Latest Report - Featured Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden"
      >
        <div className="bg-gradient-to-r from-[#003725] to-[#0F5F35] px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileAudio className="w-5 h-5 text-white/80" />
              <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider">
                Dernier rapport
              </span>
            </div>
            <span className="text-xs text-white/60 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {LATEST_REPORT.duration}
            </span>
          </div>
          <h3 className="text-lg font-semibold text-white mt-2">{LATEST_REPORT.title}</h3>
        </div>

        <div className="p-6 space-y-5">
          {/* Audio Player */}
          <div className="bg-[#F5F5F0] rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-4">
              <button
                onClick={() => handlePlay(LATEST_REPORT.id)}
                className="w-11 h-11 rounded-full bg-[#0F5F35] text-white flex items-center justify-center hover:bg-[#003725] transition-colors flex-shrink-0"
              >
                {playingId === LATEST_REPORT.id && isPlaying ? (
                  <Pause className="w-5 h-5" />
                ) : (
                  <Play className="w-5 h-5 ml-0.5" />
                )}
              </button>
              <div className="flex-1 space-y-1.5">
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-[#0F5F35] rounded-full"
                    initial={{ width: '0%' }}
                    animate={{
                      width: playingId === LATEST_REPORT.id && isPlaying ? '100%' : `${progress}%`,
                    }}
                    transition={
                      playingId === LATEST_REPORT.id && isPlaying
                        ? { duration: LATEST_REPORT.durationSeconds, ease: 'linear' }
                        : { duration: 0.2 }
                    }
                  />
                </div>
                <div className="flex justify-between text-[11px] text-[#716D5C]">
                  <span>{formatProgress(LATEST_REPORT.durationSeconds, playingId === LATEST_REPORT.id && isPlaying ? 0 : progress)}</span>
                  <span>
                    {(() => {
                      const voice = VOICE_OPTIONS.find(v => v.id === selectedVoice)
                      return voice ? `Voix : ${voice.name}` : ''
                    })()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Key Highlights */}
          <div>
            <p className="text-[10px] font-bold text-[#716D5C] uppercase tracking-wider mb-3">
              Points cles
            </p>
            <ul className="space-y-2">
              {LATEST_REPORT.highlights.map((highlight, idx) => (
                <motion.li
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + idx * 0.1 }}
                  className="flex items-start gap-2.5 text-sm text-[#262626]"
                >
                  <Sparkles className="w-4 h-4 text-[#0F5F35] mt-0.5 flex-shrink-0" />
                  <span>{highlight}</span>
                </motion.li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-[#716D5C] flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            {LATEST_REPORT.generatedAt}
          </p>
        </div>
      </motion.div>

      {/* Previous Reports */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6"
      >
        <p className="text-[10px] font-bold text-[#716D5C] uppercase tracking-wider mb-4">
          Rapports precedents
        </p>
        <div className="space-y-3">
          {PREVIOUS_REPORTS.map((report, idx) => (
            <motion.div
              key={report.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 + idx * 0.08 }}
              className="flex items-center justify-between p-3 rounded-xl bg-[#F5F5F0] hover:bg-[#EDEDE8] transition-colors"
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handlePlay(report.id)}
                  className="w-9 h-9 rounded-full bg-[#0F5F35] text-white flex items-center justify-center hover:bg-[#003725] transition-colors flex-shrink-0"
                >
                  {playingId === report.id && isPlaying ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4 ml-0.5" />
                  )}
                </button>
                <div>
                  <p className="text-sm font-medium text-[#262626]">{report.title}</p>
                  <p className="text-xs text-[#716D5C]">{report.duration}</p>
                </div>
              </div>
              {playingId === report.id && isPlaying && (
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4].map(i => (
                    <motion.div
                      key={i}
                      className="w-1 bg-[#0F5F35] rounded-full"
                      animate={{ height: [4, 16, 4] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Configuration */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 space-y-6"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#003725]/10 flex items-center justify-center">
            <Calendar className="w-4 h-4 text-[#003725]" />
          </div>
          <h3 className="text-base font-semibold text-[#262626]">Configuration</h3>
        </div>

        {/* Day & Time */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-bold text-[#716D5C] uppercase tracking-wider block mb-2">
              Quel jour ?
            </label>
            <div className="relative">
              <select
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
                className="w-full appearance-none bg-[#F5F5F0] border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-[#262626] pr-10 focus:outline-none focus:ring-2 focus:ring-[#0F5F35]/20 focus:border-[#0F5F35]"
              >
                {DAY_OPTIONS.map(day => (
                  <option key={day} value={day}>{day}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-[#716D5C] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-[#716D5C] uppercase tracking-wider block mb-2">
              Quelle heure ?
            </label>
            <div className="relative">
              <select
                value={selectedHour}
                onChange={(e) => setSelectedHour(e.target.value)}
                className="w-full appearance-none bg-[#F5F5F0] border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-[#262626] pr-10 focus:outline-none focus:ring-2 focus:ring-[#0F5F35]/20 focus:border-[#0F5F35]"
              >
                {HOUR_OPTIONS.map(hour => (
                  <option key={hour} value={hour}>{hour}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-[#716D5C] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Voice Selector */}
        <div>
          <label className="text-[10px] font-bold text-[#716D5C] uppercase tracking-wider block mb-2">
            Voix
          </label>
          <div className="grid grid-cols-3 gap-3">
            {VOICE_OPTIONS.map(voice => (
              <button
                key={voice.id}
                onClick={() => setSelectedVoice(voice.id)}
                className={`p-3 rounded-xl border text-center transition-all ${
                  selectedVoice === voice.id
                    ? 'border-[#0F5F35] bg-[#0F5F35]/5 ring-1 ring-[#0F5F35]/20'
                    : 'border-gray-200 bg-[#F5F5F0] hover:border-gray-300'
                }`}
              >
                <p className={`text-sm font-medium ${
                  selectedVoice === voice.id ? 'text-[#0F5F35]' : 'text-[#262626]'
                }`}>
                  {voice.name}
                </p>
                <p className="text-[11px] text-[#716D5C]">{voice.style}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Content Checkboxes */}
        <div>
          <label className="text-[10px] font-bold text-[#716D5C] uppercase tracking-wider block mb-3">
            Contenu a inclure
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {CONTENT_OPTIONS.map(option => {
              const Icon = option.icon
              return (
                <button
                  key={option.id}
                  onClick={() => toggleContent(option.id)}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                    contentChecks[option.id]
                      ? 'border-[#0F5F35] bg-[#0F5F35]/5'
                      : 'border-gray-200 bg-[#F5F5F0]'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    contentChecks[option.id]
                      ? 'bg-[#0F5F35] border-[#0F5F35]'
                      : 'border-gray-300 bg-white'
                  }`}>
                    {contentChecks[option.id] && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                    )}
                  </div>
                  <Icon className={`w-4 h-4 flex-shrink-0 ${
                    contentChecks[option.id] ? 'text-[#0F5F35]' : 'text-[#716D5C]'
                  }`} />
                  <span className={`text-sm ${
                    contentChecks[option.id] ? 'text-[#262626] font-medium' : 'text-[#716D5C]'
                  }`}>
                    {option.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Toggles */}
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-xl bg-[#F5F5F0]">
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-[#716D5C]" />
              <span className="text-sm text-[#262626]">Envoyer par email</span>
            </div>
            <button
              onClick={() => setSendEmail(!sendEmail)}
              className={`w-11 h-6 rounded-full transition-colors relative ${
                sendEmail ? 'bg-[#0F5F35]' : 'bg-gray-300'
              }`}
            >
              <motion.div
                className="w-5 h-5 bg-white rounded-full shadow-sm absolute top-0.5"
                animate={{ left: sendEmail ? 22 : 2 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            </button>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-[#F5F5F0]">
            <div className="flex items-center gap-3">
              <Bell className="w-4 h-4 text-[#716D5C]" />
              <span className="text-sm text-[#262626]">Notification push</span>
            </div>
            <button
              onClick={() => setPushNotification(!pushNotification)}
              className={`w-11 h-6 rounded-full transition-colors relative ${
                pushNotification ? 'bg-[#0F5F35]' : 'bg-gray-300'
              }`}
            >
              <motion.div
                className="w-5 h-5 bg-white rounded-full shadow-sm absolute top-0.5"
                animate={{ left: pushNotification ? 22 : 2 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            </button>
          </div>
        </div>

        {/* Generate Button */}
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleGenerate}
          disabled={isGenerating}
          className="w-full py-3 bg-[#0F5F35] text-white font-medium rounded-xl hover:bg-[#003725] transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generation en cours...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Generer maintenant
            </>
          )}
        </motion.button>
      </motion.div>
    </div>
  )
}
