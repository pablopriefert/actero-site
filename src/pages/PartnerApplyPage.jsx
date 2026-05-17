import React, { useState } from 'react'
import { CheckCircle2, Send, Award, AlertCircle } from 'lucide-react'
import { Navbar } from '../components/layout/Navbar'
import { Footer } from '../components/layout/Footer'
import { FadeInUp } from '../components/ui/scroll-animations'
import { SEO } from '../components/SEO'

/**
 * /partners/apply — Partner certification application form.
 */
export const PartnerApplyPage = ({ onNavigate }) => {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    company_name: '',
    website: '',
    linkedin: '',
    pitch: '',
    experience_years: '',
    clients_managed: '',
  })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [banner] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('certified') === '1') {
      return {
        kind: 'success',
        text: 'Paiement reçu ! Votre profil partner est en cours de création. Vous allez recevoir un email pour accéder à votre dashboard.',
      }
    } else if (params.get('canceled') === '1') {
      return {
        kind: 'error',
        text: 'Paiement annulé. Vous pourrez retenter plus tard via votre lien d approbation.',
      }
    }
    return null
  })

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/partners/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Une erreur est survenue.')
        return
      }
      setSuccess(true)
    } catch (_err) {
      setError('Une erreur réseau est survenue. Veuillez réessayer.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <SEO
        title="Candidature Actero Partners"
        description="Postulez au programme de certification Actero Partners. Commission 20% récurrente, badge officiel et profil public."
        canonical="/partners/apply"
      />
      <div className="relative min-h-screen bg-white font-sans text-[#262626]">
        <div className="fixed inset-0 z-0 pointer-events-none bg-gradient-to-b from-[#F9F7F1] to-white" />

        <div className="relative z-10 w-full">
          <Navbar onNavigate={onNavigate} />

          <main className="pt-32 pb-20 px-6">
            <div className="max-w-2xl mx-auto">
              <FadeInUp className="text-center mb-10">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 text-xs font-bold uppercase tracking-widest mb-6">
                  <Award className="w-3.5 h-3.5" />
                  Candidature Partner
                </div>
                <h1 className="text-4xl md:text-5xl font-bold tracking-tighter mb-4">
                  Postulez au programme
                </h1>
                <p className="text-[#716D5C] text-lg">
                  Remplissez ce formulaire, nous revenons vers vous sous 48h.
                </p>
              </FadeInUp>

              {banner && (
                <FadeInUp>
                  <div
                    className={`mb-6 p-4 rounded-xl border flex items-start gap-3 ${
                      banner.kind === 'success'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700'
                        : 'bg-amber-500/10 border-amber-500/30 text-amber-700'
                    }`}
                  >
                    {banner.kind === 'success' ? (
                      <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    )}
                    <p className="text-sm">{banner.text}</p>
                  </div>
                </FadeInUp>
              )}

              {success ? (
                <FadeInUp>
                  <div className="text-center p-12 rounded-2xl bg-indigo-500/5 border border-indigo-500/20">
                    <CheckCircle2 className="w-16 h-16 text-indigo-500 mx-auto mb-6" />
                    <h3 className="text-2xl font-bold mb-3">Candidature envoyée !</h3>
                    <p className="text-[#716D5C] mb-6">
                      Merci. Notre équipe étudie votre dossier et vous recontacte sous 48h.
                      Si votre candidature est approuvée, vous recevrez un email avec un
                      lien de paiement pour finaliser votre certification (500€).
                    </p>
                    <button
                      onClick={() => onNavigate('/partners-program')}
                      className="px-6 py-3 bg-indigo-500 hover:bg-indigo-400 text-white font-bold rounded-full transition-colors"
                    >
                      Retour au programme
                    </button>
                  </div>
                </FadeInUp>
              ) : (
                <FadeInUp>
                  <form onSubmit={handleSubmit} className="space-y-5 bg-white p-8 rounded-2xl border border-gray-200 shadow-sm">
                    <div>
                      <label className="block text-sm font-medium text-[#716D5C] mb-1.5">
                        Nom complet *
                      </label>
                      <input
                        type="text"
                        name="full_name"
                        value={formData.full_name}
                        onChange={handleChange}
                        required
                        minLength={2}
                        className="w-full px-4 py-3 bg-[#F9F7F1] border border-gray-200 rounded-xl text-[#262626] placeholder-gray-500 outline-none focus:border-indigo-500/40 transition-colors"
                        placeholder="Votre prénom et nom"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[#716D5C] mb-1.5">
                        Email *
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-3 bg-[#F9F7F1] border border-gray-200 rounded-xl text-[#262626] placeholder-gray-500 outline-none focus:border-indigo-500/40 transition-colors"
                        placeholder="vous@entreprise.com"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-sm font-medium text-[#716D5C] mb-1.5">
                          Entreprise
                        </label>
                        <input
                          type="text"
                          name="company_name"
                          value={formData.company_name}
                          onChange={handleChange}
                          className="w-full px-4 py-3 bg-[#F9F7F1] border border-gray-200 rounded-xl text-[#262626] placeholder-gray-500 outline-none focus:border-indigo-500/40 transition-colors"
                          placeholder="Nom de votre société"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[#716D5C] mb-1.5">
                          Site web
                        </label>
                        <input
                          type="url"
                          name="website"
                          value={formData.website}
                          onChange={handleChange}
                          className="w-full px-4 py-3 bg-[#F9F7F1] border border-gray-200 rounded-xl text-[#262626] placeholder-gray-500 outline-none focus:border-indigo-500/40 transition-colors"
                          placeholder="https://..."
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[#716D5C] mb-1.5">
                        LinkedIn
                      </label>
                      <input
                        type="url"
                        name="linkedin"
                        value={formData.linkedin}
                        onChange={handleChange}
                        className="w-full px-4 py-3 bg-[#F9F7F1] border border-gray-200 rounded-xl text-[#262626] placeholder-gray-500 outline-none focus:border-indigo-500/40 transition-colors"
                        placeholder="https://linkedin.com/in/..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[#716D5C] mb-1.5">
                        Pourquoi voulez-vous devenir partner Actero ? *
                      </label>
                      <textarea
                        name="pitch"
                        value={formData.pitch}
                        onChange={handleChange}
                        required
                        minLength={20}
                        rows={5}
                        className="w-full px-4 py-3 bg-[#F9F7F1] border border-gray-200 rounded-xl text-[#262626] placeholder-gray-500 outline-none focus:border-indigo-500/40 transition-colors resize-none"
                        placeholder="Parlez-nous de vous, de vos clients actuels, et de pourquoi Actero correspond à votre approche..."
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-sm font-medium text-[#716D5C] mb-1.5">
                          Années d expérience e-commerce
                        </label>
                        <input
                          type="number"
                          name="experience_years"
                          value={formData.experience_years}
                          onChange={handleChange}
                          min="0"
                          max="50"
                          className="w-full px-4 py-3 bg-[#F9F7F1] border border-gray-200 rounded-xl text-[#262626] placeholder-gray-500 outline-none focus:border-indigo-500/40 transition-colors"
                          placeholder="Ex: 5"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[#716D5C] mb-1.5">
                          Nombre de clients gérés
                        </label>
                        <input
                          type="number"
                          name="clients_managed"
                          value={formData.clients_managed}
                          onChange={handleChange}
                          min="0"
                          className="w-full px-4 py-3 bg-[#F9F7F1] border border-gray-200 rounded-xl text-[#262626] placeholder-gray-500 outline-none focus:border-indigo-500/40 transition-colors"
                          placeholder="Ex: 12"
                        />
                      </div>
                    </div>

                    {error && (
                      <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 text-sm">
                        {error}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-2 px-8 py-4 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white font-bold rounded-xl text-lg transition-all shadow-lg shadow-indigo-500/25"
                    >
                      {loading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <Send className="w-5 h-5" />
                          Soumettre ma candidature
                        </>
                      )}
                    </button>
                  </form>
                </FadeInUp>
              )}
            </div>
          </main>

          <Footer onNavigate={onNavigate} />
        </div>
      </div>
    </>
  )
}
