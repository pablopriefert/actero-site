import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  Globe,
  Linkedin,
  Mail,
  Star,
  Users,
  Award,
  ExternalLink,
  Copy,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Navbar } from '../components/layout/Navbar'
import { Footer } from '../components/layout/Footer'
import { FadeInUp } from '../components/ui/scroll-animations'
import { SEO } from '../components/SEO'

/**
 * /partners/:slug — Public profile page for a certified Actero Partner.
 */
export const PartnerProfilePage = ({ slug, onNavigate }) => {
  const { data: partner, isLoading } = useQuery({
    queryKey: ['partner-profile', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partners')
        .select('*')
        .eq('slug', slug)
        .eq('is_public', true)
        .maybeSingle()
      if (error) throw error
      return data
    },
    enabled: !!slug,
  })

  const referralLink = useMemo(() => {
    if (!partner?.referral_code) return ''
    return `https://actero.fr/?ref=${partner.referral_code}`
  }, [partner])

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink)
    } catch { /* ignored */ }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-[#716D5C]">Chargement...</div>
      </div>
    )
  }

  if (!partner) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar onNavigate={onNavigate} />
        <div className="pt-32 text-center px-6">
          <h1 className="text-3xl font-bold mb-4">Partenaire introuvable</h1>
          <p className="text-[#716D5C] mb-6">Ce profil n existe pas ou n est plus public.</p>
          <button
            onClick={() => onNavigate('/partners')}
            className="px-6 py-3 bg-indigo-500 text-white font-bold rounded-full"
          >
            Voir l annuaire
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <SEO
        title={`${partner.full_name} — Actero Certified Partner`}
        description={partner.bio?.slice(0, 150) || `${partner.full_name}, partenaire certifié Actero.`}
        canonical={`/partners/${partner.slug}`}
      />
      <div className="relative min-h-screen bg-white font-sans text-[#262626]">
        <div className="fixed inset-0 z-0 pointer-events-none bg-gradient-to-b from-[#F9F7F1] to-white" />

        <div className="relative z-10 w-full">
          <Navbar onNavigate={onNavigate} />

          <main className="pt-32 pb-20 px-6">
            <div className="max-w-4xl mx-auto">
              <button
                onClick={() => onNavigate('/partners')}
                className="inline-flex items-center gap-2 text-sm text-[#716D5C] hover:text-indigo-500 mb-6 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Retour à l annuaire
              </button>

              <FadeInUp>
                <div className="bg-white border border-gray-200 rounded-3xl p-8 md:p-12 shadow-sm">
                  <div className="flex flex-col md:flex-row items-start gap-6 mb-8">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white font-bold text-3xl flex-shrink-0">
                      {partner.avatar_url ? (
                        <img
                          src={partner.avatar_url}
                          alt={partner.full_name}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        partner.full_name?.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-3 mb-2">
                        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                          {partner.full_name}
                        </h1>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-indigo-500/10 text-indigo-600 rounded-full">
                          <Award className="w-3 h-3" />
                          CERTIFIED
                        </span>
                      </div>
                      {partner.company_name && (
                        <p className="text-lg text-[#716D5C] mb-3">{partner.company_name}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-4 text-sm text-[#716D5C]">
                        {partner.rating > 0 && (
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                            <span className="font-semibold">
                              {Number(partner.rating).toFixed(1)}
                            </span>
                          </div>
                        )}
                        {partner.active_clients > 0 && (
                          <div className="flex items-center gap-1.5">
                            <Users className="w-4 h-4" />
                            <span>{partner.active_clients} clients actifs</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {partner.bio && (
                    <div className="mb-8">
                      <h2 className="text-sm font-bold uppercase tracking-widest text-[#716D5C] mb-3">
                        À propos
                      </h2>
                      <p className="text-[#262626] leading-relaxed whitespace-pre-line">
                        {partner.bio}
                      </p>
                    </div>
                  )}

                  {(partner.specialties || []).length > 0 && (
                    <div className="mb-6">
                      <h2 className="text-sm font-bold uppercase tracking-widest text-[#716D5C] mb-3">
                        Spécialités
                      </h2>
                      <div className="flex flex-wrap gap-2">
                        {partner.specialties.map((s) => (
                          <span
                            key={s}
                            className="px-3 py-1.5 text-sm font-medium bg-indigo-500/10 text-indigo-600 rounded-full"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {(partner.industries || []).length > 0 && (
                    <div className="mb-6">
                      <h2 className="text-sm font-bold uppercase tracking-widest text-[#716D5C] mb-3">
                        Industries
                      </h2>
                      <div className="flex flex-wrap gap-2">
                        {partner.industries.map((i) => (
                          <span
                            key={i}
                            className="px-3 py-1.5 text-sm font-medium bg-gray-100 text-[#716D5C] rounded-full"
                          >
                            {i}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-8 mt-8 border-t border-gray-200">
                    <div className="flex flex-wrap gap-3">
                      {partner.website && (
                        <a
                          href={partner.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-full text-sm font-semibold hover:border-indigo-500/30 transition-colors"
                        >
                          <Globe className="w-4 h-4" />
                          Site web
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {partner.linkedin && (
                        <a
                          href={partner.linkedin}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-full text-sm font-semibold hover:border-indigo-500/30 transition-colors"
                        >
                          <Linkedin className="w-4 h-4" />
                          LinkedIn
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      <a
                        href={`mailto:contact@actero.fr?subject=Contact%20avec%20${encodeURIComponent(partner.full_name)}`}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-full text-sm font-semibold hover:border-indigo-500/30 transition-colors"
                      >
                        <Mail className="w-4 h-4" />
                        Contacter
                      </a>
                    </div>

                    <div className="mt-6 p-5 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div>
                          <h3 className="font-bold text-lg mb-1">
                            Travailler avec {partner.full_name.split(' ')[0]}
                          </h3>
                          <p className="text-sm opacity-90">
                            Utilisez ce lien pour démarrer votre projet Actero avec cet expert.
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={copyLink}
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/15 hover:bg-white/25 backdrop-blur text-white font-semibold rounded-full text-sm transition-colors"
                          >
                            <Copy className="w-4 h-4" />
                            Copier le lien
                          </button>
                          <a
                            href={referralLink}
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-indigo-600 font-bold rounded-full text-sm hover:scale-105 transition-transform"
                          >
                            Démarrer
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </FadeInUp>
            </div>
          </main>

          <Footer onNavigate={onNavigate} />
        </div>
      </div>
    </>
  )
}
