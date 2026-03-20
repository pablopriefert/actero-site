import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Mail,
  BarChart3,
  MessageSquare,
  CalendarCheck,
  Target,
  Zap,
  Check,
  Loader2,
  ArrowUpRight,
  Sparkles,
  Clock,
  TrendingUp,
} from 'lucide-react'
import { getUpsellsForVertical } from '../../lib/upsell-catalog'
import { calculateUpsellPrice } from '../../lib/upsell-pricing'

const ICON_MAP = {
  Mail,
  BarChart3,
  MessageSquare,
  CalendarCheck,
  Target,
}

const COLOR_STYLES = {
  emerald: {
    dark: {
      badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      glow: 'shadow-emerald-500/5',
      accent: 'text-emerald-400',
      button: 'bg-emerald-600 hover:bg-emerald-500',
      iconBg: 'bg-emerald-500/10 border-emerald-500/20',
    },
    light: {
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      glow: 'shadow-emerald-100',
      accent: 'text-emerald-600',
      button: 'bg-emerald-600 hover:bg-emerald-700',
      iconBg: 'bg-emerald-50 border-emerald-200',
    },
  },
  violet: {
    dark: {
      badge: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
      glow: 'shadow-violet-500/5',
      accent: 'text-violet-400',
      button: 'bg-violet-600 hover:bg-violet-500',
      iconBg: 'bg-violet-500/10 border-violet-500/20',
    },
    light: {
      badge: 'bg-violet-50 text-violet-700 border-violet-200',
      glow: 'shadow-violet-100',
      accent: 'text-violet-600',
      button: 'bg-violet-600 hover:bg-violet-700',
      iconBg: 'bg-violet-50 border-violet-200',
    },
  },
  blue: {
    dark: {
      badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      glow: 'shadow-blue-500/5',
      accent: 'text-blue-400',
      button: 'bg-blue-600 hover:bg-blue-500',
      iconBg: 'bg-blue-500/10 border-blue-500/20',
    },
    light: {
      badge: 'bg-blue-50 text-blue-700 border-blue-200',
      glow: 'shadow-blue-100',
      accent: 'text-blue-600',
      button: 'bg-blue-600 hover:bg-blue-700',
      iconBg: 'bg-blue-50 border-blue-200',
    },
  },
  amber: {
    dark: {
      badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      glow: 'shadow-amber-500/5',
      accent: 'text-amber-400',
      button: 'bg-amber-600 hover:bg-amber-500',
      iconBg: 'bg-amber-500/10 border-amber-500/20',
    },
    light: {
      badge: 'bg-amber-50 text-amber-700 border-amber-200',
      glow: 'shadow-amber-100',
      accent: 'text-amber-600',
      button: 'bg-amber-600 hover:bg-amber-700',
      iconBg: 'bg-amber-50 border-amber-200',
    },
  },
}

const StatusBadge = ({ status, theme }) => {
  const isLight = theme === 'light'
  const statusConfig = {
    active: {
      label: 'Actif',
      className: isLight
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      icon: Check,
    },
    pending: {
      label: 'En cours',
      className: isLight
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      icon: Clock,
    },
  }

  const config = statusConfig[status]
  if (!config) return null

  const IconComp = config.icon
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${config.className}`}>
      <IconComp className="w-3 h-3" />
      {config.label}
    </span>
  )
}

const UpsellCard = ({ upsell, client, metrics, existingUpsell, theme, onActivate, isActivating }) => {
  const isLight = theme === 'light'
  const Icon = ICON_MAP[upsell.icon] || Zap
  const colorStyle = COLOR_STYLES[upsell.color]?.[isLight ? 'light' : 'dark'] || COLOR_STYLES.emerald[isLight ? 'light' : 'dark']

  const price = calculateUpsellPrice(client, metrics, upsell.id)
  const status = existingUpsell?.status || 'available'
  const isActive = status === 'active'
  const isPending = status === 'pending'
  const isAvailable = status === 'available'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`group relative rounded-2xl border p-6 transition-all duration-300 ${
        isLight
          ? `bg-white border-slate-200 shadow-sm ${isAvailable ? 'hover:shadow-lg hover:border-slate-300' : ''}`
          : `bg-[#0a0a0a] border-white/10 ${isAvailable ? 'hover:border-white/20 hover:shadow-xl' : ''}`
      } ${colorStyle.glow}`}
    >
      {/* Badge top-right */}
      <div className="flex items-start justify-between mb-5">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${colorStyle.iconBg}`}>
          <Icon className={`w-6 h-6 ${colorStyle.accent}`} />
        </div>
        <div className="flex items-center gap-2">
          {isActive || isPending ? (
            <StatusBadge status={status} theme={theme} />
          ) : (
            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${colorStyle.badge}`}>
              {upsell.badge}
            </span>
          )}
        </div>
      </div>

      {/* Title */}
      <h3 className={`text-lg font-bold mb-1 ${isLight ? 'text-slate-900' : 'text-white'}`}>
        {upsell.name}
      </h3>
      <p className={`text-xs font-medium mb-3 ${colorStyle.accent}`}>
        {upsell.subtitle}
      </p>

      {/* Description */}
      <p className={`text-sm leading-relaxed mb-4 ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>
        {upsell.description}
      </p>

      {/* Business value */}
      <div className={`flex items-start gap-2 mb-6 p-3 rounded-xl ${isLight ? 'bg-slate-50' : 'bg-white/[0.03]'}`}>
        <TrendingUp className={`w-4 h-4 mt-0.5 shrink-0 ${colorStyle.accent}`} />
        <p className={`text-xs leading-relaxed ${isLight ? 'text-slate-500' : 'text-zinc-500'}`}>
          {upsell.businessValue}
        </p>
      </div>

      {/* Pricing */}
      <div className="mb-5">
        <div className="flex items-baseline gap-1">
          <span className={`text-3xl font-bold tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
            {price}€
          </span>
          <span className={`text-sm ${isLight ? 'text-slate-400' : 'text-zinc-500'}`}>/mois</span>
        </div>
        <p className={`text-[10px] mt-1 font-medium ${isLight ? 'text-slate-400' : 'text-zinc-600'}`}>
          Calculé selon votre activité actuelle
        </p>
      </div>

      {/* CTA Button */}
      {isActive ? (
        <div className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold ${
          isLight ? 'bg-emerald-50 text-emerald-700' : 'bg-emerald-500/10 text-emerald-400'
        }`}>
          <Check className="w-4 h-4" />
          Automatisation active
        </div>
      ) : isPending ? (
        <div className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold ${
          isLight ? 'bg-amber-50 text-amber-700' : 'bg-amber-500/10 text-amber-400'
        }`}>
          <Loader2 className="w-4 h-4 animate-spin" />
          Activation en cours...
        </div>
      ) : (
        <button
          onClick={() => onActivate(upsell.id, price)}
          disabled={isActivating}
          className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold text-white transition-all duration-200 ${colorStyle.button} ${
            isActivating ? 'opacity-60 cursor-not-allowed' : 'hover:shadow-lg active:scale-[0.98]'
          }`}
        >
          {isActivating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Redirection...
            </>
          ) : (
            <>
              Activer cette automatisation
              <ArrowUpRight className="w-4 h-4" />
            </>
          )}
        </button>
      )}
    </motion.div>
  )
}

