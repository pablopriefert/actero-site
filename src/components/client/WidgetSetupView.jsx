import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Check, Copy, MessageSquare, ShoppingBag, Code2, Loader2 } from 'lucide-react'

/**
 * WidgetSetupView — "Ma bulle SAV"
 *
 * One screen to (1) customize the storefront chat bubble and (2) copy the
 * one-line install snippet. All customization is persisted to client_settings
 * and served to the live widget via /api/engine/widget-config — so the snippet
 * never changes: the merchant pastes it once and tweaks colors/greeting here
 * anytime, live.
 */
export const WidgetSetupView = ({ clientId }) => {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)
  const [canWhiteLabel, setCanWhiteLabel] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [shopDomain, setShopDomain] = useState(null)

  const [cfg, setCfg] = useState({
    widget_brand_color: '#0F5F35',
    widget_position: 'bottom-right',
    widget_greeting: 'Bonjour ! Comment puis-je vous aider ?',
    widget_logo_url: '',
    widget_show_powered_by: true,
  })

  // ── Load current settings + API key + plan ────────────────────
  useEffect(() => {
    if (!clientId) return
    let cancelled = false
    ;(async () => {
      try {
        // Settings row (widget_* columns).
        const { data: s } = await supabase
          .from('client_settings')
          .select('widget_brand_color, widget_position, widget_greeting, widget_logo_url, widget_show_powered_by, widget_api_key')
          .eq('client_id', clientId)
          .maybeSingle()

        // API key precedence: active client_api_keys first, else legacy widget_api_key.
        let key = null
        const { data: k } = await supabase
          .from('client_api_keys')
          .select('key_value')
          .eq('client_id', clientId)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        key = k?.key_value || s?.widget_api_key || clientId

        // Plan → can hide "Powered by".
        const { data: c } = await supabase
          .from('clients')
          .select('plan, trial_ends_at')
          .eq('id', clientId)
          .maybeSingle()
        const plan = c?.plan || 'free'
        const inTrial = c?.trial_ends_at && new Date(c.trial_ends_at) > new Date()
        const wl = ['pro', 'enterprise'].includes(plan) || (inTrial && ['pro', 'enterprise'].includes(plan))

        // Shopify shop domain — used to deep-link the theme editor's App
        // embeds panel. Best-effort: if RLS blocks it or there's no connection,
        // we simply don't show the deep-link button (paste path still works).
        let shop = null
        try {
          const { data: conn } = await supabase
            .from('client_shopify_connections')
            .select('shop_domain')
            .eq('client_id', clientId)
            .maybeSingle()
          shop = conn?.shop_domain || null
        } catch { /* ignore — button just won't render */ }

        if (cancelled) return
        setApiKey(key)
        setShopDomain(shop)
        setCanWhiteLabel(wl)
        if (s) {
          setCfg({
            widget_brand_color: s.widget_brand_color || '#0F5F35',
            widget_position: s.widget_position || 'bottom-right',
            widget_greeting: s.widget_greeting || 'Bonjour ! Comment puis-je vous aider ?',
            widget_logo_url: s.widget_logo_url || '',
            widget_show_powered_by: s.widget_show_powered_by !== false,
          })
        }
      } catch {
        if (!cancelled) setError('Impossible de charger la configuration.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [clientId])

  const snippet = `<script src="https://actero.fr/widget.js" data-actero-key="${apiKey}" defer></script>`
  // Deep-link straight to the theme editor's "App embeds" panel, where the
  // merchant flips the Actero toggle on. Only when we know their shop domain.
  const themeEditorUrl = shopDomain
    ? `https://${shopDomain}/admin/themes/current/editor?context=apps`
    : null

  const update = (patch) => { setCfg((c) => ({ ...c, ...patch })); setSaved(false) }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(snippet)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard blocked — user can select manually */ }
  }

  const handleSave = async () => {
    setSaving(true); setError(null); setSaved(false)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/client/widget-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(cfg),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Erreur serveur')
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setError(e.message || 'Erreur lors de la sauvegarde.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-[#71717a]">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement…
      </div>
    )
  }

  const isLeft = cfg.widget_position === 'bottom-left'

  return (
    <div className="max-w-5xl mx-auto pb-16">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1a1a1a]">Ma bulle SAV</h1>
        <p className="text-sm text-[#71717a] mt-1">
          Personnalisez la bulle de chat, puis copiez une seule ligne de code à coller sur votre boutique. Vous pourrez modifier les couleurs et le message quand vous voulez — sans jamais retoucher le code.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        {/* ── Contrôles ── */}
        <div className="space-y-5">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 space-y-5">
            <h2 className="text-base font-bold text-[#1a1a1a]">Apparence</h2>

            {/* Couleur */}
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5">Couleur principale</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={cfg.widget_brand_color}
                  onChange={(e) => update({ widget_brand_color: e.target.value })}
                  className="w-11 h-11 rounded-lg border border-gray-200 cursor-pointer bg-white p-1"
                  aria-label="Couleur principale de la bulle"
                />
                <input
                  type="text"
                  value={cfg.widget_brand_color}
                  onChange={(e) => update({ widget_brand_color: e.target.value })}
                  className="w-32 px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono"
                  placeholder="#0F5F35"
                />
              </div>
            </div>

            {/* Position */}
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5">Position</label>
              <div className="flex gap-2">
                {[
                  { v: 'bottom-right', l: 'Bas droite' },
                  { v: 'bottom-left', l: 'Bas gauche' },
                ].map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => update({ widget_position: opt.v })}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      cfg.widget_position === opt.v
                        ? 'border-[#0F5F35] bg-[#0F5F35] text-white'
                        : 'border-gray-200 text-[#71717a] hover:border-gray-300'
                    }`}
                  >
                    {opt.l}
                  </button>
                ))}
              </div>
            </div>

            {/* Message d'accueil */}
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5">Message d'accueil</label>
              <textarea
                value={cfg.widget_greeting}
                onChange={(e) => update({ widget_greeting: e.target.value.slice(0, 200) })}
                rows={2}
                maxLength={200}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none"
                placeholder="Bonjour ! Comment puis-je vous aider ?"
              />
              <p className="text-[11px] text-[#9ca3af] mt-1">{cfg.widget_greeting.length}/200</p>
            </div>

            {/* Logo */}
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5">Logo (URL, optionnel)</label>
              <input
                type="url"
                value={cfg.widget_logo_url}
                onChange={(e) => update({ widget_logo_url: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                placeholder="https://votre-marque.com/logo.png"
              />
            </div>

            {/* Powered by (Pro) */}
            <div className="flex items-center justify-between pt-1">
              <div>
                <span className="text-sm font-medium text-[#1a1a1a]">Masquer « Propulsé par Actero »</span>
                {!canWhiteLabel && (
                  <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">PRO</span>
                )}
              </div>
              <button
                type="button"
                disabled={!canWhiteLabel}
                onClick={() => update({ widget_show_powered_by: !cfg.widget_show_powered_by })}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  !cfg.widget_show_powered_by && canWhiteLabel ? 'bg-[#0F5F35]' : 'bg-gray-200'
                } ${!canWhiteLabel ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                aria-label="Masquer la mention Actero"
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${!cfg.widget_show_powered_by && canWhiteLabel ? 'translate-x-5' : ''}`} />
              </button>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0F5F35] text-white text-sm font-semibold hover:bg-[#003725] transition-colors disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : null}
                {saved ? 'Enregistré' : 'Enregistrer'}
              </button>
              {error && <span className="text-sm text-red-600">{error}</span>}
            </div>
          </div>

          {/* ── Snippet + install ── */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-[#0F5F35]/10 flex items-center justify-center">
                <Code2 className="w-4.5 h-4.5 text-[#0F5F35]" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#1a1a1a]">Votre code à copier</h2>
                <p className="text-xs text-[#71717a]">Une seule ligne — collez-la, c'est tout.</p>
              </div>
            </div>

            <div className="relative">
              <pre className="bg-[#1a1a1a] text-[#e5e5e5] text-[12px] rounded-xl p-4 pr-14 overflow-x-auto font-mono leading-relaxed">
                {snippet}
              </pre>
              <button
                type="button"
                onClick={handleCopy}
                className="absolute top-3 right-3 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/10 text-white text-xs font-medium hover:bg-white/20 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copié' : 'Copier'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              <div className="rounded-xl border border-gray-100 bg-[#FAF7F2] p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <ShoppingBag className="w-4 h-4 text-[#0F5F35]" />
                  <span className="text-sm font-semibold text-[#1a1a1a]">Sur Shopify</span>
                </div>
                {themeEditorUrl ? (
                  <>
                    <p className="text-[12px] text-[#71717a] leading-relaxed mb-2.5">
                      Ouvrez l'éditeur de thème, puis activez le bloc « Actero » dans <b>Modules d'application</b>. Aucun code à coller.
                    </p>
                    <a
                      href={themeEditorUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0F5F35] text-white text-[12px] font-semibold hover:bg-[#003725] transition-colors"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      Ouvrir l'éditeur de thème
                    </a>
                  </>
                ) : (
                  <p className="text-[12px] text-[#71717a] leading-relaxed">
                    Thème → <b>Modifier le code</b> → ouvrez <span className="font-mono">theme.liquid</span> → collez la ligne juste avant <span className="font-mono">{'</body>'}</span> → Enregistrer.
                  </p>
                )}
              </div>
              <div className="rounded-xl border border-gray-100 bg-[#FAF7F2] p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <Code2 className="w-4 h-4 text-[#0F5F35]" />
                  <span className="text-sm font-semibold text-[#1a1a1a]">Autre site</span>
                </div>
                <p className="text-[12px] text-[#71717a] leading-relaxed">
                  Collez la ligne juste avant la balise <span className="font-mono">{'</body>'}</span> de votre site. Compatible WooCommerce, Webflow, WordPress et tout site web.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Aperçu live ── */}
        <div className="lg:sticky lg:top-6 self-start">
          <div className="rounded-2xl border border-gray-200 bg-[#FAF7F2] p-6 h-[440px] relative overflow-hidden">
            <p className="text-xs font-semibold text-[#71717a] mb-2">Aperçu</p>
            {/* Mini chat panel preview */}
            <div
              className={`absolute bottom-20 ${isLeft ? 'left-6' : 'right-6'} w-64 rounded-2xl bg-white shadow-xl overflow-hidden`}
            >
              <div className="px-4 py-3 flex items-center gap-2" style={{ background: cfg.widget_brand_color }}>
                {cfg.widget_logo_url ? (
                  <img src={cfg.widget_logo_url} alt="" className="w-5 h-5 rounded object-cover" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-green-300" />
                )}
                <div className="text-white">
                  <div className="text-[12px] font-semibold leading-none">Support</div>
                  <div className="text-[9px] opacity-70">En ligne</div>
                </div>
              </div>
              <div className="p-3 space-y-2">
                <div className="text-[11px] bg-[#f5f5f0] text-[#262626] rounded-xl rounded-bl-sm px-3 py-2 max-w-[85%]">
                  {cfg.widget_greeting || 'Bonjour ! Comment puis-je vous aider ?'}
                </div>
                <div className="text-[11px] text-white rounded-xl rounded-br-sm px-3 py-2 max-w-[85%] ml-auto" style={{ background: cfg.widget_brand_color }}>
                  Où est ma commande&nbsp;?
                </div>
              </div>
              {cfg.widget_show_powered_by && (
                <div className="text-center py-1.5 text-[9px] text-[#999] border-t border-gray-100">
                  Propulsé par Actero
                </div>
              )}
            </div>
            {/* Bubble button */}
            <div
              className={`absolute bottom-6 ${isLeft ? 'left-6' : 'right-6'} w-14 h-14 rounded-full flex items-center justify-center shadow-lg`}
              style={{ background: cfg.widget_brand_color }}
            >
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
