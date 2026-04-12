import React, { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Plug,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../ui/PageHeader'
import { KpiCard, KpiRow } from '../ui/KpiCard'
import { SectionCard } from '../ui/SectionCard'
import { ListItem } from '../ui/ListItem'
import { StatusPill } from '../ui/StatusPill'
import { EmptyState } from '../ui/EmptyState'

const STATUS_VARIANT = {
  active: 'success',
  expired: 'warning',
  revoked: 'neutral',
  pending: 'info',
}

const STATUS_LABEL = {
  active: 'Connected',
  expired: 'Expired',
  revoked: 'Revoked',
  pending: 'Pending',
}

function providerLabel(p) {
  if (!p) return 'Unknown'
  return p.charAt(0).toUpperCase() + p.slice(1)
}

function TestButton({ clientId, provider }) {
  const [state, setState] = useState('idle') // idle | running | ok | ko
  const [message, setMessage] = useState('')

  const runTest = async (e) => {
    e.stopPropagation()
    setState('running')
    setMessage('')
    try {
      const res = await fetch('/api/integrations/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, provider }),
      })
      if (res.ok) {
        setState('ok')
        setMessage('OK')
      } else {
        setState('ko')
        const text = await res.text().catch(() => '')
        setMessage(text ? text.slice(0, 60) : `HTTP ${res.status}`)
      }
    } catch (err) {
      setState('ko')
      setMessage(err?.message || 'network error')
    }
  }

  const label =
    state === 'running'
      ? '...'
      : state === 'ok'
      ? 'OK'
      : state === 'ko'
      ? 'KO'
      : 'Test'

  const className =
    state === 'ok'
      ? 'text-[#10b981] border-[#10b981]/30 bg-[#10b981]/10'
      : state === 'ko'
      ? 'text-[#ef4444] border-[#ef4444]/30 bg-[#ef4444]/10'
      : 'text-[#71717a] border-[#f0f0f0] bg-white hover:bg-[#fafafa]'

  return (
    <button
      onClick={runTest}
      title={message || 'Tester la connexion'}
      className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-colors ${className}`}
    >
      {label}
    </button>
  )
}

export const AdminConnectorHealthView = () => {
  const { data: integrations = [], isLoading } = useQuery({
    queryKey: ['admin-connector-health'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_integrations')
        .select('id, client_id, provider, status, status_message, updated_at, created_at')
        .order('updated_at', { ascending: false })
        .limit(2000)
      if (error) throw error
      return data || []
    },
    refetchInterval: 30000,
  })

  const { data: clients = [] } = useQuery({
    queryKey: ['admin-connector-health-clients'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('id, brand_name')
      if (error) throw error
      return data || []
    },
    staleTime: 5 * 60 * 1000,
  })

  const clientMap = useMemo(() => {
    const m = new Map()
    for (const c of clients) m.set(c.id, c.brand_name || 'Client')
    return m
  }, [clients])

  const grouped = useMemo(() => {
    const by = new Map()
    for (const i of integrations) {
      const key = i.provider || 'unknown'
      if (!by.has(key)) by.set(key, [])
      by.get(key).push(i)
    }
    return Array.from(by.entries())
      .map(([provider, items]) => ({
        provider,
        items: items.sort((a, b) => {
          const order = { expired: 0, pending: 1, revoked: 2, active: 3 }
          return (order[a.status] ?? 9) - (order[b.status] ?? 9)
        }),
        total: items.length,
        healthy: items.filter((x) => x.status === 'active').length,
        errors: items.filter((x) => x.status !== 'active' && x.status_message != null).length,
        expired: items.filter((x) => x.status === 'expired').length,
      }))
      .sort((a, b) => b.total - a.total)
  }, [integrations])

  const globals = useMemo(() => {
    const total = integrations.length
    const healthy = integrations.filter((i) => i.status === 'active').length
    const errors = integrations.filter((i) => i.status !== 'active' && i.status_message != null).length
    const expired = integrations.filter((i) => i.status === 'expired').length
    return { total, healthy, errors, expired }
  }, [integrations])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Sante des connecteurs"
        subtitle="Etat des integrations cross-clients"
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#fafafa]">
        <KpiRow>
          <KpiCard
            label="Connecteurs totaux"
            value={globals.total}
            icon={Plug}
            color="brand"
            loading={isLoading}
          />
          <KpiCard
            label="Sains"
            value={globals.healthy}
            icon={CheckCircle2}
            color="success"
            loading={isLoading}
          />
          <KpiCard
            label="En erreur"
            value={globals.errors}
            icon={XCircle}
            color="danger"
            loading={isLoading}
          />
          <KpiCard
            label="Expires"
            value={globals.expired}
            icon={Clock}
            color="warning"
            loading={isLoading}
          />
        </KpiRow>

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-40 rounded-2xl bg-white animate-pulse border border-[#f0f0f0]" />
            ))}
          </div>
        ) : grouped.length === 0 ? (
          <SectionCard title="Aucune integration" icon={Plug}>
            <EmptyState
              icon={Plug}
              title="Aucun connecteur enregistre"
              description="Les integrations clients apparaitront ici des qu'elles seront configurees."
            />
          </SectionCard>
        ) : (
          grouped.map((group) => (
            <SectionCard
              key={group.provider}
              title={providerLabel(group.provider)}
              subtitle={`${group.total} client${group.total > 1 ? 's' : ''} - ${group.healthy} sains - ${group.errors} erreurs - ${group.expired} expires`}
              icon={Plug}
              action={
                <div className="flex items-center gap-1.5">
                  {group.errors > 0 && (
                    <StatusPill variant="danger" size="sm" icon={AlertTriangle}>
                      {group.errors}
                    </StatusPill>
                  )}
                  {group.expired > 0 && (
                    <StatusPill variant="warning" size="sm" icon={Clock}>
                      {group.expired}
                    </StatusPill>
                  )}
                </div>
              }
            >
              <div className="-mx-5">
                {group.items.map((i) => {
                  const variant = STATUS_VARIANT[i.status] || 'neutral'
                  const label = STATUS_LABEL[i.status] || 'Unknown'
                  const brand = clientMap.get(i.client_id) || `#${String(i.client_id || '').slice(0, 6)}`
                  const subtitle = i.status_message
                    ? `${String(i.status_message).slice(0, 120)}`
                    : `Mis a jour ${i.updated_at ? new Date(i.updated_at).toLocaleDateString('fr-FR') : '—'}`
                  return (
                    <ListItem
                      key={i.id}
                      avatar={brand}
                      title={brand}
                      subtitle={subtitle}
                      meta={
                        <div className="flex items-center gap-2 justify-end">
                          <StatusPill variant={variant} size="sm">
                            {label}
                          </StatusPill>
                          <TestButton clientId={i.client_id} provider={i.provider} />
                        </div>
                      }
                    />
                  )
                })}
              </div>
            </SectionCard>
          ))
        )}
      </div>
    </div>
  )
}

export default AdminConnectorHealthView