export const UpsellsView = ({ client, metrics, supabase, theme }) => {
  const [activatingId, setActivatingId] = useState(null)
  const [error, setError] = useState(null)

  const clientType = client?.client_type || 'ecommerce'
  const catalogItems = getUpsellsForVertical(clientType)

  // Fetch existing upsells from Supabase
  const [existingUpsells, setExistingUpsells] = React.useState([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    if (!client?.id || !supabase) return
    const fetchUpsells = async () => {
      const { data } = await supabase
        .from('client_upsells')
        .select('*')
        .eq('client_id', client.id)
      setExistingUpsells(data || [])
      setLoading(false)
    }
    fetchUpsells()
  }, [client?.id, supabase])

  const getExistingUpsell = (upsellType) => {
    return existingUpsells.find((u) => u.upsell_type === upsellType)
  }

  const handleActivate = async (upsellType, price) => {
    setActivatingId(upsellType)
    setError(null)

    try {
      const response = await fetch('/api/create-upsell-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: client.id,
          upsell_type: upsellType,
          vertical: clientType,
          calculated_price: price,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la création du checkout')
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url
    } catch (err) {
      setError(err.message)
      setActivatingId(null)
    }
  }

  const isLight = theme === 'light'

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl animate-pulse ${isLight ? 'bg-slate-200' : 'bg-zinc-800'}`} />
          <div className={`h-6 w-64 rounded-lg animate-pulse ${isLight ? 'bg-slate-200' : 'bg-zinc-800'}`} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <div key={i} className={`h-80 rounded-2xl animate-pulse ${isLight ? 'bg-slate-100' : 'bg-zinc-900'}`} />
          ))}
        </div>
      </div>
    )
  }

  const activeCount = existingUpsells.filter((u) => u.status === 'active').length

  return (
    <div className="space-y-6">
      {/* Section header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isLight ? 'bg-violet-50 border border-violet-200' : 'bg-violet-500/10 border border-violet-500/20'
            }`}>
              <Sparkles className={`w-5 h-5 ${isLight ? 'text-violet-600' : 'text-violet-400'}`} />
            </div>
            <div>
              <h2 className={`text-2xl font-bold tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Opportunités de croissance
              </h2>
            </div>
          </div>
          <p className={`text-sm ml-[52px] ${isLight ? 'text-slate-500' : 'text-zinc-500'}`}>
            Automatisations disponibles pour votre {clientType === 'immobilier' ? 'agence' : 'boutique'}. Tarification ajustée à votre volume.
          </p>
        </div>

        {activeCount > 0 && (
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${
            isLight ? 'bg-emerald-50 border-emerald-200' : 'bg-emerald-500/10 border-emerald-500/20'
          }`}>
            <Check className={`w-4 h-4 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`} />
            <span className={`text-sm font-bold ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
              {activeCount} active{activeCount > 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm font-medium">
          {error}
        </div>
      )}

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {catalogItems.map((upsell, index) => (
          <motion.div
            key={upsell.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.1 }}
          >
            <UpsellCard
              upsell={upsell}
              client={client}
              metrics={metrics}
              existingUpsell={getExistingUpsell(upsell.id)}
              theme={theme}
              onActivate={handleActivate}
              isActivating={activatingId === upsell.id}
            />
          </motion.div>
        ))}
      </div>

      {/* Trust footer */}
      <div className={`text-center py-4 ${isLight ? 'text-slate-400' : 'text-zinc-600'}`}>
        <p className="text-xs">
          Paiement sécurisé par Stripe. Abonnement mensuel sans engagement. Annulable à tout moment.
        </p>
      </div>
    </div>
  )
}
