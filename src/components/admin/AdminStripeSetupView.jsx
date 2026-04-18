import React, { useState, useEffect } from 'react'
import { CreditCard, Check, X, Copy, ExternalLink, AlertTriangle, Loader2, ShieldCheck } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../ui/PageHeader'
import { SectionCard } from '../ui/SectionCard'
import { StatusPill } from '../ui/StatusPill'

const ENV_VARS = [
  { key: 'stripe_secret_key', label: 'STRIPE_SECRET_KEY', description: 'Cle secrete Stripe (sk_live_... ou sk_test_...)' },
  { key: 'stripe_webhook_secret', label: 'STRIPE_WEBHOOK_SECRET', description: 'Secret du webhook Stripe (whsec_...)' },
  { key: 'stripe_price_starter_monthly', label: 'STRIPE_PRICE_STARTER_MONTHLY', description: 'Prix ID Starter mensuel' },
  { key: 'stripe_price_starter_annual', label: 'STRIPE_PRICE_STARTER_ANNUAL', description: 'Prix ID Starter annuel' },
  { key: 'stripe_price_pro_monthly', label: 'STRIPE_PRICE_PRO_MONTHLY', description: 'Prix ID Pro mensuel' },
  { key: 'stripe_price_pro_annual', label: 'STRIPE_PRICE_PRO_ANNUAL', description: 'Prix ID Pro annuel' },
]

const PRODUCTS_TABLE = [
  { name: 'Actero Starter', monthly: '99', annual: '948', annualPerMonth: '79' },
  { name: 'Actero Pro', monthly: '399', annual: '3 828', annualPerMonth: '319' },
  { name: 'Actero Enterprise', monthly: 'Sur devis', annual: 'Sur devis', annualPerMonth: '-' },
]

