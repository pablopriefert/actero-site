import React, { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mic, Play, Pause, Plus, Upload, Check, ChevronRight,
  Sliders, Volume2, Sparkles, User, Crown, Loader2
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../ui/Toast'

const VOICE_COLORS = [
  'bg-rose-500/10 text-rose-600 border-rose-200',
  'bg-blue-500/10 text-blue-600 border-blue-200',
  'bg-violet-500/10 text-violet-600 border-violet-200',
  'bg-amber-500/10 text-amber-600 border-amber-200',
  'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  'bg-cyan-500/10 text-cyan-600 border-cyan-200',
]

const CLONING_STEPS = [
  { id: 1, label: 'Enregistrer' },
  { id: 2, label: 'Analyser' },
  { id: 3, label: 'Générer' },
  { id: 4, label: 'Valider' },
]

const EMOTION_PRESETS = ['Neutre', 'Joyeux', 'Empathique', 'Sérieux']

export function VoiceStudioView({ clientId, theme }) {
  const toast = useToast()
  const audioRef = useRef(null)

  const [selectedVoice, setSelectedVoice] = useState(null)
  const [speed, setSpeed] = useState(1)
  const [pitch, setPitch] = useState(50)
  const [emotion, setEmotion] = useState('Neutre')
  const [previewText, setPreviewText] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [playingPreview, setPlayingPreview] = useState(null)
  const [cloningProgress] = useState(1)

  // Fetch real voices from ElevenLabs
  const { data: voices = [], isLoading: voicesLoading } = useQuery({
    queryKey: ['elevenlabs-voices'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/elevenlabs/voices', {
        headers: { 'Authorization': `Bearer ${session?.access_token}` },
      })
      if (!res.ok) throw new Error('Erreur chargement voix')
      const data = await res.json()
      return data.voices || []
    },
    enabled: !!supabase,
    staleTime: 5 * 60 * 1000,
  })

  const handleSelectVoice = (voiceId) => {
    setSelectedVoice(voiceId)
    toast.success('Voix selectionnee')
  }

  const handlePlayPreviewUrl = (previewUrl, voiceId) => {
    if (playingPreview === voiceId) {
      audioRef.current?.pause()
      setPlayingPreview(null)
      return
    }
    if (audioRef.current) {
      audioRef.current.pause()
    }
    const audio = new Audio(previewUrl)
    audioRef.current = audio
    audio.onended = () => setPlayingPreview(null)
    audio.play()
    setPlayingPreview(voiceId)
  }

  const handleGeneratePreview = async () => {
    if (!previewText.trim()) {
      toast.error('Veuillez saisir un texte')
      return
    }
    if (!selectedVoice) {
      toast.error('Selectionnez une voix')
      return
    }
    setIsGenerating(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/text-to-speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ text: previewText, voice_id: selectedVoice }),
      })
      if (!res.ok) throw new Error('Erreur generation')
      const audioBlob = await res.blob()
      const audioUrl = URL.createObjectURL(audioBlob)
      if (audioRef.current) audioRef.current.pause()
      const audio = new Audio(audioUrl)
      audioRef.current = audio
      audio.play()
      toast.success('Apercu genere')
    } catch (err) {
      toast.error('Erreur: ' + err.message)
    }
    setIsGenerating(false)
  }

  const handleCreateVoice = () => {
    toast.info('La creation de voix personnalisee sera disponible prochainement.')
  }

  useEffect(() => {
    return () => { if (audioRef.current) audioRef.current.pause() }
  }, [])

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-[#0F5F35]/10 rounded-xl">
          <Mic className="w-5 h-5 text-[#0F5F35]" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#262626]">Studio de Voix</h2>
          <p className="text-sm text-[#716D5C]">
            Créez et personnalisez les voix de votre assistant IA
          </p>
        </div>
      </div>

      {/* Voice Library */}
      <section>
        <label className="text-[10px] font-bold text-[#716D5C] uppercase tracking-wider">
          Bibliothèque de voix
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-3">
          {voicesLoading ? (
            <div className="col-span-full flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-[#716D5C]" />
            </div>
          ) : voices.slice(0, 6).map((voice, i) => (
            <motion.div
              key={voice.voice_id}
              whileHover={{ y: -2 }}
              className={`bg-white border rounded-2xl shadow-sm p-5 flex flex-col gap-3 transition-all ${
                selectedVoice === voice.voice_id
                  ? 'border-[#0F5F35] ring-2 ring-[#0F5F35]/20'
                  : 'border-gray-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border ${VOICE_COLORS[i % VOICE_COLORS.length]}`}
                >
                  {voice.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#262626] text-sm">{voice.name}</p>
                  <p className="text-xs text-[#716D5C]">{voice.description || voice.category}</p>
                </div>
                {voice.gender && (
                  <div className="flex items-center gap-1">
                    <User className="w-3 h-3 text-[#716D5C]" />
                    <span className="text-[10px] text-[#716D5C] capitalize">{voice.gender === 'female' ? 'Femme' : 'Homme'}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 mt-auto">
                {voice.preview_url && (
                  <button
                    onClick={() => handlePlayPreviewUrl(voice.preview_url, voice.voice_id)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-[#262626] bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors"
                  >
                    {playingPreview === voice.voice_id ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    {playingPreview === voice.voice_id ? 'Pause' : 'Ecouter'}
                  </button>
                )}
                <button
                  onClick={() => handleSelectVoice(voice.voice_id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl transition-colors ${
                    selectedVoice === voice.voice_id
                      ? 'bg-[#0F5F35] text-white'
                      : 'bg-[#0F5F35]/10 text-[#0F5F35] hover:bg-[#0F5F35]/20'
                  }`}
                >
                  {selectedVoice === voice.voice_id ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Selectionnee
                    </>
                  ) : (
                    'Selectionner'
                  )}
                </button>
              </div>
            </motion.div>
          ))}

          {/* Custom voice slots */}
          {[1, 2, 3].map((slot) => (
            <motion.button
              key={`custom-${slot}`}
              whileHover={{ y: -2 }}
              onClick={handleCreateVoice}
              className="bg-white border border-dashed border-gray-200 rounded-2xl shadow-sm p-5 flex flex-col items-center justify-center gap-3 min-h-[140px] hover:border-[#0F5F35]/40 hover:bg-[#0F5F35]/5 transition-all cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-full bg-gray-100 group-hover:bg-[#0F5F35]/10 flex items-center justify-center transition-colors">
                <Plus className="w-5 h-5 text-[#716D5C] group-hover:text-[#0F5F35] transition-colors" />
              </div>
              <p className="text-sm font-medium text-[#716D5C] group-hover:text-[#0F5F35] transition-colors">
                Créer une voix
              </p>
            </motion.button>
          ))}
        </div>
      </section>

      {/* Voice Cloning Section */}
      <section className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 space-y-5">
        <div className="flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-[#0F5F35]" />
          <h3 className="font-semibold text-[#262626]">Clonage de voix</h3>
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 rounded-full">
            <Crown className="w-3 h-3" />
            Enterprise
          </span>
        </div>

        {/* Upload area */}
        <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-[#0F5F35]/30 transition-colors">
          <Upload className="w-8 h-8 text-[#716D5C] mx-auto mb-3" />
          <p className="text-sm font-medium text-[#262626]">
            Enregistrez 5 minutes de voix pour créer un clone
          </p>
          <p className="text-xs text-[#716D5C] mt-1">
            Formats acceptés : WAV, MP3, M4A (max 50 Mo)
          </p>
          <button className="mt-4 px-5 py-2 bg-gray-100 text-[#262626] text-sm font-medium rounded-full hover:bg-gray-200 transition-colors">
            Importer un fichier audio
          </button>
        </div>

        {/* Progress steps */}
        <div className="flex items-center justify-between">
          {CLONING_STEPS.map((step, index) => (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    step.id <= cloningProgress
                      ? 'bg-[#0F5F35] text-white'
                      : 'bg-gray-100 text-[#716D5C]'
                  }`}
                >
                  {step.id}
                </div>
                <span className="text-[10px] font-medium text-[#716D5C]">{step.label}</span>
              </div>
              {index < CLONING_STEPS.length - 1 && (
                <ChevronRight className="w-4 h-4 text-gray-300 mt-[-12px]" />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Fake progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#716D5C]">Progression</span>
            <span className="text-[#262626] font-medium">Étape 1 sur 4</span>
          </div>
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: '25%' }}
              transition={{ duration: 1.5, ease: 'easeOut' }}
              className="h-full bg-[#0F5F35] rounded-full"
            />
          </div>
        </div>

        <p className="text-xs text-[#716D5C] italic text-center">
          Disponible avec le plan Enterprise
        </p>
      </section>

      {/* Voice Settings */}
      <section className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 space-y-5">
        <div className="flex items-center gap-3">
          <Sliders className="w-5 h-5 text-[#0F5F35]" />
          <h3 className="font-semibold text-[#262626]">Paramètres de voix</h3>
        </div>

        {/* Speed slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-[#716D5C] uppercase tracking-wider">
              Vitesse
            </label>
            <span className="text-sm font-medium text-[#262626]">{speed}x</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.1"
            value={speed}
            onChange={(e) => setSpeed(parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-100 rounded-full appearance-none cursor-pointer accent-[#0F5F35]"
          />
          <div className="flex justify-between text-[10px] text-[#716D5C]">
            <span>0.5x</span>
            <span>2x</span>
          </div>
        </div>

        {/* Pitch slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-[#716D5C] uppercase tracking-wider">
              Tonalité
            </label>
            <span className="text-sm font-medium text-[#262626]">{pitch}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={pitch}
            onChange={(e) => setPitch(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-100 rounded-full appearance-none cursor-pointer accent-[#0F5F35]"
          />
          <div className="flex justify-between text-[10px] text-[#716D5C]">
            <span>Grave</span>
            <span>Aigu</span>
          </div>
        </div>

        {/* Emotion presets */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-[#716D5C] uppercase tracking-wider">
            Émotion
          </label>
          <div className="flex flex-wrap gap-2">
            {EMOTION_PRESETS.map((preset) => (
              <button
                key={preset}
                onClick={() => setEmotion(preset)}
                className={`px-4 py-2 text-xs font-medium rounded-full transition-all ${
                  emotion === preset
                    ? 'bg-[#0F5F35] text-white shadow-sm'
                    : 'bg-gray-50 text-[#262626] hover:bg-gray-100'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Preview Section */}
      <section className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Volume2 className="w-5 h-5 text-[#0F5F35]" />
          <h3 className="font-semibold text-[#262626]">Aperçu</h3>
        </div>

        <div>
          <label className="text-[10px] font-bold text-[#716D5C] uppercase tracking-wider">
            Texte de test
          </label>
          <textarea
            value={previewText}
            onChange={(e) => setPreviewText(e.target.value)}
            placeholder="Saisissez un texte pour tester la voix sélectionnée..."
            rows={3}
            className="mt-1.5 w-full px-4 py-3 text-sm text-[#262626] bg-[#F5F5F0] border border-gray-100 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-[#0F5F35]/20 focus:border-[#0F5F35]/40 placeholder:text-[#716D5C]/60"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleGeneratePreview}
            disabled={isGenerating}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#0F5F35] text-white text-sm font-medium rounded-full hover:bg-[#003725] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                >
                  <Sparkles className="w-4 h-4" />
                </motion.div>
                Génération en cours...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Générer aperçu
              </>
            )}
          </button>

          {selectedVoice && (
            <span className="text-xs text-[#716D5C]">
              Voix : {voices.find((v) => v.voice_id === selectedVoice)?.name || 'Personnalisee'}
            </span>
          )}
          {!selectedVoice && (
            <span className="text-xs text-[#716D5C] italic">
              Sélectionnez une voix pour générer un aperçu
            </span>
          )}
        </div>
      </section>
    </div>
  )
}
