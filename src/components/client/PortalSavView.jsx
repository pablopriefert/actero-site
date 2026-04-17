import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  MonitorSmartphone, Copy, CheckCheck, ExternalLink,
  ToggleLeft, ToggleRight, Loader2, Palette, BarChart3,
} from 'lucide-react'
import { canAccess } from '../../lib/plans'
import { UpgradeBanner } from '../ui/UpgradeBanner'

const PORTAL_BASE_DOMAIN = import.meta.env.VITE_PORTAL_BASE_DOMAIN || 'portal.actero.fr'

function portalUrl(slug) {
  return `https://${slug}.${PORTAL_BASE_DOMAIN}`
}

// ─── Copy button (small inline) ──────────────────────────────────
function CopyButton({ text, className = '' }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }
  return (
    <button
      onClick={handleCopy}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
        copied
          ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
          : 'bg-[#f5f5f5] text-[#71717a] hover:bg-[#ebebeb] border border-[#ebebeb]'
      } ${className}`}
    >
      {copied ? <CheckCheck className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copié !' : 'Copier'}
    </button>
  )
}

// ─── Snippet card ─────────────────────────────────────────────────
function SnippetCard({ title, description, code }) {
  return (
    <div className="bg-white rounded-xl border border-[#f0f0f0] shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
      <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-[#1a1a1a]">{title}</p>
          {description && (
            <p className="text-[11px] text-[#9ca3af] mt-0.5">{description}</p>
          )}
        </div>
        <CopyButton text={code} />
      </div>
      <pre className="px-4 pb-4 text-[11px] text-[#555] bg-[#fafafa] border-t border-[#f0f0f0] overflow-x-auto whitespace-pre-wrap break-all font-mono leading-relaxed">
        {code}
      </pre>
    </div>
  )
}

// ─── Stat card ───────────────────────────────────────────────────
function StatCard({ label, value }) {
  return (
    <div className="bg-white rounded-xl border border-[#f0f0f0] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-5 text-center">
      <p className="text-[28px] font-bold text-[#1a1a1a] tabular-nums">
        {value === 0 ? '—' : value.toLocaleString('fr-FR')}
      </p>
      <p className="text-[12px] text-[#71717a] mt-1">{label}</p>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────
export const PortalSavView = ({ client, clientId, supabase, onUpgrade, onNavigate }) => {
  const queryClient = useQueryClient()
  const plan = client?.plan || 'free'

  // ── If free plan — full upgrade wall ─────────────────────────
  if (!canAccess(plan, 'portal_enabled')) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h2 className="text-[22px] font-semibold text-[#1a1a1a]">Portail SAV</h2>
          <p className="text-[13px] text-[#9ca3af] mt-1">
            Donnez à vos clients un espace en libre-service pour gérer leurs demandes.
          </p>
        </div>
        <div className="max-w-lg mx-auto py-8">
          <div className="bg-white rounded-2xl border border-[#f0f0f0] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-10 text-center">
            <div className="w-16 h-16 rounded-full bg-[#E8F5EC] border border-[#A8C490] flex items-center justify-center mx-auto mb-5">
              <MonitorSmartphone className="w-7 h-7 text-[#1F3A12]" />
            </div>
            <h3 className="text-[20px] font-semibold text-[#1a1a1a] mb-2">
              Portail SAV self-service
            </h3>
            <p className="text-[14px] text-[#71717a] leading-relaxed max-w-sm mx-auto mb-6">
              Donne à tes clients un espace privé pour suivre leurs commandes, demander un remboursement ou un retour — 100% en autonomie.
            </p>
            <button
              onClick={onUpgrade}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#1F3A12] text-white text-[14px] font-semibold hover:bg-[#162C0D] transition-colors shadow-sm"
            >
              Passer au plan Starter
            </button>
            <p className="text-[11px] text-[#9ca3af] mt-4">Essai gratuit 7 jours, sans engagement</p>
          </div>
        </div>
      </div>
    )
  }

  // ── Fetch full client row for portal fields ───────────────────
  const { data: clientRow, isLoading } = useQuery({
    queryKey: ['portal-client-row', clientId],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('*').eq('id', clientId).single()
      return data
    },
    enabled: !!clientId,
    initialData: client,
  })

  // ── Derived values from the full row ─────────────────────────
  const slug = clientRow?.slug || ''
  const url = slug ? portalUrl(slug) : null

  // ── Toggle portal_enabled ────────────────────────────────────
  const [toggleLoading, setToggleLoading] = useState(false)
  const [justEnabled, setJustEnabled] = useState(false)
  const portalEnabled = clientRow?.portal_enabled ?? false

  const handleToggle = async () => {
    setToggleLoading(true)
    const newVal = !portalEnabled
    try {
      const { data: { session } } = await supabase.auth.getSession()
      await fetch('/api/client/toggle-portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ enabled: newVal }),
      })
      queryClient.invalidateQueries({ queryKey: ['portal-client-row', clientId] })
      if (newVal) setJustEnabled(true)
    } catch { /* noop */ }
    setToggleLoading(false)
  }

  // ── Stats (portal_action_logs) ──────────────────────────────
  const { data: stats } = useQuery({
    queryKey: ['portal-stats', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('portal_action_logs')
        .select('action')
        .eq('client_id', clientId)
      if (!data) return { logins: 0, tickets: 0, selfservice: 0 }
      const logins = data.filter(r => r.action === 'login').length
      const tickets = data.filter(r => r.action === 'ticket_reply').length
      const selfservice = data.filter(r =>
        ['refund_request', 'return_request', 'invoice_download'].includes(r.action)
      ).length
      return { logins, tickets, selfservice }
    },
    enabled: !!clientId,
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-[#9ca3af]" />
      </div>
    )
  }

  const canCustomize = canAccess(plan, 'portal_customization')
  const hasBranding = !!(clientRow?.portal_display_name || clientRow?.portal_logo_url)

  // ── Sharing snippets ─────────────────────────────────────────
  const snippetLink = url
    ? `<a href="${url}" style="color:#1F3A12;font-weight:600;">Suivre ma commande et gérer mon SAV →</a>`
    : ''
  const snippetFooter = url
    ? `<div style="padding:16px;background:#f8f8f8;border-radius:8px;text-align:center;">\n  <p style="margin:0 0 8px;font-size:14px;">Besoin d'aide ?</p>\n  <a href="${url}" style="color:#1F3A12;font-weight:600;">Accéder à mon espace SAV</a>\n</div>`
    : ''
  const snippetButton = url
    ? `<a href="${url}" style="position:fixed;bottom:24px;right:24px;background:#1F3A12;color:#fff;padding:14px 20px;border-radius:999px;text-decoration:none;font-weight:600;box-shadow:0 4px 12px rgba(0,0,0,0.15);z-index:9999;">💬 Mon SAV</a>`
    : ''

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-[22px] font-semibold text-[#1a1a1a]">Portail SAV</h2>
        <p className="text-[13px] text-[#9ca3af] mt-1">
          Gérez et partagez votre portail self-service client.
        </p>
      </div>

      {/* ━━━ Section A — Statut & URL ━━━ */}
      <div className="bg-white rounded-2xl border border-[#f0f0f0] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-6 space-y-5">
        <h3 className="text-[14px] font-semibold text-[#1a1a1a]">Statut & URL</h3>

        {/* URL pill */}
        {url ? (
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-[#f8f8f8] border border-[#e8e8e8] rounded-full text-[13px] font-mono text-[#1a1a1a] flex-1 min-w-0 truncate">
              <MonitorSmartphone className="w-4 h-4 text-[#1F3A12] flex-shrink-0" />
              <span className="truncate">{url}</span>
            </div>
            <CopyButton text={url} />
            {portalEnabled && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-[#1F3A12] bg-[#E8F5EC] border border-[#A8C490] hover:bg-[#d4edda] transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                Voir le portail
              </a>
            )}
          </div>
        ) : (
          <p className="text-[13px] text-[#9ca3af]">Aucun slug configuré. Contactez le support.</p>
        )}

        {/* Toggle */}
        <div className="flex items-center justify-between py-3 border-t border-[#f0f0f0]">
          <div>
            <p className="text-[13px] font-medium text-[#1a1a1a]">Activer le portail pour mes clients</p>
            <p className="text-[11px] text-[#9ca3af] mt-0.5">
              {portalEnabled ? 'Vos clients peuvent accéder au portail.' : 'Le portail est désactivé — vos clients ne peuvent pas y accéder.'}
            </p>
          </div>
          <button
            onClick={handleToggle}
            disabled={toggleLoading}
            className="flex-shrink-0"
            aria-label={portalEnabled ? 'Désactiver le portail' : 'Activer le portail'}
          >
            {toggleLoading ? (
              <Loader2 className="w-8 h-8 animate-spin text-[#9ca3af]" />
            ) : portalEnabled ? (
              <ToggleRight className="w-10 h-10 text-[#1F3A12]" />
            ) : (
              <ToggleLeft className="w-10 h-10 text-[#d4d4d4]" />
            )}
          </button>
        </div>

        {/* Green confirmation */}
        {justEnabled && portalEnabled && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[#E8F5EC] border border-[#A8C490] text-[13px] text-[#1F3A12] font-medium">
            <CheckCheck className="w-4 h-4" />
            Portail activé ! Vos clients peuvent maintenant y accéder.
          </div>
        )}
      </div>

      {/* ━━━ Section B — Partage avec tes clients ━━━ */}
      {url && (
        <div className="space-y-4">
          <div>
            <h3 className="text-[14px] font-semibold text-[#1a1a1a]">Partage avec tes clients</h3>
            <p className="text-[12px] text-[#9ca3af] mt-0.5">
              Copie l'un de ces snippets dans ton interface Shopify pour guider tes clients vers le portail.
            </p>
          </div>
          <SnippetCard
            title="Lien pour email de confirmation Shopify"
            description="À coller dans le template d'email de confirmation de commande"
            code={snippetLink}
          />
          <SnippetCard
            title="Bloc HTML pour footer du site Shopify"
            description="À ajouter dans le footer de ta boutique"
            code={snippetFooter}
          />
          <SnippetCard
            title="Bouton flottant (snippet JS à coller avant </body>)"
            description="Affiche un bouton flottant permanent sur ta boutique"
            code={snippetButton}
          />
        </div>
      )}

      {/* ━━━ Section C — Personnalisation branding ━━━ */}
      <div className="bg-white rounded-2xl border border-[#f0f0f0] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-6 space-y-4">
        <h3 className="text-[14px] font-semibold text-[#1a1a1a]">Personnalisation branding</h3>

        {canCustomize ? (
          <div className="space-y-4">
            {hasBranding && (
              <div className="flex flex-wrap gap-4 text-[12px] text-[#71717a]">
                {clientRow?.portal_display_name && (
                  <span className="px-3 py-1.5 bg-[#fafafa] border border-[#f0f0f0] rounded-lg">
                    Nom : <strong className="text-[#1a1a1a]">{clientRow.portal_display_name}</strong>
                  </span>
                )}
                {clientRow?.portal_logo_url && (
                  <span className="flex items-center gap-2 px-3 py-1.5 bg-[#fafafa] border border-[#f0f0f0] rounded-lg">
                    Logo :
                    <img src={clientRow.portal_logo_url} alt="Logo portail" className="h-5 w-auto rounded" />
                  </span>
                )}
                {clientRow?.portal_primary_color && (
                  <span className="flex items-center gap-2 px-3 py-1.5 bg-[#fafafa] border border-[#f0f0f0] rounded-lg">
                    Couleur :
                    <span
                      className="w-4 h-4 rounded-full border border-[#e0e0e0]"
                      style={{ backgroundColor: clientRow.portal_primary_color }}
                    />
                  </span>
                )}
              </div>
            )}
            <button
              onClick={() => onNavigate ? onNavigate('portal-branding') : (window.location.href = '/client/portal-branding')}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-[#1F3A12] text-white text-[13px] font-semibold hover:bg-[#162C0D] transition-colors"
            >
              <Palette className="w-4 h-4" />
              Personnaliser mon portail (logo, couleur, nom)
            </button>
          </div>
        ) : (
          <UpgradeBanner
            requiredPlan="pro"
            feature="portal_customization"
            onUpgrade={onUpgrade}
            compact={false}
            fallbackDescription="Passer au plan Pro pour mettre ton logo, tes couleurs et ton nom de marque sur le portail de tes clients."
          />
        )}
      </div>

      {/* ━━━ Section D — Statistiques ━━━ */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-[#9ca3af]" />
          <h3 className="text-[14px] font-semibold text-[#1a1a1a]">Statistiques</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Total de connexions" value={stats?.logins ?? 0} />
          <StatCard label="Tickets créés via portail" value={stats?.tickets ?? 0} />
          <StatCard label="Demandes self-service" value={stats?.selfservice ?? 0} />
        </div>
        {stats && (stats.logins === 0 && stats.tickets === 0 && stats.selfservice === 0) && (
          <p className="text-[12px] text-[#9ca3af] text-center">
            Pas encore de données — les statistiques apparaîtront après les premières connexions de vos clients.
          </p>
        )}
      </div>
    </div>
  )
}
