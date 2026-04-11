import React, { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Search,
  Star,
  Download,
  Store,
  Plus,
  Filter,
  ArrowLeft,
  Loader2,
  Tag,
  Sparkles,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

const CATEGORIES = [
  { id: 'all', label: 'Toutes les categories' },
  { id: 'sav', label: 'SAV' },
  { id: 'ecommerce', label: 'E-commerce' },
  { id: 'immobilier', label: 'Immobilier' },
  { id: 'comptabilite', label: 'Comptabilite' },
  { id: 'voice', label: 'Voice' },
  { id: 'autre', label: 'Autre' },
]

const INDUSTRIES = [
  { id: 'all', label: 'Toutes' },
  { id: 'mode', label: 'Mode' },
  { id: 'cosmetiques', label: 'Cosmetiques' },
  { id: 'electronique', label: 'Electronique' },
  { id: 'food', label: 'Food' },
  { id: 'immobilier', label: 'Immobilier' },
  { id: 'services', label: 'Services' },
  { id: 'autre', label: 'Autre' },
]

const PRICE_FILTERS = [
  { id: 'all', label: 'Tous' },
  { id: 'free', label: 'Gratuit' },
  { id: 'paid', label: 'Payant' },
]

const RATING_FILTERS = [
  { id: 'all', label: 'Tous' },
  { id: '4', label: '4+ etoiles' },
  { id: '3', label: '3+ etoiles' },
]

const StarRating = ({ rating = 0, size = 'sm' }) => {
  const sizeClass = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`${sizeClass} ${n <= Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'fill-none text-gray-300'}`}
        />
      ))}
    </div>
  )
}

