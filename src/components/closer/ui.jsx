import React, { useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Logo } from '../layout/Logo'
import { DUREE_ATTRIBUTION_JOURS } from '../../lib/code-closer'

/**
 * Les briques de l'espace closer, dans le système visuel d'Actero : Inter
 * Tight, fond blanc, bouton vert (`bg-cta`), titres en graisse 400, montants
 * en DM Mono (`font-mono`).
 */

/** Le cadre des pages d'accès : logo, titre, carte blanche. */
export function CadreCloser({ titre, sousTitre, children }) {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 py-12 font-sans text-ink">
      <div className="w-full max-w-[420px]">
        <div className="flex flex-col items-center text-center mb-8">
          <Logo className="w-9 h-9 text-ink" />
          <h1 className="mt-6 text-[28px] leading-tight font-normal text-ink">{titre}</h1>
          {sousTitre && <p className="mt-2 text-[15px] text-ink-3">{sousTitre}</p>}
        </div>
        <div className="border border-border-cream rounded-2xl p-6 bg-white">{children}</div>
      </div>
    </div>
  )
}

export function Champ({ libelle, ...props }) {
  return (
    <label className="block">
      <span className="block text-[13px] text-ink-2 mb-1.5">{libelle}</span>
      <input
        {...props}
        className="w-full h-11 px-3.5 rounded-xl border border-border-cream bg-white text-[15px] text-ink placeholder:text-ink-4 focus:outline-none focus:border-cta"
      />
    </label>
  )
}

export function BoutonPrincipal({ children, ...props }) {
  return (
    <button
      {...props}
      className="w-full h-11 rounded-full bg-cta hover:bg-cta-hover text-white text-[15px] font-medium transition-colors disabled:opacity-50"
    >
      {children}
    </button>
  )
}

export function Alerte({ ton = 'erreur', children }) {
  const couleurs = ton === 'erreur'
    ? 'bg-red-50 border-red-100 text-red-700'
    : 'bg-primary-tint border-primary-soft text-primary-deep'
  return (
    <div role={ton === 'erreur' ? 'alert' : 'status'} className={`p-3 rounded-xl border text-[13px] ${couleurs}`}>
      {children}
    </div>
  )
}

export function BoutonGoogle({ onClick, libelle }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full h-11 flex items-center justify-center gap-3 rounded-full border border-border-cream bg-white hover:bg-cream transition-colors text-[15px] text-ink"
    >
      <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
      </svg>
      {libelle}
    </button>
  )
}

/**
 * Ce que le lien rattache, exactement. Le lien pose un cookie : il ne vaut
 * que dans le navigateur où il a été ouvert, et pendant la durée
 * d'attribution. Au-delà, seul Actero peut rattacher une boutique, à la main.
 */
export function RegleRattachement({ debut, className }) {
  return (
    <p className={className}>
      {debut} par votre lien, depuis le même navigateur et dans les {DUREE_ATTRIBUTION_JOURS} jours. Sinon, écrivez à{' '}
      <a href="mailto:contact@actero.fr" className="text-cta hover:underline">contact@actero.fr</a> : Actero peut la
      rattacher à la main.
    </p>
  )
}

/**
 * Un lien à copier d'un clic. Si le presse-papiers est refusé (ou absent hors
 * HTTPS), le texte est sélectionné et la page dit de le copier à la main ;
 * « Lien copié » est annoncé aux lecteurs d'écran.
 */
export function LienACopier({ lien }) {
  const [etat, setEtat] = useState(null)
  const champ = useRef(null)
  const copier = async () => {
    try {
      await navigator.clipboard.writeText(lien)
      setEtat('copie')
      setTimeout(() => setEtat((e) => (e === 'copie' ? null : e)), 2000)
    } catch {
      setEtat('refuse')
      champ.current?.focus()
      champ.current?.select()
    }
  }
  const copie = etat === 'copie'
  return (
    <div>
      <div className="flex gap-2">
        <input
          ref={champ}
          readOnly
          value={lien}
          onFocus={(e) => e.target.select()}
          aria-label="Lien d’abonnement"
          className="flex-1 min-w-0 h-11 px-3.5 rounded-xl border border-border-cream bg-white font-mono text-[14px] text-ink"
        />
        <button
          type="button"
          onClick={copier}
          className="h-11 px-4 rounded-full bg-cta hover:bg-cta-hover text-white text-[14px] inline-flex items-center gap-1.5 shrink-0"
        >
          {copie ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
          {copie ? 'Copié' : 'Copier'}
        </button>
      </div>
      <p aria-live="polite" className={etat === 'refuse' ? 'mt-2 text-[13px] text-ink-2' : 'sr-only'}>
        {copie && 'Lien copié.'}
        {etat === 'refuse' && 'Copiez le lien à la main : il est sélectionné.'}
      </p>
    </div>
  )
}

export function Tableau({ entetes, children }) {
  return (
    <div className="overflow-x-auto border border-border-cream rounded-2xl">
      <table className="w-full text-left text-[14px]">
        <thead>
          <tr>
            {entetes.map((e) => (
              <th key={e} scope="col" className="px-4 py-3 text-[12px] font-medium text-ink-3 whitespace-nowrap">{e}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export function Chargement() {
  return <p className="text-[14px] text-ink-3">Chargement…</p>
}

/** Un nouvel essai peut aboutir : panne, surcharge, réponse illisible, coupure réseau. */
function passager(erreur) {
  const statut = erreur?.status
  return !statut || statut >= 500 || statut === 408 || statut === 429
}

/**
 * Une lecture ratée. Session expirée (401) : un lien vers la connexion
 * closer. Panne passagère : « Réessayer », si la vue sait recharger.
 */
export function ErreurChargement({ erreur, onReessayer }) {
  const sessionExpiree = erreur?.status === 401
  return (
    <div role="alert" className="space-y-3">
      <p className="text-[14px] text-red-700">
        {sessionExpiree ? 'Votre session a expiré. Reconnectez-vous pour continuer.' : erreur?.message || 'Chargement impossible.'}
      </p>
      {sessionExpiree ? (
        <a href="/closer/connexion" className="inline-flex items-center h-9 px-4 rounded-full bg-cta hover:bg-cta-hover text-white text-[14px]">
          Se reconnecter
        </a>
      ) : (
        onReessayer && passager(erreur) && (
          <button
            type="button"
            onClick={() => onReessayer()}
            className="h-9 px-4 rounded-full border border-border-cream bg-white hover:bg-cream text-[14px] text-ink"
          >
            Réessayer
          </button>
        )
      )}
    </div>
  )
}
