import React, { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Wand2, Save, Loader2, CheckCircle2, AlertCircle,
  Globe, MessageCircle, ShieldAlert, Package, Sparkles,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

const LANGUAGES = [
  { value: 'fr', label: 'Francais' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Espanol' },
  { value: 'de', label: 'Deutsch' },
  { value: 'it', label: 'Italiano' },
  { value: 'pt', label: 'Portugues' },
  { value: 'nl', label: 'Nederlands' },
  { value: 'multi', label: 'Multilingue (auto-detect)' },
]

const TONE_PRESETS = [
  { value: 'professionnel et chaleureux', label: 'Professionnel & Chaleureux', desc: 'Ton equilibre, ideal pour la plupart des marques' },
  { value: 'casual et amical', label: 'Casual & Amical', desc: 'Tutoiement, emojis, proche du client' },
  { value: 'formel et premium', label: 'Formel & Premium', desc: 'Vouvoiement strict, vocabulaire soigne, luxe' },
  { value: 'technique et precis', label: 'Technique & Precis', desc: 'Reponses concises, factuelles, orientees solution' },
]

export const PromptEditor = ({ clientId, theme }) => {
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  const { data: settings, isLoading } = useQuery({
    queryKey: ['client-prompt-settings', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_settings')
        .select('*')
        .eq('client_id', clientId)
        .maybeSingle()
      if (error) throw error
      return data
    },
    enabled: !!clientId,
  })

  const [form, setForm] = useState({
    brand_tone: '',
    brand_language: 'fr',
    return_policy: '',
    excluded_products: '',
    custom_instructions: '',
    greeting_template: '',
  })

  useEffect(() => {
    if (settings) {
      setForm({
        brand_tone: settings.brand_tone || 'professionnel et chaleureux',
        brand_language: settings.brand_language || 'fr',
        return_policy: settings.return_policy || '',
        excluded_products: settings.excluded_products || '',
        custom_instructions: settings.custom_instructions || '',
        greeting_template: settings.greeting_template || '',
      })
    }
  }, [settings])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const { error: err } = await supabase
        .from('client_settings')
        .upsert({
          client_id: clientId,
          ...form,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'client_id' })
      if (err) throw err
      setSaved(true)
      queryClient.invalidateQueries({ queryKey: ['client-prompt-settings', clientId] })
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err.message)
    }
    setSaving(false)
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-[#716D5C]" />
      </div>
    )
  }

  const inputClass = "w-full px-4 py-3 bg-[#F9F7F1] border border-gray-200 rounded-xl text-sm text-[#262626] outline-none focus:ring-1 focus:ring-gray-300 placeholder-gray-400"

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
            <Wand2 className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[#262626]">Configuration de l'agent</h2>
            <p className="text-sm text-[#716D5C]">Personnalisez le comportement de votre agent IA sans code</p>
          </div>
        </div>
      </div>

      {/* Tone preset */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <MessageCircle className="w-4 h-4 text-[#003725]" />
          <h3 className="text-sm font-bold text-[#262626]">Ton de marque</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {TONE_PRESETS.map((preset) => (
            <button
              key={preset.value}
              onClick={() => setForm(f => ({ ...f, brand_tone: preset.value }))}
              className={`p-4 rounded-xl border text-left transition-all ${
                form.brand_tone === preset.value
                  ? 'bg-[#003725] text-white border-[#003725]'
                  : 'bg-white border-gray-200 hover:border-gray-300 text-[#262626]'
              }`}
            >
              <p className="font-bold text-sm">{preset.label}</p>
              <p className={`text-xs mt-1 ${form.brand_tone === preset.value ? 'text-white/70' : 'text-[#716D5C]'}`}>
                {preset.desc}
              </p>
            </button>
          ))}
        </div>
        <div className="mt-3">
          <input
            type="text"
            value={form.brand_tone}
            onChange={(e) => setForm(f => ({ ...f, brand_tone: e.target.value }))}
            placeholder="Ou ecrivez votre propre ton..."
            className={inputClass}
          />
        </div>
      </div>

      {/* Language */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-4 h-4 text-[#003725]" />
          <h3 className="text-sm font-bold text-[#262626]">Langue de l'agent</h3>
        </div>
        <select
          value={form.brand_language}
          onChange={(e) => setForm(f => ({ ...f, brand_language: e.target.value }))}
          className="w-full max-w-xs px-4 py-3 bg-[#F9F7F1] border border-gray-200 rounded-xl text-sm text-[#262626] outline-none focus:ring-1 focus:ring-gray-300 appearance-none cursor-pointer"
        >
          {LANGUAGES.map(l => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>
      </div>

      {/* Return policy */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <ShieldAlert className="w-4 h-4 text-[#003725]" />
          <h3 className="text-sm font-bold text-[#262626]">Politique de retour</h3>
          <span className="text-xs text-[#716D5C]">— L'agent utilisera ces regles pour traiter les demandes de retour</span>
        </div>
        <textarea
          value={form.return_policy}
          onChange={(e) => setForm(f => ({ ...f, return_policy: e.target.value }))}
          rows={4}
          placeholder="Ex: Retour gratuit sous 30 jours. Echange possible sous 14 jours. Les produits soldes ne sont ni repris ni echanges."
          className={inputClass + " resize-y"}
        />
      </div>

      {/* Excluded products */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Package className="w-4 h-4 text-[#003725]" />
          <h3 className="text-sm font-bold text-[#262626]">Produits exclus / regles speciales</h3>
          <span className="text-xs text-[#716D5C]">— Produits avec des regles differentes</span>
        </div>
        <textarea
          value={form.excluded_products}
          onChange={(e) => setForm(f => ({ ...f, excluded_products: e.target.value }))}
          rows={3}
          placeholder="Ex: Les coffrets cadeaux ne sont pas remboursables. Les produits personnalises ne peuvent pas etre retournes."
          className={inputClass + " resize-y"}
        />
      </div>

      {/* Greeting template */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-[#003725]" />
          <h3 className="text-sm font-bold text-[#262626]">Message d'accueil</h3>
          <span className="text-xs text-[#716D5C]">— Comment l'agent se presente</span>
        </div>
        <textarea
          value={form.greeting_template}
          onChange={(e) => setForm(f => ({ ...f, greeting_template: e.target.value }))}
          rows={2}
          placeholder="Ex: Bonjour ! Je suis l'assistant de [NOM DE LA MARQUE]. Comment puis-je vous aider ?"
          className={inputClass + " resize-y"}
        />
      </div>

      {/* Custom instructions */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Wand2 className="w-4 h-4 text-[#003725]" />
          <h3 className="text-sm font-bold text-[#262626]">Instructions personnalisees</h3>
          <span className="text-xs text-[#716D5C]">— Instructions libres pour affiner le comportement</span>
        </div>
        <textarea
          value={form.custom_instructions}
          onChange={(e) => setForm(f => ({ ...f, custom_instructions: e.target.value }))}
          rows={5}
          placeholder="Ex: Toujours proposer un code promo de 10% si le client hesite. Mentionner le programme de fidelite dans les reponses aux clients reguliers."
          className={inputClass + " resize-y"}
        />
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-[#0F5F35] text-white rounded-full text-sm font-bold hover:bg-[#003725] transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Enregistrer la configuration
        </button>
        {saved && (
          <span className="text-sm text-[#003725] flex items-center gap-1 font-medium">
            <CheckCircle2 className="w-4 h-4" /> Configuration sauvegardee
          </span>
        )}
        {error && (
          <span className="text-sm text-red-500 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" /> {error}
          </span>
        )}
      </div>
    </div>
  )
}
