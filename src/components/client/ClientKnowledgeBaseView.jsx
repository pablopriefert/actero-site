import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookOpen, FileText, HelpCircle, Package, Palette, CalendarClock,
  Plus, Save, Trash2, Loader2, CheckCircle2, AlertCircle,
  ChevronRight, Clock, X, Globe, Link2, ShoppingBag, Zap, BarChart3,
  MessageCircle, Upload,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { KnowledgeImportModal } from './KnowledgeImportModal'
import { SkeletonList } from '../ui/Skeleton'

const CATEGORIES = [
  { id: 'policy', label: 'Politiques', icon: FileText, color: 'blue' },
  { id: 'faq', label: 'FAQ', icon: HelpCircle, color: 'emerald' },
  { id: 'product', label: 'Produits / Biens', icon: Package, color: 'amber' },
  { id: 'tone', label: 'Ton & Style', icon: Palette, color: 'violet' },
  { id: 'temporary', label: 'Infos temporaires', icon: CalendarClock, color: 'rose' },
]

const CATEGORY_COLORS = {
  blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  violet: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  rose: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
}

const POLICY_TEMPLATES = [
  { title: 'Politique de livraison', content: '' },
  { title: 'Politique de retour', content: '' },
  { title: 'Politique de remboursement', content: '' },
]

const PLACEHOLDERS = {
  policy: 'Décrivez vos conditions, délais, zones couvertes...',
  faq: 'Rédigez la réponse à cette question...',
  product: 'Décrivez les caractéristiques, tailles, prix...',
  tone: '',
  temporary: 'Décrivez l\'information temporaire...',
}

const syncBrandContext = async (clientId) => {
  try {
    await fetch('/api/sync-brand-context', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId }),
    })
  } catch (e) {
    console.error('Sync brand context error:', e)
  }
}

