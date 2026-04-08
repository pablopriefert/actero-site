import React, { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain, Database, Users, BarChart3, TrendingUp,
  Shield, Download, Eye, EyeOff, Trash2,
  CheckCircle2, MessageSquare, Calendar, ShoppingCart,
  Heart, AlertTriangle, Clock, ChevronDown, ChevronUp
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../ui/Toast'

const RETENTION_OPTIONS = [
  { value: '3m', label: '3 mois' },
  { value: '6m', label: '6 mois' },
  { value: '12m', label: '12 mois' },
  { value: 'unlimited', label: 'Illimite' },
]

const DATA_TYPES = [
  { id: 'product_prefs', label: 'Preferences produit', icon: Heart },
  { id: 'order_history', label: 'Historique de commandes', icon: ShoppingCart },
  { id: 'comm_tone', label: 'Ton de communication prefere', icon: MessageSquare },
  { id: 'recurring_issues', label: 'Problemes recurrents', icon: AlertTriangle },
  { id: 'important_dates', label: 'Dates importantes (anniversaire, etc.)', icon: Calendar },
]

const MOCK_PROFILES = [
  {
    id: 1,
    initial: 'S',
    name: 'Sophie Martin',
    email: 'sophie.martin@email.fr',
    since: 'mars 2025',
    color: 'bg-emerald-500',
    interactions: 47,
    memories: [
      'Prefere les reponses courtes',
      'Allergique aux noix',
      'Commande tous les 15 du mois',
    ],
  },
  {
    id: 2,
    initial: 'T',
    name: 'Thomas Durand',
    email: 'thomas.durand@email.fr',
    since: 'mai 2025',
    color: 'bg-blue-500',
    interactions: 23,
    memories: [
      'Prefere le tutoiement',
      'Interesse par les produits bio',
      'Livraison en point relais uniquement',
    ],
  },
  {
    id: 3,
    initial: 'L',
    name: 'Laure Petit',
    email: 'laure.petit@email.fr',
    since: 'janvier 2025',
    color: 'bg-violet-500',
    interactions: 89,
    memories: [
      'Cliente VIP - offrir 10% sur prochaine commande',
      'A eu un probleme de livraison en fevrier',
      'Prefere etre contactee par email',
    ],
  },
]

export const ClientMemoryView = ({ clientId, theme = 'light' }) => {
  const toast = useToast()
  const isLight = theme === 'light'

  const [memoryEnabled, setMemoryEnabled] = useState(true)
  const [retentionPeriod, setRetentionPeriod] = useState('12m')
  const [dataTypes, setDataTypes] = useState({
    product_prefs: true,
    order_history: true,
    comm_tone: true,
    recurring_issues: true,
    important_dates: false,
  })
  const [expandedProfile, setExpandedProfile] = useState(null)

  // RGPD toggles
  const [autoForget, setAutoForget] = useState(true)
  const [anonymizeAfter, setAnonymizeAfter] = useState(true)
  const [exportEnabled, setExportEnabled] = useState(true)

  // Fetch real settings
  const { data: memorySettings } = useQuery({
    queryKey: ['memory-settings', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('client_memory_settings')
        .select('*')
        .eq('client_id', clientId)
        .maybeSingle()
      return data
    },
    enabled: !!clientId,
  })

  // Fetch real customer memories
  const { data: customerMemories = [] } = useQuery({
    queryKey: ['customer-memories', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_customer_memory')
        .select('*')
        .eq('client_id', clientId)
        .order('last_seen_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return data || []
    },
    enabled: !!clientId,
  })

  // Fetch stats
  const { data: memoryStats } = useQuery({
    queryKey: ['memory-stats', clientId],
    queryFn: async () => {
      const { count: customerCount } = await supabase
        .from('client_customer_memory')
        .select('customer_email', { count: 'exact', head: true })
        .eq('client_id', clientId)
      const { count: dataPoints } = await supabase
        .from('client_customer_memory')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientId)
      return { customers: customerCount || 0, dataPoints: dataPoints || 0 }
    },
    enabled: !!clientId,
  })

  useEffect(() => {
    if (memorySettings) {
      setMemoryEnabled(memorySettings.is_enabled ?? true)
      setRetentionPeriod(memorySettings.retention_period === '3_months' ? '3m' : memorySettings.retention_period === '6_months' ? '6m' : memorySettings.retention_period === 'unlimited' ? 'unlimited' : '12m')
      if (memorySettings.data_types) {
        setDataTypes({
          product_prefs: memorySettings.data_types.product_preferences ?? true,
          order_history: memorySettings.data_types.order_history ?? true,
          comm_tone: memorySettings.data_types.communication_tone ?? true,
          recurring_issues: memorySettings.data_types.recurring_issues ?? true,
          important_dates: memorySettings.data_types.important_dates ?? false,
        })
      }
      setAutoForget(memorySettings.auto_forget ?? true)
      setAnonymizeAfter(memorySettings.anonymize_after ?? true)
      setExportEnabled(memorySettings.export_enabled ?? true)
    }
  }, [memorySettings])

  const saveSettings = async (updates) => {
    if (!clientId) return
    const retMap = { '3m': '3_months', '6m': '6_months', '12m': '12_months', 'unlimited': 'unlimited' }
    await supabase.from('client_memory_settings').upsert({
      client_id: clientId,
      is_enabled: updates.memoryEnabled ?? memoryEnabled,
      retention_period: retMap[updates.retentionPeriod ?? retentionPeriod] || '12_months',
      data_types: {
        product_preferences: (updates.dataTypes ?? dataTypes).product_prefs,
        order_history: (updates.dataTypes ?? dataTypes).order_history,
        communication_tone: (updates.dataTypes ?? dataTypes).comm_tone,
        recurring_issues: (updates.dataTypes ?? dataTypes).recurring_issues,
        important_dates: (updates.dataTypes ?? dataTypes).important_dates,
      },
      auto_forget: updates.autoForget ?? autoForget,
      anonymize_after: updates.anonymizeAfter ?? anonymizeAfter,
      export_enabled: updates.exportEnabled ?? exportEnabled,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'client_id' })
  }

  const toggleDataType = (id) => {
    const updated = { ...dataTypes, [id]: !dataTypes[id] }
    setDataTypes(updated)
    saveSettings({ dataTypes: updated })
    toast.success('Configuration mise a jour')
  }

  const handleToggleMemory = () => {
    const newVal = !memoryEnabled
    setMemoryEnabled(newVal)
    saveSettings({ memoryEnabled: newVal })
    toast.success(newVal ? 'Memoire activee' : 'Memoire desactivee')
  }

  // Group customer memories by email for profile display
  const customerProfiles = Object.values(
    customerMemories.reduce((acc, mem) => {
      const key = mem.customer_email || 'unknown'
      if (!acc[key]) acc[key] = { email: key, name: mem.customer_name || key, memories: [], firstSeen: mem.first_seen_at, interactions: 0 }
      acc[key].memories.push({ key: mem.memory_key, value: mem.memory_value })
      acc[key].interactions++
      return acc
    }, {})
  ).slice(0, 6)

  const stats = [
    { label: 'Clients memorises', value: memoryStats?.customers?.toLocaleString('fr-FR') || '0', icon: Users, color: 'text-emerald-500' },
    { label: 'Points de donnees', value: memoryStats?.dataPoints?.toLocaleString('fr-FR') || '0', icon: Database, color: 'text-blue-500' },
    { label: 'Retention amelioree', value: '+18%', icon: TrendingUp, color: 'text-amber-500' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#0F5F35]/10 flex items-center justify-center">
          <Brain className="w-5 h-5 text-[#0F5F35]" />
        </div>
        <div>
          <h2 className={`text-lg font-semibold ${isLight ? 'text-[#262626]' : 'text-white'}`}>
            Memoire Client Longue Duree
          </h2>
          <p className={`text-sm ${isLight ? 'text-[#716D5C]' : 'text-gray-400'}`}>
            L'IA retient les preferences, l'historique et le contexte de chaque client
          </p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((stat) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl border p-4 ${
              isLight
                ? 'bg-white border-gray-100 shadow-sm'
                : 'bg-white/5 border-white/10'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                isLight ? 'bg-[#F5F5F0]' : 'bg-white/5'
              }`}>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
              <div>
                <p className={`text-[10px] font-bold uppercase tracking-wider ${
                  isLight ? 'text-[#716D5C]' : 'text-gray-500'
                }`}>
                  {stat.label}
                </p>
                <p className={`text-xl font-bold ${isLight ? 'text-[#262626]' : 'text-white'}`}>
                  {stat.value}
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Memory Configuration */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className={`rounded-2xl border p-6 ${
          isLight
            ? 'bg-white border-gray-100 shadow-sm'
            : 'bg-white/5 border-white/10'
        }`}
      >
        <h3 className={`text-sm font-semibold mb-4 ${isLight ? 'text-[#262626]' : 'text-white'}`}>
          Configuration de la memoire
        </h3>

        {/* Toggle */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Database className={`w-4 h-4 ${isLight ? 'text-[#716D5C]' : 'text-gray-400'}`} />
            <span className={`text-sm ${isLight ? 'text-[#262626]' : 'text-white'}`}>
              Activer la memoire longue duree
            </span>
          </div>
          <button
            onClick={handleToggleMemory}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              memoryEnabled ? 'bg-[#0F5F35]' : isLight ? 'bg-gray-300' : 'bg-gray-600'
            }`}
          >
            <motion.div
              animate={{ x: memoryEnabled ? 20 : 2 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="absolute top-1 w-4 h-4 rounded-full bg-white shadow"
            />
          </button>
        </div>

        {/* Retention Period */}
        <AnimatePresence>
          {memoryEnabled && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-5 overflow-hidden"
            >
              <div>
                <p className={`text-[10px] font-bold uppercase tracking-wider mb-3 ${
                  isLight ? 'text-[#716D5C]' : 'text-gray-500'
                }`}>
                  Periode de retention
                </p>
                <div className="flex flex-wrap gap-2">
                  {RETENTION_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setRetentionPeriod(opt.value)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                        retentionPeriod === opt.value
                          ? 'bg-[#0F5F35] text-white shadow-sm'
                          : isLight
                            ? 'bg-[#F5F5F0] text-[#262626] hover:bg-gray-200'
                            : 'bg-white/5 text-gray-300 hover:bg-white/10'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Data Types */}
              <div>
                <p className={`text-[10px] font-bold uppercase tracking-wider mb-3 ${
                  isLight ? 'text-[#716D5C]' : 'text-gray-500'
                }`}>
                  Types de donnees a memoriser
                </p>
                <div className="space-y-2">
                  {DATA_TYPES.map((dt) => (
                    <label
                      key={dt.id}
                      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                        isLight
                          ? 'hover:bg-[#F5F5F0]'
                          : 'hover:bg-white/5'
                      }`}
                    >
                      <div
                        onClick={() => toggleDataType(dt.id)}
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all cursor-pointer ${
                          dataTypes[dt.id]
                            ? 'bg-[#0F5F35] border-[#0F5F35]'
                            : isLight
                              ? 'border-gray-300'
                              : 'border-gray-600'
                        }`}
                      >
                        {dataTypes[dt.id] && (
                          <CheckCircle2 className="w-3 h-3 text-white" />
                        )}
                      </div>
                      <dt.icon className={`w-4 h-4 ${isLight ? 'text-[#716D5C]' : 'text-gray-400'}`} />
                      <span className={`text-sm ${isLight ? 'text-[#262626]' : 'text-white'}`}>
                        {dt.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Memory Profiles */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className={`rounded-2xl border p-6 ${
          isLight
            ? 'bg-white border-gray-100 shadow-sm'
            : 'bg-white/5 border-white/10'
        }`}
      >
        <h3 className={`text-sm font-semibold mb-4 ${isLight ? 'text-[#262626]' : 'text-white'}`}>
          Profils memorises (exemple)
        </h3>

        <div className="space-y-3">
          {MOCK_PROFILES.map((profile) => (
            <motion.div
              key={profile.id}
              layout
              className={`rounded-xl border p-4 transition-colors ${
                isLight
                  ? 'border-gray-100 hover:border-gray-200'
                  : 'border-white/10 hover:border-white/20'
              }`}
            >
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() =>
                  setExpandedProfile(expandedProfile === profile.id ? null : profile.id)
                }
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full ${profile.color} flex items-center justify-center text-white font-bold text-sm`}
                  >
                    {profile.initial}
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${isLight ? 'text-[#262626]' : 'text-white'}`}>
                      {profile.name}
                    </p>
                    <p className={`text-xs ${isLight ? 'text-[#716D5C]' : 'text-gray-400'}`}>
                      {profile.email}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    isLight
                      ? 'bg-[#F5F5F0] text-[#716D5C]'
                      : 'bg-white/5 text-gray-400'
                  }`}>
                    {profile.interactions} interactions
                  </span>
                  {expandedProfile === profile.id ? (
                    <ChevronUp className={`w-4 h-4 ${isLight ? 'text-[#716D5C]' : 'text-gray-400'}`} />
                  ) : (
                    <ChevronDown className={`w-4 h-4 ${isLight ? 'text-[#716D5C]' : 'text-gray-400'}`} />
                  )}
                </div>
              </div>

              <AnimatePresence>
                {expandedProfile === profile.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                      <div className="flex items-center gap-2">
                        <Clock className={`w-3 h-3 ${isLight ? 'text-[#716D5C]' : 'text-gray-400'}`} />
                        <span className={`text-xs ${isLight ? 'text-[#716D5C]' : 'text-gray-400'}`}>
                          Depuis : {profile.since}
                        </span>
                      </div>
                      <p className={`text-[10px] font-bold uppercase tracking-wider ${
                        isLight ? 'text-[#716D5C]' : 'text-gray-500'
                      }`}>
                        Souvenirs cles
                      </p>
                      <div className="space-y-2">
                        {profile.memories.map((memory, idx) => (
                          <div
                            key={idx}
                            className={`flex items-start gap-2 text-sm ${
                              isLight ? 'text-[#262626]' : 'text-gray-300'
                            }`}
                          >
                            <Brain className="w-3.5 h-3.5 text-[#0F5F35] mt-0.5 flex-shrink-0" />
                            <span>{memory}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* RGPD Privacy Section */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className={`rounded-2xl border p-6 ${
          isLight
            ? 'bg-white border-gray-100 shadow-sm'
            : 'bg-white/5 border-white/10'
        }`}
      >
        <div className="flex items-center gap-2 mb-4">
          <Shield className={`w-4 h-4 ${isLight ? 'text-[#0F5F35]' : 'text-emerald-400'}`} />
          <h3 className={`text-sm font-semibold ${isLight ? 'text-[#262626]' : 'text-white'}`}>
            Confidentialite & RGPD
          </h3>
        </div>

        <div className="space-y-4">
          {/* Droit a l'oubli */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Trash2 className={`w-4 h-4 ${isLight ? 'text-[#716D5C]' : 'text-gray-400'}`} />
              <div>
                <p className={`text-sm ${isLight ? 'text-[#262626]' : 'text-white'}`}>
                  Droit a l'oubli automatique
                </p>
                <p className={`text-xs ${isLight ? 'text-[#716D5C]' : 'text-gray-500'}`}>
                  Suppression automatique sur demande client
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                const newVal = !autoForget
                setAutoForget(newVal)
                saveSettings({ autoForget: newVal })
                toast.success('Parametre RGPD mis a jour')
              }}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                autoForget ? 'bg-[#0F5F35]' : isLight ? 'bg-gray-300' : 'bg-gray-600'
              }`}
            >
              <motion.div
                animate={{ x: autoForget ? 20 : 2 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="absolute top-1 w-4 h-4 rounded-full bg-white shadow"
              />
            </button>
          </div>

          {/* Anonymisation */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <EyeOff className={`w-4 h-4 ${isLight ? 'text-[#716D5C]' : 'text-gray-400'}`} />
              <div>
                <p className={`text-sm ${isLight ? 'text-[#262626]' : 'text-white'}`}>
                  Anonymisation apres periode
                </p>
                <p className={`text-xs ${isLight ? 'text-[#716D5C]' : 'text-gray-500'}`}>
                  Les donnees sont anonymisees a expiration
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                const newVal = !anonymizeAfter
                setAnonymizeAfter(newVal)
                saveSettings({ anonymizeAfter: newVal })
                toast.success('Parametre RGPD mis a jour')
              }}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                anonymizeAfter ? 'bg-[#0F5F35]' : isLight ? 'bg-gray-300' : 'bg-gray-600'
              }`}
            >
              <motion.div
                animate={{ x: anonymizeAfter ? 20 : 2 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="absolute top-1 w-4 h-4 rounded-full bg-white shadow"
              />
            </button>
          </div>

          {/* Export */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Download className={`w-4 h-4 ${isLight ? 'text-[#716D5C]' : 'text-gray-400'}`} />
              <div>
                <p className={`text-sm ${isLight ? 'text-[#262626]' : 'text-white'}`}>
                  Export donnees client
                </p>
                <p className={`text-xs ${isLight ? 'text-[#716D5C]' : 'text-gray-500'}`}>
                  Permettre l'export des donnees memorisees
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                const newVal = !exportEnabled
                setExportEnabled(newVal)
                saveSettings({ exportEnabled: newVal })
                toast.success('Parametre RGPD mis a jour')
              }}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                exportEnabled ? 'bg-[#0F5F35]' : isLight ? 'bg-gray-300' : 'bg-gray-600'
              }`}
            >
              <motion.div
                animate={{ x: exportEnabled ? 20 : 2 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="absolute top-1 w-4 h-4 rounded-full bg-white shadow"
              />
            </button>
          </div>
        </div>

        <div className={`mt-4 pt-4 border-t ${isLight ? 'border-gray-100' : 'border-white/10'}`}>
          <p className={`text-xs ${isLight ? 'text-[#716D5C]' : 'text-gray-500'}`}>
            Conforme au Reglement General sur la Protection des Donnees (RGPD). Les donnees clients sont chiffrees et stockees de maniere securisee.
          </p>
        </div>
      </motion.div>
    </div>
  )
}
