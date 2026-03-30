import React, { useState, useEffect } from 'react'
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { fetchUserRole } from '../../lib/auth-utils'
import { ButtonColorful } from '../ui/button-colorful'

export function SetPasswordPage({ onNavigate }) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [success, setSuccess] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)

  useEffect(() => {
    let mounted = true;
    let subscription = null;

    const init = async () => {
      try {
        // With PKCE flow, the ?code= param is exchanged for a session ASYNCHRONOUSLY
        // by the Supabase client. We need to wait for that exchange to complete.

        // First, try exchanging the code if present in the URL
        const params = new URLSearchParams(window.location.search)
        const code = params.get('code')

        if (code) {
          // Manually trigger the PKCE exchange
          const { data, error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) {
            console.error('[SetPasswordPage] Code exchange error:', error)
            if (mounted) setErrorMsg("Lien expiré ou invalide. Veuillez demander un nouveau lien d'invitation.")
            return
          }
          if (data?.session && mounted) {
            // Clean URL
            window.history.replaceState({}, '', '/setup-password')
            setSessionReady(true)
            return
          }
        }

        // Fallback: check if session already exists
        const { data: { session } } = await supabase.auth.getSession()
        if (session && mounted) {
          setSessionReady(true)
          return
        }
      } catch (err) {
        console.error('[SetPasswordPage] Init error:', err)
        if (mounted) setErrorMsg("Une erreur est survenue lors de l'activation. Veuillez réessayer.")
      }
    }
    init()

    // Also listen for auth state changes as backup
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && mounted) {
        setSessionReady(true)
      }
    })
    subscription = authListener?.subscription

    // Timeout fallback: if no session after 15s, show error
    const timeout = setTimeout(() => {
      if (mounted && !sessionReady) {
        setErrorMsg("Session expirée. Veuillez demander un nouveau lien d'invitation.")
      }
    }, 15000)

    return () => {
      mounted = false
      if (subscription) subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  const isValid = password.length >= 8 && password === confirmPassword

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg('')

    if (password.length < 8) {
      setErrorMsg('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }
    if (password !== confirmPassword) {
      setErrorMsg('Les mots de passe ne correspondent pas.')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error

      setSuccess(true)

      // After 2s, redirect to the right dashboard
      setTimeout(async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          const role = await fetchUserRole(session.user.id)
          onNavigate(role === 'admin' ? '/admin' : '/client')
        } else {
          onNavigate('/login')
        }
      }, 2000)
    } catch (err) {
      setErrorMsg(err.message || 'Une erreur est survenue.')
    } finally {
      setLoading(false)
    }
  }

  if (!sessionReady && !errorMsg) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0E1A]">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#0A0E1A] flex flex-col justify-center items-center px-6 font-sans">
        <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6">
          <CheckCircle className="w-10 h-10 text-emerald-500" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Mot de passe créé !</h2>
        <p className="text-gray-400 text-sm">Redirection vers votre espace...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0E1A] flex font-sans">
      {/* Left side — Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center px-6 sm:px-12 lg:px-20">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-12">
            <img src="/favicon.svg" alt="Actero" className="w-8 h-8" />
            <span className="text-white font-bold text-xl tracking-tight">Actero</span>
          </div>

          <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">
            Créez votre mot de passe
          </h1>
          <p className="text-gray-400 text-sm mb-8 leading-relaxed">
            Bienvenue ! Sécurisez votre compte en définissant un mot de passe pour vos prochaines connexions.
          </p>

          {errorMsg && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-sm text-red-400 mb-6">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Password */}
            <div>
              <label htmlFor="new-password" className="block text-sm font-bold text-white mb-2">
                Mot de passe
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 pr-12 bg-[#0E1424] border border-white/10 rounded-xl focus:ring-2 focus:ring-zinc-400 outline-none transition-all text-sm text-white"
                  required
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1.5">Minimum 8 caractères</p>
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirm-password" className="block text-sm font-bold text-white mb-2">
                Confirmer le mot de passe
              </label>
              <input
                id="confirm-password"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-[#0E1424] border border-white/10 rounded-xl focus:ring-2 focus:ring-zinc-400 outline-none transition-all text-sm text-white"
                required
              />
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-red-400 mt-1.5">Les mots de passe ne correspondent pas</p>
              )}
            </div>

            {/* Submit */}
            <div className="pt-2">
              <ButtonColorful
                type="submit"
                disabled={loading || !isValid}
                className="w-full h-14 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Création en cours...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    Activer mon compte
                  </>
                )}
              </ButtonColorful>
            </div>
          </form>
        </div>
      </div>

      {/* Right side — Decorative */}
      <div className="hidden lg:block lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-[#0a0a0a] to-zinc-900" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center px-12">
            <div className="w-20 h-20 bg-white/5 rounded-3xl border border-white/10 flex items-center justify-center mx-auto mb-8">
              <Lock className="w-10 h-10 text-white/40" />
            </div>
            <h3 className="text-2xl font-bold text-white/80 mb-3">
              Votre espace est prêt
            </h3>
            <p className="text-gray-500 text-sm max-w-sm mx-auto leading-relaxed">
              Tableau de bord, recommandations IA et suivi de performance — tout est configuré pour vous.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
