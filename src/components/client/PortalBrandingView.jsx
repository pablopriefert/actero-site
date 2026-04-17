import React, { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2, Check, AlertCircle } from 'lucide-react'
import { canAccess } from '../../lib/plans'
import { UpgradeBanner } from '../ui/UpgradeBanner'

// ─── Live portal preview ────────────────────────────────────────────
function PortalPreview({ displayName, logoUrl, primaryColor }) {
  const color = primaryColor || '#0F5F35'
  const name = displayName || 'Votre boutique'

  return (
    <div className="sticky top-4">
      <p className="text-[12px] font-semibold text-[#71717a] uppercase tracking-wider mb-3">
        Aperçu en direct
      </p>
      {/* Mockup browser shell */}
      <div className="rounded-2xl border border-[#e0e0e0] overflow-hidden shadow-[0_4px_16px_rgba(0,0,0,0.08)]">
        {/* Browser top bar */}
        <div className="bg-[#f5f5f5] border-b border-[#e0e0e0] px-4 py-2.5 flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#ff5f56]" />
          <span className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
          <span className="w-3 h-3 rounded-full bg-[#27c93f]" />
          <div className="ml-3 flex-1 bg-white rounded-md px-3 py-1 text-[10px] text-[#9ca3af] border border-[#e8e8e8] truncate">
            {name.toLowerCase().replace(/\s+/g, '')}.portal.actero.fr
          </div>
        </div>

        {/* Scaled-down portal page at ~60% */}
        <div className="bg-[#f8f8f8] overflow-hidden" style={{ height: '360px' }}>
          <div
            style={{
              transform: 'scale(0.6)',
              transformOrigin: 'top center',
              width: '166.67%',
              marginLeft: '-33.33%',
            }}
          >
            {/* Portal header */}
            <div className="bg-white border-b border-[#f0f0f0] px-8 py-4 flex items-center justify-between">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Logo"
                  className="h-8 w-auto max-w-[180px] object-contain"
                  onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
                />
              ) : null}
              <span
                className="text-[18px] font-bold text-[#1a1a1a]"
                style={{ display: logoUrl ? 'none' : 'block' }}
              >
                Actero
              </span>
              {logoUrl && (
                <span className="text-[18px] font-bold text-[#1a1a1a]" style={{ display: 'none' }}>
                  Actero
                </span>
              )}
            </div>

            {/* Login card */}
            <div className="flex items-center justify-center py-16 px-6">
              <div className="bg-white rounded-2xl border border-[#f0f0f0] shadow-[0_4px_24px_rgba(0,0,0,0.08)] p-10 w-full max-w-md">
                <h1 className="text-[26px] font-bold text-[#1a1a1a] mb-2">
                  Accède à ton espace SAV
                </h1>
                <p className="text-[15px] text-[#71717a] mb-8">
                  pour tes commandes chez <strong className="text-[#1a1a1a]">{name}</strong>
                </p>

                {/* Email input mock */}
                <div className="mb-4">
                  <label className="block text-[13px] font-medium text-[#1a1a1a] mb-1.5">
                    Ton adresse email
                  </label>
                  <div className="w-full px-4 py-3 rounded-xl border border-[#e0e0e0] bg-[#fafafa] text-[14px] text-[#9ca3af]">
                    jean@exemple.com
                  </div>
                </div>

                {/* CTA button with brand color */}
                <button
                  disabled
                  className="w-full py-3.5 rounded-xl text-white text-[15px] font-semibold"
                  style={{ backgroundColor: color }}
                >
                  Recevoir mon lien de connexion
                </button>

                <p className="text-[12px] text-[#9ca3af] text-center mt-4">
                  Un lien magique sera envoyé à ton adresse email.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <p className="text-[11px] text-[#9ca3af] text-center mt-2">
        Aperçu approximatif — le rendu final peut varier légèrement.
      </p>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────
