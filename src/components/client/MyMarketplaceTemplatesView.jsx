import React, { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Store,
  Plus,
  Download,
  Star,
  DollarSign,
  Edit3,
  EyeOff,
  X,
  Loader2,
  Sparkles,
  BookOpen,
  Shield,
  MessageSquare,
  Package,
  CheckCircle2,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../ui/Toast'

const CATEGORIES = [
  { id: 'sav', label: 'SAV' },
  { id: 'ecommerce', label: 'E-commerce' },
  { id: 'immobilier', label: 'Immobilier' },
  { id: 'comptabilite', label: 'Comptabilite' },
  { id: 'voice', label: 'Voice' },
  { id: 'autre', label: 'Autre' },
]

const INDUSTRIES = [
  { id: 'mode', label: 'Mode' },
  { id: 'cosmetiques', label: 'Cosmetiques' },
  { id: 'electronique', label: 'Electronique' },
  { id: 'food', label: 'Food' },
  { id: 'immobilier', label: 'Immobilier' },
  { id: 'services', label: 'Services' },
  { id: 'autre', label: 'Autre' },
]

const REVENUE_SHARE = 0.8

export const MyMarketplaceTemplatesView = ({ clientId }) => {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState(null)

  const { data: myTemplates = [], isLoading } = useQuery({
    queryKey: ['my-marketplace-templates', clientId],
    queryFn: async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch('/api/marketplace/mine', {
          headers: { Authorization: `Bearer ${session?.access_token}` },
        })
        if (res.ok) {
          const data = await res.json()
          return data.templates || data || []
        }
      } catch (_e) {
        // fall through
      }
      const { data, error } = await supabase
        .from('marketplace_templates')
        .select('*')
        .eq('owner_client_id', clientId)
        .order('created_at', { ascending: false })
      if (error) {
        console.warn('Own templates query error:', error.message)
        return []
      }
      return data || []
    },
    enabled: !!clientId,
  })

  // Aggregate config preview (prompts, rules, kb, examples counts for current client)
  const { data: configPreview } = useQuery({
    queryKey: ['marketplace-config-preview', clientId],
    queryFn: async () => {
      if (!clientId) return null
      const [rules, kb, templates, prompts] = await Promise.all([
        supabase.from('agent_guardrails').select('id', { count: 'exact', head: true }).eq('client_id', clientId),
        supabase.from('knowledge_base').select('id', { count: 'exact', head: true }).eq('client_id', clientId),
        supabase.from('response_templates').select('id', { count: 'exact', head: true }).eq('client_id', clientId),
        supabase.from('client_settings').select('tone, prompt').eq('client_id', clientId).maybeSingle(),
      ])
      return {
        rules_count: rules?.count || 0,
        kb_count: kb?.count || 0,
        examples_count: templates?.count || 0,
        prompts_count: prompts?.data?.prompt ? 1 : 0,
        tone: prompts?.data?.tone || 'professionnel',
      }
    },
    enabled: !!clientId,
  })

  const handleUnpublish = async (template) => {
    if (!confirm(`Depublier "${template.name}" du marketplace ?`)) return
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/marketplace/unpublish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ template_id: template.id }),
      })
      if (!res.ok) {
        // Fallback: direct Supabase update
        const { error } = await supabase
          .from('marketplace_templates')
          .update({ is_published: false })
          .eq('id', template.id)
        if (error) throw error
      }
      toast.success('Template depublie')
      queryClient.invalidateQueries({ queryKey: ['my-marketplace-templates', clientId] })
    } catch (e) {
      toast.error(e?.message || 'Depublication impossible')
    }
  }

  const openCreate = () => {
    setEditingTemplate(null)
    setShowModal(true)
  }

  const openEdit = (template) => {
    setEditingTemplate(template)
    setShowModal(true)
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Store className="w-5 h-5 text-[#003725]" />
            <h2 className="text-[20px] font-bold text-[#1a1a1a]">Mes templates publies</h2>
          </div>
          <p className="text-[13px] text-[#71717a]">
            Publiez vos meilleurs templates et gagnez {Math.round(REVENUE_SHARE * 100)}% de commission sur chaque vente.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#003725] text-white text-[13px] font-bold hover:bg-[#002a1c] transition-colors whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Publier un nouveau template
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-[#003725]" />
        </div>
      ) : myTemplates.length === 0 ? (
        <div className="bg-white border border-[#f0f0f0] rounded-2xl p-12 text-center">
          <Store className="w-10 h-10 text-[#cfcbbc] mx-auto mb-3" />
          <p className="text-[15px] font-semibold text-[#1a1a1a] mb-1">Vous n'avez pas encore publie de template</p>
          <p className="text-[13px] text-[#71717a] mb-5">
            Partagez votre configuration avec la communaute Actero et generez des revenus passifs.
          </p>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#003725] text-white text-[13px] font-bold"
          >
            <Plus className="w-4 h-4" />
            Publier mon premier template
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {myTemplates.map((template) => {
            const price = Number(template.price_eur ?? template.price ?? 0)
            const installs = template.installs_count ?? template.install_count ?? 0
            const ratingValue = template.avg_rating ?? template.rating ?? 0
            const ratingCount = template.ratings_count ?? template.rating_count ?? 0
            const revenue = price * installs * REVENUE_SHARE
            const isPublished = template.is_published !== false
            return (
              <div
                key={template.id}
                className="bg-white border border-[#f0f0f0] rounded-2xl p-5 flex items-start gap-5"
              >
                <div className="w-20 h-20 flex-shrink-0 rounded-xl bg-gradient-to-br from-[#F9F7F1] to-[#eceae2] overflow-hidden">
                  {template.preview_image ? (
                    <img src={template.preview_image} alt={template.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Sparkles className="w-6 h-6 text-[#cfcbbc]" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 mb-1">
                    <h3 className="text-[15px] font-bold text-[#1a1a1a] truncate">{template.name}</h3>
                    {!isPublished && (
                      <span className="px-2 py-0.5 rounded-full bg-gray-100 text-[#71717a] text-[10px] font-bold uppercase tracking-wider">
                        Depublie
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-[#71717a] mb-3 line-clamp-1">
                    {template.short_description || 'Template'}
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-[10px] text-[#9ca3af] font-semibold uppercase tracking-wider">Installs</p>
                      <p className="text-[15px] font-bold text-[#1a1a1a] flex items-center gap-1">
                        <Download className="w-3.5 h-3.5 text-[#71717a]" />
                        {installs}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#9ca3af] font-semibold uppercase tracking-wider">Rating</p>
                      {ratingCount > 0 ? (
                        <p className="text-[15px] font-bold text-[#1a1a1a] flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          {Number(ratingValue).toFixed(1)}
                        </p>
                      ) : (
                        <p className="text-[13px] font-medium text-[#9ca3af]">Non noté</p>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] text-[#9ca3af] font-semibold uppercase tracking-wider">Revenus</p>
                      <p className="text-[15px] font-bold text-[#003725] flex items-center gap-1">
                        <DollarSign className="w-3.5 h-3.5" />
                        {Math.round(revenue).toLocaleString('fr-FR')}€
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 flex-shrink-0">
                  <button
                    onClick={() => openEdit(template)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F9F7F1] text-[#1a1a1a] text-[12px] font-semibold hover:bg-[#eceae2] transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Modifier
                  </button>
                  {isPublished && (
                    <button
                      onClick={() => handleUnpublish(template)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#f0f0f0] text-red-600 text-[12px] font-semibold hover:bg-red-50 transition-colors"
                    >
                      <EyeOff className="w-3.5 h-3.5" />
                      Depublier
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <AnimatePresence>
        {showModal && (
          <PublishModal
            template={editingTemplate}
            configPreview={configPreview}
            clientId={clientId}
            onClose={() => {
              setShowModal(false)
              setEditingTemplate(null)
            }}
            onSaved={() => {
              queryClient.invalidateQueries({ queryKey: ['my-marketplace-templates', clientId] })
              setShowModal(false)
              setEditingTemplate(null)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

const PublishModal = ({ template, configPreview, clientId, onClose, onSaved }) => {
  const toast = useToast()
  const isEditing = !!template
  const [form, setForm] = useState({
    name: template?.name || '',
    short_description: template?.short_description || '',
    description: template?.description || template?.long_description || '',
    category: template?.category || 'sav',
    industry: template?.industry || 'mode',
    price_eur: template?.price_eur ? String(template.price_eur) : '0',
  })
  const [saving, setSaving] = useState(false)

  const handleChange = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }))
  }

  const handleSubmit = async (e) => {
    e?.preventDefault?.()
    if (!form.name.trim()) {
      toast.error('Donnez un nom a votre template')
      return
    }
    if (!form.short_description.trim()) {
      toast.error('Ajoutez une description courte')
      return
    }
    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const payload = {
        template_id: template?.id,
        client_id: clientId,
        name: form.name.trim(),
        short_description: form.short_description.trim(),
        description: form.description.trim(),
        category: form.category,
        industry: form.industry,
        price_eur: parseFloat(form.price_eur) || 0,
      }
      const endpoint = isEditing ? '/api/marketplace/update' : '/api/marketplace/publish'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Publication impossible')
      toast.success(isEditing ? 'Template mis a jour' : 'Template publie avec succes')
      onSaved?.()
    } catch (err) {
      toast.error(err?.message || 'Une erreur est survenue')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.96 }}
        className="relative bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#f0f0f0]">
          <div>
            <h3 className="text-[18px] font-bold text-[#1a1a1a]">
              {isEditing ? 'Modifier le template' : 'Publier sur le marketplace'}
            </h3>
            <p className="text-[12px] text-[#71717a]">
              Partagez votre configuration avec la communaute Actero
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-[#F9F7F1] flex items-center justify-center"
          >
            <X className="w-4 h-4 text-[#71717a]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div>
            <label className="block text-[11px] font-bold text-[#71717a] uppercase tracking-widest mb-1.5">
              Nom du template
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Ex: Agent SAV Mode premium"
              className="w-full px-4 py-2.5 rounded-xl border border-[#f0f0f0] bg-white text-[14px] focus:outline-none focus:ring-2 focus:ring-[#003725]/20 focus:border-[#003725]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#71717a] uppercase tracking-widest mb-1.5">
              Description courte
            </label>
            <input
              type="text"
              value={form.short_description}
              onChange={(e) => handleChange('short_description', e.target.value)}
              placeholder="Une phrase qui donne envie d'installer votre template"
              className="w-full px-4 py-2.5 rounded-xl border border-[#f0f0f0] bg-white text-[14px] focus:outline-none focus:ring-2 focus:ring-[#003725]/20 focus:border-[#003725]"
              maxLength={140}
            />
            <p className="text-[10px] text-[#9ca3af] mt-1">{form.short_description.length}/140</p>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#71717a] uppercase tracking-widest mb-1.5">
              Description longue
            </label>
            <textarea
              value={form.description}
              onChange={(e) => handleChange('description', e.target.value)}
              rows={5}
              placeholder="Expliquez ce que fait votre template, pour qui, et pourquoi l'installer. Markdown supporte."
              className="w-full px-4 py-2.5 rounded-xl border border-[#f0f0f0] bg-white text-[14px] focus:outline-none focus:ring-2 focus:ring-[#003725]/20 focus:border-[#003725] resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-[#71717a] uppercase tracking-widest mb-1.5">
                Categorie
              </label>
              <select
                value={form.category}
                onChange={(e) => handleChange('category', e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-[#f0f0f0] bg-white text-[14px] focus:outline-none focus:ring-2 focus:ring-[#003725]/20 focus:border-[#003725]"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#71717a] uppercase tracking-widest mb-1.5">
                Industrie
              </label>
              <select
                value={form.industry}
                onChange={(e) => handleChange('industry', e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-[#f0f0f0] bg-white text-[14px] focus:outline-none focus:ring-2 focus:ring-[#003725]/20 focus:border-[#003725]"
              >
                {INDUSTRIES.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#71717a] uppercase tracking-widest mb-1.5">
              Prix (€) — mettre 0 pour gratuit
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={form.price_eur}
              onChange={(e) => handleChange('price_eur', e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-[#f0f0f0] bg-white text-[14px] focus:outline-none focus:ring-2 focus:ring-[#003725]/20 focus:border-[#003725]"
            />
            {parseFloat(form.price_eur) > 0 && (
              <p className="text-[11px] text-[#71717a] mt-1.5">
                Vous touchez {Math.round(REVENUE_SHARE * 100)}% — soit{' '}
                <span className="font-bold text-[#003725]">
                  {(parseFloat(form.price_eur) * REVENUE_SHARE).toFixed(2)}€
                </span>{' '}
                par vente
              </p>
            )}
          </div>

          <div className="bg-[#F9F7F1] border border-[#f0f0f0] rounded-2xl p-4">
            <p className="text-[11px] font-bold text-[#71717a] uppercase tracking-widest mb-3">
              Contenu qui sera copie
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { icon: MessageSquare, label: 'Tone & prompt', value: configPreview?.tone || '—' },
                { icon: Shield, label: 'Regles', value: `${configPreview?.rules_count || 0}` },
                { icon: BookOpen, label: 'Base de savoir', value: `${configPreview?.kb_count || 0}` },
                { icon: Package, label: 'Templates', value: `${configPreview?.examples_count || 0}` },
              ].map((item, i) => (
                <div key={i} className="bg-white rounded-xl px-3 py-2.5 flex items-center gap-2.5 border border-[#f0f0f0]">
                  <div className="w-7 h-7 rounded-lg bg-[#003725]/5 flex items-center justify-center">
                    <item.icon className="w-3.5 h-3.5 text-[#003725]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-[#9ca3af] font-semibold uppercase tracking-wider truncate">
                      {item.label}
                    </p>
                    <p className="text-[12px] font-bold text-[#1a1a1a] truncate">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-[#9ca3af] mt-3 flex items-start gap-1.5">
              <CheckCircle2 className="w-3 h-3 text-[#003725] mt-0.5 flex-shrink-0" />
              Aucune donnee client personnelle n'est copiee. Seule la config est partagee.
            </p>
          </div>
        </form>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[#f0f0f0] bg-[#fafafa]">
          <button
            onClick={onClose}
            type="button"
            className="px-4 py-2.5 rounded-xl text-[13px] font-semibold text-[#555] hover:bg-[#F9F7F1]"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            type="button"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#003725] text-white text-[13px] font-bold hover:bg-[#002a1c] disabled:opacity-60 transition-colors"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Publication...
              </>
            ) : isEditing ? (
              'Enregistrer'
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Publier
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

export default MyMarketplaceTemplatesView
