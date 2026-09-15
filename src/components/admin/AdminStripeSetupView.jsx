import React, { useState, useEffect } from 'react'
import { CreditCard, Check, X, AlertTriangle, Loader2, ShieldCheck } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../ui/PageHeader'
import { SectionCard } from '../ui/SectionCard'
import { StatusPill } from '../ui/StatusPill'
import { FORMULES } from '../../../api/lib/formules.js'

const ACTIONS = { existant: 'déjà en place', cle_posee: 'clé posée sur un prix existant', cree: 'créé', remplace: 'remplacé (le montant avait changé)' }

// NOTE (écart au plan) : src/lib/affichage-formules.js (Task 7 du plan) n'existe
// pas encore dans cette base — cet écran n'en dépend donc pas et formate les
// prix lui-même à partir du catalogue serveur (api/lib/formules.js), seule
// source de vérité commune. À réconcilier avec `affichagePrix` quand la Task 7
// sera fusionnée.
const formatEuros = (centimes) => {
  const valeur = centimes / 100
  const decimales = Number.isInteger(valeur) ? 0 : 2
  return `${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: decimales, maximumFractionDigits: 2 }).format(valeur)}\u00a0€`
}

const descriptionFormule = (f) => {
  if (f.periode === 'trimestriel') return { prix: `${formatEuros(f.montantCentimes)} / 3 mois`, avantage: '−50 % sur le premier mois' }
  if (f.periode === 'annuel') return { prix: `${formatEuros(f.montantCentimes)} / an`, avantage: '12 mois pour le prix de 11' }
  return { prix: `${formatEuros(f.montantCentimes)} / mois`, avantage: 'Sans engagement' }
}

export function AdminStripeSetupView() {
  const [status, setStatus] = useState(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  // Incrémenté après une configuration, pour relire le statut.
  const [lectureStatut, setLectureStatut] = useState(0)

  const getToken = async () => {
    const { data } = await supabase.auth.getSession()
    return data?.session?.access_token
  }

  useEffect(() => {
    ;(async () => {
      try {
        const token = await getToken()
        const res = await fetch('/api/admin/stripe-status', { headers: { Authorization: `Bearer ${token}` } })
        if (res.ok) setStatus(await res.json())
      } catch {
        // statut indisponible : l'écran le dit plus bas
      } finally {
        setStatusLoading(false)
      }
    })()
  }, [lectureStatut])

  const handleCreate = async () => {
    if (!window.confirm('Créer ou retrouver les 6 prix et les 2 coupons des formules dans Stripe ? Les anciens prix annuels seront désactivés.')) return
    setCreating(true)
    setError(null)
    setResult(null)
    try {
      const token = await getToken()
      const res = await fetch('/api/admin/setup-stripe-products?confirm=yes', { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`)
      setResult(data)
      setStatusLoading(true)
      setLectureStatut((n) => n + 1)
    } catch (err) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto animate-fade-in-up">
      <PageHeader title="Configuration Stripe" subtitle="Les formules vendues, telles que Stripe les connaît" />

      <div className="p-6 space-y-6">
        <SectionCard title="Statut" icon={ShieldCheck}>
          {statusLoading ? (
            <div className="flex items-center gap-2 text-[13px] text-[#9ca3af]">
              <Loader2 className="w-4 h-4 animate-spin" /> Vérification…
            </div>
          ) : status ? (
            <div className="space-y-2">
              {[
                ['STRIPE_SECRET_KEY', status.stripe_secret_key],
                ['STRIPE_WEBHOOK_SECRET', status.stripe_webhook_secret],
              ].map(([nom, ok]) => (
                <div key={nom} className="flex items-center justify-between py-2 border-b border-[#f0f0f0]">
                  <code className="text-[12px] font-mono bg-surface px-2 py-0.5 rounded">{nom}</code>
                  {ok ? <StatusPill variant="success" icon={Check}>Présente</StatusPill> : <StatusPill variant="danger" icon={X}>Manquante</StatusPill>}
                </div>
              ))}
              {status.formules.map((f) => (
                <div key={f.lookupKey} className="flex items-center justify-between py-2 border-b border-[#f0f0f0]">
                  <code className="text-[12px] font-mono bg-surface px-2 py-0.5 rounded">{f.lookupKey}</code>
                  {f.configuree ? <StatusPill variant="success" icon={Check}>Prix en place</StatusPill> : <StatusPill variant="danger" icon={X}>À configurer</StatusPill>}
                </div>
              ))}
              {status.coupons.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-2 border-b border-[#f0f0f0] last:border-0">
                  <code className="text-[12px] font-mono bg-surface px-2 py-0.5 rounded">{c.id}</code>
                  {c.configure ? <StatusPill variant="success" icon={Check}>Coupon en place</StatusPill> : <StatusPill variant="danger" icon={X}>Absent</StatusPill>}
                </div>
              ))}
              <div className="pt-3">
                {status.all_configured
                  ? <StatusPill variant="success" dot size="md">Tout est configuré</StatusPill>
                  : <StatusPill variant="warning" dot size="md">Configuration incomplète</StatusPill>}
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-[#9ca3af]">Impossible de vérifier le statut.</p>
          )}
        </SectionCard>

        <SectionCard title="Configurer les formules" icon={CreditCard}>
          <div className="border border-[#f0f0f0] rounded-xl overflow-hidden mb-4">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface border-b border-[#f0f0f0]">
                  <th className="px-4 py-2.5 text-[11px] font-bold text-[#71717a] uppercase tracking-wider">Formule</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold text-[#71717a] uppercase tracking-wider">Prix</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold text-[#71717a] uppercase tracking-wider">Avantage</th>
                </tr>
              </thead>
              <tbody>
                {FORMULES.map((f) => {
                  const a = descriptionFormule(f)
                  return (
                    <tr key={f.lookupKey} className="border-b border-[#f0f0f0] last:border-0">
                      <td className="px-4 py-3 text-[13px] font-semibold text-[#1a1a1a]">{f.plan === 'pro' ? 'Pro' : 'Starter'} · {f.periode}</td>
                      <td className="px-4 py-3 text-[13px] text-[#71717a]">{a.prix}</td>
                      <td className="px-4 py-3 text-[13px] text-[#71717a]">{a.avantage}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <button
            onClick={handleCreate}
            disabled={creating}
            className="px-4 py-2 rounded-xl text-[13px] font-semibold bg-cta text-white hover:bg-cta-hover disabled:opacity-50 flex items-center gap-2"
          >
            {creating ? <><Loader2 className="w-4 h-4 animate-spin" /> Configuration en cours…</> : <><CreditCard className="w-4 h-4" /> Configurer Stripe</>}
          </button>

          {error && (
            <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-[12px] text-red-600">{error}</p>
            </div>
          )}

          {result && (
            <div className="mt-4 p-4 rounded-xl bg-primary-tint">
              <p className="text-[13px] font-semibold text-primary mb-2">Configuration terminée — rien à copier dans Vercel.</p>
              <ul className="space-y-1 text-[12px] text-[#3A3A3A]">
                {result.formules.map((f) => <li key={f.lookupKey}><code className="font-mono">{f.lookupKey}</code> : {ACTIONS[f.action]}</li>)}
                {result.coupons.map((c) => <li key={c.id}><code className="font-mono">{c.id}</code> : {ACTIONS[c.action]}</li>)}
                {result.anciensPrixDesactives.length > 0 && <li>Anciens prix annuels désactivés : {result.anciensPrixDesactives.join(', ')}</li>}
              </ul>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  )
}