export const PortalBrandingView = ({ client, clientId, supabase, planId, onBack }) => {
  const queryClient = useQueryClient()
  const hasAccess = canAccess(planId, 'portal_customization')

  const [displayName, setDisplayName] = useState(client?.portal_display_name || '')
  const [logoUrl, setLogoUrl] = useState(client?.portal_logo_url || '')
  const [primaryColor, setPrimaryColor] = useState(client?.portal_primary_color || '#0F5F35')
  const [saveStatus, setSaveStatus] = useState(null) // null | 'success' | 'error'
  const [errorMessage, setErrorMessage] = useState('')

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/client/update-portal-branding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erreur serveur')
      return json
    },
    onSuccess: (data) => {
      setSaveStatus('success')
      queryClient.invalidateQueries({ queryKey: ['portal-client-row', clientId] })
      // Reset after 3s
      setTimeout(() => setSaveStatus(null), 3000)
    },
    onError: (err) => {
      setSaveStatus('error')
      setErrorMessage(err.message || 'Une erreur est survenue.')
    },
  })

  const handleSave = () => {
    setSaveStatus(null)
    setErrorMessage('')
    saveMutation.mutate({
      portal_display_name: displayName.trim(),
      portal_logo_url: logoUrl.trim(),
      portal_primary_color: primaryColor,
    })
  }

  // If no Pro+ plan — show upgrade banner
  if (!hasAccess) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-[13px] text-[#71717a] hover:text-[#1a1a1a] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour au Portail SAV
          </button>
        </div>
        <UpgradeBanner
          requiredPlan="pro"
          feature="portal_customization"
          onUpgrade={onBack}
          compact={false}
          fallbackDescription="Personnalise ton portail SAV à ton image — logo, couleurs, nom de marque. Disponible dès le plan Pro."
        />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header with back link */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[13px] text-[#71717a] hover:text-[#1a1a1a] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour au Portail SAV
        </button>
      </div>

      <div>
        <h2 className="text-[22px] font-semibold text-[#1a1a1a]">Personnaliser mon portail</h2>
        <p className="text-[13px] text-[#9ca3af] mt-1">
          Mets ton image de marque sur le portail SAV visible par tes clients.
        </p>
      </div>

      {/* 2-col layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left column — form */}
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-[#f0f0f0] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-6 space-y-6">

            {/* Nom affiché */}
            <div>
              <label className="block text-[13px] font-semibold text-[#1a1a1a] mb-1">
                Nom affiché
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value.slice(0, 60))}
                maxLength={60}
                placeholder="Ex: Horace · Service client"
                className="w-full px-4 py-2.5 rounded-xl border border-[#e0e0e0] text-[14px] text-[#1a1a1a] placeholder:text-[#c0c0c0] focus:outline-none focus:ring-2 focus:ring-[#1F3A12]/20 focus:border-[#1F3A12] transition-colors"
              />
              <p className="text-[11px] text-[#9ca3af] mt-1.5 flex justify-between">
                <span>Affiché sous "pour tes commandes chez…" sur la page de connexion.</span>
                <span>{displayName.length}/60</span>
              </p>
            </div>

            {/* URL du logo */}
            <div>
              <label className="block text-[13px] font-semibold text-[#1a1a1a] mb-1">
                URL du logo
              </label>
              <input
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://cdn.exemple.com/logo.png"
                className="w-full px-4 py-2.5 rounded-xl border border-[#e0e0e0] text-[14px] text-[#1a1a1a] placeholder:text-[#c0c0c0] focus:outline-none focus:ring-2 focus:ring-[#1F3A12]/20 focus:border-[#1F3A12] transition-colors"
              />
              <p className="text-[11px] text-[#9ca3af] mt-1.5">
                PNG ou SVG, max 180px de large. Tu peux l'héberger sur ton CDN ou utiliser imgur.
              </p>
            </div>

            {/* Couleur principale */}
            <div>
              <label className="block text-[13px] font-semibold text-[#1a1a1a] mb-1">
                Couleur principale
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => {
                    const val = e.target.value
                    setPrimaryColor(val)
                  }}
                  placeholder="#0F5F35"
                  maxLength={7}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-[#e0e0e0] text-[14px] text-[#1a1a1a] font-mono placeholder:text-[#c0c0c0] focus:outline-none focus:ring-2 focus:ring-[#1F3A12]/20 focus:border-[#1F3A12] transition-colors"
                />
                <input
                  type="color"
                  value={/^#[0-9a-fA-F]{6}$/.test(primaryColor) ? primaryColor : '#0F5F35'}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-10 h-10 rounded-xl border border-[#e0e0e0] cursor-pointer overflow-hidden p-0.5 flex-shrink-0"
                  title="Choisir une couleur"
                />
              </div>
              <p className="text-[11px] text-[#9ca3af] mt-1.5">
                Utilisée pour le bouton de connexion et les accents. Format hex — ex: #0F5F35.
              </p>
            </div>
          </div>

          {/* Save button + status (sticky on mobile) */}
          <div className="lg:static sticky bottom-4 z-10">
            <div className="bg-white rounded-2xl border border-[#f0f0f0] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4 flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={saveMutation.isPending}
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-[#1F3A12] text-white text-[14px] font-semibold hover:bg-[#162C0D] disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : saveStatus === 'success' ? (
                  <Check className="w-4 h-4" />
                ) : null}
                {saveMutation.isPending ? 'Enregistrement…' : saveStatus === 'success' ? 'Enregistré !' : 'Enregistrer les modifications'}
              </button>

              {saveStatus === 'error' && (
                <div className="flex items-center gap-1.5 text-[12px] text-red-600">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {errorMessage}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right column — live preview */}
        <div>
          <PortalPreview
            displayName={displayName}
            logoUrl={logoUrl}
            primaryColor={/^#[0-9a-fA-F]{6}$/.test(primaryColor) ? primaryColor : '#0F5F35'}
          />
        </div>
      </div>
    </div>
  )
}
