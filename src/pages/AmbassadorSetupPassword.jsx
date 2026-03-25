import React, { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { motion } from 'framer-motion'
import { Lock, Eye, EyeOff, CheckCircle, ArrowRight } from 'lucide-react'
import { Logo } from '../components/layout/Logo'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export default function AmbassadorSetupPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [sessionReady, setSessionReady] = useState(false)

  useEffect(() => {
    // Supabase will auto-handle the magic link token from URL hash
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setSessionReady(true)
      }
    })
    // Check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  const isValid = password.length >= 8 && password === confirm

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isValid) return
    setLoading(true)
    setError('')

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        setError(updateError.message)
        setLoading(false)
        return
      }
      setDone(true)
    } catch (err) {
      setError('Erreur lors de la mise à jour du mot de passe.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#030303] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <Logo className="w-8 h-8 mx-auto mb-4 text-white" />
          <span className="inline-block bg-emerald-500/10 text-emerald-400 text-xs font-bold px-3 py-1 rounded-full mb-4 tracking-widest">PROGRAMME AMBASSADEUR</span>
        </div>

        {done ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-8 text-center"
          >
            <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Mot de passe créé !</h2>
            <p className="text-zinc-400 mb-8">Dernière étape : ajoutez votre IBAN pour recevoir vos récompenses.</p>
            <a
              href="/ambassador/setup-iban"
              className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-8 py-3 rounded-xl transition-colors text-lg"
            >
              Ajouter mon IBAN <ArrowRight className="w-5 h-5" />
            </a>
          </motion.div>
        ) : (
          <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-8">
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Lock className="w-7 h-7 text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Créez votre mot de passe</h2>
              <p className="text-zinc-400 text-sm">Pour accéder à votre espace ambassadeur Actero</p>
            </div>

            {!sessionReady && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6">
                <p className="text-amber-400 text-sm text-center">Vérification de votre session en cours...</p>
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6">
                <p className="text-red-400 text-sm text-center">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Mot de passe</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 caractères"
                    className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 pr-12"
                    disabled={!sessionReady}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                  >
                    {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {password.length > 0 && password.length < 8 && (
                  <p className="text-amber-400 text-xs mt-1">Minimum 8 caractères</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Confirmer le mot de passe</label>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Retapez votre mot de passe"
                  className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50"
                  disabled={!sessionReady}
                />
                {confirm.length > 0 && password !== confirm && (
                  <p className="text-red-400 text-xs mt-1">Les mots de passe ne correspondent pas</p>
                )}
              </div>

              <button
                type="submit"
                disabled={!isValid || loading || !sessionReady}
                className={`w-full py-3 rounded-xl font-bold text-lg transition-all ${
                  isValid && sessionReady
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-black'
                    : 'bg-white/5 text-zinc-600 cursor-not-allowed'
                }`}
              >
                {loading ? 'Création...' : 'Créer mon mot de passe'}
              </button>
            </form>
          </div>
        )}
      </motion.div>
    </div>
  )
}
