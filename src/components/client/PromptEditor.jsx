import React, { useState, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Wand2, Save, Loader2, CheckCircle2, AlertCircle,
  Globe, MessageCircle, ShieldAlert, Sparkles,
  ChevronLeft, ChevronRight,
  Upload, Link2, FileText, Plus, Trash2, Pencil, Building, BookOpen, Eye, Zap,
} from 'lucide-react'
import { useToast } from '../ui/Toast'
import { supabase } from '../../lib/supabase'
import { HelpTooltip } from '../ui/HelpTooltip'
import { QuickTestButton } from './QuickTestButton'

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

const STEPS = [
  { id: 'identity', label: 'Identite', icon: Building, desc: 'Marque & langue' },
  { id: 'tone', label: 'Ton', icon: MessageCircle, desc: 'Personnalite' },
  { id: 'rules', label: 'Regles', icon: ShieldAlert, desc: 'Règles & limites' },
  { id: 'knowledge', label: 'Connaissances', icon: BookOpen, desc: 'FAQ & infos' },
  { id: 'preview', label: 'Apercu', icon: Eye, desc: 'Prompt final' },
]

const EditKbEntry = ({ entry, onSave, onCancel }) => {
  const [title, setTitle] = useState(entry.title)
  const [content, setContent] = useState(entry.content)
  return (
    <div className="space-y-2">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full px-3 py-2 bg-[#fafafa] border border-[#ebebeb] rounded-lg text-[13px] text-[#1a1a1a] outline-none focus:ring-1 focus:ring-cta/30"
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        className="w-full px-3 py-2 bg-[#fafafa] border border-[#ebebeb] rounded-lg text-[13px] text-[#1a1a1a] outline-none resize-y focus:ring-1 focus:ring-cta/30"
      />
      <div className="flex gap-2">
        <button onClick={() => onSave(title, content)} className="px-3 py-1.5 bg-cta text-white text-[12px] font-semibold rounded-lg hover:bg-[#003725]">Sauvegarder</button>
        <button onClick={onCancel} className="px-3 py-1.5 text-xs font-medium text-[#9ca3af] hover:text-[#1a1a1a]">Annuler</button>
      </div>
    </div>
  )
}

export const PromptEditor = ({ clientId, theme }) => {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [currentStep, setCurrentStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)
  const [importUrl, setImportUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [editingKb, setEditingKb] = useState(null)
  const [showAddManual, setShowAddManual] = useState(false)
  const [manualTitle, setManualTitle] = useState('')
  const [manualContent, setManualContent] = useState('')
  const [newAbsoluteRule, setNewAbsoluteRule] = useState('')

  const inputClass = "w-full px-4 py-3 bg-[#fafafa] border border-[#ebebeb] rounded-lg text-[13px] text-[#1a1a1a] outline-none focus:ring-1 focus:ring-cta/20 placeholder-gray-400"

  // -------- Data fetching --------
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

  const { data: kbEntries = [] } = useQuery({
    queryKey: ['kb-entries', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_knowledge_base')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
    enabled: !!clientId,
  })

  const { data: guardrails = [] } = useQuery({
    queryKey: ['pe-guardrails', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_guardrails')
        .select('*')
        .eq('client_id', clientId)
        .order('priority', { ascending: true })
      if (error) throw error
      return data || []
    },
    enabled: !!clientId,
  })

  // -------- Form state --------
  const [form, setForm] = useState({
    brand_tone: '',
    brand_language: 'fr',
    supported_languages: ['fr', 'en'],
    return_policy: '',
    excluded_products: '',
    custom_instructions: '',
    greeting_template: '',
    brand_identity: '',
    tone_style: '',
    example_responses: [],
    tone_formality: 30,
    tone_warmth: 70,
    tone_detail: 50,
  })

  useEffect(() => {
    if (settings) {
      setForm({
        brand_tone: settings.brand_tone || 'professionnel et chaleureux',
        brand_language: settings.brand_language || 'fr',
        supported_languages: Array.isArray(settings.supported_languages) && settings.supported_languages.length > 0
          ? settings.supported_languages
          : ['fr', 'en'],
        return_policy: settings.return_policy || '',
        excluded_products: settings.excluded_products || '',
        custom_instructions: settings.custom_instructions || '',
        greeting_template: settings.greeting_template || '',
        tone_formality: settings.tone_formality ?? 30,
        tone_warmth: settings.tone_warmth ?? 70,
        tone_detail: settings.tone_detail ?? 50,
        brand_identity: settings.brand_identity || '',
        tone_style: settings.tone_style || '',
        example_responses: Array.isArray(settings.example_responses) ? settings.example_responses : [],
      })
    }
  }, [settings])

  // -------- Auto-save (Feature 18) --------
  const saveTimer = useRef(null)
  const isHydratedRef = useRef(false)
  useEffect(() => {
    if (!settings) return
    if (!isHydratedRef.current) {
      isHydratedRef.current = true
      return
    }
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      try {
        await supabase.from('client_settings').upsert({
          client_id: clientId,
          brand_identity: form.brand_identity,
          tone_style: form.tone_style,
          tone_formality: form.tone_formality,
          tone_warmth: form.tone_warmth,
          tone_detail: form.tone_detail,
          example_responses: form.example_responses,
          brand_language: form.brand_language,
          supported_languages: form.supported_languages,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'client_id' })
        queryClient.invalidateQueries({ queryKey: ['client-prompt-settings', clientId] })
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      } catch { /* ignore */ }
    }, 900)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.brand_identity, form.tone_style, form.example_responses, form.tone_formality, form.tone_warmth, form.tone_detail, form.brand_language, form.supported_languages])

  // -------- Knowledge Base actions --------
  const handleAddManual = async () => {
    if (!manualTitle.trim() || !manualContent.trim()) return
    await supabase.from('client_knowledge_base').insert({
      client_id: clientId,
      category: 'faq',
      title: manualTitle.trim(),
      content: manualContent.trim(),
    })
    queryClient.invalidateQueries({ queryKey: ['kb-entries', clientId] })
    setManualTitle('')
    setManualContent('')
    setShowAddManual(false)
    toast.success('Entree ajoutee')
  }

  const handleDeleteKb = async (id) => {
    await supabase.from('client_knowledge_base').delete().eq('id', id)
    queryClient.invalidateQueries({ queryKey: ['kb-entries', clientId] })
    toast.success('Entree supprimee')
  }

  const handleUpdateKb = async (id, title, content) => {
    await supabase.from('client_knowledge_base').update({ title, content, updated_at: new Date().toISOString() }).eq('id', id)
    queryClient.invalidateQueries({ queryKey: ['kb-entries', clientId] })
    setEditingKb(null)
    toast.success('Entree modifiee')
  }

  const handleImportUrl = async () => {
    if (!importUrl.trim()) return
    setImporting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/knowledge/import-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ url: importUrl.trim(), client_id: clientId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur')
      toast.success(`${data.imported} entrees importees`)
      setImportUrl('')
      queryClient.invalidateQueries({ queryKey: ['kb-entries', clientId] })
    } catch (err) {
      toast.error(err.message)
    }
    setImporting(false)
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 4 * 1024 * 1024) { toast.error('Fichier trop volumineux (max 4 Mo)'); return }
    setUploading(true)
    try {
      const text = await file.text()
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/knowledge/import-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ content: text.substring(0, 50000), filename: file.name, client_id: clientId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur')
      toast.success(`${data.imported} entrees importees depuis "${file.name}"`)
      queryClient.invalidateQueries({ queryKey: ['kb-entries', clientId] })
    } catch (err) {
      toast.error(err.message)
    }
    setUploading(false)
    e.target.value = ''
  }

  // -------- Guardrails actions --------
  const handleAddAbsoluteRule = async () => {
    if (!newAbsoluteRule.trim()) return
    const { error } = await supabase.from('client_guardrails').insert({
      client_id: clientId,
      rule_text: newAbsoluteRule.trim(),
      is_enabled: true,
      priority: guardrails.length,
    })
    if (!error) {
      setNewAbsoluteRule('')
      queryClient.invalidateQueries({ queryKey: ['pe-guardrails', clientId] })
    }
  }
  const handleDeleteAbsoluteRule = async (id) => {
    await supabase.from('client_guardrails').delete().eq('id', id)
    queryClient.invalidateQueries({ queryKey: ['pe-guardrails', clientId] })
  }

  // -------- Examples actions --------
  const handleAddExample = () => {
    setForm(f => ({ ...f, example_responses: [...(f.example_responses || []), { question: '', answer: '' }] }))
  }
  const handleUpdateExample = (i, key, value) => {
    setForm(f => ({
      ...f,
      example_responses: (f.example_responses || []).map((ex, idx) => idx === i ? { ...ex, [key]: value } : ex),
    }))
  }
  const handleRemoveExample = (i) => {
    setForm(f => ({ ...f, example_responses: (f.example_responses || []).filter((_, idx) => idx !== i) }))
  }

  // -------- Save (manual full save) --------
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

  // -------- Preview prompt builder --------
  const buildPreviewPrompt = () => {
    const brandName = 'Votre marque'
    let p = `Tu es un agent de support client IA professionnel pour "${brandName}".`
    p += ` Tu reponds aux demandes des clients de maniere ${form.brand_tone || 'professionnelle et chaleureuse'}.`
    if (form.brand_identity?.trim()) p += `\n\nIDENTITE DE MARQUE:\n${form.brand_identity.trim()}`
    const toneLines = []
    if (form.tone_formality != null) {
      if (form.tone_formality <= 33) toneLines.push('- Registre formel, vouvoiement.')
      else if (form.tone_formality >= 67) toneLines.push('- Registre casual, tutoiement possible.')
      else toneLines.push('- Registre equilibre.')
    }
    if (form.tone_warmth != null) {
      if (form.tone_warmth >= 67) toneLines.push('- Ton chaleureux et empathique.')
      else if (form.tone_warmth <= 33) toneLines.push('- Ton neutre et factuel.')
      else toneLines.push('- Ton cordial.')
    }
    if (form.tone_detail != null) {
      if (form.tone_detail >= 67) toneLines.push('- Reponses detaillees.')
      else if (form.tone_detail <= 33) toneLines.push('- Reponses concises.')
      else toneLines.push('- Reponses de longueur moyenne.')
    }
    if (toneLines.length > 0) p += `\n\nTON DE COMMUNICATION:\n${toneLines.join('\n')}`
    if (form.tone_style?.trim()) p += `\n\nSTYLE PARTICULIER:\n${form.tone_style.trim()}`
    if (guardrails.length > 0) {
      p += `\n\nREGLES D'EXCLUSION:\n${guardrails.filter(g => g.is_enabled).map((g, i) => `${i + 1}. ${g.rule_text}`).join('\n')}`
    }
    if (kbEntries.length > 0) {
      p += `\n\nBASE DE CONNAISSANCES:\n${kbEntries.slice(0, 50).map(k => `[${k.category}] ${k.title}: ${k.content}`).join('\n')}`
    }
    const exs = (form.example_responses || []).filter(e => e.question && e.answer)
    if (exs.length > 0) {
      p += `\n\nEXEMPLES DE BONNES REPONSES:\n${exs.slice(0, 8).map((ex, i) => `Exemple ${i + 1}:\nQuestion: ${ex.question}\nReponse: ${ex.answer}`).join('\n\n')}`
    }
    return p
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-[#9ca3af]" />
      </div>
    )
  }

  const step = STEPS[currentStep]
  const progress = ((currentStep + 1) / STEPS.length) * 100

  const goNext = () => {
    if (currentStep < STEPS.length - 1) setCurrentStep(currentStep + 1)
  }
  const goPrev = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1)
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
            <Wand2 className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h2
              className="text-2xl italic tracking-tight text-[#1a1a1a]"
              style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontWeight: 400 }}
            >
              Mon Agent
            </h2>
            <p className="text-[15px] text-[#5A5A5A]">Configure ton agent en {STEPS.length} étapes simples.</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {saved && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-600">
                <CheckCircle2 className="w-3.5 h-3.5" /> Sauvegarde
              </span>
            )}
            <QuickTestButton clientId={clientId} />
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="h-1 bg-[#f0f0f0] rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-cta"
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Step pills navigation */}
      <div className="grid grid-cols-5 gap-2 mb-8">
        {STEPS.map((s, i) => {
          const Icon = s.icon
          const isActive = i === currentStep
          const isCompleted = i < currentStep
          return (
            <button
              key={s.id}
              onClick={() => setCurrentStep(i)}
              className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all ${
                isActive
                  ? 'bg-cta/5 border-cta/30 shadow-[0_1px_3px_rgba(0,0,0,0.06)]'
                  : isCompleted
                    ? 'bg-white border-[#f0f0f0] hover:border-[#e5e5e5]'
                    : 'bg-white border-[#f0f0f0] hover:border-[#e5e5e5] opacity-70'
              }`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                isActive
                  ? 'bg-cta text-white'
                  : isCompleted
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-[#fafafa] text-[#9ca3af]'
              }`}>
                {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
              </div>
              <div className="text-center">
                <p className={`text-[11px] font-semibold leading-tight ${isActive ? 'text-[#1a1a1a]' : 'text-[#1a1a1a]'}`}>
                  {s.label}
                </p>
                <p className="text-[9px] text-[#9ca3af] leading-tight mt-0.5 hidden md:block">{s.desc}</p>
              </div>
            </button>
          )
        })}
      </div>

      {/* Step content */}
      <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-[#f0f0f0] p-6 md:p-8 min-h-[400px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={step.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {/* ============ STEP 1: IDENTITY ============ */}
            {step.id === 'identity' && (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                    <Building className="w-5 h-5 text-cta" />
                  </div>
                  <div>
                    <h3 className="text-[16px] font-semibold text-[#1a1a1a]">Identite de marque</h3>
                    <p className="text-[12px] text-[#9ca3af]">L'ADN de votre entreprise — l'agent va s'en inspirer pour parler comme vous</p>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-2 inline-flex items-center gap-1.5">
                    Decrivez votre marque
                    <HelpTooltip text="Nom, secteur, valeurs, clientèle cible. Plus c'est précis, plus l'agent répondra de manière cohérente avec votre image." />
                  </label>
                  <textarea
                    value={form.brand_identity}
                    onChange={(e) => setForm(f => ({ ...f, brand_identity: e.target.value }))}
                    rows={6}
                    placeholder={'ex: Marque de cosmetiques bio fondee en 2018, nos valeurs : transparence, naturel, fait en France. Clientele premium feminine 25-45 ans.'}
                    className={inputClass + ' resize-y'}
                  />
                  <p className="text-[10px] text-[#9ca3af] mt-2">Sauvegarde automatique au fil de la frappe</p>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-2 inline-flex items-center gap-1.5">
                    <Globe className="w-3 h-3" /> Langue de l'agent
                    <HelpTooltip text="Langue dans laquelle l'agent répondra. Choisissez 'Multilingue' pour qu'il s'adapte automatiquement à la langue du client." />
                  </label>
                  <select
                    value={form.brand_language}
                    onChange={(e) => setForm(f => ({ ...f, brand_language: e.target.value }))}
                    className="w-full max-w-md px-4 py-3 bg-[#fafafa] border border-[#ebebeb] rounded-lg text-[13px] text-[#1a1a1a] outline-none focus:ring-1 focus:ring-cta/20 appearance-none cursor-pointer"
                  >
                    {LANGUAGES.map(l => (
                      <option key={l.value} value={l.value}>{l.label}</option>
                    ))}
                  </select>

                  {/* ── Multilingue : whitelist des langues supportées ── */}
                  {form.brand_language === 'multi' && (
                    <div className="mt-4 p-4 rounded-xl bg-[#F9F7F1] border border-[#E8DFC9] max-w-md">
                      <div className="flex items-start gap-2 mb-3">
                        <Globe className="w-4 h-4 text-cta mt-0.5 flex-shrink-0" strokeWidth={2} />
                        <div>
                          <p className="text-[12.5px] font-bold text-[#1A1A1A]">Langues supportées</p>
                          <p className="text-[11.5px] text-[#716D5C] leading-[1.4] mt-0.5">
                            L'agent détectera la langue du client et répondra dans celle-ci si elle est cochée. Sinon, il répondra en français et proposera une aide humaine.
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {LANGUAGES.filter(l => l.value !== 'multi').map(l => {
                          const isOn = form.supported_languages.includes(l.value)
                          const disable = l.value === 'fr' && isOn && form.supported_languages.length === 1
                          return (
                            <button
                              key={l.value}
                              type="button"
                              onClick={() => {
                                if (disable) return
                                setForm(f => ({
                                  ...f,
                                  supported_languages: isOn
                                    ? f.supported_languages.filter(v => v !== l.value)
                                    : [...f.supported_languages, l.value],
                                }))
                              }}
                              className={`px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-colors ${
                                isOn
                                  ? 'bg-cta text-white border-cta'
                                  : 'bg-white text-[#5A5A5A] border-[#E8DFC9] hover:border-cta/40'
                              } ${disable ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
                              title={disable ? 'Au moins une langue doit rester active' : undefined}
                            >
                              {l.label}
                            </button>
                          )
                        })}
                      </div>
                      {form.supported_languages.length === 0 && (
                        <p className="text-[11px] text-red-600 mt-2">
                          Sélectionnez au moins une langue.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ============ STEP 2: TONE ============ */}
            {step.id === 'tone' && (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                    <MessageCircle className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-[16px] font-semibold text-[#1a1a1a]">Ton de votre agent</h3>
                    <p className="text-[12px] text-[#9ca3af]">Ajustez les curseurs — la previsualisation se met a jour en direct</p>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Slider 1 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold text-[#9ca3af] inline-flex items-center gap-1">
                        Formel
                        <HelpTooltip text="Niveau de formalite du langage. A gauche : vouvoiement et phrases soutenues. A droite : tutoiement et style decontracte." />
                      </span>
                      <span className="text-[11px] font-semibold text-[#9ca3af]">Casual</span>
                    </div>
                    <input
                      type="range" min="0" max="100" step="1"
                      value={form.tone_formality || 30}
                      onChange={(e) => setForm(f => ({ ...f, tone_formality: parseInt(e.target.value) }))}
                      className="w-full h-1.5 bg-[#f0f0f0] rounded-full appearance-none cursor-pointer accent-cta"
                    />
                  </div>

                  {/* Slider 2 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold text-[#9ca3af] inline-flex items-center gap-1">
                        Froid
                        <HelpTooltip text="Niveau d'empathie. À droite : l'agent reconnaît explicitement les émotions du client et personnalise sa réponse." />
                      </span>
                      <span className="text-[11px] font-semibold text-[#9ca3af]">Chaleureux</span>
                    </div>
                    <input
                      type="range" min="0" max="100" step="1"
                      value={form.tone_warmth || 70}
                      onChange={(e) => setForm(f => ({ ...f, tone_warmth: parseInt(e.target.value) }))}
                      className="w-full h-1.5 bg-[#f0f0f0] rounded-full appearance-none cursor-pointer accent-cta"
                    />
                  </div>

                  {/* Slider 3 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold text-[#9ca3af] inline-flex items-center gap-1">
                        Court
                        <HelpTooltip text="Longueur des reponses. A gauche : reponses concises (1-2 phrases). A droite : reponses detaillees avec contexte et etapes." />
                      </span>
                      <span className="text-[11px] font-semibold text-[#9ca3af]">Detaille</span>
                    </div>
                    <input
                      type="range" min="0" max="100" step="1"
                      value={form.tone_detail || 50}
                      onChange={(e) => setForm(f => ({ ...f, tone_detail: parseInt(e.target.value) }))}
                      className="w-full h-1.5 bg-[#f0f0f0] rounded-full appearance-none cursor-pointer accent-cta"
                    />
                  </div>
                </div>

                {/* Live preview */}
                <div className="p-4 bg-[#fafafa] rounded-xl border border-[#f0f0f0]">
                  <p className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-2">Previsualisation</p>
                  <p className="text-[13px] text-[#1a1a1a] leading-relaxed italic">
                    "{(form.tone_formality || 30) < 40
                      ? (form.tone_warmth || 70) > 60
                        ? 'Bonjour, merci pour votre message. Nous comprenons votre situation et allons faire le necessaire pour resoudre cela rapidement. N\'hesitez pas si vous avez d\'autres questions.'
                        : 'Bonjour. Nous avons bien recu votre demande. Notre equipe la traite dans les meilleurs delais. Cordialement.'
                      : (form.tone_warmth || 70) > 60
                        ? 'Hey ! Merci de nous avoir contactes ! On s\'occupe de ca tout de suite, pas de souci. Tu as besoin d\'autre chose ?'
                        : 'Salut ! On a bien recu ton message. On regarde ca et on te tient au courant. A bientot !'
                    }"
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-2 inline-flex items-center gap-1.5">
                    Style particulier (optionnel)
                    <HelpTooltip text="Indications de style libres : signature, expressions favorites, formulations a utiliser/eviter." />
                  </label>
                  <textarea
                    value={form.tone_style}
                    onChange={(e) => setForm(f => ({ ...f, tone_style: e.target.value }))}
                    rows={3}
                    placeholder={'ex: utilise des expressions francaises decontractees, signe toujours par "L\'equipe"'}
                    className={inputClass + ' resize-y'}
                  />
                </div>
              </div>
            )}

            {/* ============ STEP 3: RULES ============ */}
            {step.id === 'rules' && (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                    <ShieldAlert className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <h3 className="text-[16px] font-semibold text-[#1a1a1a]">Regles absolues</h3>
                    <p className="text-[12px] text-[#9ca3af]">"Toujours faire X, ne jamais faire Y" — l'agent respectera ces regles strictement</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newAbsoluteRule}
                    onChange={(e) => setNewAbsoluteRule(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddAbsoluteRule() }}
                    placeholder='ex: Ne jamais proposer de remboursement sans escalade humaine'
                    className={inputClass}
                  />
                  <button
                    onClick={handleAddAbsoluteRule}
                    disabled={!newAbsoluteRule.trim()}
                    className="px-4 py-3 bg-cta text-white text-[12px] font-semibold rounded-lg hover:bg-[#003725] disabled:opacity-40 flex-shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {guardrails.length > 0 ? (
                  <div className="space-y-2">
                    {guardrails.map((g, i) => (
                      <div key={g.id} className="flex items-center gap-3 px-4 py-3 bg-[#fafafa] rounded-xl border border-[#f0f0f0]">
                        <div className="w-6 h-6 rounded-md bg-red-50 flex items-center justify-center flex-shrink-0">
                          <span className="text-[10px] font-bold text-red-500">{i + 1}</span>
                        </div>
                        <span className={`text-[13px] flex-1 ${g.is_enabled ? 'text-[#1a1a1a]' : 'text-[#9ca3af] line-through'}`}>{g.rule_text}</span>
                        <button onClick={() => handleDeleteAbsoluteRule(g.id)} className="p-1.5 rounded text-[#9ca3af] hover:bg-red-50 hover:text-red-500">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 border border-dashed border-[#ebebeb] rounded-2xl">
                    <ShieldAlert className="w-8 h-8 text-[#d4d4d4] mx-auto mb-2" />
                    <p className="text-[12px] text-[#9ca3af]">Aucune règle définie. Ajoutez votre première règle ci-dessus.</p>
                  </div>
                )}
              </div>
            )}

            {/* ============ STEP 4: KNOWLEDGE BASE ============ */}
            {step.id === 'knowledge' && (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-[16px] font-semibold text-[#1a1a1a]">Base de connaissances</h3>
                    <p className="text-[12px] text-[#9ca3af]">FAQ, politiques, infos produits — l'agent puise ici pour repondre {kbEntries.length > 0 && <span className="ml-1 text-cta font-semibold">{kbEntries.length} entree{kbEntries.length > 1 ? 's' : ''}</span>}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* URL Import */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider flex items-center gap-1">
                      <Link2 className="w-3 h-3" /> Importer depuis une URL
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={importUrl}
                        onChange={(e) => setImportUrl(e.target.value)}
                        placeholder="https://votre-site.com/faq"
                        className={inputClass}
                      />
                      <button
                        onClick={handleImportUrl}
                        disabled={!importUrl.trim() || importing}
                        className="px-4 py-3 bg-cta text-white rounded-lg text-[12px] font-semibold hover:bg-[#003725] disabled:opacity-50 transition-colors flex-shrink-0"
                      >
                        {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* File Upload */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider flex items-center gap-1">
                      <Upload className="w-3 h-3" /> Importer un fichier
                    </label>
                    <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-[#ebebeb] rounded-xl cursor-pointer hover:border-cta/30 hover:bg-[#f5f5f5] transition-all">
                      {uploading ? (
                        <><Loader2 className="w-4 h-4 animate-spin text-[#9ca3af]" /><span className="text-sm text-[#9ca3af]">Analyse...</span></>
                      ) : (
                        <><Upload className="w-4 h-4 text-[#9ca3af]" /><span className="text-sm text-[#9ca3af]">PDF, TXT, CSV — max 4 Mo</span></>
                      )}
                      <input type="file" accept=".pdf,.txt,.csv,.md,.doc,.docx" onChange={handleFileUpload} disabled={uploading} className="hidden" />
                    </label>
                  </div>
                </div>

                {/* Add manually */}
                {!showAddManual ? (
                  <button
                    onClick={() => setShowAddManual(true)}
                    className="flex items-center gap-2 text-sm font-medium text-cta hover:underline"
                  >
                    <Plus className="w-4 h-4" />
                    Ajouter une entree manuellement
                  </button>
                ) : (
                  <div className="space-y-2 p-4 bg-[#fafafa] rounded-xl border border-[#f0f0f0]">
                    <input
                      type="text"
                      value={manualTitle}
                      onChange={(e) => setManualTitle(e.target.value)}
                      placeholder="Titre (ex: Delais de livraison)"
                      className="w-full px-3 py-2 bg-white border border-[#ebebeb] rounded-lg text-[13px] text-[#1a1a1a] outline-none focus:ring-1 focus:ring-cta/30"
                    />
                    <textarea
                      value={manualContent}
                      onChange={(e) => setManualContent(e.target.value)}
                      placeholder="Contenu (ex: La livraison est gratuite a partir de 50€. Delai: 2-5 jours ouvres.)"
                      rows={3}
                      className="w-full px-3 py-2 bg-white border border-[#ebebeb] rounded-lg text-[13px] text-[#1a1a1a] outline-none resize-y focus:ring-1 focus:ring-cta/30"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleAddManual}
                        disabled={!manualTitle.trim() || !manualContent.trim()}
                        className="px-4 py-1.5 bg-cta text-white text-[12px] font-semibold rounded-lg hover:bg-[#003725] disabled:opacity-50"
                      >
                        Ajouter
                      </button>
                      <button onClick={() => { setShowAddManual(false); setManualTitle(''); setManualContent('') }} className="px-3 py-1.5 text-xs text-[#9ca3af] hover:text-[#1a1a1a]">
                        Annuler
                      </button>
                    </div>
                  </div>
                )}

                {/* Entries list */}
                {kbEntries.length > 0 && (
                  <div className="space-y-2 pt-4 border-t border-[#f0f0f0]">
                    <p className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-2">Entrees existantes</p>
                    {kbEntries.map(entry => (
                      <div key={entry.id} className="p-3 bg-[#fafafa] rounded-xl border border-[#f0f0f0]">
                        {editingKb === entry.id ? (
                          <EditKbEntry
                            entry={entry}
                            onSave={(title, content) => handleUpdateKb(entry.id, title, content)}
                            onCancel={() => setEditingKb(null)}
                          />
                        ) : (
                          <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white text-[#9ca3af] border border-[#f0f0f0]">{entry.category}</span>
                                <p className="text-[13px] font-semibold text-[#1a1a1a] truncate">{entry.title}</p>
                              </div>
                              <p className="text-[12px] text-[#9ca3af] line-clamp-2">{entry.content}</p>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button onClick={() => setEditingKb(entry.id)} className="p-1.5 rounded-lg text-[#9ca3af] hover:bg-white hover:text-[#1a1a1a] transition-colors">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleDeleteKb(entry.id)} className="p-1.5 rounded-lg text-[#9ca3af] hover:bg-red-50 hover:text-red-500 transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ============ STEP 5: PREVIEW + EXAMPLES ============ */}
            {step.id === 'preview' && (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
                    <Eye className="w-5 h-5 text-violet-600" />
                  </div>
                  <div>
                    <h3 className="text-[16px] font-semibold text-[#1a1a1a]">Exemples & Apercu</h3>
                    <p className="text-[12px] text-[#9ca3af]">Ajoutez des exemples de bonnes reponses, puis verifiez le prompt final</p>
                  </div>
                </div>

                {/* Examples */}
                <div>
                  <p className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-3 inline-flex items-center gap-1.5">
                    Exemples de bonnes reponses (few-shot)
                    <HelpTooltip text="Paires Question/Reponse que l'agent doit imiter en termes de ton et structure. 2-3 exemples suffisent generalement." />
                  </p>

                  <div className="space-y-3">
                    {(form.example_responses || []).map((ex, i) => (
                      <div key={i} className="p-3 bg-[#fafafa] rounded-xl border border-[#f0f0f0] space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af]">Exemple {i + 1}</span>
                          <button onClick={() => handleRemoveExample(i)} className="p-1 rounded text-[#9ca3af] hover:bg-red-50 hover:text-red-500">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <input
                          type="text"
                          value={ex.question || ''}
                          onChange={(e) => handleUpdateExample(i, 'question', e.target.value)}
                          placeholder="Question du client"
                          className="w-full px-3 py-2 bg-white border border-[#ebebeb] rounded-lg text-[12px] outline-none focus:ring-1 focus:ring-cta/30"
                        />
                        <textarea
                          value={ex.answer || ''}
                          onChange={(e) => handleUpdateExample(i, 'answer', e.target.value)}
                          placeholder="Reponse ideale que l'IA doit imiter"
                          rows={2}
                          className="w-full px-3 py-2 bg-white border border-[#ebebeb] rounded-lg text-[12px] outline-none focus:ring-1 focus:ring-cta/30 resize-y"
                        />
                      </div>
                    ))}
                    <button
                      onClick={handleAddExample}
                      className="w-full flex items-center justify-center gap-2 px-3 py-3 border border-dashed border-[#ebebeb] rounded-xl text-[12px] font-medium text-[#9ca3af] hover:border-cta/30 hover:text-cta hover:bg-cta/5 transition-all"
                    >
                      <Plus className="w-4 h-4" /> Ajouter un exemple
                    </button>
                  </div>
                </div>

                {/* Final prompt preview */}
                <div className="pt-4 border-t border-[#f0f0f0]">
                  <p className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-3 inline-flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3" /> Apercu du prompt final
                    <HelpTooltip text="C'est ce qui sera envoye a l'IA pour generer les reponses. Il se met a jour en temps reel selon vos parametres." />
                  </p>
                  <pre className="p-4 bg-[#0b0b0b] text-[#e5e5e5] rounded-xl text-[11px] font-mono leading-relaxed whitespace-pre-wrap overflow-x-auto max-h-[300px]">{buildPreviewPrompt()}</pre>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer navigation */}
      <div className="flex items-center justify-between mt-6">
        <button
          onClick={goPrev}
          disabled={currentStep === 0}
          className="flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium text-[#9ca3af] hover:text-[#1a1a1a] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Precedent
        </button>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#9ca3af]">Etape {currentStep + 1} / {STEPS.length}</span>
        </div>

        {currentStep < STEPS.length - 1 ? (
          <button
            onClick={goNext}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-cta text-white text-[13px] font-semibold rounded-full hover:bg-[#003725] transition-colors"
          >
            Suivant <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-cta text-white text-[13px] font-semibold rounded-full hover:bg-[#003725] disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Enregistrer la configuration
          </button>
        )}
      </div>

      {error && (
        <div className="mt-4 flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-[12px] text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}
    </div>
  )
}
