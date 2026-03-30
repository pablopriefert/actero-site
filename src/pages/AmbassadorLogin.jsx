import React, { useState } from 'react'
import { Logo } from '../components/layout/Logo'
import { supabase } from '../lib/supabase'

export const AmbassadorLogin = ({ onNavigate }) => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (authError) throw authError
      onNavigate('/ambassador')
    } catch (_err) {
      setError('Identifiants incorrects.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex font-sans">
      {/* Left: Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 sm:px-12 md:px-20 lg:px-16 xl:px-24 py-12">
        <div className="max-w-[420px] w-full mx-auto">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-14">
            <button
              onClick={() => onNavigate('/')}
              aria-label="Retour à l'accueil"
              className="w-10 h-10 rounded-full bg-[#18181b] flex items-center justify-center border border-gray-100 hover:scale-105 transition-transform"
            >
              <Logo className="w-5 h-5 text-[#262626]" />
            </button>
            <span className="text-[#262626] text-lg font-semibold tracking-tight">Actero</span>
          </div>

          {/* Heading */}
          <h1 className="text-[#262626] text-3xl sm:text-4xl font-bold tracking-tight mb-3">
            Espace Ambassadeur
          </h1>
          <p className="text-[#716D5C] text-sm mb-10">
            Pas encore ambassadeur ?{' '}
            <button
              onClick={() => onNavigate('/ambassadeurs')}
              className="text-emerald-400 hover:text-emerald-300 underline underline-offset-4 decoration-emerald-800 hover:decoration-emerald-600 transition-colors font-medium"
            >
              Postulez ici
            </button>
          </p>

          <form className="space-y-5 flex flex-col" onSubmit={handleSubmit}>
            {error && (
              <div className="p-3 bg-red-500/10 text-red-400 text-xs font-medium rounded-xl border border-red-500/20 text-center">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-[#716D5C] mb-2">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-[#262626] placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                placeholder="jean@exemple.com"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-[#716D5C] mb-2">Mot de passe</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-[#262626] placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                placeholder="Votre mot de passe"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-[#262626] font-bold rounded-xl text-base transition-all"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin mx-auto" />
              ) : (
                'Se connecter'
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Right: Visual */}
      <div className="hidden lg:flex w-1/2 items-center justify-center bg-gradient-to-br from-emerald-950/30 to-[#030303] border-l border-gray-100">
        <div className="text-center p-12">
          <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-8">
            <Logo className="w-10 h-10 text-emerald-400" />
          </div>
          <h2 className="text-3xl font-bold text-[#262626] mb-4 tracking-tight">
            Programme Ambassadeur
          </h2>
          <p className="text-[#716D5C] font-medium max-w-sm mx-auto leading-relaxed">
            Suivez vos recommandations, consultez vos commissions et partagez votre lien unique.
          </p>
        </div>
      </div>
    </div>
  )
}
