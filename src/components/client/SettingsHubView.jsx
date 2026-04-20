import React from 'react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { User, Users, Bell, CreditCard, LifeBuoy, Gift, Code, ChevronRight, Award, Cog } from 'lucide-react'
import { supabase } from '../../lib/supabase'

/**
 * Settings Hub — refondu avril 2026.
 *
 * Avant : liste de liens groupés, aucun signal dynamique.
 * Après : header strip unifié + per-item signals (plan actuel, team size,
 * notifications state, etc.). User voit l'état de chaque surface avant de
 * cliquer.
 *
 * Pattern cohérent avec Overview / Automation / Insights / KB.
 */
export const SettingsHubView = ({ clientId, onNavigate }) => {
  const { data: hubSignals } = useQuery({
    queryKey: ['settings-hub-signals', clientId],
    queryFn: async () => {
      if (!clientId) return null
      const [clientRow, teamRes, settingsRes] = await Promise.all([
        supabase.from('clients').select('plan, company_name').eq('id', clientId).maybeSingle(),
        supabase.from('team_members').select('id', { count: 'exact', head: true }).eq('client_id', clientId),
        supabase.from('client_settings').select('notifications_enabled, email_notifications_enabled').eq('client_id', clientId).maybeSingle(),
      ])
      const plan = clientRow.data?.plan || 'free'
      const planLabel = plan === 'free' ? 'Free'
        : plan === 'starter' ? 'Starter'
        : plan === 'pro' ? 'Pro'
        : plan === 'enterprise' ? 'Entreprise'
        : plan.charAt(0).toUpperCase() + plan.slice(1)
      const teamCount = (teamRes.count || 0) + 1 // +1 for owner
      const notifsOn = settingsRes.data?.notifications_enabled !== false
      const emailNotifsOn = settingsRes.data?.email_notifications_enabled !== false
      return {
        plan,
        planLabel,
        companyName: clientRow.data?.company_name,
        teamCount,
        notifsOn,
        emailNotifsOn,
      }
    },
    enabled: !!clientId,
  })

  const planLabel = hubSignals?.planLabel || '—'
  const teamCount = hubSignals?.teamCount ?? 1
  const notifsOn = hubSignals?.notifsOn !== false
  const emailNotifsOn = hubSignals?.emailNotifsOn !== false

  const groups = [
    {
      title: 'Compte',
      items: [
        {
          id: 'profile',
          label: 'Mon compte',
          description: 'Email, mot de passe, préférences',
          icon: User,
          signal: hubSignals?.companyName,
        },
        {
          id: 'team',
          label: 'Équipe',
          description: 'Inviter des collaborateurs, rôles',
          icon: Users,
          signal: `${teamCount} membre${teamCount > 1 ? 's' : ''}`,
        },
        {
          id: 'notifications',
          label: 'Notifications',
          description: 'Emails et alertes',
          icon: Bell,
          signal: notifsOn && emailNotifsOn
            ? 'Toutes actives'
            : (!notifsOn && !emailNotifsOn
                ? 'Toutes désactivées'
                : 'Partiellement activées'),
          signalState: notifsOn && emailNotifsOn ? 'ok' : 'warn',
        },
      ],
    },
    {
      title: 'Facturation',
      items: [
        {
          id: 'billing',
          label: 'Facturation',
          description: 'Plan, factures, moyens de paiement',
          icon: CreditCard,
          signal: `Plan ${planLabel}`,
          signalState: hubSignals?.plan === 'free' ? 'warn' : 'ok',
        },
        {
          id: 'referral',
          label: 'Parrainage',
          description: '1 mois offert par filleul',
          icon: Gift,
          badge: '1 mois offert',
        },
      ],
    },
    {
      title: 'Développeur',
      items: [
        {
          id: 'api-docs',
          label: 'API & Webhooks',
          description: 'Clés, documentation, webhooks',
          icon: Code,
        },
      ],
    },
    {
      title: 'Support',
      items: [
        {
          id: 'support',
          label: 'Centre d\'aide',
          description: 'Guides, FAQ, contact support',
          icon: LifeBuoy,
        },
        {
          id: 'partner',
          label: 'Actero Partners',
          description: 'Devenir partenaire agence',
          icon: Award,
        },
      ],
    },
  ]

  return (
    <div className="max-w-5xl mx-auto px-5 md:px-8 pt-6 pb-16 animate-fade-in-up">
      {/* ═══════ HEADER STRIP ═══════ */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 md:p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-cta/10 flex items-center justify-center">
                <Cog className="w-3.5 h-3.5 text-cta" />
              </div>
              <h1 className="text-lg font-bold text-[#1a1a1a]">Paramètres</h1>
            </div>
            <p className="text-[12px] text-[#71717a]">
              Gérez votre compte, votre équipe et la facturation.
            </p>
          </div>
          <div className="flex items-center gap-4 md:gap-6 flex-wrap">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wider">Plan</span>
              <span className={`text-[15px] font-bold tabular-nums leading-tight ${
                hubSignals?.plan === 'free' ? 'text-amber-700' : 'text-cta'
              }`}>
                {planLabel}
              </span>
              <span className="text-[10px] text-[#9ca3af]">actuel</span>
            </div>
            <div className="w-px h-10 bg-gray-200" />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wider">Équipe</span>
              <span className="text-[15px] font-bold text-[#1a1a1a] tabular-nums leading-tight">
                {teamCount}
              </span>
              <span className="text-[10px] text-[#9ca3af]">
                {teamCount === 1 ? 'membre' : 'membres'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════ SETTINGS GROUPS ═══════ */}
      <div className="space-y-6">
        {groups.map((grp, gidx) => (
          <div key={grp.title}>
            <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#9ca3af] mb-2 px-1">
              {grp.title}
            </h2>
            <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
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
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
                            {it.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[12px] text-[#71717a] truncate mt-0.5">{it.description}</p>
                    </div>
                    {it.signal && (
                      <span className={`text-[11px] font-semibold tabular-nums flex-shrink-0 truncate max-w-[140px] ${
                        it.signalState === 'warn'
                          ? 'text-amber-700'
                          : it.signalState === 'ok'
                            ? 'text-cta'
                            : 'text-[#71717a]'
                      }`}>
                        {it.signal}
                      </span>
                    )}
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
