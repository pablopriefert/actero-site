import React, { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Phone, PhoneCall, PhoneOff, PhoneIncoming, Clock, CheckCircle2,
  AlertTriangle, Users, Mic, Globe, MessageSquare, ArrowRightLeft,
  ChevronDown, TrendingUp, Star, Timer, Volume2, Settings
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../ui/Toast'

const VOICE_OPTIONS = [
  { id: 'sophie', name: 'Sophie', style: 'Chaleureuse', locale: 'fr-FR' },
  { id: 'lucas', name: 'Lucas', style: 'Professionnel', locale: 'fr-FR' },
  { id: 'emma', name: 'Emma', style: 'Dynamique', locale: 'fr-FR' },
  { id: 'marc', name: 'Marc', style: 'Rassurant', locale: 'fr-FR' },
]

const LANGUAGE_OPTIONS = [
  { code: 'fr', label: 'Francais', flag: 'FR' },
  { code: 'en', label: 'English', flag: 'GB' },
  { code: 'es', label: 'Espanol', flag: 'ES' },
]

const MOCK_CALLS = [
  {
    id: 1,
    caller: 'Marie Dupont',
    phone: '+33 6 12 34 56 78',
    duration: '3:42',
    status: 'resolved',
    reason: 'Suivi de commande #4821',
    timestamp: '2026-04-08T14:23:00',
  },
  {
    id: 2,
    caller: 'Pierre Martin',
    phone: '+33 6 98 76 54 32',
    duration: '7:15',
    status: 'escalated',
    reason: 'Demande de remboursement',
    timestamp: '2026-04-08T13:05:00',
  },
  {
    id: 3,
    caller: 'Camille Leroy',
    phone: '+33 7 11 22 33 44',
    duration: '1:58',
    status: 'resolved',
    reason: 'Question sur les tailles',
    timestamp: '2026-04-08T11:47:00',
  },
  {
    id: 4,
    caller: 'Jean-Luc Bernard',
    phone: '+33 6 55 44 33 22',
    duration: '0:45',
    status: 'abandoned',
    reason: 'Appel raccroche avant reponse',
    timestamp: '2026-04-08T10:12:00',
  },
  {
    id: 5,
    caller: 'Sophie Moreau',
    phone: '+33 7 66 77 88 99',
    duration: '5:30',
    status: 'resolved',
    reason: 'Modification adresse livraison',
    timestamp: '2026-04-07T17:30:00',
  },
]

const STATUS_CONFIG = {
  resolved: { label: 'Resolu', color: 'bg-emerald-50 text-emerald-700', icon: CheckCircle2 },
  escalated: { label: 'Escalade', color: 'bg-amber-50 text-amber-700', icon: ArrowRightLeft },
  abandoned: { label: 'Abandonne', color: 'bg-red-50 text-red-600', icon: PhoneOff },
}

const formatTimestamp = (dateStr) => {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now - date
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 60) return `Il y a ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Il y a ${hours}h`
  const days = Math.floor(hours / 24)
  return `Il y a ${days}j`
}

