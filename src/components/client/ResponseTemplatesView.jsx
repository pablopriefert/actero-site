import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Search, Edit3, Copy, Trash2, X, Save, Loader2,
  CheckCircle2, AlertTriangle, FileText, TrendingUp,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

const emptyForm = { name: '', shortcut: '', category: '', body: '' }

export const ResponseTemplatesView = ({ clientId, theme = 'light' }) => {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null) // template object or null (create)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const showToast = (type, msg) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3000)
  }

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['response-templates', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_response_templates')
        .select('*')
        .eq('client_id', clientId)
        .order('usage_count', { ascending: false })
      if (error) throw error
      return data || []
    },
    enabled: !!clientId,
  })

  const categories = useMemo(() => {
    const set = new Set()
    templates.forEach(t => { if (t.category) set.add(t.category) })
    return Array.from(set)
  }, [templates])

  const filtered = useMemo(() => {
    let list = templates
    if (categoryFilter !== 'all') {
      list = list.filter(t => t.category === categoryFilter)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(t =>
        (t.name || '').toLowerCase().includes(q) ||
        (t.shortcut || '').toLowerCase().includes(q) ||
        (t.body || '').toLowerCase().includes(q)
      )
    }
    return list
  }, [templates, search, categoryFilter])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  const openEdit = (tpl) => {
    setEditing(tpl)
    setForm({
      name: tpl.name || '',
      shortcut: tpl.shortcut || '',
      category: tpl.category || '',
      body: tpl.body || '',
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.body.trim()) return
    setSaving(true)
    try {
      if (editing) {
        const { error } = await supabase
          .from('client_response_templates')
          .update({
            name: form.name.trim(),
            shortcut: form.shortcut.trim() || null,
            category: form.category.trim() || null,
            body: form.body,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editing.id)
        if (error) throw error
        showToast('success', 'Template modifie')
      } else {
        const { error } = await supabase
          .from('client_response_templates')
          .insert({
            client_id: clientId,
            name: form.name.trim(),
            shortcut: form.shortcut.trim() || null,
            category: form.category.trim() || null,
            body: form.body,
          })
        if (error) throw error
        showToast('success', 'Template cree')
      }
      setModalOpen(false)
      setEditing(null)
      setForm(emptyForm)
      queryClient.invalidateQueries({ queryKey: ['response-templates', clientId] })
    } catch (e) {
      showToast('error', 'Erreur : ' + (e.message || 'echec'))
    }
    setSaving(false)
  }

  const duplicateMutation = useMutation({
    mutationFn: async (tpl) => {
      const { error } = await supabase
        .from('client_response_templates')
        .insert({
          client_id: clientId,
          name: `${tpl.name} (copie)`,
          shortcut: tpl.shortcut,
          category: tpl.category,
          body: tpl.body,
        })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['response-templates', clientId] })
      showToast('success', 'Template duplique')
    },
    onError: () => showToast('error', 'Erreur duplication'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('client_response_templates')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['response-templates', clientId] })
      showToast('success', 'Template supprime')
      setConfirmDelete(null)
    },
    onError: () => showToast('error', 'Erreur suppression'),
  })

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in-up">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-[22px] font-semibold text-[#1a1a1a]">Templates de reponses</h2>
          <p className="text-[13px] text-[#9ca3af] mt-1">
            Sauvegardez et reutilisez vos reponses frequentes pour gagner du temps.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[12px] font-semibold bg-cta text-white hover:bg-[#003725] transition-all"
        >
          <Plus className="w-4 h-4" />
          Créer un template
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-[#f0f0f0] shadow-[0_1px_3px_rgba(0,0,0,0.04)] min-w-[240px] flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#9ca3af]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un template..."
            className="flex-1 bg-transparent outline-none text-[13px] text-[#1a1a1a] placeholder-[#9ca3af]"
          />
        </div>
        {categories.length > 0 && (
          <div className="flex p-1 rounded-xl border border-[#f0f0f0] bg-[#fafafa] overflow-x-auto">
            <button
              onClick={() => setCategoryFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap ${
                categoryFilter === 'all'
                  ? 'bg-white text-[#1a1a1a] shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                  : 'text-[#9ca3af] hover:text-[#1a1a1a]'
              }`}
            >
              Toutes
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap ${
                  categoryFilter === cat
                    ? 'bg-white text-[#1a1a1a] shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                    : 'text-[#9ca3af] hover:text-[#1a1a1a]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-[#9ca3af]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border bg-white border-[#f0f0f0] shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
          <FileText className="w-10 h-10 mx-auto mb-3 text-[#9ca3af] opacity-40" />
          <p className="text-[13px] text-[#9ca3af]">
            {templates.length === 0
              ? 'Aucun template. Creez votre premier template !'
              : 'Aucun template ne correspond a votre recherche.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(tpl => (
            <motion.div
              key={tpl.id}
              layout
              className="bg-white rounded-2xl border border-[#f0f0f0] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-5 hover:border-gray-300 transition-all"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="text-[14px] font-semibold text-[#1a1a1a] truncate">{tpl.name}</h3>
                    {tpl.shortcut && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-cta/10 text-cta border border-cta/20">
                        {tpl.shortcut}
                      </span>
                    )}
                    {tpl.category && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#f0f0f0] text-[#71717a] border border-[#ebebeb]">
                        {tpl.category}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-[#9ca3af]">
                    <TrendingUp className="w-3 h-3" />
                    <span>{tpl.usage_count || 0} utilisation{(tpl.usage_count || 0) > 1 ? 's' : ''}</span>
                  </div>
                </div>
              </div>
              <p className="text-[12px] text-[#71717a] line-clamp-3 whitespace-pre-wrap mb-4">{tpl.body}</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEdit(tpl)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-semibold bg-[#f5f5f5] text-[#1a1a1a] border border-[#ebebeb] hover:bg-[#ececec] transition-all"
                >
                  <Edit3 className="w-3 h-3" /> Modifier
                </button>
                <button
                  onClick={() => duplicateMutation.mutate(tpl)}
                  disabled={duplicateMutation.isPending}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-semibold bg-white text-[#1a1a1a] border border-[#ebebeb] hover:bg-[#fafafa] transition-all disabled:opacity-50"
                >
                  <Copy className="w-3 h-3" /> Dupliquer
                </button>
                <button
                  onClick={() => setConfirmDelete(tpl)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-semibold text-red-600 border border-red-200 bg-white hover:bg-red-50 transition-all ml-auto"
                >
                  <Trash2 className="w-3 h-3" /> Supprimer
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* CRUD modal */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={() => setModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white border border-[#f0f0f0] rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between p-5 border-b border-[#f0f0f0]">
                <h3 className="text-[15px] font-bold text-[#1a1a1a]">
                  {editing ? 'Modifier le template' : 'Nouveau template'}
                </h3>
                <button onClick={() => setModalOpen(false)} className="text-[#9ca3af] hover:text-[#1a1a1a]">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-1.5">Nom *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Ex : Remboursement livraison retardee"
                    className="w-full bg-[#fafafa] border border-[#ebebeb] rounded-lg px-3 py-2 text-[13px] text-[#1a1a1a] outline-none focus:border-cta/30"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-1.5">Raccourci</label>
                    <input
                      type="text"
                      value={form.shortcut}
                      onChange={(e) => setForm(f => ({ ...f, shortcut: e.target.value }))}
                      placeholder="/rembourse"
                      className="w-full bg-[#fafafa] border border-[#ebebeb] rounded-lg px-3 py-2 text-[13px] text-[#1a1a1a] outline-none focus:border-cta/30"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-1.5">Categorie</label>
                    <input
                      type="text"
                      value={form.category}
                      onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))}
                      placeholder="Remboursement, SAV..."
                      className="w-full bg-[#fafafa] border border-[#ebebeb] rounded-lg px-3 py-2 text-[13px] text-[#1a1a1a] outline-none focus:border-cta/30"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-1.5">Corps du template *</label>
                  <textarea
                    value={form.body}
                    onChange={(e) => setForm(f => ({ ...f, body: e.target.value }))}
                    rows={8}
                    placeholder="Bonjour {{prenom}},&#10;&#10;Nous sommes desoles pour..."
                    className="w-full bg-[#fafafa] border border-[#ebebeb] rounded-lg px-3 py-2 text-[13px] text-[#1a1a1a] outline-none resize-none focus:border-cta/30"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 p-5 border-t border-[#f0f0f0]">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-[12px] font-semibold text-[#9ca3af] hover:text-[#1a1a1a]"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!form.name.trim() || !form.body.trim() || saving}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-semibold bg-cta text-white hover:bg-[#003725] transition-all disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {editing ? 'Enregistrer' : 'Créer'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm delete */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={() => setConfirmDelete(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white border border-[#f0f0f0] rounded-2xl shadow-2xl w-full max-w-sm p-5"
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <h3 className="text-[14px] font-bold text-[#1a1a1a]">Supprimer ce template ?</h3>
                  <p className="text-[12px] text-[#9ca3af] mt-1">
                    Cette action est irreversible. Le template &quot;{confirmDelete.name}&quot; sera definitivement supprime.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(null)}
                  className="px-4 py-2 rounded-lg text-[12px] font-semibold text-[#9ca3af] hover:text-[#1a1a1a]"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(confirmDelete.id)}
                  disabled={deleteMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-semibold bg-red-500 text-white hover:bg-red-600 transition-all disabled:opacity-50"
                >
                  {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Supprimer
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-2xl border ${
              toast.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            <span className="text-[12px] font-semibold">{toast.msg}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
