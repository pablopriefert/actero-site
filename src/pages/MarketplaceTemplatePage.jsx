import React, { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Star,
  Download,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  User,
  Sparkles,
  BookOpen,
  Shield,
  MessageSquare,
  Package,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/ui/Toast'

const StarRow = ({ rating = 0, size = 'md' }) => {
  const sizeClass = size === 'md' ? 'w-4 h-4' : 'w-5 h-5'
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

// Lightweight markdown-like renderer (paragraphs + line-breaks + bullet lists)
const RichText = ({ text }) => {
  if (!text) return null
  const blocks = text.split(/\n\s*\n/)
  return (
    <div className="space-y-4 text-[14px] leading-[1.7] text-[#333]">
      {blocks.map((block, i) => {
        const lines = block.split('\n')
        const isList = lines.every((l) => l.trim().startsWith('- ') || l.trim().startsWith('* '))
        if (isList) {
          return (
            <ul key={i} className="list-disc pl-5 space-y-1">
              {lines.map((l, j) => (
                <li key={j}>{l.replace(/^[-*]\s*/, '')}</li>
              ))}
            </ul>
          )
        }
        if (block.trim().startsWith('# ')) {
          return (
            <h2 key={i} className="text-[20px] font-bold text-[#1a1a1a] mt-6 mb-2">
              {block.replace(/^#\s*/, '')}
            </h2>
          )
        }
        if (block.trim().startsWith('## ')) {
          return (
            <h3 key={i} className="text-[16px] font-bold text-[#1a1a1a] mt-4 mb-1">
              {block.replace(/^##\s*/, '')}
            </h3>
          )
        }
        return (
          <p key={i} className="whitespace-pre-line">
            {block}
          </p>
        )
      })}
    </div>
  )
}

export const MarketplaceTemplatePage = ({ slug, onNavigate }) => {
  const toast = useToast()
  const [activeTab, setActiveTab] = useState('details')
  const [installing, setInstalling] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setIsLoggedIn(!!data?.session)
    })
  }, [])

  const { data: template, isLoading } = useQuery({
    queryKey: ['marketplace-template', slug],
    queryFn: async () => {
      try {
        const res = await fetch(`/api/marketplace/template/${slug}`)
        if (res.ok) {
          const data = await res.json()
          return data.template || data
        }
      } catch (_e) {
        // fallback
      }
      const { data, error } = await supabase
        .from('marketplace_templates')
        .select('*')
        .or(`slug.eq.${slug},id.eq.${slug}`)
        .maybeSingle()
      if (error) {
        console.warn('Marketplace template query error:', error.message)
        return null
      }
      return data
    },
    enabled: !!slug,
  })

  const { data: ratings = [] } = useQuery({
    queryKey: ['marketplace-ratings', template?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketplace_ratings')
        .select('*')
        .eq('template_id', template.id)
        .order('created_at', { ascending: false })
      if (error) {
        console.warn('Marketplace ratings query error:', error.message)
        return []
      }
      return data || []
    },
    enabled: !!template?.id,
  })

  const { data: installs = [] } = useQuery({
    queryKey: ['marketplace-installs', template?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketplace_installs')
        .select('id, created_at, client_brand_name')
        .eq('template_id', template.id)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) {
        console.warn('Marketplace installs query error:', error.message)
        return []
      }
      return data || []
    },
    enabled: !!template?.id,
  })

  const handleInstall = async () => {
    if (!isLoggedIn) {
      toast.info('Connectez-vous pour installer ce template')
      onNavigate('/login')
      return
    }
    if (installing) return
    setInstalling(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const price = Number(template?.price_eur || 0)

      if (price === 0) {
        const res = await fetch('/api/marketplace/install', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ template_id: template.id, slug: template.slug }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error || 'Installation impossible')
        toast.success('Template installe avec succes')
        setTimeout(() => onNavigate('/client'), 800)
      } else {
        // Paid → Stripe checkout
        const res = await fetch('/api/marketplace/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ template_id: template.id, slug: template.slug }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error || 'Checkout impossible')
        if (data.url) {
          window.location.href = data.url
        } else {
          throw new Error('URL de paiement manquante')
        }
      }
    } catch (e) {
      toast.error(e?.message || 'Une erreur est survenue')
    } finally {
      setInstalling(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#003725]" />
      </div>
    )
  }

  if (!template) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center text-center px-6">
        <div>
          <p className="text-[18px] font-bold text-[#1a1a1a] mb-2">Template introuvable</p>
          <p className="text-[13px] text-[#716D5C] mb-4">
            Ce template n'existe plus ou n'est plus publie.
          </p>
          <button
            onClick={() => onNavigate('/marketplace')}
            className="px-4 py-2 rounded-xl bg-[#003725] text-white text-[13px] font-bold"
          >
            Retour au marketplace
          </button>
        </div>
      </div>
    )
  }

  const price = Number(template.price_eur ?? template.price ?? 0)
  const isFree = price === 0
  const installsCount = template.installs_count ?? template.install_count ?? 0
  const ratingValue = template.avg_rating ?? template.rating ?? 0
  const ratingCount = template.ratings_count ?? template.rating_count ?? 0
  const isActeroPick = template.is_actero_pick === true
  const contents = template.contents || template.included || {}
  const promptsCount = contents.prompts_count || (Array.isArray(contents.prompts) ? contents.prompts.length : 0)
  const rulesCount = contents.rules_count || (Array.isArray(contents.rules) ? contents.rules.length : 0)
  const kbCount = contents.kb_count || (Array.isArray(contents.kb_entries) ? contents.kb_entries.length : 0)
  const examplesCount = contents.examples_count || (Array.isArray(contents.examples) ? contents.examples.length : 0)

  return (
    <div className="min-h-screen bg-[#fafafa] text-[#1a1a1a]">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-[#f0f0f0]">
        <div className="max-w-6xl mx-auto px-5 md:px-8 h-14 flex items-center justify-between">
          <button
            onClick={() => onNavigate('/marketplace')}
            className="flex items-center gap-2 text-[13px] font-semibold hover:text-[#003725]"
          >
            <ArrowLeft className="w-4 h-4" />
            Marketplace
          </button>
          <div />
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-5 md:px-8 py-8 md:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main column */}
          <div className="lg:col-span-2 min-w-0">
            <div className="aspect-[16/9] rounded-3xl overflow-hidden bg-gradient-to-br from-[#F9F7F1] to-[#eceae2] mb-6 border border-[#f0f0f0]">
              {template.preview_image ? (
                <img src={template.preview_image} alt={template.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Sparkles className="w-16 h-16 text-[#cfcbbc]" />
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-3">
              {isActeroPick && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-cta text-white text-[11px] font-medium">
                  <span>⭐</span>
                  <span>Actero Pick</span>
                </span>
              )}
              {template.category && (
                <span className="px-2.5 py-1 rounded-full bg-[#003725]/5 text-[#003725] text-[11px] font-bold uppercase tracking-wider">
                  {template.category}
                </span>
              )}
              {template.industry && (
                <span className="px-2.5 py-1 rounded-full bg-[#F9F7F1] text-[#555] text-[11px] font-bold uppercase tracking-wider">
                  {template.industry}
                </span>
              )}
            </div>

            <h1 className="text-[30px] md:text-[36px] font-bold tracking-tight leading-[1.1] mb-3">
              {template.name}
            </h1>

            <div className="flex flex-wrap items-center gap-4 mb-6 text-[13px] text-[#716D5C]">
              <div className="flex items-center gap-1.5">
                <User className="w-4 h-4" />
                <span className="font-semibold text-[#1a1a1a]">{template.creator_name || 'Createur Actero'}</span>
              </div>
              {ratingCount > 0 ? (
                <div className="flex items-center gap-1.5">
                  <StarRow rating={ratingValue} />
                  <span>
                    {Number(ratingValue).toFixed(1)} ({ratingCount} avis)
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-[#9ca3af]">
                  <Star className="w-4 h-4" />
                  <span>Non noté</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                {installsCount >= 50 ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-50 text-red-700 border border-red-200">
                    <span>🔥</span>
                    <span>Populaire · {installsCount}</span>
                  </span>
                ) : installsCount >= 10 ? (
                  <span className="inline-flex items-center gap-1 text-[#716D5C]">
                    <Download className="w-4 h-4" />
                    <span>{installsCount} installations</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                    <span>🆕</span>
                    <span>Nouveau</span>
                  </span>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-[#f0f0f0] mb-6">
              <div className="flex items-center gap-1">
                {[
                  { id: 'details', label: 'Details' },
                  { id: 'reviews', label: `Avis${ratings.length ? ` (${ratings.length})` : ''}` },
                  { id: 'installs', label: `Installations${installs.length ? ` (${installs.length})` : ''}` },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2.5 text-[13px] font-semibold border-b-2 transition-colors ${
                      activeTab === tab.id
                        ? 'text-[#003725] border-[#003725]'
                        : 'text-[#716D5C] border-transparent hover:text-[#1a1a1a]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {activeTab === 'details' && (
              <div>
                <RichText text={template.description || template.long_description || template.short_description || ''} />

                {/* Ce que vous obtenez */}
                <div className="mt-10">
                  <h3 className="text-[18px] font-bold text-[#1a1a1a] mb-4">Ce que vous obtenez</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { icon: MessageSquare, label: 'Prompts', value: promptsCount, color: 'bg-emerald-50 text-emerald-700' },
                      { icon: Shield, label: 'Regles', value: rulesCount, color: 'bg-amber-50 text-amber-700' },
                      { icon: BookOpen, label: 'Base de savoir', value: kbCount, color: 'bg-blue-50 text-blue-700' },
                      { icon: Package, label: 'Exemples', value: examplesCount, color: 'bg-violet-50 text-violet-700' },
                    ].map((item, i) => (
                      <div key={i} className="bg-white border border-[#f0f0f0] rounded-2xl p-4 flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.color}`}>
                          <item.icon className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[11px] text-[#716D5C] font-medium uppercase tracking-wider">{item.label}</p>
                          <p className="text-[18px] font-bold text-[#1a1a1a]">{item.value}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="space-y-4">
                {ratings.length === 0 ? (
                  <div className="bg-white border border-[#f0f0f0] rounded-2xl p-8 text-center">
                    <Star className="w-8 h-8 text-[#cfcbbc] mx-auto mb-2" />
                    <p className="text-[13px] text-[#716D5C]">Pas encore d'avis. Soyez le premier !</p>
                  </div>
                ) : (
                  ratings.map((r) => (
                    <div key={r.id} className="bg-white border border-[#f0f0f0] rounded-2xl p-5">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-[#F9F7F1] flex items-center justify-center">
                            <User className="w-3.5 h-3.5 text-[#716D5C]" />
                          </div>
                          <div>
                            <p className="text-[13px] font-semibold">{r.reviewer_name || 'Client Actero'}</p>
                            <p className="text-[10px] text-[#9ca3af]">
                              {r.created_at ? new Date(r.created_at).toLocaleDateString('fr-FR') : ''}
                            </p>
                          </div>
                        </div>
                        <StarRow rating={r.rating || 0} />
                      </div>
                      {r.review && <p className="text-[13px] text-[#333] leading-[1.6] mt-2">{r.review}</p>}
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'installs' && (
              <div className="bg-white border border-[#f0f0f0] rounded-2xl overflow-hidden">
                {installs.length === 0 ? (
                  <div className="p-8 text-center">
                    <Download className="w-8 h-8 text-[#cfcbbc] mx-auto mb-2" />
                    <p className="text-[13px] text-[#716D5C]">Aucune installation pour l'instant.</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-[#f0f0f0]">
                    {installs.map((inst) => (
                      <li key={inst.id} className="flex items-center justify-between px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-lg bg-[#F9F7F1] flex items-center justify-center">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#003725]" />
                          </div>
                          <p className="text-[13px] font-medium">{inst.client_brand_name || 'Client anonyme'}</p>
                        </div>
                        <span className="text-[11px] text-[#9ca3af]">
                          {inst.created_at ? new Date(inst.created_at).toLocaleDateString('fr-FR') : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Sticky purchase card */}
          <aside className="lg:col-span-1">
            <div className="sticky top-20">
              <div className="bg-white border border-[#f0f0f0] rounded-3xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
                <div className="mb-5">
                  <p className="text-[11px] font-bold text-[#716D5C] uppercase tracking-widest mb-2">
                    {isFree ? 'Gratuit' : 'Achat unique'}
                  </p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-[36px] font-bold tracking-tight text-[#1a1a1a]">
                      {isFree ? 'Gratuit' : `${price.toFixed(0)}€`}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleInstall}
                  disabled={installing}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl bg-[#003725] text-white text-[14px] font-bold hover:bg-[#002a1c] disabled:opacity-60 transition-colors mb-3"
                >
                  {installing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Traitement...
                    </>
                  ) : isFree ? (
                    <>
                      <Download className="w-4 h-4" />
                      Installer
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Acheter {price.toFixed(0)}€
                    </>
                  )}
                </button>

                <p className="text-[11px] text-[#9ca3af] text-center mb-5">
                  {isFree
                    ? 'Installation immediate dans votre dashboard'
                    : 'Paiement securise via Stripe'}
                </p>

                <div className="border-t border-[#f0f0f0] pt-4 space-y-2.5 text-[12px]">
                  {[
                    'Installation en 1 clic',
                    'Personnalisable a 100%',
                    'Support inclus 30 jours',
                    'Mises a jour gratuites',
                  ].map((feat, i) => (
                    <div key={i} className="flex items-start gap-2 text-[#555]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#003725] mt-0.5 flex-shrink-0" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

export default MarketplaceTemplatePage
