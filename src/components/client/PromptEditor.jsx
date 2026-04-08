import React, { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Wand2, Save, Loader2, CheckCircle2, AlertCircle,
  Globe, MessageCircle, ShieldAlert, Package, Sparkles,
  ShoppingBag, Crown, Building2, Headphones, Zap, ChevronDown,
  Upload, Link2, FileText, Plus, Trash2, Pencil, X,
} from 'lucide-react'
import { useToast } from '../ui/Toast'
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

const AGENT_TEMPLATES = [
  {
    id: 'sav_standard',
    label: 'SAV E-commerce Standard',
    desc: 'Retours, suivi colis, remboursements, FAQ produits',
    icon: ShoppingBag,
    color: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    config: {
      brand_tone: 'professionnel et chaleureux',
      brand_language: 'fr',
      return_policy: 'Retour gratuit sous 30 jours. Le client doit fournir le numero de commande. Remboursement sous 5-7 jours ouvrés apres reception du colis retour.',
      custom_instructions: 'Tu es un agent SAV pour une boutique e-commerce. Tes priorites :\n1. Toujours demander le numero de commande en premier\n2. Verifier le statut de la commande avant de repondre\n3. Proposer une solution concrete (remboursement, echange, avoir)\n4. Si le probleme est complexe, escalader vers un humain\n5. Toujours terminer en demandant si le client a besoin d\'autre chose',
      greeting_template: 'Bonjour ! Merci de contacter notre service client. Comment puis-je vous aider aujourd\'hui ?',
    },
  },
  {
    id: 'sav_premium',
    label: 'SAV Premium + Upsell',
    desc: 'SAV complet + recommandations produits, fidelite, codes promo',
    icon: Crown,
    color: 'bg-violet-50 text-violet-600 border-violet-200',
    config: {
      brand_tone: 'formel et premium',
      brand_language: 'fr',
      return_policy: 'Retour gratuit sous 30 jours avec etiquette prepayee. Echange prioritaire. Remboursement immediat pour les clients fideles.',
      custom_instructions: 'Tu es un agent SAV premium. En plus du support classique :\n1. Recommande des produits complementaires quand c\'est pertinent\n2. Propose un code promo -10% si le client est mecontent (code: SORRY10)\n3. Mentionne le programme de fidelite si le client a 3+ commandes\n4. Traite chaque client comme un VIP\n5. Utilise le vouvoiement exclusivement',
      greeting_template: 'Bonjour et bienvenue ! C\'est un plaisir de vous accompagner. En quoi puis-je vous etre utile ?',
    },
  },
  {
    id: 'immo_leads',
    label: 'Immobilier - Qualification Leads',
    desc: 'Qualification leads, disponibilites, prise de RDV visite',
    icon: Building2,
    color: 'bg-blue-50 text-blue-600 border-blue-200',
    config: {
      brand_tone: 'professionnel et chaleureux',
      brand_language: 'fr',
      return_policy: '',
      custom_instructions: 'Tu es un agent IA pour une agence immobiliere. Tes missions :\n1. Qualifier les leads : budget, secteur recherche, type de bien, delai\n2. Verifier la disponibilite des biens demandes\n3. Proposer des creneaux de visite\n4. Repondre aux questions sur les biens (surface, prix, charges, DPE)\n5. Si le lead est qualifie, proposer un RDV avec un agent humain\n6. Ne jamais inventer d\'informations sur un bien',
      greeting_template: 'Bonjour ! Bienvenue dans notre agence. Vous recherchez un bien a l\'achat ou a la location ?',
    },
  },
  {
    id: 'immo_gestion',
    label: 'Immobilier - Gestion Locative',
    desc: 'Incidents locataires, relances loyer, etats des lieux',
    icon: Headphones,
    color: 'bg-amber-50 text-amber-600 border-amber-200',
    config: {
      brand_tone: 'professionnel et chaleureux',
      brand_language: 'fr',
      return_policy: '',
      custom_instructions: 'Tu es un agent IA pour la gestion locative. Tes missions :\n1. Enregistrer les signalements d\'incidents (fuite, panne, bruit)\n2. Donner les delais d\'intervention estimés\n3. Repondre aux questions sur le bail et les charges\n4. Informer sur les procedures (etat des lieux, conge, depot de garantie)\n5. Escalader vers le gestionnaire pour les urgences (degat des eaux, serrure)\n6. Rester neutre et factuel, ne pas prendre parti',
      greeting_template: 'Bonjour ! Service de gestion locative. Comment puis-je vous aider ?',
    },
  },
  {
    id: 'support_technique',
    label: 'Support Technique / SaaS',
    desc: 'Troubleshooting, tickets, documentation, onboarding',
    icon: Zap,
    color: 'bg-cyan-50 text-cyan-600 border-cyan-200',
    config: {
      brand_tone: 'technique et precis',
      brand_language: 'fr',
      return_policy: '',
      custom_instructions: 'Tu es un agent de support technique. Tes priorites :\n1. Identifier le probleme exact (reproduire les etapes)\n2. Proposer des solutions etape par etape\n3. Rediriger vers la documentation si pertinent\n4. Creer un ticket si le probleme necessite une investigation\n5. Fournir un numero de ticket pour le suivi\n6. Pas de jargon inutile, etre clair et actionnable',
      greeting_template: 'Bonjour ! Support technique ici. Decrivez le probleme que vous rencontrez et je vous aide a le resoudre.',
    },
  },
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
        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-[#262626] outline-none focus:ring-1 focus:ring-[#0F5F35]/30"
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-[#262626] outline-none resize-y focus:ring-1 focus:ring-[#0F5F35]/30"
      />
      <div className="flex gap-2">
        <button onClick={() => onSave(title, content)} className="px-3 py-1.5 bg-[#0F5F35] text-white text-xs font-bold rounded-lg hover:bg-[#003725]">Sauvegarder</button>
        <button onClick={onCancel} className="px-3 py-1.5 text-xs font-medium text-[#716D5C] hover:text-[#262626]">Annuler</button>
      </div>
    </div>
  )
}

export const PromptEditor = ({ clientId, theme }) => {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)
  const [showTemplates, setShowTemplates] = useState(false)
  const [activeTemplate, setActiveTemplate] = useState(null)
  const [importUrl, setImportUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [editingKb, setEditingKb] = useState(null)
  const [showAddManual, setShowAddManual] = useState(false)
  const [manualTitle, setManualTitle] = useState('')
  const [manualContent, setManualContent] = useState('')

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

  // Fetch existing KB entries
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

  const handleApplyTemplate = (template) => {
    setForm(f => ({
      ...f,
      ...template.config,
    }))
    setActiveTemplate(template.id)
    setShowTemplates(false)
    toast.success(`Modele "${template.label}" applique — pensez a sauvegarder`)
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

      {/* Template Selector */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <button
          onClick={() => setShowTemplates(!showTemplates)}
          className="w-full p-5 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#003725] to-[#0F5F35] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <p className="font-bold text-sm text-[#262626]">
                {activeTemplate ? `Modele : ${AGENT_TEMPLATES.find(t => t.id === activeTemplate)?.label}` : 'Partir d\'un modele pre-configure'}
              </p>
              <p className="text-xs text-[#716D5C]">
                {activeTemplate ? 'Cliquez pour changer de modele' : '5 templates optimises pour demarrer en 30 secondes'}
              </p>
            </div>
          </div>
          <ChevronDown className={`w-5 h-5 text-[#716D5C] transition-transform ${showTemplates ? 'rotate-180' : ''}`} />
        </button>

        {showTemplates && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="border-t border-gray-100 p-5 space-y-2"
          >
            {AGENT_TEMPLATES.map(template => {
              const Icon = template.icon
              return (
                <button
                  key={template.id}
                  onClick={() => handleApplyTemplate(template)}
                  className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                    activeTemplate === template.id
                      ? 'border-[#0F5F35] bg-emerald-50/50'
                      : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center border ${template.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-[#262626]">{template.label}</p>
                    <p className="text-xs text-[#716D5C] truncate">{template.desc}</p>
                  </div>
                  {activeTemplate === template.id && (
                    <CheckCircle2 className="w-5 h-5 text-[#0F5F35] flex-shrink-0" />
                  )}
                </button>
              )
            })}
          </motion.div>
        )}
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

      {/* Base de connaissances — Import */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#003725]" />
            <h3 className="text-sm font-bold text-[#262626]">Base de connaissances</h3>
          </div>
          {kbEntries.length > 0 && (
            <span className="text-xs text-[#716D5C] bg-[#F9F7F1] px-2 py-0.5 rounded-full">{kbEntries.length} entree{kbEntries.length > 1 ? 's' : ''}</span>
          )}
        </div>
        <p className="text-xs text-[#716D5C]">Importez vos FAQ, politiques et infos produits. L'agent les utilisera pour repondre aux clients.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* URL Import */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-[#716D5C] uppercase tracking-wider flex items-center gap-1">
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
                className="px-4 py-3 bg-[#0F5F35] text-white rounded-xl text-sm font-bold hover:bg-[#003725] disabled:opacity-50 transition-colors flex-shrink-0"
              >
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-[#716D5C]">L'IA scrape la page et genere des FAQ automatiquement</p>
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-[#716D5C] uppercase tracking-wider flex items-center gap-1">
              <Upload className="w-3 h-3" /> Importer un fichier
            </label>
            <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-[#0F5F35]/30 hover:bg-[#F9F7F1] transition-all">
              {uploading ? (
                <><Loader2 className="w-4 h-4 animate-spin text-[#716D5C]" /><span className="text-sm text-[#716D5C]">Analyse...</span></>
              ) : (
                <><Upload className="w-4 h-4 text-[#716D5C]" /><span className="text-sm text-[#716D5C]">PDF, TXT, CSV — max 4 Mo</span></>
              )}
              <input type="file" accept=".pdf,.txt,.csv,.md,.doc,.docx" onChange={handleFileUpload} disabled={uploading} className="hidden" />
            </label>
            <p className="text-[10px] text-[#716D5C]">L'IA extrait les informations utiles du fichier</p>
          </div>
        </div>

        {/* Add manually */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          {!showAddManual ? (
            <button
              onClick={() => setShowAddManual(true)}
              className="flex items-center gap-2 text-sm font-medium text-[#0F5F35] hover:underline"
            >
              <Plus className="w-4 h-4" />
              Ajouter une entree manuellement
            </button>
          ) : (
            <div className="space-y-2 p-3 bg-[#F9F7F1] rounded-xl">
              <input
                type="text"
                value={manualTitle}
                onChange={(e) => setManualTitle(e.target.value)}
                placeholder="Titre (ex: Delais de livraison)"
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-[#262626] outline-none focus:ring-1 focus:ring-[#0F5F35]/30"
              />
              <textarea
                value={manualContent}
                onChange={(e) => setManualContent(e.target.value)}
                placeholder="Contenu (ex: La livraison est gratuite a partir de 50€. Delai: 2-5 jours ouvres.)"
                rows={3}
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-[#262626] outline-none resize-y focus:ring-1 focus:ring-[#0F5F35]/30"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAddManual}
                  disabled={!manualTitle.trim() || !manualContent.trim()}
                  className="px-4 py-1.5 bg-[#0F5F35] text-white text-xs font-bold rounded-lg hover:bg-[#003725] disabled:opacity-50"
                >
                  Ajouter
                </button>
                <button onClick={() => { setShowAddManual(false); setManualTitle(''); setManualContent('') }} className="px-3 py-1.5 text-xs text-[#716D5C] hover:text-[#262626]">
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Entries list */}
        {kbEntries.length > 0 && (
          <div className="space-y-2 mt-4 pt-4 border-t border-gray-100">
            {kbEntries.map(entry => (
              <div key={entry.id} className="p-3 bg-[#F9F7F1] rounded-xl">
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
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-200 text-[#716D5C]">{entry.category}</span>
                        <p className="text-sm font-semibold text-[#262626] truncate">{entry.title}</p>
                      </div>
                      <p className="text-xs text-[#716D5C] line-clamp-2">{entry.content}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => setEditingKb(entry.id)} className="p-1.5 rounded-lg text-[#716D5C] hover:bg-white hover:text-[#262626] transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDeleteKb(entry.id)} className="p-1.5 rounded-lg text-[#716D5C] hover:bg-red-50 hover:text-red-500 transition-colors">
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
