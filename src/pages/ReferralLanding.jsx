import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Gift, ArrowRight, CheckCircle2, Shield, Zap, Clock, Star } from 'lucide-react'
import { Logo } from '../components/layout/Logo'

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
    onNavigate(`/audit?referral_code=${code}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#030303] flex items-center justify-center">
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
      <div className="min-h-screen bg-[#030303] flex items-center justify-center text-white">
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
    <div className="min-h-screen bg-[#030303] text-white overflow-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#030303]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <button onClick={() => onNavigate('/')} className="flex items-center gap-2">
            <Logo className="w-7 h-7 text-white" />
            <span className="font-bold text-lg tracking-tight">Actero</span>
          </button>
          <button
            onClick={handleCTA}
            className="bg-emerald-500 hover:bg-emerald-400 text-black px-5 py-2 rounded-xl text-sm font-bold transition-all"
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
                Frais de setup de{' '}
                <span className="line-through text-gray-500">800&#8364;</span>{' '}
                <span className="text-emerald-400 font-bold">offerts</span>{' '}
                grace a votre parrain
              </p>
              <p className="text-sm text-gray-400 mt-1">
                Soit 800&#8364; d'economie immediate sur votre demarrage
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
              className="group bg-emerald-500 hover:bg-emerald-400 text-black px-8 py-4 rounded-2xl text-lg font-bold transition-all inline-flex items-center gap-3 shadow-lg shadow-emerald-500/25"
            >
              Reserver mon audit gratuit
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <p className="text-sm text-gray-500 mt-4">15 min — 100% gratuit — Sans engagement</p>
          </motion.div>
        </div>
      </div>

      {/* Benefits */}
      <div className="py-20 px-6 border-t border-white/5">
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
                desc: 'Vos automatisations sont operationnelles en quelques jours, pas des mois.',
                color: 'amber',
              },
              {
                icon: Clock,
                title: '+40h economisees/mois',
                desc: 'Nos clients economisent en moyenne 40 heures de travail manuel par mois.',
                color: 'emerald',
              },
              {
                icon: Shield,
                title: 'ROI garanti',
                desc: 'Si vous ne voyez pas de resultats en 30 jours, on vous rembourse.',
                color: 'blue',
              },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-[#0a0a0a] rounded-2xl border border-white/10 p-6 hover:border-white/20 transition-colors"
              >
                <div className={`w-10 h-10 rounded-xl bg-${item.color}-500/10 flex items-center justify-center mb-4`}>
                  <item.icon className={`w-5 h-5 text-${item.color}-400`} />
                </div>
                <h3 className="text-lg font-bold mb-2">{item.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Social proof */}
      <div className="py-20 px-6 border-t border-white/5">
        <div className="max-w-3xl mx-auto text-center">
          <div className="flex items-center justify-center gap-1 mb-4">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-5 h-5 text-amber-400 fill-amber-400" />
            ))}
          </div>
          <p className="text-lg text-gray-300 mb-6 italic">
            "Actero a transforme notre support client. On a reduit nos temps de reponse de 80% en 2 semaines."
          </p>
          <p className="text-sm text-gray-500">— Client Actero depuis 2025</p>
        </div>
      </div>

      {/* Final CTA */}
      <div className="py-20 px-6 border-t border-white/5">
        <div className="max-w-2xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="bg-gradient-to-br from-emerald-500/10 to-blue-500/10 border border-emerald-500/20 rounded-3xl p-10"
          >
            <Gift className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
            <h3 className="text-2xl font-bold mb-3">Profitez de votre offre exclusive</h3>
            <p className="text-gray-400 mb-6">
              Setup offert grace au parrainage de {referrerName}. Reservez votre audit gratuit maintenant.
            </p>
            <button
              onClick={handleCTA}
              className="bg-emerald-500 hover:bg-emerald-400 text-black px-8 py-4 rounded-2xl text-lg font-bold transition-all inline-flex items-center gap-3"
            >
              Reserver mon audit gratuit
              <ArrowRight className="w-5 h-5" />
            </button>
            <div className="flex items-center justify-center gap-6 mt-6 text-sm text-gray-500">
              <span className="flex items-center gap-1"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Gratuit</span>
              <span className="flex items-center gap-1"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> 15 minutes</span>
              <span className="flex items-center gap-1"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Sans engagement</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 px-6 text-center">
        <p className="text-sm text-gray-600">&copy; 2026 Actero. Tous droits reserves.</p>
      </footer>
    </div>
  )
}
