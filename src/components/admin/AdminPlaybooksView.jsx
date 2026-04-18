import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Zap, CheckCircle2, Users, Loader2, ShoppingBag,
  Home, Headphones, Building2, Settings,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../ui/Toast'

const PLAYBOOK_ICONS = {
  sav_ecommerce: ShoppingBag,
  abandoned_cart: ShoppingBag,
  lead_qualification_immo: Building2,
  gestion_locative: Home,
  support_technique: Headphones,
}

export const AdminPlaybooksView = () => {
  const toast = useToast()
  const queryClient = useQueryClient()

  const { data: playbooks = [], isLoading } = useQuery({
    queryKey: ['admin-playbooks'],
    queryFn: async () => {
      const { data } = await supabase.from('engine_playbooks').select('*').order('display_name')
      return data || []
    },
  })

  const { data: clients = [] } = useQuery({
    queryKey: ['admin-clients-for-playbooks'],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('id, brand_name, client_type').order('brand_name')
      return data || []
    },
  })

  const { data: associations = [] } = useQuery({
    queryKey: ['admin-playbook-associations'],
    queryFn: async () => {
      const { data } = await supabase.from('engine_client_playbooks').select('*, clients(brand_name), engine_playbooks(display_name)')
      return data || []
    },
  })

  const handleToggleAssociation = async (clientId, playbookId, currentlyActive) => {
    const existing = associations.find(a => a.client_id === clientId && a.playbook_id === playbookId)

    if (existing) {
      await supabase.from('engine_client_playbooks').update({
        is_active: !currentlyActive,
        [!currentlyActive ? 'activated_at' : 'deactivated_at']: new Date().toISOString(),
      }).eq('id', existing.id)
    } else {
      await supabase.from('engine_client_playbooks').insert({
        client_id: clientId,
        playbook_id: playbookId,
        is_active: true,
        activated_at: new Date().toISOString(),
      })
    }

    queryClient.invalidateQueries({ queryKey: ['admin-playbook-associations'] })
    toast.success('Mis a jour')
  }

  const isActive = (clientId, playbookId) => {
    return associations.some(a => a.client_id === clientId && a.playbook_id === playbookId && a.is_active)
  }

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#71717a]" /></div>

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[24px] font-bold text-[#1a1a1a]">Playbooks</h2>
        <p className="text-[13px] text-[#71717a]">Gerez les playbooks metier et leur association aux clients</p>
      </div>

      {/* Playbooks list */}
      {playbooks.map(playbook => {
        const Icon = PLAYBOOK_ICONS[playbook.name] || Zap
        const clientsWithPlaybook = associations.filter(a => a.playbook_id === playbook.id && a.is_active)

        return (
          <div key={playbook.id} className="bg-white border border-[#f0f0f0] rounded-2xl overflow-hidden">
            <div className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#003725]/10 flex items-center justify-center">
                <Icon className="w-6 h-6 text-[#003725]" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-[#1a1a1a]">{playbook.display_name}</h3>
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-full">
                    {clientsWithPlaybook.length} client{clientsWithPlaybook.length > 1 ? 's' : ''}
                  </span>
                </div>
                <p className="text-[12px] text-[#71717a] mt-0.5">{playbook.description}</p>
                <div className="flex gap-1 mt-2">
                  {(playbook.event_types || []).map(et => (
                    <span key={et} className="px-2 py-0.5 bg-[#ffffff] rounded text-[9px] font-mono text-[#71717a]">{et}</span>
                  ))}
                </div>
              </div>
              <div className="text-right text-[12px] text-[#71717a]">
                <p>Seuil: {Math.round((playbook.confidence_threshold || 0.85) * 100)}%</p>
                <p>{(playbook.actions_available || []).length} actions</p>
              </div>
            </div>

            {/* Client association grid */}
            <div className="border-t border-[#f0f0f0] p-4">
              <p className="text-[10px] font-bold text-[#71717a] uppercase tracking-wider mb-2">Clients</p>
              <div className="flex flex-wrap gap-2">
                {clients.map(client => {
                  const active = isActive(client.id, playbook.id)
                  return (
                    <button
                      key={client.id}
                      onClick={() => handleToggleAssociation(client.id, playbook.id, active)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold transition-all ${
                        active
                          ? 'bg-cta text-white'
                          : 'bg-[#f5f5f5] text-[#71717a] hover:bg-gray-200'
                      }`}
                    >
                      {active && <CheckCircle2 className="w-3 h-3" />}
                      {client.brand_name}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