const Toast = ({ message, type = 'success', onClose }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 20 }}
    role={type === 'error' ? 'alert' : 'status'}
    aria-live={type === 'error' ? 'assertive' : 'polite'}
    aria-atomic="true"
    className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl border ${
      type === 'success'
        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
        : 'bg-red-500/10 border-red-500/20 text-red-400'
    }`}
  >
    {type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
    <span className="text-sm font-medium">{message}</span>
    <button onClick={onClose} className="ml-2" aria-label="Fermer la notification"><X className="w-3 h-3" /></button>
  </motion.div>
)

const ToneEditor = ({ entry, onSave, saving }) => {
  const reactId = React.useId()
  const ids = {
    tone: `kb-tone-${reactId}`,
    signature: `kb-tone-signature-${reactId}`,
    forbidden: `kb-tone-forbidden-${reactId}`,
    instructions: `kb-tone-instructions-${reactId}`,
  }
  const [form, setForm] = useState({
    tutoiement: false,
    tone: 'Professionnel',
    signature: '',
    forbidden: '',
    instructions: '',
  })

  useEffect(() => {
    if (entry?.content) {
      try {
        const parsed = JSON.parse(entry.content)
        setForm(parsed)
      } catch {
        setForm({ tutoiement: false, tone: 'Professionnel', signature: '', forbidden: '', instructions: entry.content })
      }
    }
  }, [entry])

  const handleSave = () => {
    onSave({ ...entry, title: 'Ton & Style', content: JSON.stringify(form) })
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <span id={`${reactId}-tutoiement-label`} className="text-sm font-bold text-[#71717a]">Tutoiement / Vouvoiement</span>
        <button
          type="button"
          role="switch"
          aria-checked={form.tutoiement}
          aria-labelledby={`${reactId}-tutoiement-label`}
          onClick={() => setForm(f => ({ ...f, tutoiement: !f.tutoiement }))}
          className={`relative w-12 h-6 rounded-full transition-colors ${form.tutoiement ? 'bg-blue-500' : 'bg-gray-200'}`}
        >
          <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${form.tutoiement ? 'translate-x-6' : 'translate-x-0.5'}`} />
        </button>
        <span className="text-xs text-[#71717a]">{form.tutoiement ? 'Tutoiement' : 'Vouvoiement'}</span>
      </div>

      <div>
        <label htmlFor={ids.tone} className="block text-xs font-bold text-[#71717a] uppercase tracking-wider mb-2">Ton</label>
        <select
          id={ids.tone}
          value={form.tone}
          onChange={(e) => setForm(f => ({ ...f, tone: e.target.value }))}
          className="w-full bg-gray-50 border border-[#E5E2D7] rounded-xl px-4 py-3 text-sm text-[#1a1a1a] outline-none"
        >
          {['Formel', 'Professionnel', 'Decontracte', 'Amical'].map(t => (
            <option key={t} value={t} className="bg-white">{t}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor={ids.signature} className="block text-xs font-bold text-[#71717a] uppercase tracking-wider mb-2">Signature email</label>
        <input
          id={ids.signature}
          type="text"
          value={form.signature}
          onChange={(e) => setForm(f => ({ ...f, signature: e.target.value }))}
          placeholder="L'equipe Bonne Gueule"
          className="w-full bg-gray-50 border border-[#E5E2D7] rounded-xl px-4 py-3 text-sm text-[#1a1a1a] outline-none"
        />
      </div>

      <div>
        <label htmlFor={ids.forbidden} className="block text-xs font-bold text-[#71717a] uppercase tracking-wider mb-2">Phrases ou mots interdits (un par ligne)</label>
        <textarea
          id={ids.forbidden}
          value={form.forbidden}
          onChange={(e) => setForm(f => ({ ...f, forbidden: e.target.value }))}
          rows={4}
          placeholder="je ne sais pas&#10;ce n'est pas possible"
          className="w-full bg-gray-50 border border-[#E5E2D7] rounded-xl px-4 py-3 text-sm text-[#1a1a1a] outline-none resize-none"
        />
      </div>

      <div>
        <label htmlFor={ids.instructions} className="block text-xs font-bold text-[#71717a] uppercase tracking-wider mb-2">Instructions speciales</label>
        <textarea
          id={ids.instructions}
          value={form.instructions}
          onChange={(e) => setForm(f => ({ ...f, instructions: e.target.value }))}
          rows={4}
          placeholder="Instructions supplementaires pour l'IA..."
          className="w-full bg-gray-50 border border-[#E5E2D7] rounded-xl px-4 py-3 text-sm text-[#1a1a1a] outline-none resize-none"
        />
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-white text-[#1a1a1a] hover:bg-gray-100 transition-all disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Enregistrer
      </button>
    </div>
  )
}

const EntryEditor = ({ entry, category, onSave, onDelete, onCancel, saving }) => {
  const reactId = React.useId()
  const ids = {
    title: `kb-entry-title-${reactId}`,
    content: `kb-entry-content-${reactId}`,
    expires: `kb-entry-expires-${reactId}`,
  }
  const [title, setTitle] = useState(entry?.title || '')
  const [content, setContent] = useState(entry?.content || '')
  const [expiresAt, setExpiresAt] = useState(entry?.expires_at ? entry.expires_at.split('T')[0] : '')

  const isFaq = category === 'faq'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-50 border border-[#E5E2D7] rounded-2xl p-5 space-y-4"
    >
      <div>
        <label htmlFor={ids.title} className="block text-xs font-bold text-[#71717a] uppercase tracking-wider mb-2">
          {isFaq ? 'Question' : 'Titre'}
        </label>
        <input
          id={ids.title}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={isFaq ? 'Comment suivre ma commande ?' : 'Titre...'}
          className="w-full bg-gray-50 border border-[#E5E2D7] rounded-xl px-4 py-3 text-sm text-[#1a1a1a] outline-none focus:border-gray-400"
        />
      </div>

      <div>
        <label htmlFor={ids.content} className="block text-xs font-bold text-[#71717a] uppercase tracking-wider mb-2">
          {isFaq ? 'Reponse' : 'Contenu'}
        </label>
        <textarea
          id={ids.content}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={6}
          placeholder={PLACEHOLDERS[category] || 'Contenu...'}
          className="w-full bg-gray-50 border border-[#E5E2D7] rounded-xl px-4 py-3 text-sm text-[#1a1a1a] outline-none resize-none focus:border-gray-400"
        />
      </div>

      {category === 'temporary' && (
        <div>
          <label htmlFor={ids.expires} className="block text-xs font-bold text-[#71717a] uppercase tracking-wider mb-2">Valide jusqu&apos;au</label>
          <input
            id={ids.expires}
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="bg-gray-50 border border-[#E5E2D7] rounded-xl px-4 py-3 text-sm text-[#1a1a1a] outline-none"
          />
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={() => onSave({ ...entry, title, content, expires_at: expiresAt ? new Date(expiresAt).toISOString() : null })}
          disabled={saving || !title.trim() || !content.trim()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-white text-[#1a1a1a] hover:bg-gray-100 transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Enregistrer
        </button>
        {entry?.id && (
          <button
            onClick={() => onDelete(entry.id)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-red-400 hover:bg-red-500/10 transition-all"
          >
            <Trash2 className="w-4 h-4" /> Supprimer
          </button>
        )}
        <button onClick={onCancel} className="px-4 py-2.5 rounded-xl text-sm font-bold text-[#71717a] hover:text-[#1a1a1a] transition-colors">
          Annuler
        </button>
      </div>
    </motion.div>
  )
}

export const ClientKnowledgeBaseView = ({ clientId, clientType, theme = 'dark' }) => {
  const queryClient = useQueryClient()
  const isLight = theme === 'light'
  const [selectedCategory, setSelectedCategory] = useState('policy')
  const [editingEntry, setEditingEntry] = useState(null)
  const [isCreating, setIsCreating] = useState(false)
  const [toast, setToast] = useState(null)

  const [importUrl, setImportUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showQA, setShowQA] = useState(false)
  const [showFileUpload, setShowFileUpload] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [importProvider, setImportProvider] = useState(null) // 'google_docs' | 'notion'

  // Check which external integrations are connected
  const { data: connectedProviders = [] } = useQuery({
    queryKey: ['kb-connected-providers', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('client_integrations')
        .select('provider')
        .eq('client_id', clientId)
        .eq('status', 'active')
        .in('provider', ['google_docs', 'notion'])
      return (data || []).map((r) => r.provider)
    },
    enabled: !!clientId,
  })
  const [qaQuestion, setQaQuestion] = useState('')
  const [qaAnswer, setQaAnswer] = useState('')

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  const handleImportUrl = async () => {
    if (!importUrl.trim()) return
    setImporting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/knowledge/import-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ url: importUrl.trim(), client_id: clientId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur import')
      queryClient.invalidateQueries({ queryKey: ['knowledge-base', clientId] })
      showToast(`${data.imported} entrees importees depuis l'URL`)
      setImportUrl('')
      setShowImport(false)
    } catch (err) {
      showToast(err.message || 'Erreur lors de l\'import', 'error')
    }
    setImporting(false)
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const maxSize = 4 * 1024 * 1024 // 4MB
    if (file.size > maxSize) {
      showToast('Fichier trop volumineux (max 4 Mo)', 'error')
      return
    }

    setUploading(true)
    try {
      // Read file content
      const text = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsText(file)
      })

      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/knowledge/import-file', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          content: text.substring(0, 50000),
          filename: file.name,
          client_id: clientId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur import')
      queryClient.invalidateQueries({ queryKey: ['knowledge-base', clientId] })
      showToast(`${data.imported} entrees importees depuis "${file.name}"`)
      setShowFileUpload(false)
    } catch (err) {
      showToast(err.message || 'Erreur lors de l\'import du fichier', 'error')
    }
    setUploading(false)
    e.target.value = '' // Reset file input
  }

  const handleAddQA = async () => {
    if (!qaQuestion.trim() || !qaAnswer.trim()) return
    // Check KB entries limit
    try {
      const { getLimit, getPlanConfig } = await import('../../lib/plans.js')
      const { data: clientRow } = await supabase.from('clients').select('plan').eq('id', clientId).maybeSingle()
      const plan = clientRow?.plan || 'free'
      const kbLimit = getLimit(plan, 'knowledge_entries')
      if (kbLimit !== Infinity && entries.length >= kbLimit) {
        showToast(`Limite atteinte : ${kbLimit} entrees sur le plan ${getPlanConfig(plan).name}. Passez au plan superieur.`)
        return
      }
    } catch { /* skip */ }
    await supabase.from('client_knowledge_base').insert({
      client_id: clientId,
      category: 'faq',
      title: qaQuestion.trim(),
      content: qaAnswer.trim(),
      sort_order: entries.length,
    })
    await syncBrandContext(clientId)
    queryClient.invalidateQueries({ queryKey: ['knowledge-base', clientId] })
    showToast('FAQ ajoutee')
    setQaQuestion('')
    setQaAnswer('')
    setSelectedCategory('faq')
  }

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['knowledge-base', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_knowledge_base')
        .select('*')
        .eq('client_id', clientId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!clientId,
  })

  const { data: lastSync } = useQuery({
    queryKey: ['kb-last-sync', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('clients')
        .select('updated_at')
        .eq('id', clientId)
        .single()
      return data?.updated_at
    },
    enabled: !!clientId,
  })

  const saveMutation = useMutation({
    mutationFn: async (entry) => {
      if (entry.id) {
        const { error } = await supabase
          .from('client_knowledge_base')
          .update({
            title: entry.title,
            content: entry.content,
            expires_at: entry.expires_at,
            is_active: entry.is_active !== false,
          })
          .eq('id', entry.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('client_knowledge_base')
          .insert({
            client_id: clientId,
            category: selectedCategory,
            title: entry.title,
            content: entry.content,
            expires_at: entry.expires_at,
            sort_order: filteredEntries.length,
          })
        if (error) throw error
      }
      await syncBrandContext(clientId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-base', clientId] })
      setEditingEntry(null)
      setIsCreating(false)
      showToast('Base de connaissances mise a jour. L\'IA utilise deja les nouvelles informations.')
    },
    onError: () => showToast('Erreur lors de la sauvegarde', 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('client_knowledge_base')
        .delete()
        .eq('id', id)
      if (error) throw error
      await syncBrandContext(clientId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-base', clientId] })
      setEditingEntry(null)
      showToast('Entree supprimee. L\'IA est a jour.')
    },
    onError: () => showToast('Erreur lors de la suppression', 'error'),
  })

  const filteredEntries = entries.filter(e => e.category === selectedCategory)
  const categoryConfig = CATEGORIES.find(c => c.id === selectedCategory)

  const getDaysUntilExpiry = (expiresAt) => {
    if (!expiresAt) return null
    const diff = new Date(expiresAt) - new Date()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return null
    const diff = (new Date() - new Date(dateStr)) / 1000 / 60
    if (diff < 1) return 'a l\'instant'
    if (diff < 60) return `il y a ${Math.round(diff)} min`
    if (diff < 1440) return `il y a ${Math.round(diff / 60)}h`
    return `il y a ${Math.round(diff / 1440)}j`
  }

  const productLabel = clientType === 'immobilier' ? 'bien' : 'produit'

  const coveragePct = Math.min(100, Math.round((entries.length / 10) * 100))

  return (
    <div className="max-w-5xl mx-auto space-y-5 animate-fade-in-up">
      {/* ═══════ HEADER STRIP ═══════ */}
      <div className="bg-white border border-[#E5E2D7] rounded-2xl p-5 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-cta/10 flex items-center justify-center">
                <BookOpen className="w-3.5 h-3.5 text-cta" />
              </div>
              <h1 className="text-lg font-bold text-[#1a1a1a]">Base de connaissances</h1>
              {entries.length > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-cta/10 text-cta text-[10px] font-bold rounded-full uppercase tracking-wider">
                  {entries.length} entrée{entries.length > 1 ? 's' : ''}
                </span>
              )}
              {entries.length < 5 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 text-[10px] font-bold rounded-full uppercase tracking-wider">
                  <AlertCircle className="w-2.5 h-2.5" /> À enrichir
                </span>
              )}
            </div>
            <p className="text-[12px] text-[#71717a]">
              Configurez les informations que votre IA utilise pour répondre à vos clients.
            </p>
          </div>
          <div className="flex items-center gap-4 md:gap-6 flex-wrap">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wider">Couverture</span>
              <span className="text-lg font-bold text-[#1a1a1a] tabular-nums leading-tight">{coveragePct}%</span>
              <span className="text-[10px] text-[#9ca3af]">de la base</span>
            </div>
            {lastSync && (
              <>
                <div className="w-px h-10 bg-gray-200" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wider">Dernière synchro</span>
                  <span className="text-[13px] font-bold text-[#1a1a1a] leading-tight flex items-center gap-1">
                    <Clock className="w-3 h-3 text-[#9ca3af]" /> {formatTimeAgo(lastSync)}
                  </span>
                  <span className="text-[10px] text-[#9ca3af]">agent à jour</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions: Import URL + File Upload + Q&A Builder */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* URL Import */}
        <div className="bg-white border border-[#E5E2D7] rounded-2xl overflow-hidden">
          <button
            onClick={() => { setShowImport(!showImport); setShowQA(false) }}
            className="w-full p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
              <Globe className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#1a1a1a]">Importer depuis une URL</p>
              <p className="text-[11px] text-[#71717a]">Collez un lien vers votre FAQ ou site</p>
            </div>
          </button>
          {showImport && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} className="overflow-hidden border-t border-[#E5E2D7]">
              <div className="p-4 space-y-3">
                <input
                  type="url"
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  placeholder="https://votre-site.com/faq"
                  className="w-full px-4 py-2.5 bg-[#F9F7F1] border border-[#E5E2D7] rounded-xl text-sm text-[#1a1a1a] outline-none focus:ring-1 focus:ring-blue-300"
                />
                <button
                  onClick={handleImportUrl}
                  disabled={!importUrl.trim() || importing}
                  className="w-full py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  {importing ? 'Import en cours...' : 'Générer les FAQ'}
                </button>
                <p className="text-[10px] text-[#71717a]">L'IA va analyser la page et générer des paires Question/Réponse automatiquement</p>
              </div>
            </motion.div>
          )}
        </div>

        {/* Google Docs / Notion import */}
        {['google_docs', 'notion'].map((prov) => {
          const isConnected = connectedProviders.includes(prov)
          const label = prov === 'google_docs' ? 'Google Docs' : 'Notion'
          const desc = isConnected
            ? `Importer depuis vos ${label}`
            : `Connectez ${label} dans Intégrations pour importer`
          const bgColor = prov === 'google_docs' ? 'bg-blue-50' : 'bg-gray-100'
          const icon = prov === 'google_docs' ? (
            <img src="https://upload.wikimedia.org/wikipedia/commons/0/01/Google_Docs_logo_%282014-2020%29.svg" alt="Google Docs" className="w-5 h-5" />
          ) : (
            <img src="https://upload.wikimedia.org/wikipedia/commons/4/45/Notion_app_logo.png" alt="Notion" className="w-5 h-5" />
          )
          return (
            <div key={prov} className="bg-white border border-[#E5E2D7] rounded-2xl overflow-hidden">
              <button
                onClick={() => isConnected && setImportProvider(prov)}
                disabled={!isConnected}
                className={`w-full p-4 flex items-center gap-3 text-left transition-colors ${
                  isConnected ? 'hover:bg-gray-50 cursor-pointer' : 'opacity-60 cursor-not-allowed'
                }`}
              >
                <div className={`w-9 h-9 rounded-lg ${bgColor} flex items-center justify-center`}>
                  {icon}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-[#1a1a1a]">Importer depuis {label}</p>
                  <p className="text-[11px] text-[#71717a]">{desc}</p>
                </div>
                {!isConnected && (
                  <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">
                    Non connecté
                  </span>
                )}
              </button>
            </div>
          )
        })}

        {/* Q&A Builder */}
        <div className="bg-white border border-[#E5E2D7] rounded-2xl overflow-hidden">
          <button
            onClick={() => { setShowQA(!showQA); setShowImport(false) }}
            className="w-full p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
              <MessageCircle className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#1a1a1a]">Ajouter une FAQ rapide</p>
              <p className="text-[11px] text-[#71717a]">Question → Reponse en 30 secondes</p>
            </div>
          </button>
          {showQA && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} className="overflow-hidden border-t border-[#E5E2D7]">
              <div className="p-4 space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-[#71717a] uppercase tracking-wider">Question du client</label>
                  <input
                    type="text"
                    value={qaQuestion}
                    onChange={(e) => setQaQuestion(e.target.value)}
                    placeholder="Ex: Quels sont vos delais de livraison ?"
                    className="mt-1 w-full px-4 py-2.5 bg-[#F9F7F1] border border-[#E5E2D7] rounded-xl text-sm text-[#1a1a1a] outline-none focus:ring-1 focus:ring-emerald-300"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[#71717a] uppercase tracking-wider">Reponse attendue</label>
                  <textarea
                    value={qaAnswer}
                    onChange={(e) => setQaAnswer(e.target.value)}
                    placeholder="La livraison est gratuite a partir de 50€. Delai: 2-5 jours ouvrés..."
                    rows={3}
                    className="mt-1 w-full px-4 py-2.5 bg-[#F9F7F1] border border-[#E5E2D7] rounded-xl text-sm text-[#1a1a1a] outline-none focus:ring-1 focus:ring-emerald-300 resize-none"
                  />
                </div>
                <button
                  onClick={handleAddQA}
                  disabled={!qaQuestion.trim() || !qaAnswer.trim()}
                  className="w-full py-2.5 bg-cta text-white text-sm font-bold rounded-xl hover:bg-[#003725] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Ajouter la FAQ
                </button>
              </div>
            </motion.div>
          )}
        </div>

        {/* File Upload */}
        <div className="bg-white border border-[#E5E2D7] rounded-2xl overflow-hidden">
          <button
            onClick={() => { setShowFileUpload(!showFileUpload); setShowImport(false); setShowQA(false) }}
            className="w-full p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center">
              <Upload className="w-4 h-4 text-violet-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#1a1a1a]">Importer un fichier</p>
              <p className="text-[11px] text-[#71717a]">PDF, TXT, CSV, DOCX</p>
            </div>
          </button>
          {showFileUpload && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} className="overflow-hidden border-t border-[#E5E2D7]">
              <div className="p-4 space-y-3">
                <label className={`relative block border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                  uploading
                    ? 'border-[#E5E2D7] cursor-wait'
                    : 'border-[#E5E2D7] cursor-pointer hover:border-cta/30 hover:bg-gray-50'
                }`}>
                  <Upload className="w-6 h-6 text-[#71717a] mx-auto mb-2" />
                  <p className="text-sm text-[#1a1a1a] font-medium">
                    {uploading ? 'Analyse en cours...' : 'Cliquez pour choisir un fichier'}
                  </p>
                  <p className="text-[10px] text-[#71717a] mt-1">TXT, CSV, MD — max 4 Mo</p>
                  <input
                    type="file"
                    accept=".txt,.csv,.md"
                    onChange={handleFileUpload}
                    disabled={uploading}
                    className="sr-only"
                  />
                </label>
                {uploading && (
                  <div className="flex items-center justify-center gap-2 py-2">
                    <Loader2 className="w-4 h-4 animate-spin text-violet-600" />
                    <span className="text-xs text-[#71717a]">L'IA analyse le fichier et extrait les informations...</span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* ═══════ CATEGORY FILTER TABS ═══════ */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {CATEGORIES.map((cat) => {
          const count = entries.filter(e => e.category === cat.id).length
          const isActive = selectedCategory === cat.id
          const CatIcon = cat.icon
          return (
            <button
              key={cat.id}
              onClick={() => { setSelectedCategory(cat.id); setEditingEntry(null); setIsCreating(false) }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-lg transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-[#1a1a1a] text-white'
                  : 'bg-white border border-[#E5E2D7] text-[#71717a] hover:bg-[#fafafa]'
              }`}
            >
              <CatIcon className="w-3.5 h-3.5" />
              {cat.label}
              <span className={`tabular-nums text-[11px] ${isActive ? 'text-white/70' : 'text-[#9ca3af]'}`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Main content */}
      <div className="space-y-4">
        <div>
          {isLoading ? (
            <div aria-busy="true" aria-label="Chargement des entrées">
              <SkeletonList n={5} />
            </div>
          ) : selectedCategory === 'tone' ? (
            <div className={`rounded-2xl border p-6 ${isLight ? 'bg-white border-[#E5E2D7]' : 'bg-[#F9F7F1] border-[#E5E2D7]'}`}>
              <ToneEditor
                entry={filteredEntries[0]}
                onSave={(entry) => saveMutation.mutate(entry)}
                saving={saveMutation.isPending}
              />
            </div>
          ) : (
            <>
              {/* Entry list */}
              {filteredEntries.length === 0 && !isCreating ? (
                <div className={`text-center py-16 rounded-2xl border ${isLight ? 'bg-white border-[#E5E2D7]' : 'bg-[#F9F7F1] border-[#E5E2D7]'}`}>
                  <categoryConfig.icon className={`w-10 h-10 mx-auto mb-3 ${isLight ? 'text-slate-300' : 'text-[#71717a]'}`} />
                  <p className={`text-sm ${isLight ? 'text-[#71717a]' : 'text-[#71717a]'}`}>
                    Ajoutez vos {categoryConfig.label.toLowerCase()} pour que l&apos;IA reponde precisement a vos clients.
                  </p>
                  <button
                    onClick={() => setIsCreating(true)}
                    className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-white text-[#1a1a1a] hover:bg-gray-100 transition-all"
                  >
                    <Plus className="w-4 h-4" /> Ajouter
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredEntries.map((entry) => {
                    if (editingEntry === entry.id) {
                      return (
                        <EntryEditor
                          key={entry.id}
                          entry={entry}
                          category={selectedCategory}
                          onSave={(e) => saveMutation.mutate(e)}
                          onDelete={(id) => deleteMutation.mutate(id)}
                          onCancel={() => setEditingEntry(null)}
                          saving={saveMutation.isPending}
                        />
                      )
                    }

                    const daysLeft = getDaysUntilExpiry(entry.expires_at)
                    const isExpired = daysLeft !== null && daysLeft <= 0

                    return (
                      <motion.div
                        key={entry.id}
                        layout
                        onClick={() => setEditingEntry(entry.id)}
                        className={`rounded-2xl border p-5 cursor-pointer transition-all ${
                          isExpired
                            ? (isLight ? 'bg-[#F9F7F1] border-[#E5E2D7] opacity-50' : 'bg-gray-50 border-[#E5E2D7] opacity-50')
                            : (isLight ? 'bg-white border-[#E5E2D7] hover:border-slate-300' : 'bg-[#F9F7F1] border-[#E5E2D7] hover:border-gray-300')
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5">
                              <h3 className={`text-sm font-bold ${isLight ? 'text-[#1a1a1a]' : 'text-[#1a1a1a]'}`}>
                                {entry.title}
                              </h3>
                              {isExpired && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                                  Expire
                                </span>
                              )}
                              {daysLeft !== null && daysLeft > 0 && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                  Expire dans {daysLeft}j
                                </span>
                              )}
                            </div>
                            <p className={`text-xs line-clamp-2 ${isLight ? 'text-[#71717a]' : 'text-[#71717a]'}`}>
                              {entry.content}
                            </p>
                          </div>
                          <ChevronRight className={`w-4 h-4 flex-shrink-0 mt-1 ${isLight ? 'text-[#71717a]' : 'text-[#71717a]'}`} />
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              )}

              {isCreating && (
                <EntryEditor
                  entry={null}
                  category={selectedCategory}
                  onSave={(e) => saveMutation.mutate(e)}
                  onDelete={() => {}}
                  onCancel={() => setIsCreating(false)}
                  saving={saveMutation.isPending}
                />
              )}

              {filteredEntries.length > 0 && !isCreating && (
                <button
                  onClick={() => setIsCreating(true)}
                  className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed text-sm font-bold transition-all ${
                    isLight
                      ? 'border-slate-300 text-[#71717a] hover:border-slate-400 hover:text-slate-700'
                      : 'border-[#E5E2D7] text-[#71717a] hover:border-gray-300 hover:text-[#1a1a1a]'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  Ajouter {selectedCategory === 'faq' ? 'une question' : selectedCategory === 'product' ? `un ${productLabel}` : 'une entree'}
                </button>
              )}

              {selectedCategory === 'faq' && filteredEntries.length > 0 && (
                <p className={`text-xs ${isLight ? 'text-[#71717a]' : 'text-[#71717a]'}`}>
                  {filteredEntries.length} question{filteredEntries.length > 1 ? 's' : ''} dans votre FAQ
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <AnimatePresence>
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </AnimatePresence>

      <AnimatePresence>
        {importProvider && (
          <KnowledgeImportModal
            clientId={clientId}
            provider={importProvider}
            onClose={() => setImportProvider(null)}
            onSuccess={(count) => {
              setImportProvider(null)
              setToast({ message: `${count} document${count > 1 ? 's' : ''} importé${count > 1 ? 's' : ''}`, type: 'success' })
              queryClient.invalidateQueries({ queryKey: ['client-knowledge-base', clientId] })
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
