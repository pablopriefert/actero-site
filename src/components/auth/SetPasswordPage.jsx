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
        const params = new URLSearchParams(window.location.search)
        const code = params.get('code')

        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) {
            console.error('[SetPasswordPage] Code exchange error:', error)
            if (mounted) setErrorMsg("Lien expiré ou invalide. Veuillez demander un nouveau lien d'invitation.")
            return
          }
          if (data?.session && mounted) {
            window.history.replaceState({}, '', '/setup-password')
            setSessionReady(true)
            return
          }
        }

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

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && mounted) {
        setSessionReady(true)
      }
    })
    subscription = authListener?.subscription

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
      <div className="min-h-screen flex items-center justify-center bg-[#F9F7F1]">
        <Loader2 className="w-8 h-8 text-cta animate-spin" />
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#F9F7F1] flex flex-col justify-center items-center px-6 font-sans">
        <div className="w-20 h-20 bg-cta/10 rounded-full flex items-center justify-center mb-6">
          <CheckCircle className="w-10 h-10 text-cta" />
        </div>
        <h2 className="text-2xl font-bold text-[#262626] mb-2">Mot de passe créé !</h2>
        <p className="text-[#716D5C] text-sm">Redirection vers votre espace...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F9F7F1] flex font-sans">
      {/* Left side — Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center px-6 sm:px-12 lg:px-20">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-12">
            <img src="/favicon.svg" alt="Actero" className="w-8 h-8" />
            <span className="text-[#262626] font-bold text-xl tracking-tight">Actero</span>
          </div>

          <h1 className="text-3xl font-bold text-[#262626] mb-2 tracking-tight">
            Créez votre mot de passe
          </h1>
          <p className="text-[#716D5C] text-sm mb-8 leading-relaxed">
            Bienvenue ! Sécurisez votre compte en définissant un mot de passe pour vos prochaines connexions.
          </p>

          {errorMsg && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-sm text-red-600 mb-6">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Password */}
            <div>
              <label htmlFor="new-password" className="block text-sm font-bold text-[#262626] mb-2">
                Mot de passe
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 pr-12 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-cta/30 outline-none transition-all text-sm text-[#262626]"
                  required
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#716D5C] hover:text-[#262626] transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-[#716D5C] mt-1.5">Minimum 8 caractères</p>
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirm-password" className="block text-sm font-bold text-[#262626] mb-2">
                Confirmer le mot de passe
              </label>
              <input
                id="confirm-password"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-cta/30 outline-none transition-all text-sm text-[#262626]"
                required
              />
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-red-500 mt-1.5">Les mots de passe ne correspondent pas</p>
              )}
            </div>

            {/* Submit */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading || !isValid}
                className="w-full h-14 rounded-full font-bold text-white bg-cta hover:bg-[#003725] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Right side — Decorative */}
      <div className="hidden lg:block lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-white" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center px-12">
            <div className="w-20 h-20 bg-[#F9F7F1] rounded-3xl border border-gray-200 flex items-center justify-center mx-auto mb-8">
              <Lock className="w-10 h-10 text-[#716D5C]" />
            </div>
            <h3 className="text-2xl font-bold text-[#262626] mb-3">
              Votre espace est prêt
            </h3>
            <p className="text-[#716D5C] text-sm max-w-sm mx-auto leading-relaxed">
              Tableau de bord, recommandations IA et suivi de performance — tout est configuré pour vous.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
