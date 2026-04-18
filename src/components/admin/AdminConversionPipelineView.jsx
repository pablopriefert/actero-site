import React, { useState, useEffect } from 'react'
import { Users, TrendingUp, Mail, Loader2, Target } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../ui/PageHeader'
import { SectionCard } from '../ui/SectionCard'
import { KpiCard, KpiRow } from '../ui/KpiCard'
import { StatusPill } from '../ui/StatusPill'
import { ListItem } from '../ui/ListItem'

function timeAgo(dateStr) {
  if (!dateStr) return '-'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `il y a ${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `il y a ${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `il y a ${days}j`
  const months = Math.floor(days / 30)
  return `il y a ${months} mois`
}

export function AdminConversionPipelineView() {
  const [clients, setClients] = useState([])
  const [usage, setUsage] = useState({})
  const [loading, setLoading] = useState(true)
  const [totalClients, setTotalClients] = useState(0)
  const [paidClients, setPaidClients] = useState(0)

  useEffect(() => {
    ;(async () => {
      try {
        // Fetch all clients for total count + paid count
        const { data: allClients } = await supabase
          .from('clients')
          .select('id, plan')

        const all = allClients || []
        setTotalClients(all.length)
        setPaidClients(all.filter(c => c.plan && c.plan !== 'free').length)

        // Fetch free clients
        const { data: freeClients } = await supabase
          .from('clients')
          .select('id, brand_name, contact_email, plan, created_at')
          .eq('plan', 'free')
          .order('created_at', { ascending: false })

        const freeList = freeClients || []
        setClients(freeList)

        // Fetch usage counters for current month
        if (freeList.length > 0) {
          const now = new Date()
          const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
          const clientIds = freeList.map(c => c.id)

          const { data: counters } = await supabase
            .from('usage_counters')
            .select('client_id, tickets_used, period, updated_at')
            .in('client_id', clientIds)
            .eq('period', currentPeriod)

          const usageMap = {}
          ;(counters || []).forEach(c => {
            usageMap[c.client_id] = {
              tickets: c.tickets_used || 0,
              lastActivity: c.updated_at,
            }
          })
          setUsage(usageMap)
        }
      } catch (err) {
        console.error('[ConversionPipeline]', err)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const FREE_QUOTA = 50
  const READY_THRESHOLD = 35 // 70% of 50

  const readyToConvert = clients.filter(c => (usage[c.id]?.tickets || 0) >= READY_THRESHOLD)
  const conversionRate = totalClients > 0 ? ((paidClients / totalClients) * 100).toFixed(1) : '0'

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto animate-fade-in-up">
        <PageHeader title="Pipeline Conversion Free" />
        <div className="flex items-center justify-center py-20 text-[#9ca3af]">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto animate-fade-in-up">
      <PageHeader title="Pipeline Conversion Free" subtitle="Identifiez les clients Free prets a passer en Starter/Pro" />

      <div className="p-6 space-y-6">
        <KpiRow>
          <KpiCard
            label="Clients Free"
            value={clients.length}
            icon={Users}
            color="info"
          />
          <KpiCard
            label="Prets a convertir"
            value={readyToConvert.length}
            icon={Target}
            color="success"
          />
          <KpiCard
            label="Taux de conversion global"
            value={`${conversionRate}%`}
            icon={TrendingUp}
            color="brand"
            sublabel={`${paidClients} payants / ${totalClients} total`}
          />
        </KpiRow>

        <SectionCard title={`Clients Free (${clients.length})`} icon={Users}>
          {clients.length === 0 ? (
            <p className="text-[13px] text-[#9ca3af] py-4 text-center">Aucun client Free actuellement.</p>
          ) : (
            <div className="-mx-5 -mb-5">
              {/* Table header */}
              <div className="grid grid-cols-12 gap-2 px-5 py-2.5 bg-[#fafafa] border-b border-[#f0f0f0] text-[11px] font-bold text-[#71717a] uppercase tracking-wider">
                <div className="col-span-3">Client</div>
                <div className="col-span-2">Inscription</div>
                <div className="col-span-3">Tickets ce mois</div>
                <div className="col-span-2">Derniere activite</div>
                <div className="col-span-2 text-right">Statut</div>
              </div>

              {clients.map((client) => {
                const clientUsage = usage[client.id] || {}
                const tickets = clientUsage.tickets || 0
                const pct = Math.min((tickets / FREE_QUOTA) * 100, 100)
                const isReady = tickets >= READY_THRESHOLD

                return (
                  <div
                    key={client.id}
                    className="grid grid-cols-12 gap-2 items-center px-5 py-3 border-b border-[#f0f0f0] hover:bg-[#fafafa] transition-colors"
                  >
                    {/* Brand + email */}
                    <div className="col-span-3 min-w-0">
                      <div className="text-[13px] font-medium text-[#1a1a1a] truncate">{client.brand_name}</div>
                      <div className="text-[11px] text-[#9ca3af] truncate">{client.contact_email || '-'}</div>
                    </div>

                    {/* Inscription date */}
                    <div className="col-span-2 text-[12px] text-[#71717a]">
                      {timeAgo(client.created_at)}
                    </div>

                    {/* Progress bar */}
                    <div className="col-span-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-[#f0f0f0] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              isReady ? 'bg-[#10b981]' : pct > 50 ? 'bg-[#f59e0b]' : 'bg-[#3b82f6]'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-[#71717a] tabular-nums flex-shrink-0">
                          {tickets}/{FREE_QUOTA}
                        </span>
                      </div>
                    </div>

                    {/* Last activity */}
                    <div className="col-span-2 text-[12px] text-[#71717a]">
                      {clientUsage.lastActivity ? timeAgo(clientUsage.lastActivity) : '-'}
                    </div>

                    {/* Status + action */}
                    <div className="col-span-2 flex items-center justify-end gap-2">
                      {isReady ? (
                        <StatusPill variant="success" dot>Pret</StatusPill>
                      ) : (
                        <StatusPill variant="neutral">{Math.round(pct)}%</StatusPill>
                      )}
                      {client.contact_email && (
                        <a
                          href={`mailto:${client.contact_email}?subject=Votre compte Actero`}
                          className="p-1.5 rounded-lg hover:bg-[#fafafa] text-[#71717a] hover:text-cta"
                          title="Contacter"
                        >
                          <Mail className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  )
}