const TemplateCard = ({ template, onOpen }) => {
  const price = Number(template.price_eur || 0)
  const isFree = price === 0
  return (
    <motion.button
      type="button"
      onClick={() => onOpen(template)}
      whileHover={{ y: -2 }}
      className="group text-left bg-white border border-[#f0f0f0] rounded-2xl overflow-hidden hover:shadow-[0_6px_24px_rgba(0,0,0,0.08)] hover:border-[#e5e5e5] transition-all"
    >
      <div className="aspect-[16/9] bg-gradient-to-br from-[#F9F7F1] to-[#eceae2] relative overflow-hidden">
        {template.preview_image ? (
          <img
            src={template.preview_image}
            alt={template.name}
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Sparkles className="w-10 h-10 text-[#cfcbbc]" />
          </div>
        )}
        <div className="absolute top-3 left-3 flex items-center gap-1.5">
          {template.category && (
            <span className="px-2 py-0.5 rounded-full bg-white/95 backdrop-blur text-[10px] font-semibold text-[#262626] uppercase tracking-wider">
              {template.category}
            </span>
          )}
        </div>
        <div className="absolute top-3 right-3">
          <span
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
              isFree ? 'bg-emerald-500 text-white' : 'bg-[#003725] text-white'
            }`}
          >
            {isFree ? 'Gratuit' : `${price.toFixed(0)}€`}
          </span>
        </div>
      </div>

      <div className="p-4">
        <h3 className="font-bold text-[15px] text-[#1a1a1a] mb-1 line-clamp-1">{template.name}</h3>
        <p className="text-[12px] text-[#716D5C] mb-2 line-clamp-1">
          par {template.creator_name || 'Createur Actero'}
        </p>
        <p className="text-[12px] text-[#555] mb-3 line-clamp-2 min-h-[32px]">
          {template.short_description || template.description || 'Template pret a installer.'}
        </p>

        <div className="flex items-center justify-between pt-2 border-t border-[#f0f0f0]">
          <div className="flex items-center gap-1.5">
            <StarRating rating={template.avg_rating || 0} />
            <span className="text-[11px] text-[#716D5C] font-medium">
              {template.avg_rating ? Number(template.avg_rating).toFixed(1) : '—'}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-[#716D5C] font-medium">
            <Download className="w-3 h-3" />
            <span>{template.installs_count || 0}</span>
          </div>
        </div>
      </div>
    </motion.button>
  )
}

export const MarketplacePage = ({ onNavigate }) => {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedIndustry, setSelectedIndustry] = useState('all')
  const [selectedPrice, setSelectedPrice] = useState('all')
  const [selectedRating, setSelectedRating] = useState('all')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setIsLoggedIn(!!data?.session)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setIsLoggedIn(!!session)
    })
    return () => {
      mounted = false
      listener?.subscription?.unsubscribe?.()
    }
  }, [])

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['marketplace-templates'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/marketplace/list')
        if (res.ok) {
          const data = await res.json()
          return data.templates || data || []
        }
      } catch (_e) {
        // fallback to direct Supabase read if endpoint not ready
      }
      const { data, error } = await supabase
        .from('marketplace_templates')
        .select('*')
        .eq('is_published', true)
        .order('installs_count', { ascending: false })
      if (error) {
        console.warn('Marketplace templates query error:', error.message)
        return []
      }
      return data || []
    },
  })

  const filteredTemplates = useMemo(() => {
    return (templates || []).filter((t) => {
      if (search) {
        const q = search.toLowerCase()
        const hay = [t.name, t.description, t.short_description, t.creator_name, t.category, t.industry]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (selectedCategory !== 'all' && t.category !== selectedCategory) return false
      if (selectedIndustry !== 'all' && t.industry !== selectedIndustry) return false
      if (selectedPrice === 'free' && Number(t.price_eur || 0) > 0) return false
      if (selectedPrice === 'paid' && Number(t.price_eur || 0) === 0) return false
      if (selectedRating !== 'all') {
        const min = parseInt(selectedRating, 10)
        if (Number(t.avg_rating || 0) < min) return false
      }
      return true
    })
  }, [templates, search, selectedCategory, selectedIndustry, selectedPrice, selectedRating])

  const openTemplate = (tpl) => {
    const slug = tpl.slug || tpl.id
    onNavigate(`/marketplace/${slug}`)
  }

  return (
    <div className="min-h-screen bg-[#fafafa] text-[#1a1a1a]">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-[#f0f0f0]">
        <div className="max-w-7xl mx-auto px-5 md:px-8 h-14 flex items-center justify-between gap-4">
          <button
            onClick={() => onNavigate('/')}
            className="flex items-center gap-2 text-[13px] font-semibold text-[#1a1a1a] hover:text-[#003725]"
          >
            <ArrowLeft className="w-4 h-4" />
            Accueil
          </button>
          <div className="flex items-center gap-2">
            {isLoggedIn && (
              <button
                onClick={() => onNavigate('/client')}
                className="hidden md:inline-flex px-3 py-1.5 rounded-lg border border-[#f0f0f0] text-[12px] font-semibold hover:bg-[#F9F7F1]"
              >
                Mon dashboard
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-b from-white to-[#fafafa] border-b border-[#f0f0f0]">
        <div className="max-w-7xl mx-auto px-5 md:px-8 py-10 md:py-14">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#003725]/5 text-[#003725] text-[11px] font-bold uppercase tracking-wider mb-4">
                <Store className="w-3 h-3" />
                Marketplace
              </div>
              <h1 className="text-[32px] md:text-[44px] font-bold tracking-tight text-[#1a1a1a] leading-[1.05] mb-3">
                Marketplace Actero
              </h1>
              <p className="text-[15px] md:text-[17px] text-[#555] max-w-2xl">
                Des templates et playbooks prets a l'emploi pour chaque secteur. Installez en un clic,
                personnalisez, lancez.
              </p>
            </div>
            {isLoggedIn && (
              <button
                onClick={() => onNavigate('/client/marketplace')}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#003725] text-white text-[13px] font-bold hover:bg-[#002a1c] transition-colors whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Publier mon template
              </button>
            )}
          </div>

          {/* Search */}
          <div className="mt-8 relative max-w-2xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un template, une categorie, un createur..."
              className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-white border border-[#f0f0f0] text-[14px] placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#003725]/20 focus:border-[#003725] transition"
            />
          </div>
        </div>
      </section>

      {/* Body */}
      <section className="max-w-7xl mx-auto px-5 md:px-8 py-8">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Mobile filter toggle */}
          <button
            onClick={() => setFiltersOpen((v) => !v)}
            className="md:hidden inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[#f0f0f0] bg-white text-[13px] font-semibold"
          >
            <Filter className="w-4 h-4" /> Filtres
          </button>

          {/* Sidebar filters */}
          <aside className={`md:w-64 flex-shrink-0 ${filtersOpen ? 'block' : 'hidden md:block'}`}>
            <div className="bg-white border border-[#f0f0f0] rounded-2xl p-5 sticky top-20">
              <h3 className="text-[11px] font-bold text-[#716D5C] uppercase tracking-widest mb-3">
                Categories
              </h3>
              <div className="space-y-1 mb-5">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCategory(c.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                      selectedCategory === c.id
                        ? 'bg-[#003725] text-white'
                        : 'text-[#555] hover:bg-[#F9F7F1]'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              <h3 className="text-[11px] font-bold text-[#716D5C] uppercase tracking-widest mb-3">
                Industrie
              </h3>
              <div className="flex flex-wrap gap-1.5 mb-5">
                {INDUSTRIES.map((ind) => (
                  <button
                    key={ind.id}
                    onClick={() => setSelectedIndustry(ind.id)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                      selectedIndustry === ind.id
                        ? 'bg-[#003725] text-white'
                        : 'bg-[#F9F7F1] text-[#555] hover:bg-[#eceae2]'
                    }`}
                  >
                    {ind.label}
                  </button>
                ))}
              </div>

              <h3 className="text-[11px] font-bold text-[#716D5C] uppercase tracking-widest mb-3">
                Prix
              </h3>
              <div className="flex flex-wrap gap-1.5 mb-5">
                {PRICE_FILTERS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPrice(p.id)}
                    className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${
                      selectedPrice === p.id
                        ? 'bg-[#003725] text-white'
                        : 'bg-[#F9F7F1] text-[#555] hover:bg-[#eceae2]'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <h3 className="text-[11px] font-bold text-[#716D5C] uppercase tracking-widest mb-3">
                Rating minimum
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {RATING_FILTERS.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedRating(r.id)}
                    className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${
                      selectedRating === r.id
                        ? 'bg-[#003725] text-white'
                        : 'bg-[#F9F7F1] text-[#555] hover:bg-[#eceae2]'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* Results grid */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[13px] text-[#716D5C] font-medium">
                {isLoading ? 'Chargement...' : `${filteredTemplates.length} template${filteredTemplates.length > 1 ? 's' : ''}`}
              </p>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-[#003725]" />
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="bg-white border border-[#f0f0f0] rounded-2xl p-12 text-center">
                <Tag className="w-10 h-10 text-[#cfcbbc] mx-auto mb-3" />
                <p className="text-[14px] font-semibold text-[#1a1a1a] mb-1">Aucun template trouve</p>
                <p className="text-[12px] text-[#716D5C]">
                  Essayez d'ajuster vos filtres ou votre recherche.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredTemplates.map((tpl) => (
                  <TemplateCard key={tpl.id || tpl.slug} template={tpl} onOpen={openTemplate} />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

export default MarketplacePage