export function AdminStripeSetupView() {
  const [status, setStatus] = useState(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [copiedKey, setCopiedKey] = useState(null)

  const getToken = async () => {
    const { data } = await supabase.auth.getSession()
    return data?.session?.access_token
  }

  // Check env var status
  useEffect(() => {
    ;(async () => {
      try {
        const token = await getToken()
        const res = await fetch('/api/admin/stripe-status', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          setStatus(await res.json())
        }
      } catch {
        // ignore
      } finally {
        setStatusLoading(false)
      }
    })()
  }, [])

  const handleCreate = async () => {
    if (!window.confirm('Cela va creer 4 produits et 8 prix dans votre compte Stripe. Continuer ?')) return
    setCreating(true)
    setError(null)
    setResult(null)
    try {
      const token = await getToken()
      const res = await fetch('/api/admin/setup-stripe-products?confirm=yes', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`)
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  const copyToClipboard = (key, value) => {
    navigator.clipboard.writeText(value)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  return (
    <div className="max-w-4xl mx-auto animate-fade-in-up">
      <PageHeader title="Configuration Stripe" subtitle="Gerez les produits et prix Stripe depuis le dashboard" />

      <div className="p-6 space-y-6">
        {/* Status Section */}
        <SectionCard title="Statut de la configuration" icon={ShieldCheck}>
          {statusLoading ? (
            <div className="flex items-center gap-2 text-[13px] text-[#9ca3af]">
              <Loader2 className="w-4 h-4 animate-spin" /> Verification...
            </div>
          ) : status ? (
            <div className="space-y-2">
              {ENV_VARS.map((v) => (
                <div key={v.key} className="flex items-center justify-between py-2 border-b border-[#f0f0f0] last:border-0">
                  <div className="flex items-center gap-2">
                    <code className="text-[12px] font-mono bg-[#fafafa] px-2 py-0.5 rounded">{v.label}</code>
                  </div>
                  {status[v.key] ? (
                    <StatusPill variant="success" icon={Check}>Configuree</StatusPill>
                  ) : (
                    <StatusPill variant="danger" icon={X}>Manquante</StatusPill>
                  )}
                </div>
              ))}
              <div className="pt-3">
                {status.all_configured ? (
                  <StatusPill variant="success" dot size="md">Toutes les variables sont configurees</StatusPill>
                ) : (
                  <StatusPill variant="warning" dot size="md">Configuration incomplete</StatusPill>
                )}
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-[#9ca3af]">Impossible de vérifier le statut.</p>
          )}
        </SectionCard>

        {/* Create Products Section */}
        <SectionCard title="Créer les produits Stripe" icon={CreditCard}>
          <p className="text-[13px] text-[#71717a] mb-4">
            Crée automatiquement les 4 produits et 8 prix dans votre compte Stripe.
          </p>

          {/* Products table */}
          <div className="border border-[#f0f0f0] rounded-xl overflow-hidden mb-4">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#fafafa] border-b border-[#f0f0f0]">
                  <th className="px-4 py-2.5 text-[11px] font-bold text-[#71717a] uppercase tracking-wider">Produit</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold text-[#71717a] uppercase tracking-wider">Mensuel</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold text-[#71717a] uppercase tracking-wider">Annuel</th>
                </tr>
              </thead>
              <tbody>
                {PRODUCTS_TABLE.map((p) => (
                  <tr key={p.name} className="border-b border-[#f0f0f0] last:border-0">
                    <td className="px-4 py-3 text-[13px] font-semibold text-[#1a1a1a]">{p.name}</td>
                    <td className="px-4 py-3 text-[13px] text-[#71717a]">
                      {p.monthly === 'Sur devis' ? 'Sur devis' : `${p.monthly} EUR/mois`}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[#71717a]">
                      {p.annual === 'Sur devis' ? 'Sur devis' : `${p.annual} EUR/an (${p.annualPerMonth} EUR/mois)`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={handleCreate}
            disabled={creating}
            className="px-4 py-2 rounded-xl text-[13px] font-semibold bg-cta text-white hover:bg-cta/90 disabled:opacity-50 flex items-center gap-2"
          >
            {creating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Création en cours...
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4" />
                Créer les produits Stripe
              </>
            )}
          </button>

          {/* Error */}
          {error && (
            <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[13px] font-semibold text-red-700">Erreur</p>
                <p className="text-[12px] text-red-600 mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Success result */}
          {result && (
            <div className="mt-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
              <p className="text-[13px] font-semibold text-emerald-700 mb-1">
                {result.status === 'already_exists' ? 'Produits deja crees' : 'Produits crees avec succes'}
              </p>
              <p className="text-[12px] text-emerald-600 mb-4">
                Copiez ces Price IDs dans vos variables d'environnement Vercel :
              </p>
              <div className="space-y-2">
                {result.env_vars && Object.entries(result.env_vars).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between bg-white rounded-lg border border-emerald-200 px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <code className="text-[11px] font-mono text-[#71717a]">{key}:</code>
                      <code className="text-[12px] font-mono text-[#1a1a1a] truncate">{value}</code>
                    </div>
                    <button
                      onClick={() => copyToClipboard(key, value)}
                      className="ml-2 p-1.5 rounded-lg hover:bg-emerald-50 text-[#71717a] hover:text-emerald-700 flex-shrink-0"
                      title="Copier"
                    >
                      {copiedKey === key ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionCard>

        {/* Env vars reference */}
        <SectionCard title="Variables d'environnement necessaires" icon={AlertTriangle}>
          <div className="space-y-3">
            {ENV_VARS.map((v) => (
              <div key={v.key} className="flex items-start gap-3">
                <code className="text-[11px] font-mono bg-[#fafafa] px-2 py-0.5 rounded flex-shrink-0 mt-0.5">{v.label}</code>
                <span className="text-[12px] text-[#71717a]">{v.description}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-[#f0f0f0]">
            <a
              href="https://vercel.com/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-cta hover:underline"
            >
              Gerer sur Vercel
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
