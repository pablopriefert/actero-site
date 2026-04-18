import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  MoreVertical,
  Pause,
  Play,
  RefreshCw,
  Eraser,
  Mail,
  KeyRound,
  Eye,
  Trash2,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../ui/Toast'
import { TypedConfirmModal } from '../ui/TypedConfirmModal'
import { logAdminAction } from '../../lib/audit-log'

/**
 * AdminClientQuickActions — Menu kebab réutilisable pour actions admin sur un client.
 *
 * @param {Object} props
 * @param {{ id: string, brand_name?: string, email?: string, agent_enabled?: boolean }} props.client
 * @param {(action: string, payload: any) => void} [props.onAction]  Callback post-success
 * @param {string} [props.align='right']  'right' | 'left'
 */
export function AdminClientQuickActions({ client, onAction, align = 'right' }) {
  const [open, setOpen] = useState(false)
  const [loadingAction, setLoadingAction] = useState(null)
  // Typed-confirm modal state: { action: 'delete_client' | 'clear_memory' | 'rotate_keys' } or null
  const [confirmModal, setConfirmModal] = useState(null)
  const containerRef = useRef(null)
  const toast = useToast()

  // Close on outside click + Escape
  useEffect(() => {
    if (!open) return
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    const handleKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  const callClientAction = useCallback(
    async (action, { confirm } = {}) => {
      setLoadingAction(action)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch('/api/admin/client-actions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ client_id: client.id, action, confirm }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
        toast.success(`${actionLabel(action)} - OK`)
        // Audit log — fire-and-forget. Records WHO did WHAT to WHICH client.
        logAdminAction({
          action: `client.${action}`,
          target_type: 'client',
          target_id: client.id,
          details: { brand_name: client.brand_name || null },
        })
        onAction?.(action, json)
        return json
      } catch (err) {
        console.error(`[AdminClientQuickActions] ${action} failed:`, err)
        toast.error(`${actionLabel(action)} : ${err.message}`)
      } finally {
        setLoadingAction(null)
        setOpen(false)
      }
    },
    [client.id, onAction, toast]
  )

  const handleImpersonate = useCallback(async () => {
    setLoadingAction('impersonate')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/impersonate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ client_id: client.id }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`)
      toast.success('Token d\'impersonation créé')
      logAdminAction({
        action: 'client.impersonate',
        target_type: 'client',
        target_id: client.id,
        details: { brand_name: client.brand_name || null },
      })
      window.open(json.impersonate_url, '_blank', 'noopener,noreferrer')
      onAction?.('impersonate', json)
    } catch (err) {
      console.error('[AdminClientQuickActions] impersonate failed:', err)
      toast.error(`Impersonation : ${err.message}`)
    } finally {
      setLoadingAction(null)
      setOpen(false)
    }
  }, [client.id, onAction, toast])

  const handlePause = () => callClientAction('pause_agent')
  const handleResume = () => callClientAction('resume_agent')
  const handleResync = () => callClientAction('resync_shopify')
  const handleResendWelcome = () => callClientAction('resend_welcome')
  // Destructive actions: open typed-confirm modal instead of native window.confirm.
  // User must type the brand_name (delete), 'VIDER' (clear memory), or 'ROTATE' (rotate keys)
  // to enable the red button — GitHub-style muscle-memory protection.
  const handleClearMemory = () => {
    setOpen(false)
    setConfirmModal({ action: 'clear_memory' })
  }
  const handleRotate = () => {
    setOpen(false)
    setConfirmModal({ action: 'rotate_keys' })
  }
  const handleDelete = () => {
    setOpen(false)
    setConfirmModal({ action: 'delete_client' })
  }

  const isPaused = client.agent_enabled === false

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        aria-label="Actions"
        aria-haspopup="menu"
        aria-expanded={open}
        className="w-8 h-8 rounded-lg hover:bg-[#fafafa] flex items-center justify-center text-[#9ca3af] hover:text-[#1a1a1a] transition-colors"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {open && (
        <div
          role="menu"
          onClick={(e) => e.stopPropagation()}
          className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} top-9 z-50 w-60 rounded-xl bg-white border border-[#f0f0f0] shadow-[0_8px_24px_rgba(0,0,0,0.12)] py-1.5`}
        >
          {isPaused ? (
            <MenuItem
              icon={Play}
              label="Reprendre agent"
              onClick={handleResume}
              loading={loadingAction === 'resume_agent'}
            />
          ) : (
            <MenuItem
              icon={Pause}
              label="Pause agent"
              onClick={handlePause}
              loading={loadingAction === 'pause_agent'}
            />
          )}
          <MenuItem
            icon={RefreshCw}
            label="Re-sync Shopify"
            onClick={handleResync}
            loading={loadingAction === 'resync_shopify'}
          />
          <MenuItem
            icon={Eraser}
            label="Vider la mémoire client"
            onClick={handleClearMemory}
            loading={loadingAction === 'clear_memory'}
          />
          <MenuItem
            icon={Mail}
            label="Renvoyer email de bienvenue"
            onClick={handleResendWelcome}
            loading={loadingAction === 'resend_welcome'}
          />
          <MenuItem
            icon={KeyRound}
            label="Rotate API keys"
            onClick={handleRotate}
            loading={loadingAction === 'rotate_keys'}
          />

          <div className="my-1 border-t border-[#f0f0f0]" />

          <MenuItem
            icon={Eye}
            label="Voir comme client"
            onClick={handleImpersonate}
            loading={loadingAction === 'impersonate'}
          />

          <div className="my-1 border-t border-[#f0f0f0]" />

          <MenuItem
            icon={Trash2}
            label="Supprimer client"
            onClick={handleDelete}
            loading={loadingAction === 'delete_client'}
            danger
          />
        </div>
      )}

      {/* Typed-confirm modal for destructive actions.
          Shared modal, action-switched via confirmModal.action. */}
      <TypedConfirmModal
        open={confirmModal?.action === 'delete_client'}
        onClose={() => setConfirmModal(null)}
        onConfirm={async () => {
          await callClientAction('delete_client', { confirm: true })
          setConfirmModal(null)
        }}
        title="Supprimer définitivement le client ?"
        description={`Toutes les données de ${client.brand_name || 'ce client'} seront perdues : tickets, agents, intégrations, factures. Cette action est irréversible.`}
        confirmText={client.brand_name || String(client.id)}
        confirmLabel="Supprimer définitivement"
        tone="danger"
      />

      <TypedConfirmModal
        open={confirmModal?.action === 'clear_memory'}
        onClose={() => setConfirmModal(null)}
        onConfirm={async () => {
          await callClientAction('clear_memory', { confirm: true })
          setConfirmModal(null)
        }}
        title="Vider la mémoire client ?"
        description={`L'agent de ${client.brand_name || 'ce client'} oubliera tout son historique de conversations. Action irréversible.`}
        confirmText="VIDER"
        confirmLabel="Vider la mémoire"
        tone="danger"
      />

      <TypedConfirmModal
        open={confirmModal?.action === 'rotate_keys'}
        onClose={() => setConfirmModal(null)}
        onConfirm={async () => {
          await callClientAction('rotate_keys', { confirm: true })
          setConfirmModal(null)
        }}
        title="Régénérer les clés API du widget ?"
        description="Le widget installé sur la boutique cessera de fonctionner jusqu'à la mise à jour des clés. Ré-déploiement manuel requis."
        confirmText="ROTATE"
        confirmLabel="Régénérer les clés"
        tone="warning"
      />
    </div>
  )
}

function MenuItem({ icon: Icon, label, onClick, loading, danger }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={loading}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-[12.5px] text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        danger
          ? 'text-[#ef4444] hover:bg-[#ef4444]/5'
          : 'text-[#1a1a1a] hover:bg-[#fafafa]'
      }`}
    >
      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
      <span className="flex-1 truncate">{label}</span>
      {loading && (
        <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
      )}
    </button>
  )
}

function actionLabel(action) {
  const map = {
    pause_agent: 'Pause agent',
    resume_agent: 'Reprise agent',
    resync_shopify: 'Re-sync Shopify',
    clear_memory: 'Mémoire vidée',
    resend_welcome: 'Email de bienvenue envoyé',
    rotate_keys: 'API keys régénérées',
    delete_client: 'Client supprimé',
    impersonate: 'Impersonation',
  }
  return map[action] || action
}

export default AdminClientQuickActions
