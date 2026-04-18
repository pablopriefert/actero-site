import React from 'react'
import { motion } from 'framer-motion'
import { User, Users, Bell, CreditCard, LifeBuoy, Gift, Code, ChevronRight, Award } from 'lucide-react'

/**
 * Settings Hub — single "Paramètres" landing that groups all the secondary
 * settings (account, team, notifications, billing, help, referral, api,
 * partner) into clean cards.
 *
 * Keeps the sidebar compact (one entry) while staying fully navigable.
 */
export const SettingsHubView = ({ onNavigate }) => {
  const groups = [
    {
      title: 'Compte',
      items: [
        { id: 'profile', label: 'Mon compte', description: 'Email, mot de passe, préférences', icon: User },
        { id: 'team', label: 'Équipe', description: 'Inviter des collaborateurs, rôles', icon: Users },
        { id: 'notifications', label: 'Notifications', description: 'Emails et alertes', icon: Bell },
      ],
    },
    {
      title: 'Facturation',
      items: [
        { id: 'billing', label: 'Facturation', description: 'Plan, factures, moyens de paiement', icon: CreditCard },
        { id: 'referral', label: 'Parrainage', description: '1 mois offert par filleul', icon: Gift, badge: '1 mois offert' },
      ],
    },
    {
      title: 'Développeur',
      items: [
        { id: 'api-docs', label: 'API & Webhooks', description: 'Clés, documentation, webhooks', icon: Code },
      ],
    },
    {
      title: 'Support',
      items: [
        { id: 'support', label: 'Centre d\'aide', description: 'Guides, FAQ, contact support', icon: LifeBuoy },
        { id: 'partner', label: 'Actero Partners', description: 'Devenir partenaire agence', icon: Award },
      ],
    },
  ]

  return (
    <div className="max-w-5xl mx-auto px-5 md:px-8 pt-6 pb-16 animate-fade-in-up">
      <div className="mb-8">
        <h1 className="text-[22px] font-bold text-[#1a1a1a] tracking-tight mb-1">Paramètres</h1>
        <p className="text-[13px] text-[#71717a]">
          Gérez votre compte, votre équipe et la facturation.
        </p>
      </div>

      <div className="space-y-8">
        {groups.map((grp, gidx) => (
          <div key={grp.title}>
            <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#9ca3af] mb-3 px-1">
              {grp.title}
            </h2>
            <div className="bg-white rounded-2xl border border-[#f0f0f0] divide-y divide-[#f0f0f0] overflow-hidden">
              {grp.items.map((it, idx) => {
                const Icon = it.icon
                return (
                  <motion.button
                    key={it.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2, delay: 0.03 * (gidx * 3 + idx) }}
                    onClick={() => onNavigate && onNavigate(it.id)}
                    className="group w-full flex items-center gap-3 px-4 py-3.5 hover:bg-[#fafafa] transition-colors text-left"
                  >
                    <div className="w-9 h-9 rounded-lg bg-cta/10 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-cta" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-[#1a1a1a]">{it.label}</span>
                        {it.badge && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {it.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[12px] text-[#71717a] truncate mt-0.5">{it.description}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#9ca3af] group-hover:text-[#71717a] transition-colors flex-shrink-0" />
                  </motion.button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
