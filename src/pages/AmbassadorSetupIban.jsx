import React, { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { motion } from 'framer-motion'
import { Landmark, CheckCircle, ArrowRight, AlertTriangle } from 'lucide-react'
import { Logo } from '../components/layout/Logo'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export default function AmbassadorSetupIban() {
  const [iban, setIban] = useState('')
  const [bic, setBic] = useState('')
  const [holder, setHolder] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [user, setUser] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setUser(session.user)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (session?.user) setUser(session.user)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Format IBAN with spaces every 4 chars
  const formatIban = (value) => {
    const clean = value.replace(/\s/g, '').toUpperCase()
    return clean.replace(/(.{4})/g, '$1 ').trim()
  }

  const handleIbanChange = (e) => {
    const raw = e.target.value.replace(/\s/g, '').toUpperCase()
    if (raw.length <= 34) {
      setIban(formatIban(raw))
    }
  }

  const isValidIban = iban.replace(/\s/g, '').length >= 14 && /^[A-Z]{2}/.test(iban)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isValidIban || !holder.trim()) return
    setLoading(true)
    setError('')

    try {
      const { error: updateError } = await supabase
        .from('ambassadors')
        .update({
          iban: iban.replace(/\s/g, ''),
          bic: bic.trim().toUpperCase() || null,
          iban_holder: holder.trim(),
        })
        .eq('user_id', user.id)

      if (updateError) {
        setError(updateError.message)
        setLoading(false)
        return
      }
      setDone(true)
    } catch (err) {
      setError('Erreur lors de la sauvegarde.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center p-4">
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
            className="bg-[#0E1424] border border-white/10 rounded-2xl p-8 text-center"
          >
            <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">IBAN enregistré !</h2>
            <p className="text-zinc-400 mb-8">Tout est prêt. Commencez à recommander Actero et gagnez des récompenses.</p>
            <a
              href="/ambassador/overview"
              className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-8 py-3 rounded-xl transition-colors text-lg"
            >
              Accéder à mon dashboard <ArrowRight className="w-5 h-5" />
            </a>
          </motion.div>
        ) : (
          <div className="bg-[#0E1424] border border-white/10 rounded-2xl p-8">
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Landmark className="w-7 h-7 text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Ajoutez votre IBAN</h2>
              <p className="text-zinc-400 text-sm">Pour recevoir vos récompenses par virement bancaire</p>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-6">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                <p className="text-amber-400 text-xs leading-relaxed">
                  Vos informations bancaires sont stockées de manière sécurisée et utilisées uniquement pour le versement de vos commissions.
                </p>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6">
                <p className="text-red-400 text-sm text-center">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Titulaire du compte *</label>
                <input
                  type="text"
                  value={holder}
                  onChange={(e) => setHolder(e.target.value)}
                  placeholder="Prénom Nom ou Raison sociale"
                  className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">IBAN *</label>
                <input
                  type="text"
                  value={iban}
                  onChange={handleIbanChange}
                  placeholder="FR76 1234 5678 9012 3456 7890 123"
                  className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 font-mono tracking-wider"
                />
                {iban.length > 0 && !isValidIban && (
                  <p className="text-amber-400 text-xs mt-1">IBAN invalide (doit commencer par 2 lettres)</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">BIC / SWIFT (optionnel)</label>
                <input
                  type="text"
                  value={bic}
                  onChange={(e) => setBic(e.target.value.toUpperCase())}
                  placeholder="BNPAFRPP"
                  className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={!isValidIban || !holder.trim() || loading || !user}
                className={`w-full py-3 rounded-xl font-bold text-lg transition-all mt-2 ${
                  isValidIban && holder.trim() && user
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-black'
                    : 'bg-white/5 text-zinc-600 cursor-not-allowed'
                }`}
              >
                {loading ? 'Enregistrement...' : 'Enregistrer mon IBAN'}
              </button>

              <button
                type="button"
                onClick={() => window.location.href = '/ambassador/overview'}
                className="w-full py-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Passer cette étape (vous pourrez l'ajouter plus tard)
              </button>
            </form>
          </div>
        )}
      </motion.div>
    </div>
  )
}
