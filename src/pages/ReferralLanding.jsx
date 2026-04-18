import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Gift, ArrowRight, CheckCircle2, Shield, Zap, Clock, Star, Check, Crown } from 'lucide-react'
import { Logo } from '../components/layout/Logo'
import { PLANS, PLAN_ORDER } from '../lib/plans'

export const ReferralLanding = ({ code, onNavigate }) => {
  const [referrerName, setReferrerName] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })

    // Store code in cookie (90 days)
    const expires = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toUTCString()
    document.cookie = `referral_code=${code}; expires=${expires}; path=/; SameSite=Lax`

    // Track click
    const trackClick = async () => {
      try {
        const res = await fetch('/api/referral/track-click', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        })
        const data = await res.json()
        if (res.ok && data.referrer_name) {
          setReferrerName(data.referrer_name)
        } else {
          setError('Code de parrainage invalide')
        }
      } catch {
        setError('Erreur de connexion')
      }
      setLoading(false)
    }
    trackClick()
  }, [code])

  const handleCTA = () => {
    onNavigate(`/signup?referral_code=${code}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full"
        />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center text-[#262626]">
        <div className="text-center">
          <p className="text-red-400 text-lg mb-4">{error}</p>
          <button onClick={() => onNavigate('/')} className="text-emerald-400 font-bold">
            Retour a l'accueil
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white text-[#262626] overflow-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <button onClick={() => onNavigate('/')} className="flex items-center gap-2">
            <Logo className="w-7 h-7 text-[#262626]" />
            <span className="font-bold text-lg tracking-tight">Actero</span>
          </button>
          <button
            onClick={handleCTA}
            className="bg-cta hover:bg-[#003725] text-white px-5 py-2 rounded-xl text-sm font-bold transition-all"
          >
            Commencer
          </button>
        </div>
      </nav>

      {/* Hero */}
      <div className="pt-32 pb-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          {/* Referrer badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-8"
          >
            <Gift className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-medium text-emerald-400">
              Recommande par {referrerName}
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-4xl md:text-6xl font-bold tracking-tight leading-tight mb-6"
          >
            Automatisez votre business
            <br />
            <span className="text-emerald-400">avec l'IA</span>
          </motion.h1>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-8"
          >
            <div className="inline-block bg-gradient-to-r from-amber-500/10 to-emerald-500/10 border border-amber-500/20 rounded-2xl px-8 py-5">
              <p className="text-lg md:text-xl font-medium">
                <span className="text-emerald-400 font-bold">Votre premier mois offert</span>
                {referrerName ? ` grace a ${referrerName}` : ' grace a votre parrain'}
              </p>
              <p className="text-sm text-[#716D5C] mt-1">
                Inscrivez-vous et profitez d'un mois gratuit sur n'importe quel plan
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <button
              onClick={handleCTA}
              className="group bg-cta hover:bg-[#003725] text-white px-8 py-4 rounded-2xl text-lg font-bold transition-all inline-flex items-center gap-3 shadow-lg shadow-[#003725]/15"
            >
              Créer mon compte gratuitement
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <p className="text-sm text-[#716D5C] mt-4">Sans carte bancaire — Premier mois offert</p>
          </motion.div>
        </div>
      </div>

      {/* Benefits */}
      <div className="py-20 px-6 border-t border-gray-100">
        <div className="max-w-5xl mx-auto">
          <motion.h2
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-2xl md:text-3xl font-bold text-center mb-12"
          >
            Pourquoi nos clients nous recommandent
          </motion.h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: Zap,
                title: 'Deploiement rapide',
                desc: 'Vos automatisations sont opérationnelles en quelques jours, pas des mois.',
                color: 'amber',
              },
              {
                icon: Clock,
                title: '+40h économisées/mois',
                desc: 'Nos clients économisent en moyenne 40 heures de travail manuel par mois.',
                color: 'emerald',
              },
              {
                icon: Shield,
                title: 'ROI garanti',
                desc: 'Si vous ne voyez pas de résultats en 30 jours, on vous rembourse.',
                color: 'blue',
              },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-[#F9F7F1] rounded-2xl border border-gray-200 p-6 hover:border-gray-300 transition-colors"
              >
                <div className={`w-10 h-10 rounded-xl bg-${item.color}-500/10 flex items-center justify-center mb-4`}>
                  <item.icon className={`w-5 h-5 text-${item.color}-400`} />
                </div>
                <h3 className="text-lg font-bold mb-2">{item.title}</h3>
                <p className="text-sm text-[#716D5C] leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div className="py-20 px-6 border-t border-gray-100 bg-[#F9F7F1]">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-[11px] font-bold uppercase tracking-widest mb-4">
              <Gift className="w-3 h-3" />
              1er mois offert sur n'importe quel plan
            </div>
            <h2 className="text-2xl md:text-3xl font-bold mb-3">
              Nos plans
            </h2>
            <p className="text-[#716D5C] max-w-xl mx-auto">
              Choisissez le plan qui correspond à votre boutique. Grâce à votre parrain, le premier mois est offert.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {['free', 'starter', 'pro'].map((planId, i) => {
              const plan = PLANS[planId]
              const isPopular = plan.popular
              const features = {
                free: ['50 tickets / mois', '1 workflow actif', 'Intégration Shopify', 'Règles & limites'],
                starter: ['1 000 tickets / mois', '3 workflows actifs', 'Éditeur de marque', 'API + webhooks', 'Simulateur'],
                pro: ['5 000 tickets / mois', 'Workflows illimités', 'Agent vocal (200 min)', 'Agents spécialisés'],
              }[planId]

              return (
                <motion.div
                  key={planId}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className={`relative rounded-2xl p-6 border ${
                    isPopular
                      ? 'border-cta bg-white shadow-lg ring-2 ring-cta/10'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-cta text-white text-[10px] font-bold uppercase tracking-wider">
                      Populaire
                    </div>
                  )}

                  <div className="flex items-center gap-2 mb-1">
                    {isPopular && <Crown className="w-4 h-4 text-amber-500" />}
                    <h3 className="text-lg font-bold text-[#262626]">{plan.name}</h3>
                  </div>
                  <p className="text-xs text-[#716D5C] mb-4">{plan.tagline}</p>

                  <div className="mb-5">
                    {plan.price.monthly === 0 ? (
                      <>
                        <span className="text-3xl font-bold text-[#262626]">Gratuit</span>
                        <span className="text-xs text-[#716D5C] ml-1">à vie</span>
                      </>
                    ) : (
                      <>
                        <span className="text-3xl font-bold text-[#262626]">{plan.price.monthly}€</span>
                        <span className="text-xs text-[#716D5C] ml-1">/ mois</span>
                      </>
                    )}
                    {planId !== 'free' && (
                      <p className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
                        <Gift className="w-3 h-3" />
                        1er mois offert grâce au parrainage
                      </p>
                    )}
                  </div>

                  <ul className="space-y-2 mb-6">
                    {features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-xs text-[#262626]">
                        <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={handleCTA}
                    className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                      isPopular
                        ? 'bg-cta text-white hover:bg-[#003725]'
                        : 'bg-[#F9F7F1] text-[#262626] hover:bg-gray-100 border border-gray-200'
                    }`}
                  >
                    {planId === 'free' ? 'Commencer gratuitement' : 'Essayer 30 jours gratuits'}
                  </button>
                </motion.div>
              )
            })}
          </div>

          <p className="text-center text-[11px] text-[#716D5C] mt-6">
            Besoin de plus ? <span className="font-semibold">Plan Enterprise sur devis</span> — contactez contact@actero.fr
          </p>
        </div>
      </div>

      {/* Social proof */}
      <div className="py-20 px-6 border-t border-gray-100">
        <div className="max-w-3xl mx-auto text-center">
          <div className="flex items-center justify-center gap-1 mb-4">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-5 h-5 text-amber-400 fill-amber-400" />
            ))}
          </div>
          <p className="text-lg text-[#716D5C] mb-6 italic">
            "Actero a transformé notre support client. On a réduit nos temps de réponse de 80% en 2 semaines."
          </p>
          <p className="text-sm text-[#716D5C]">— Client Actero depuis 2025</p>
        </div>
      </div>

      {/* Final CTA */}
      <div className="py-20 px-6 border-t border-gray-100">
        <div className="max-w-2xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="bg-gradient-to-br from-emerald-500/10 to-blue-500/10 border border-emerald-500/20 rounded-3xl p-10"
          >
            <Gift className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
            <h3 className="text-2xl font-bold mb-3">Votre premier mois est offert</h3>
            <p className="text-[#716D5C] mb-6">
              {referrerName
                ? `Offert par ${referrerName}. Creez votre compte et profitez d'un mois gratuit.`
                : `Creez votre compte et profitez d'un mois gratuit grace a votre parrain.`}
            </p>
            <button
              onClick={handleCTA}
              className="bg-cta hover:bg-[#003725] text-white px-8 py-4 rounded-2xl text-lg font-bold transition-all inline-flex items-center gap-3"
            >
              Créer mon compte gratuitement
              <ArrowRight className="w-5 h-5" />
            </button>
            <div className="flex items-center justify-center gap-6 mt-6 text-sm text-[#716D5C]">
              <span className="flex items-center gap-1"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Premier mois offert</span>
              <span className="flex items-center gap-1"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Sans carte bancaire</span>
              <span className="flex items-center gap-1"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Sans engagement</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 px-6 text-center">
        <p className="text-sm text-[#716D5C]">&copy; 2026 Actero. Tous droits reserves.</p>
      </footer>
    </div>
  )
}
