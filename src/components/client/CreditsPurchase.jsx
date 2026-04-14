import React, { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Coins, Zap, TrendingUp, Check, Loader2, CreditCard, Info,
  Plus, Minus, ArrowRight, Receipt
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../ui/Toast'
import {
  computeCreditPrice, formatCredits, formatPriceEUR, getRateForAmount,
  CREDIT_TIERS, SUGGESTED_PACKS, MIN_CREDITS, MAX_CREDITS
} from '../../lib/credits-pricing'

const TX_LABELS = {
  purchase: { label: 'Achat', icon: Plus, color: 'text-emerald-600 bg-emerald-50' },
  usage: { label: 'Utilisation', icon: Minus, color: 'text-red-500 bg-red-50' },
  refund: { label: 'Remboursement', icon: TrendingUp, color: 'text-blue-500 bg-blue-50' },
  bonus: { label: 'Bonus', icon: Zap, color: 'text-amber-500 bg-amber-50' },
  adjustment: { label: 'Ajustement', icon: Coins, color: 'text-violet-500 bg-violet-50' },
}

export const CreditsPurchase = ({ clientId }) => {
  const toast = useToast()
  const [amount, setAmount] = useState(1000)
  const [loading, setLoading] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  const { data, refetch } = useQuery({
    queryKey: ['credits-balance', clientId],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/credits/balance', {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (!res.ok) throw new Error('Erreur')
      return res.json()
    },
    enabled: !!clientId,
    refetchInterval: 30000,
  })

  const price = useMemo(() => computeCreditPrice(amount), [amount])
  const rate = useMemo(() => getRateForAmount(amount), [amount])
  const pricePerCredit = amount > 0 ? price / amount / 100 : 0

  const handlePurchase = async () => {
    if (amount < MIN_CREDITS || amount > MAX_CREDITS) return
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/credits/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ amount }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error)
      if (result.checkout_url) window.location.href = result.checkout_url
    } catch (err) {
      toast.error(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Balance card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-gradient-to-br from-[#0F5F35] to-[#003725] text-white p-6 overflow-hidden relative"
      >
        <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-white/5" />
        <div className="absolute -right-12 -bottom-12 w-48 h-48 rounded-full bg-white/5" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Coins className="w-4 h-4 opacity-70" />
              <span className="text-[11px] font-semibold uppercase tracking-wider opacity-70">Solde actuel</span>
            </div>
            <p className="text-4xl font-bold">{formatCredits(data?.balance || 0)}</p>
            <p className="text-xs opacity-75 mt-1">crédits disponibles</p>
          </div>
          <div className="text-right text-[10px] opacity-75 space-y-1">
            <p>Total achetés : <strong>{formatCredits(data?.total_purchased || 0)}</strong></p>
            <p>Total utilisés : <strong>{formatCredits(data?.total_used || 0)}</strong></p>
          </div>
        </div>
        <div className="relative flex items-center gap-2 mt-5 text-[11px] opacity-90">
          <Info className="w-3 h-3" />
          <span>1 crédit = 1 ticket traité. Les crédits ne s'expirent pas.</span>
        </div>
      </motion.div>

      {/* Purchase card */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
            <Zap className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#1a1a1a]">Acheter des crédits</h3>
            <p className="text-xs text-[#71717a]">Rechargez votre compte pour traiter plus de tickets</p>
          </div>
        </div>

        {/* Quick packs */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-5">
          {SUGGESTED_PACKS.map((pack) => {
            const selected = amount === pack.amount
            return (
              <button
                key={pack.amount}
                onClick={() => setAmount(pack.amount)}
                className={`relative p-3 rounded-xl border text-center transition-all ${
                  selected
                    ? 'border-[#0F5F35] bg-[#0F5F35]/5 ring-2 ring-[#0F5F35]/20'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                {pack.label && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-amber-500 text-white text-[9px] font-bold uppercase">
                    {pack.label}
                  </span>
                )}
                <p className={`text-sm font-bold ${selected ? 'text-[#0F5F35]' : 'text-[#1a1a1a]'}`}>
                  {formatCredits(pack.amount)}
                </p>
                <p className="text-[10px] text-[#71717a] mt-0.5">
                  {formatPriceEUR(computeCreditPrice(pack.amount))}
                </p>
              </button>
            )
          })}
        </div>

        {/* Custom amount */}
        <div className="space-y-3 mb-5">
          <label className="block text-xs font-semibold text-[#71717a] uppercase tracking-wider">
            Nombre de crédits personnalisé
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={amount}
              onChange={(e) => {
                const v = Math.max(0, Math.floor(Number(e.target.value) || 0))
                setAmount(Math.min(v, MAX_CREDITS))
              }}
              min={MIN_CREDITS}
              max={MAX_CREDITS}
              step={100}
              className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm text-[#1a1a1a] font-semibold focus:outline-none focus:ring-2 focus:ring-[#0F5F35]/20"
            />
            <span className="text-sm text-[#71717a] font-medium">crédits</span>
          </div>
          <input
            type="range"
            min={MIN_CREDITS}
            max={MAX_CREDITS}
            step={100}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full accent-[#0F5F35]"
          />
          <div className="flex justify-between text-[10px] text-[#9ca3af]">
            <span>{MIN_CREDITS}</span>
            <span>{formatCredits(MAX_CREDITS)}</span>
          </div>
        </div>

        {/* Price breakdown */}
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-2 mb-4">
          <div className="flex justify-between text-xs text-[#71717a]">
            <span>{formatCredits(amount)} crédits × {pricePerCredit.toFixed(3).replace('.', ',')} €</span>
            <span className="font-semibold text-[#9ca3af]">tarif par crédit</span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-sm font-semibold text-[#1a1a1a]">Total</span>
            <span className="text-2xl font-bold text-[#0F5F35]">{formatPriceEUR(price)}</span>
          </div>
          {amount >= 1000 && (
            <p className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
              <Check className="w-3 h-3" />
              Tarif de gros appliqué ({(rate / 10).toFixed(1).replace('.', ',')}€ pour 10 crédits)
            </p>
          )}
        </div>

        {/* CTA */}
        <button
          onClick={handlePurchase}
          disabled={loading || amount < MIN_CREDITS}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#0F5F35] text-white text-sm font-bold hover:bg-[#003725] disabled:opacity-50 transition-all"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Redirection…</>
          ) : (
            <>
              <CreditCard className="w-4 h-4" />
              Acheter pour {formatPriceEUR(price)}
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
        <p className="text-[10px] text-[#9ca3af] text-center mt-2">
          Paiement sécurisé via Stripe. Crédits ajoutés instantanément.
        </p>
      </div>

      {/* Pricing tiers */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <h4 className="text-xs font-bold text-[#71717a] uppercase tracking-wider mb-3">Grille tarifaire</h4>
        <div className="space-y-1.5">
          {CREDIT_TIERS.slice().reverse().map((tier) => (
            <div key={tier.min} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-b-0">
              <span className="text-xs text-[#1a1a1a]">{tier.label}</span>
              <span className="text-xs font-mono text-[#71717a]">
                {(tier.rate_cents / 100).toFixed(3).replace('.', ',')} €/crédit
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Transaction history */}
      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
              <Receipt className="w-4 h-4 text-[#71717a]" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-[#1a1a1a]">Historique</p>
              <p className="text-[10px] text-[#9ca3af]">
                {data?.transactions?.length || 0} transaction{(data?.transactions?.length || 0) > 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <ArrowRight className={`w-4 h-4 text-[#71717a] transition-transform ${showHistory ? 'rotate-90' : ''}`} />
        </button>
        {showHistory && (
          <div className="border-t border-gray-100 divide-y divide-gray-100">
            {(data?.transactions || []).length === 0 ? (
              <p className="text-xs text-[#9ca3af] p-4 text-center italic">Aucune transaction</p>
            ) : (
              (data?.transactions || []).map((tx) => {
                const meta = TX_LABELS[tx.type] || TX_LABELS.adjustment
                const Icon = meta.icon
                return (
                  <div key={tx.id} className="flex items-center gap-3 p-3 px-4">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${meta.color}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-[#1a1a1a] truncate">
                        {tx.description || meta.label}
                      </p>
                      <p className="text-[10px] text-[#9ca3af]">
                        {new Date(tx.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                      </p>
                    </div>
                    <span className={`text-sm font-bold font-mono ${tx.amount > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {tx.amount > 0 ? '+' : ''}{formatCredits(tx.amount)}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  )
}
