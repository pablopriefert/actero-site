import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Award,
  BadgeCheck,
  ChevronDown,
  DollarSign,
  Globe,
  Handshake,
  Rocket,
  Sparkles,
  UserCheck,
  CheckCircle2,
} from 'lucide-react'
import { Navbar } from '../components/layout/Navbar'
import { Footer } from '../components/layout/Footer'
import {
  FadeInUp,
  StaggerContainer,
  StaggerItem,
  ScaleIn,
} from '../components/ui/scroll-animations'
import { SEO } from '../components/SEO'

/**
 * Public landing page for the Actero Partners certification program.
 * Route: /partners-program
 */
export const PartnersLandingPage = ({ onNavigate }) => {
  const [openFaqIndex, setOpenFaqIndex] = useState(null)

  const benefits = [
    {
      icon: DollarSign,
      title: 'Commission 20% récurrente',
      desc: 'Sur l\'intégralité de l\'abonnement de chaque client que vous apportez, à vie.',
    },
    {
      icon: BadgeCheck,
      title: 'Badge officiel Actero Certified',
      desc: 'Affichez votre statut de partenaire certifié sur votre site, LinkedIn et vos devis.',
    },
    {
      icon: Globe,
      title: 'Profil public sur actero.fr/partners',
      desc: 'Gagnez en visibilité grâce à un profil public référencé dans notre annuaire.',
    },
  ]

  const steps = [
    { num: '01', title: 'Postuler', desc: 'Remplissez le formulaire de candidature en 2 minutes.' },
    { num: '02', title: 'Revue', desc: 'Notre équipe étudie votre profil sous 48h et valide votre dossier.' },
    { num: '03', title: 'Paiement 500€', desc: 'Vous réglez les frais de certification via un lien Stripe sécurisé.' },
    { num: '04', title: 'Certification', desc: 'Vous recevez votre badge, votre profil public et votre lien de referral unique.' },
  ]

  const partnerBenefits = [
    {
      title: 'Commission récurrente',
      role: 'Pour freelances & consultants e-commerce',
      text: 'Touchez une commission chaque mois sur chaque client que vous apportez, tant qu il reste abonné. Un revenu récurrent qui change l économie de votre activité de conseil.',
    },
    {
      title: 'Revendez sans gérer la tech',
      role: 'Pour les agences marketing',
      text: 'Proposez Actero à vos clients e-commerce sans avoir à gérer l infrastructure : on s occupe du produit, vous gardez la relation client.',
    },
    {
      title: 'Profil public & leads entrants',
      role: 'Pour les consultants Shopify',
      text: 'Votre profil certifié vous rend visible dans notre annuaire partenaires et peut vous apporter des leads entrants qualifiés.',
    },
  ]

  const faqItems = [
    {
      q: 'Pourquoi la certification est-elle payante (500€) ?',
      a: 'Pour garantir la qualité du réseau. Nous voulons uniquement des partenaires engagés, sérieux et prêts à défendre la marque. Les 500€ servent à financer votre formation, votre onboarding, votre badge, votre profil public et votre support dédié.',
    },
    {
      q: 'Comment fonctionne la commission de 20% ?',
      a: 'Chaque fois qu\'un client s\'inscrit via votre lien de referral unique, vous touchez 20% de son abonnement mensuel, chaque mois, tant que le client reste actif. C\'est une rente récurrente.',
    },
    {
      q: 'Combien de temps prend la certification ?',
      a: 'Sous 48h nous revenons vers vous après votre candidature. Une fois le paiement effectué, votre profil est créé immédiatement et vous accédez à votre dashboard partner.',
    },
    {
      q: 'Est-ce que je peux être refusé ?',
      a: 'Oui. Nous acceptons les profils freelance ou agences avec une expérience minimum en e-commerce ou conseil digital. Si votre dossier est refusé, aucun paiement n\'est prélevé.',
    },
    {
      q: 'Est-ce que j\'ai un engagement de durée ?',
      a: 'Non. La certification est annuelle, renouvelable. Pas d\'engagement contraignant.',
    },
    {
      q: 'Quel support je reçois en tant que partner ?',
      a: 'Onboarding vidéo, accès à notre playbook de vente, support Slack dédié, mises à jour produit en avant-première et un CSM partner.',
    },
  ]

  return (
    <>
      <SEO
        title="Actero Partners — Programme de Certification | Commission 20%"
        description="Devenez Actero Certified Partner. 500€ pour la certification, badge officiel, profil public, et 20% de commission récurrente sur chaque client apporté."
        canonical="/partners-program"
      />
      <div className="relative min-h-screen bg-white font-sans text-[#262626] selection:bg-indigo-500/20 selection:text-[#262626]">
        <div className="fixed inset-0 z-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-b from-[#F9F7F1] to-white" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-indigo-500/5 rounded-full blur-[120px]" />
          <div className="absolute top-1/3 right-0 w-[400px] h-[400px] bg-violet-500/5 rounded-full blur-[100px]" />
        </div>

        <div className="relative z-10 w-full">
          <Navbar onNavigate={onNavigate} />

          <main>
            {/* HERO */}
            <section className="pt-36 pb-24 md:pt-44 md:pb-32 px-6">
              <FadeInUp className="max-w-4xl mx-auto text-center">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 text-xs font-bold uppercase tracking-widest mb-8">
                  <Award className="w-3.5 h-3.5" />
                  Programme de certification
                </div>
                <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tighter mb-6 leading-[1.05]">
                  Devenez{' '}
                  <span className="bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-500 bg-clip-text text-transparent">
                    Actero Certified Partner
                  </span>
                </h1>
                <p className="text-xl md:text-2xl text-[#716D5C] font-medium max-w-3xl mx-auto leading-relaxed mb-4">
                  Rejoignez le réseau officiel des freelances et agences qui revendent Actero à leurs clients. Commission 20% récurrente, badge officiel, profil public.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-12">
                  <button
                    onClick={() => onNavigate('/partners/apply')}
                    className="px-8 py-4 bg-indigo-500 hover:bg-indigo-400 text-white font-bold rounded-full text-lg transition-all hover:scale-105 shadow-lg shadow-indigo-500/25"
                  >
                    Postuler maintenant
                  </button>
                  <button
                    onClick={() => onNavigate('/partners')}
                    className="px-8 py-4 bg-white hover:bg-gray-50 text-[#262626] font-bold rounded-full text-lg transition-all border border-gray-200"
                  >
                    Voir l annuaire
                  </button>
                </div>
              </FadeInUp>
            </section>

            {/* 3 BÉNÉFICES */}
            <section className="py-24 px-6">
              <div className="max-w-6xl mx-auto">
                <FadeInUp className="text-center mb-16">
                  <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                    3 raisons de devenir partner
                  </h2>
                  <p className="text-[#716D5C] text-lg max-w-2xl mx-auto">
                    Un programme pensé pour les pros du digital qui veulent ajouter une rente récurrente à leur activité.
                  </p>
                </FadeInUp>
                <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {benefits.map((b, i) => (
                    <StaggerItem key={i}>
                      <div className="p-8 rounded-2xl bg-gray-50 border border-gray-200 hover:border-indigo-500/30 transition-all group h-full">
                        <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-6 group-hover:bg-indigo-500/20 transition-colors">
                          <b.icon className="w-7 h-7 text-indigo-500" />
                        </div>
                        <h3 className="text-xl font-bold mb-3">{b.title}</h3>
                        <p className="text-[#716D5C] leading-relaxed">{b.desc}</p>
                      </div>
                    </StaggerItem>
                  ))}
                </StaggerContainer>
              </div>
            </section>

            {/* PROCESSUS */}
            <section className="py-24 px-6 bg-gray-50/50">
              <div className="max-w-5xl mx-auto">
                <FadeInUp className="text-center mb-16">
                  <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                    Comment devenir certifié
                  </h2>
                  <p className="text-[#716D5C] text-lg">Un process clair en 4 étapes.</p>
                </FadeInUp>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  {steps.map((s, i) => (
                    <ScaleIn key={i} delay={i * 0.1}>
                      <div className="p-6 rounded-2xl bg-white border border-gray-200 h-full">
                        <div className="text-4xl font-black text-indigo-500/30 mb-4">{s.num}</div>
                        <h3 className="text-lg font-bold mb-2">{s.title}</h3>
                        <p className="text-sm text-[#716D5C] leading-relaxed">{s.desc}</p>
                      </div>
                    </ScaleIn>
                  ))}
                </div>
              </div>
            </section>

            {/* CE QUE LE PROGRAMME APPORTE */}
            <section className="py-24 px-6">
              <div className="max-w-6xl mx-auto">
                <FadeInUp className="text-center mb-16">
                  <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                    Ce que le programme Partners vous apporte
                  </h2>
                </FadeInUp>
                <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {partnerBenefits.map((t, i) => (
                    <StaggerItem key={i}>
                      <div className="p-8 rounded-2xl bg-gray-50 border border-gray-200 h-full">
                        <p className="text-[#262626] leading-relaxed mb-6">{t.text}</p>
                        <div>
                          <div className="font-bold text-sm">{t.title}</div>
                          <div className="text-xs text-[#716D5C]">{t.role}</div>
                        </div>
                      </div>
                    </StaggerItem>
                  ))}
                </StaggerContainer>
              </div>
            </section>

            {/* FAQ */}
            <section className="py-24 px-6 bg-gray-50/50">
              <div className="max-w-3xl mx-auto">
                <FadeInUp className="text-center mb-16">
                  <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                    Questions fréquentes
                  </h2>
                </FadeInUp>
                <div className="space-y-3">
                  {faqItems.map((faq, i) => (
                    <FadeInUp key={i} delay={i * 0.05}>
                      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                        <button
                          onClick={() => setOpenFaqIndex(openFaqIndex === i ? null : i)}
                          className="w-full flex items-center justify-between px-6 py-5 text-left group"
                        >
                          <span className="font-semibold text-base pr-4">{faq.q}</span>
                          <motion.div
                            animate={{ rotate: openFaqIndex === i ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <ChevronDown className="w-5 h-5 text-[#716D5C] group-hover:text-indigo-500 transition-colors flex-shrink-0" />
                          </motion.div>
                        </button>
                        <AnimatePresence>
                          {openFaqIndex === i && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.25 }}
                            >
                              <div className="px-6 pb-5 text-sm text-[#716D5C] leading-relaxed">
                                {faq.a}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </FadeInUp>
                  ))}
                </div>
              </div>
            </section>

            {/* CTA FINAL */}
            <section className="py-24 px-6">
              <FadeInUp className="max-w-3xl mx-auto text-center">
                <div className="p-12 rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-xl shadow-indigo-500/25">
                  <Sparkles className="w-12 h-12 mx-auto mb-6 opacity-90" />
                  <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                    Prêt à rejoindre le réseau ?
                  </h2>
                  <p className="text-lg opacity-90 mb-8 max-w-xl mx-auto">
                    Candidatez maintenant, recevez une réponse sous 48h, et commencez à générer des commissions récurrentes.
                  </p>
                  <button
                    onClick={() => onNavigate('/partners/apply')}
                    className="px-10 py-4 bg-white text-indigo-600 font-bold rounded-full text-lg hover:scale-105 transition-transform"
                  >
                    Postuler — 500€ certification
                  </button>
                  <div className="flex items-center justify-center gap-6 mt-6 text-sm opacity-90">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      Pas d engagement
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      Remboursement si refusé
                    </div>
                  </div>
                </div>
              </FadeInUp>
            </section>
          </main>

          <Footer onNavigate={onNavigate} />
        </div>
      </div>
    </>
  )
}
