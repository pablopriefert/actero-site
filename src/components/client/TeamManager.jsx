import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, UserPlus, Shield, Eye, Headphones, Receipt,
  Crown, Trash2, Loader2, CheckCircle2, ChevronDown, Mail,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../ui/Toast'

const ROLES = [
  { id: 'manager', label: 'Manager', desc: 'Tout voir et modifier', icon: Shield, color: 'text-[#003725] bg-emerald-50' },
  { id: 'operational', label: 'Operationnel', desc: 'Metriques et tickets escalades', icon: Eye, color: 'text-blue-600 bg-blue-50' },
  { id: 'support', label: 'Support', desc: 'Voir et repondre aux escalades uniquement', icon: Headphones, color: 'text-amber-600 bg-amber-50' },
  { id: 'finance', label: 'Finance', desc: 'Factures uniquement', icon: Receipt, color: 'text-violet-600 bg-violet-50' },
]

const ROLE_LABELS = {
  owner: { label: 'Proprietaire', icon: Crown, color: 'text-[#003725] bg-emerald-50 border-emerald-200' },
  manager: { label: 'Manager', icon: Shield, color: 'text-[#003725] bg-emerald-50 border-emerald-200' },
  operational: { label: 'Operationnel', icon: Eye, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  support: { label: 'Support', icon: Headphones, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  finance: { label: 'Finance', icon: Receipt, color: 'text-violet-600 bg-violet-50 border-violet-200' },
}

// Define which tabs each role can access
export const ROLE_PERMISSIONS = {
  owner: '*', // all tabs
  manager: '*', // all tabs
  operational: ['overview', 'activity', 'escalations', 'systems', 'integrations'],
  support: ['overview', 'escalations'],
  finance: ['overview', 'profile'], // profile for billing portal
}

export const canAccessTab = (role, tabId) => {
  if (!role) return true // fallback: allow
  const perms = ROLE_PERMISSIONS[role]
  if (perms === '*') return true
  return perms.includes(tabId)
}

export const TeamManager = ({ clientId }) => {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('operational')
  const [inviting, setInviting] = useState(false)

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['team-members', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_users')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: true })
      if (error) throw error

      // Enrich with user emails from auth
      const enriched = await Promise.all((data || []).map(async (member) => {
        if (member.email) return member
        // Try to get email from Supabase auth (only works for own user)
        return { ...member, email: member.email || 'Invite en attente' }
      }))
      return enriched
    },
    enabled: !!clientId,
  })

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return
    setInviting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/invite-team-member', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          client_id: clientId,
          email: inviteEmail.trim(),
          role: inviteRole,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur')

      toast.success(data.message || `Invitation envoyee a ${inviteEmail}`)
      setInviteEmail('')
      setShowInvite(false)
      queryClient.invalidateQueries({ queryKey: ['team-members', clientId] })
    } catch (err) {
      toast.error('Erreur: ' + err.message)
    }
    setInviting(false)
  }

  const handleChangeRole = async (member, newRole) => {
    if (member.role === 'owner') {
      toast.error('Impossible de modifier le role du proprietaire')
      return
    }
    try {
      await supabase
        .from('client_users')
        .update({ role: newRole })
        .eq('client_id', clientId)
        .eq('user_id', member.user_id)
      toast.success('Role mis a jour')
      queryClient.invalidateQueries({ queryKey: ['team-members', clientId] })
    } catch {
      toast.error('Erreur lors de la mise a jour')
    }
  }

  const handleRemove = async (member) => {
    if (member.role === 'owner') {
      toast.error('Impossible de supprimer le proprietaire')
      return
    }
    try {
      await supabase
        .from('client_users')
        .delete()
        .eq('client_id', clientId)
        .eq('user_id', member.user_id)
      toast.success('Membre supprime')
      queryClient.invalidateQueries({ queryKey: ['team-members', clientId] })
    } catch {
      toast.error('Erreur lors de la suppression')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#003725]/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-[#003725]" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[#262626]">Equipe</h2>
            <p className="text-sm text-[#716D5C]">{members.length} membre{members.length > 1 ? 's' : ''}</p>
          </div>
        </div>
        <button
          onClick={() => setShowInvite(!showInvite)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#0F5F35] text-white rounded-full text-sm font-semibold hover:bg-[#003725] transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Inviter
        </button>
      </div>

      {/* Roles explanation */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {ROLES.map(role => {
          const Icon = role.icon
          return (
            <div key={role.id} className="p-4 bg-white border border-gray-100 rounded-xl shadow-sm">
              <Icon className={`w-5 h-5 mb-2 ${role.color.split(' ')[0]}`} />
              <p className="font-bold text-sm text-[#262626]">{role.label}</p>
              <p className="text-[10px] text-[#716D5C] mt-0.5">{role.desc}</p>
            </div>
          )
        })}
      </div>

      {/* Invite form */}
      <AnimatePresence>
        {showInvite && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-5 bg-white border border-gray-100 rounded-2xl shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-[#262626]">Inviter un membre</h3>
              <div className="flex gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-[10px] font-bold text-[#716D5C] uppercase tracking-wider mb-1">Email</label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="collegue@entreprise.com"
                    className="w-full px-4 py-2.5 bg-[#F5F5F0] border border-gray-200 rounded-xl text-sm text-[#262626] outline-none focus:ring-1 focus:ring-gray-300"
                  />
                </div>
                <div className="w-48">
                  <label className="block text-[10px] font-bold text-[#716D5C] uppercase tracking-wider mb-1">Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[#F5F5F0] border border-gray-200 rounded-xl text-sm text-[#262626] outline-none focus:ring-1 focus:ring-gray-300 appearance-none cursor-pointer"
                  >
                    {ROLES.map(r => (
                      <option key={r.id} value={r.id}>{r.label} — {r.desc}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleInvite}
                  disabled={!inviteEmail.trim() || inviting}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#0F5F35] text-white rounded-xl text-sm font-bold hover:bg-[#003725] transition-colors disabled:opacity-50"
                >
                  {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                  Envoyer l'invitation
                </button>
                <button
                  onClick={() => setShowInvite(false)}
                  className="px-4 py-2.5 text-sm font-semibold text-[#716D5C] hover:text-[#262626]"
                >
                  Annuler
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Members list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-[#716D5C]" />
        </div>
      ) : (
        <div className="space-y-2">
          {members.map((member) => {
            const roleConfig = ROLE_LABELS[member.role] || ROLE_LABELS.operational
            const RoleIcon = roleConfig.icon
            const isOwner = member.role === 'owner'
            return (
              <div key={member.user_id} className="flex items-center gap-4 p-4 bg-white border border-gray-100 rounded-xl shadow-sm">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-[#F5F5F0] flex items-center justify-center text-sm font-bold text-[#716D5C]">
                  {(member.email || '?')[0].toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#262626] truncate">{member.email || 'Utilisateur'}</p>
                  <p className="text-[10px] text-[#716D5C]">
                    Ajoute le {new Date(member.created_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>

                {/* Role badge / selector */}
                {isOwner ? (
                  <span className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border ${roleConfig.color}`}>
                    <RoleIcon className="w-3.5 h-3.5" />
                    {roleConfig.label}
                  </span>
                ) : (
                  <select
                    value={member.role}
                    onChange={(e) => handleChangeRole(member, e.target.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border appearance-none cursor-pointer ${roleConfig.color}`}
                  >
                    {ROLES.map(r => (
                      <option key={r.id} value={r.id}>{r.label}</option>
                    ))}
                  </select>
                )}

                {/* Remove */}
                {!isOwner && (
                  <button
                    onClick={() => handleRemove(member)}
                    className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="Retirer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