export const VoiceAgentView = ({ clientId, theme }) => {
  const toast = useToast()

  const [agentActive, setAgentActive] = useState(false)
  const [selectedVoice, setSelectedVoice] = useState('sophie')
  const [selectedLanguage, setSelectedLanguage] = useState('fr')
  const [maxDuration, setMaxDuration] = useState(5)
  const [greetingMessage, setGreetingMessage] = useState(
    'Bonjour et bienvenue ! Je suis votre assistant vocal. Comment puis-je vous aider aujourd\'hui ?'
  )
  const [escaladeActive, setEscaladeActive] = useState(true)
  const [showVoiceDropdown, setShowVoiceDropdown] = useState(false)

  // Fetch config from Supabase
  const { data: voiceConfig } = useQuery({
    queryKey: ['voice-agent-config', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('voice_agent_config')
        .select('*')
        .eq('client_id', clientId)
        .maybeSingle()
      return data
    },
    enabled: !!clientId,
  })

  useEffect(() => {
    if (voiceConfig) {
      setAgentActive(voiceConfig.is_active ?? false)
      setSelectedVoice(voiceConfig.voice_id || 'sophie')
      setSelectedLanguage(voiceConfig.language || 'fr')
      setMaxDuration(voiceConfig.max_duration || 5)
      setGreetingMessage(voiceConfig.greeting_message || greetingMessage)
      setEscaladeActive(voiceConfig.escalation_enabled ?? true)
    }
  }, [voiceConfig])

  const saveConfig = async (updates) => {
    if (!clientId) return
    await supabase.from('voice_agent_config').upsert({
      client_id: clientId,
      is_active: updates.is_active ?? agentActive,
      voice_id: updates.voice_id ?? selectedVoice,
      language: updates.language ?? selectedLanguage,
      max_duration: updates.max_duration ?? maxDuration,
      greeting_message: updates.greeting_message ?? greetingMessage,
      escalation_enabled: updates.escalation_enabled ?? escaladeActive,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'client_id' })
  }

  const stats = [
    { label: 'Appels traites', value: '147', change: '+12%', icon: PhoneCall, color: 'text-emerald-600' },
    { label: 'Duree moyenne', value: '3:24', change: '-8%', icon: Timer, color: 'text-blue-600' },
    { label: 'Taux resolution', value: '87%', change: '+3%', icon: TrendingUp, color: 'text-violet-600' },
    { label: 'Satisfaction', value: '4.6/5', change: '+0.2', icon: Star, color: 'text-amber-500' },
  ]

  const currentVoice = VOICE_OPTIONS.find((v) => v.id === selectedVoice)

  const handleToggleAgent = () => {
    const newVal = !agentActive
    setAgentActive(newVal)
    saveConfig({ is_active: newVal })
    toast.success(newVal ? 'Agent vocal active' : 'Agent vocal desactive')
  }

  const handleSaveConfig = () => {
    saveConfig({})
    toast.success('Configuration sauvegardee')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#003725]/10 flex items-center justify-center">
            <Phone className="w-5 h-5 text-[#003725]" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-[#262626]">Agent Vocal IA</h2>
            <p className="text-sm text-[#716D5C]">Powered by ElevenLabs</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-[#716D5C]">
            {agentActive ? 'Actif' : 'Inactif'}
          </span>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleToggleAgent}
            className={`relative w-14 h-7 rounded-full transition-colors duration-300 ${
              agentActive ? 'bg-[#0F5F35]' : 'bg-gray-300'
            }`}
          >
            <motion.div
              layout
              className="absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-md"
              style={{ left: agentActive ? 'calc(100% - 26px)' : '2px' }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          </motion.button>
        </div>
      </div>

      {/* Status Banner */}
      <AnimatePresence mode="wait">
        {agentActive ? (
          <motion.div
            key="active"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-xl"
          >
            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-emerald-700">
              Agent vocal en ligne — pret a recevoir des appels
            </span>
          </motion.div>
        ) : (
          <motion.div
            key="inactive"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl"
          >
            <div className="w-2.5 h-2.5 bg-gray-400 rounded-full" />
            <span className="text-sm font-medium text-gray-500">
              Agent vocal hors ligne — les appels ne seront pas pris en charge
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-[#716D5C] uppercase tracking-wider">
                  {stat.label}
                </span>
                <Icon className={`w-4 h-4 ${stat.color}`} />
              </div>
              <div className="flex items-end gap-2">
                <span className="text-2xl font-bold text-[#262626]">{stat.value}</span>
                <span className="text-xs font-medium text-emerald-600 mb-1">{stat.change}</span>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Configuration */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
        <div className="flex items-center gap-2 mb-5">
          <Settings className="w-4 h-4 text-[#716D5C]" />
          <h3 className="text-sm font-semibold text-[#262626]">Configuration</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Voice Selection */}
          <div>
            <label className="text-[10px] font-bold text-[#716D5C] uppercase tracking-wider block mb-2">
              Voix de l'agent
            </label>
            <div className="relative">
              <button
                onClick={() => setShowVoiceDropdown(!showVoiceDropdown)}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-[#F5F5F0] border border-gray-200 rounded-xl text-sm text-[#262626] hover:border-[#0F5F35]/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Mic className="w-4 h-4 text-[#0F5F35]" />
                  <span>{currentVoice?.name} — {currentVoice?.style}</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-[#716D5C] transition-transform ${showVoiceDropdown ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {showVoiceDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="absolute z-10 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-lg overflow-hidden"
                  >
                    {VOICE_OPTIONS.map((voice) => (
                      <button
                        key={voice.id}
                        onClick={() => {
                          setSelectedVoice(voice.id)
                          setShowVoiceDropdown(false)
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-[#F5F5F0] transition-colors ${
                          selectedVoice === voice.id ? 'bg-[#0F5F35]/5 text-[#0F5F35]' : 'text-[#262626]'
                        }`}
                      >
                        <Volume2 className="w-4 h-4" />
                        <span className="font-medium">{voice.name}</span>
                        <span className="text-[#716D5C]">— {voice.style}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Language Selector */}
          <div>
            <label className="text-[10px] font-bold text-[#716D5C] uppercase tracking-wider block mb-2">
              Langue
            </label>
            <div className="flex gap-2">
              {LANGUAGE_OPTIONS.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => setSelectedLanguage(lang.code)}
                  className={`flex-1 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    selectedLanguage === lang.code
                      ? 'bg-[#0F5F35] text-white shadow-sm'
                      : 'bg-[#F5F5F0] text-[#262626] hover:bg-gray-200'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>

          {/* Max Duration Slider */}
          <div>
            <label className="text-[10px] font-bold text-[#716D5C] uppercase tracking-wider block mb-2">
              Duree max d'appel
            </label>
            <div className="space-y-2">
              <input
                type="range"
                min={1}
                max={15}
                value={maxDuration}
                onChange={(e) => setMaxDuration(Number(e.target.value))}
                className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-[#0F5F35]"
              />
              <div className="flex justify-between text-xs text-[#716D5C]">
                <span>1 min</span>
                <span className="font-semibold text-[#0F5F35]">{maxDuration} min</span>
                <span>15 min</span>
              </div>
            </div>
          </div>

          {/* Greeting Message */}
          <div>
            <label className="text-[10px] font-bold text-[#716D5C] uppercase tracking-wider block mb-2">
              Message d'accueil
            </label>
            <textarea
              value={greetingMessage}
              onChange={(e) => setGreetingMessage(e.target.value)}
              rows={3}
              className="w-full px-4 py-2.5 bg-[#F5F5F0] border border-gray-200 rounded-xl text-sm text-[#262626] resize-none focus:outline-none focus:ring-2 focus:ring-[#0F5F35]/20 focus:border-[#0F5F35]/30 transition-all"
              placeholder="Entrez le message d'accueil..."
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSaveConfig}
            className="px-5 py-2.5 bg-[#0F5F35] text-white text-sm font-medium rounded-full hover:bg-[#003725] transition-colors"
          >
            Sauvegarder la configuration
          </motion.button>
        </div>
      </div>

      {/* Recent Calls */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <PhoneIncoming className="w-4 h-4 text-[#716D5C]" />
            <h3 className="text-sm font-semibold text-[#262626]">Appels recents</h3>
          </div>
          <span className="text-[10px] font-bold text-[#716D5C] uppercase tracking-wider">
            Derniers 7 jours
          </span>
        </div>

        <div className="space-y-2">
          {MOCK_CALLS.map((call) => {
            const statusCfg = STATUS_CONFIG[call.status]
            const StatusIcon = statusCfg.icon
            return (
              <motion.div
                key={call.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center justify-between px-4 py-3 rounded-xl hover:bg-[#F5F5F0] transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-[#003725]/10 flex items-center justify-center flex-shrink-0">
                    <Users className="w-4 h-4 text-[#003725]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#262626] truncate">{call.caller}</p>
                    <p className="text-xs text-[#716D5C] truncate">{call.reason}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  <div className="flex items-center gap-1 text-xs text-[#716D5C]">
                    <Clock className="w-3 h-3" />
                    <span>{call.duration}</span>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusCfg.color}`}>
                    <StatusIcon className="w-3 h-3" />
                    {statusCfg.label}
                  </span>
                  <span className="text-xs text-[#716D5C] hidden sm:block w-24 text-right">
                    {formatTimestamp(call.timestamp)}
                  </span>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Escalade Vocale */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-[#716D5C]" />
            <h3 className="text-sm font-semibold text-[#262626]">Escalade vocale</h3>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              const newVal = !escaladeActive
              setEscaladeActive(newVal)
              saveConfig({ escalation_enabled: newVal })
              toast.success(newVal ? 'Escalade vocale activee' : 'Escalade vocale desactivee')
            }}
            className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${
              escaladeActive ? 'bg-[#0F5F35]' : 'bg-gray-300'
            }`}
          >
            <motion.div
              layout
              className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md"
              style={{ left: escaladeActive ? 'calc(100% - 22px)' : '2px' }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          </motion.button>
        </div>

        <div className="bg-[#F5F5F0] rounded-xl p-4 space-y-3">
          <p className="text-sm text-[#262626]">
            Lorsque l'agent vocal ne peut pas resoudre une demande, il transfere automatiquement
            l'appel vers un operateur humain.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 text-xs text-[#716D5C]">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-[#0F5F35] rounded-full" />
              <span>Detection automatique des demandes complexes</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-[#0F5F35] rounded-full" />
              <span>Message de transition personnalise</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-[#0F5F35] rounded-full" />
              <span>Contexte transmis a l'agent humain</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
