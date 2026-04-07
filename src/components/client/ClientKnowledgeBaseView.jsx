import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookOpen, FileText, HelpCircle, Package, Palette, CalendarClock,
  Plus, Save, Trash2, GripVertical, Loader2, CheckCircle2, AlertCircle,
  ChevronRight, Clock, X
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

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
  policy: 'Decrivez vos conditions, delais, zones couvertes...',
  faq: 'Redigez la reponse a cette question...',
  product: 'Decrivez les caracteristiques, tailles, prix...',
  tone: '',
  temporary: 'Decrivez l\'information temporaire...',
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
    className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl border ${
      type === 'success'
        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
        : 'bg-red-500/10 border-red-500/20 text-red-400'
    }`}
  >
    {type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
    <span className="text-sm font-medium">{message}</span>
    <button onClick={onClose} className="ml-2"><X className="w-3 h-3" /></button>
  </motion.div>
)

const ToneEditor = ({ entry, onSave, saving }) => {
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
        <label className="text-sm font-bold text-[#716D5C]">Tutoiement / Vouvoiement</label>
        <button
          onClick={() => setForm(f => ({ ...f, tutoiement: !f.tutoiement }))}
          className={`relative w-12 h-6 rounded-full transition-colors ${form.tutoiement ? 'bg-blue-500' : 'bg-gray-200'}`}
        >
          <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${form.tutoiement ? 'translate-x-6' : 'translate-x-0.5'}`} />
        </button>
        <span className="text-xs text-[#716D5C]">{form.tutoiement ? 'Tutoiement' : 'Vouvoiement'}</span>
      </div>

      <div>
        <label className="block text-xs font-bold text-[#716D5C] uppercase tracking-wider mb-2">Ton</label>
        <select
          value={form.tone}
          onChange={(e) => setForm(f => ({ ...f, tone: e.target.value }))}
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-[#262626] outline-none"
        >
          {['Formel', 'Professionnel', 'Decontracte', 'Amical'].map(t => (
            <option key={t} value={t} className="bg-white">{t}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-bold text-[#716D5C] uppercase tracking-wider mb-2">Signature email</label>
        <input
          type="text"
          value={form.signature}
          onChange={(e) => setForm(f => ({ ...f, signature: e.target.value }))}
          placeholder="L'equipe Bonne Gueule"
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-[#262626] outline-none"
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-[#716D5C] uppercase tracking-wider mb-2">Phrases ou mots interdits (un par ligne)</label>
        <textarea
          value={form.forbidden}
          onChange={(e) => setForm(f => ({ ...f, forbidden: e.target.value }))}
          rows={4}
          placeholder="je ne sais pas&#10;ce n'est pas possible"
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-[#262626] outline-none resize-none"
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-[#716D5C] uppercase tracking-wider mb-2">Instructions speciales</label>
        <textarea
          value={form.instructions}
          onChange={(e) => setForm(f => ({ ...f, instructions: e.target.value }))}
          rows={4}
          placeholder="Instructions supplementaires pour l'IA..."
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-[#262626] outline-none resize-none"
        />
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-white text-[#262626] hover:bg-gray-100 transition-all disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Enregistrer
      </button>
    </div>
  )
}

const EntryEditor = ({ entry, category, onSave, onDelete, onCancel, saving }) => {
  const [title, setTitle] = useState(entry?.title || '')
  const [content, setContent] = useState(entry?.content || '')
  const [expiresAt, setExpiresAt] = useState(entry?.expires_at ? entry.expires_at.split('T')[0] : '')

  const isFaq = category === 'faq'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-50 border border-gray-200 rounded-2xl p-5 space-y-4"
    >
      <div>
        <label className="block text-xs font-bold text-[#716D5C] uppercase tracking-wider mb-2">
          {isFaq ? 'Question' : 'Titre'}
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={isFaq ? 'Comment suivre ma commande ?' : 'Titre...'}
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-[#262626] outline-none focus:border-gray-400"
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-[#716D5C] uppercase tracking-wider mb-2">
          {isFaq ? 'Reponse' : 'Contenu'}
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={6}
          placeholder={PLACEHOLDERS[category] || 'Contenu...'}
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-[#262626] outline-none resize-none focus:border-gray-400"
        />
      </div>

      {category === 'temporary' && (
        <div>
          <label className="block text-xs font-bold text-[#716D5C] uppercase tracking-wider mb-2">Valide jusqu&apos;au</label>
          <input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-[#262626] outline-none"
          />
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={() => onSave({ ...entry, title, content, expires_at: expiresAt ? new Date(expiresAt).toISOString() : null })}
          disabled={saving || !title.trim() || !content.trim()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-white text-[#262626] hover:bg-gray-100 transition-all disabled:opacity-50"
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
        <button onClick={onCancel} className="px-4 py-2.5 rounded-xl text-sm font-bold text-[#716D5C] hover:text-[#262626] transition-colors">
          Annuler
        </button>
      </div>
    </motion.div>
  )
}

const KnowledgeGaps = ({ clientId, isLight, onAddEntry }) => {
  const { data: gaps = [] } = useQuery({
    queryKey: ['knowledge-gaps', clientId],
    queryFn: async () => {
      // Get escalated tickets from last 30 days to find knowledge gaps
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const { data: events } = await supabase
        .from('automation_events')
        .select('event_category, ticket_type, metadata, description')
        .eq('client_id', clientId)
        .in('event_category', ['ticket_escalated', 'lead_escalated'])
        .gte('created_at', thirtyDaysAgo)
        .order('created_at', { ascending: false })
        .limit(100)

      if (!events || events.length === 0) return []

      // Group by reason/topic
      const grouped = {}
      events.forEach(e => {
        const reason = e.metadata?.reason || e.metadata?.subject || e.ticket_type || e.description || 'Autre'
        const key = reason.toLowerCase().slice(0, 60)
        if (!grouped[key]) {
          grouped[key] = { reason, count: 0 }
        }
        grouped[key].count++
      })

      return Object.values(grouped)
        .filter(g => g.count >= 2)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
    },
    enabled: !!clientId,
  })

  if (gaps.length === 0) return null

  return (
    <div className="mb-6 p-5 bg-amber-50 border border-amber-200 rounded-2xl">
      <div className="flex items-center gap-2 mb-3">
        <AlertCircle className="w-4 h-4 text-amber-600" />
        <h3 className="text-sm font-bold text-amber-800">Lacunes detectees</h3>
        <span className="text-xs text-amber-600">— Sujets frequemment escalades (30 derniers jours)</span>
      </div>
      <div className="space-y-2">
        {gaps.map((gap, i) => (
          <div key={i} className="flex items-center justify-between py-2 px-3 bg-white rounded-xl border border-amber-100">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <span className="text-xs font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full shrink-0">
                {gap.count}x
              </span>
              <p className="text-sm text-[#262626] truncate">{gap.reason}</p>
            </div>
            <button
              onClick={() => onAddEntry(gap.reason)}
              className="flex items-center gap-1 px-3 py-1 text-xs font-bold text-[#003725] bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors shrink-0 ml-2"
            >
              <Plus className="w-3 h-3" /> Couvrir
            </button>
          </div>
        ))}
      </div>
      <p className="text-xs text-amber-600 mt-3">
        Ajoutez une entree FAQ pour ces sujets — l'IA saura y repondre la prochaine fois.
      </p>
    </div>
  )
}

export const ClientKnowledgeBaseView = ({ clientId, clientType, theme = 'dark' }) => {
  const queryClient = useQueryClient()
  const isLight = theme === 'light'
  const [selectedCategory, setSelectedCategory] = useState('policy')
  const [editingEntry, setEditingEntry] = useState(null)
  const [isCreating, setIsCreating] = useState(false)
  const [toast, setToast] = useState(null)

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
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

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-2xl font-bold tracking-tight ${isLight ? 'text-[#262626]' : 'text-[#262626]'}`}>
            Base de connaissances
          </h2>
          <p className={`text-sm mt-1 ${isLight ? 'text-[#716D5C]' : 'text-[#716D5C]'}`}>
            Configurez les informations que votre IA utilise pour repondre a vos clients.
          </p>
        </div>
        {lastSync && (
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs ${isLight ? 'bg-gray-100 text-[#716D5C]' : 'bg-gray-50 text-[#716D5C]'}`}>
            <Clock className="w-3 h-3" />
            Derniere synchro : {formatTimeAgo(lastSync)}
          </div>
        )}
      </div>

      {/* Knowledge Gaps Detection */}
      <KnowledgeGaps
        clientId={clientId}
        isLight={isLight}
        onAddEntry={(topic) => {
          setSelectedCategory('faq')
          setIsCreating(true)
          // Pre-fill will happen via the creating state
        }}
      />

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar categories */}
        <div className="md:w-56 flex-shrink-0">
          <div className={`rounded-2xl border p-2 space-y-1 ${isLight ? 'bg-white border-gray-200' : 'bg-[#F9F7F1] border-gray-200'}`}>
            {CATEGORIES.map((cat) => {
              const count = entries.filter(e => e.category === cat.id).length
              const isActive = selectedCategory === cat.id
              return (
                <button
                  key={cat.id}
                  onClick={() => { setSelectedCategory(cat.id); setEditingEntry(null); setIsCreating(false) }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    isActive
                      ? (isLight ? 'bg-[#003725]/10 text-[#003725]' : 'bg-gray-50 text-[#262626]')
                      : (isLight ? 'text-[#716D5C] hover:bg-[#F9F7F1]' : 'text-[#716D5C] hover:bg-gray-50')
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <cat.icon className="w-4 h-4" />
                    {cat.label}
                  </div>
                  {count > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isLight ? 'bg-gray-100 text-[#716D5C]' : 'bg-gray-50 text-[#716D5C]'}`}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-[#716D5C]" />
            </div>
          ) : selectedCategory === 'tone' ? (
            <div className={`rounded-2xl border p-6 ${isLight ? 'bg-white border-gray-200' : 'bg-[#F9F7F1] border-gray-200'}`}>
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
                <div className={`text-center py-16 rounded-2xl border ${isLight ? 'bg-white border-gray-200' : 'bg-[#F9F7F1] border-gray-200'}`}>
                  <categoryConfig.icon className={`w-10 h-10 mx-auto mb-3 ${isLight ? 'text-slate-300' : 'text-[#716D5C]'}`} />
                  <p className={`text-sm ${isLight ? 'text-[#716D5C]' : 'text-[#716D5C]'}`}>
                    Ajoutez vos {categoryConfig.label.toLowerCase()} pour que l&apos;IA reponde precisement a vos clients.
                  </p>
                  <button
                    onClick={() => setIsCreating(true)}
                    className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-white text-[#262626] hover:bg-gray-100 transition-all"
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
                            ? (isLight ? 'bg-[#F9F7F1] border-gray-200 opacity-50' : 'bg-gray-50 border-gray-100 opacity-50')
                            : (isLight ? 'bg-white border-gray-200 hover:border-slate-300' : 'bg-[#F9F7F1] border-gray-200 hover:border-gray-300')
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5">
                              <GripVertical className="w-4 h-4 text-[#716D5C] flex-shrink-0" />
                              <h3 className={`text-sm font-bold ${isLight ? 'text-[#262626]' : 'text-[#262626]'}`}>
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
                            <p className={`text-xs line-clamp-2 ${isLight ? 'text-[#716D5C]' : 'text-[#716D5C]'}`}>
                              {entry.content}
                            </p>
                          </div>
                          <ChevronRight className={`w-4 h-4 flex-shrink-0 mt-1 ${isLight ? 'text-[#716D5C]' : 'text-[#716D5C]'}`} />
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
                      ? 'border-slate-300 text-[#716D5C] hover:border-slate-400 hover:text-slate-700'
                      : 'border-gray-200 text-[#716D5C] hover:border-gray-300 hover:text-[#262626]'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  Ajouter {selectedCategory === 'faq' ? 'une question' : selectedCategory === 'product' ? `un ${productLabel}` : 'une entree'}
                </button>
              )}

              {selectedCategory === 'faq' && filteredEntries.length > 0 && (
                <p className={`text-xs ${isLight ? 'text-[#716D5C]' : 'text-[#716D5C]'}`}>
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
    </div>
  )
}
