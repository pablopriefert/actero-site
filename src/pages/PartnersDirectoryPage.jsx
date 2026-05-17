import React, { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Star, MapPin, Globe, Filter, Users, Award } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Navbar } from '../components/layout/Navbar'
import { Footer } from '../components/layout/Footer'
import { FadeInUp, StaggerContainer, StaggerItem } from '../components/ui/scroll-animations'
import { SEO } from '../components/SEO'

/**
 * /partners — Public directory of certified Actero partners.
 */
export const PartnersDirectoryPage = ({ onNavigate }) => {
  const [query, setQuery] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [industry, setIndustry] = useState('')
  const [language, setLanguage] = useState('')

  const { data: partners = [], isLoading } = useQuery({
    queryKey: ['partners-directory'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partners')
        .select(
          'id, slug, full_name, company_name, bio, avatar_url, specialties, industries, languages, rating, active_clients'
        )
        .eq('is_public', true)
        .order('rating', { ascending: false })
      if (error) throw error
      return data || []
    },
  })

  const allSpecialties = useMemo(() => {
    const s = new Set()
    partners.forEach((p) => (p.specialties || []).forEach((x) => s.add(x)))
    return Array.from(s).sort()
  }, [partners])

  const allIndustries = useMemo(() => {
    const s = new Set()
    partners.forEach((p) => (p.industries || []).forEach((x) => s.add(x)))
    return Array.from(s).sort()
  }, [partners])

  const allLanguages = useMemo(() => {
    const s = new Set()
    partners.forEach((p) => (p.languages || []).forEach((x) => s.add(x)))
    return Array.from(s).sort()
  }, [partners])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return partners.filter((p) => {
      if (q) {
        const hay = `${p.full_name} ${p.company_name || ''} ${p.bio || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (specialty && !(p.specialties || []).includes(specialty)) return false
      if (industry && !(p.industries || []).includes(industry)) return false
      if (language && !(p.languages || []).includes(language)) return false
      return true
    })
  }, [partners, query, specialty, industry, language])

  useEffect(() => {
    document.title = 'Annuaire Actero Partners'
  }, [])

  return (
    <>
      <SEO
        title="Annuaire Actero Partners — Experts certifiés"
        description="Trouvez un partenaire Actero certifié pour déployer l automatisation IA dans votre boutique e-commerce. Freelances et agences vérifiés."
        canonical="/partners"
      />
      <div className="relative min-h-screen bg-white font-sans text-[#262626]">
        <div className="fixed inset-0 z-0 pointer-events-none bg-gradient-to-b from-[#F9F7F1] to-white" />

        <div className="relative z-10 w-full">
          <Navbar onNavigate={onNavigate} />

          <main className="pt-32 pb-20 px-6">
            <div className="max-w-6xl mx-auto">
              <FadeInUp className="text-center mb-12">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 text-xs font-bold uppercase tracking-widest mb-6">
                  <Award className="w-3.5 h-3.5" />
                  Annuaire officiel
                </div>
                <h1 className="text-4xl md:text-5xl font-bold tracking-tighter mb-4">
                  Les partenaires Actero Certified
                </h1>
                <p className="text-[#716D5C] text-lg max-w-2xl mx-auto">
                  Trouvez un expert certifié pour vous accompagner dans votre déploiement Actero.
                </p>
                <button
                  onClick={() => onNavigate('/partners-program')}
                  className="inline-flex items-center gap-2 mt-6 text-sm text-indigo-500 font-semibold hover:underline"
                >
                  Devenir partenaire <Award className="w-4 h-4" />
                </button>
              </FadeInUp>

              {/* Filters */}
              <FadeInUp>
                <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-10 shadow-sm">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="md:col-span-2 relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Rechercher un partenaire..."
                        className="w-full pl-9 pr-4 py-2.5 bg-[#F9F7F1] border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-500/40"
                      />
                    </div>
                    <select
                      value={specialty}
                      onChange={(e) => setSpecialty(e.target.value)}
                      className="px-3 py-2.5 bg-[#F9F7F1] border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-500/40 cursor-pointer"
                    >
                      <option value="">Toutes spécialités</option>
                      {allSpecialties.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <select
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      className="px-3 py-2.5 bg-[#F9F7F1] border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-500/40 cursor-pointer"
                    >
                      <option value="">Toutes industries</option>
                      {allIndustries.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  {allLanguages.length > 0 && (
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      <Filter className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-xs text-gray-500">Langue:</span>
                      <button
                        onClick={() => setLanguage('')}
                        className={`px-2.5 py-1 text-xs rounded-full border ${
                          !language
                            ? 'bg-indigo-500 text-white border-indigo-500'
                            : 'bg-white text-[#716D5C] border-gray-200'
                        }`}
                      >
                        Toutes
                      </button>
                      {allLanguages.map((l) => (
                        <button
                          key={l}
                          onClick={() => setLanguage(l)}
                          className={`px-2.5 py-1 text-xs rounded-full border uppercase ${
                            language === l
                              ? 'bg-indigo-500 text-white border-indigo-500'
                              : 'bg-white text-[#716D5C] border-gray-200'
                          }`}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </FadeInUp>

              {/* Results */}
              {isLoading ? (
                <div className="text-center py-20 text-[#716D5C]">Chargement...</div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-20">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-[#716D5C]">
                    {partners.length === 0
                      ? 'Aucun partenaire certifié pour le moment.'
                      : 'Aucun résultat pour ces filtres.'}
                  </p>
                </div>
              ) : (
                <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filtered.map((p) => (
                    <StaggerItem key={p.id}>
                      <button
                        onClick={() => onNavigate(`/partners/${p.slug}`)}
                        className="w-full text-left p-6 rounded-2xl bg-white border border-gray-200 hover:border-indigo-500/30 hover:shadow-lg transition-all group h-full"
                      >
                        <div className="flex items-start gap-4 mb-4">
                          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                            {p.avatar_url ? (
                              <img
                                src={p.avatar_url}
                                alt={p.full_name}
                                className="w-full h-full rounded-full object-cover"
                              />
                            ) : (
                              p.full_name?.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="font-bold text-base truncate group-hover:text-indigo-500 transition-colors">
                              {p.full_name}
                            </h3>
                            {p.company_name && (
                              <p className="text-xs text-[#716D5C] truncate">{p.company_name}</p>
                            )}
                            {p.rating > 0 && (
                              <div className="flex items-center gap-1 mt-1">
                                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                <span className="text-xs font-semibold">{Number(p.rating).toFixed(1)}</span>
                              </div>
                            )}
                          </div>
                          <span className="px-2 py-1 text-[10px] font-bold bg-indigo-500/10 text-indigo-600 rounded-full whitespace-nowrap">
                            CERTIFIED
                          </span>
                        </div>
                        {p.bio && (
                          <p className="text-sm text-[#716D5C] leading-relaxed line-clamp-3 mb-4">
                            {p.bio}
                          </p>
                        )}
                        {(p.specialties || []).length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {p.specialties.slice(0, 3).map((s) => (
                              <span
                                key={s}
                                className="px-2 py-0.5 text-[11px] font-medium bg-gray-100 text-[#716D5C] rounded-full"
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        )}
                      </button>
                    </StaggerItem>
                  ))}
                </StaggerContainer>
              )}
            </div>
          </main>

          <Footer onNavigate={onNavigate} />
        </div>
      </div>
    </>
  )
}
