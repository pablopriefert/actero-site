import React from 'react'
import { PERIODES_AFFICHEES } from '../../lib/affichage-formules'

/**
 * Mensuel / Trimestriel / Annuel. Un seul sélecteur pour la page tarifs, la
 * page de choix du plan et la facturation : trois copies finiraient par
 * annoncer trois offres différentes. `offreBienvenue` à false masque le badge
 * du −50 %, qui ne vaut qu'une fois par client.
 */
export function SelecteurFormule({ periode, onChange, taille = 'normale', offreBienvenue = true }) {
  const petit = taille === 'petite'
  return (
    <div role="group" aria-label="Formule de paiement" className="inline-flex flex-wrap items-center justify-center gap-1 p-1 rounded-full bg-surface border border-border-cream">
      {PERIODES_AFFICHEES.map((p) => {
        const actif = periode === p.id
        const badge = p.bienvenue && !offreBienvenue ? null : p.badge
        return (
          <button
            key={p.id}
            type="button"
            aria-pressed={actif}
            onClick={() => onChange(p.id)}
            className={`${petit ? 'px-3 py-1.5 text-[11px]' : 'px-4 py-2 text-[13px]'} rounded-full font-semibold transition-colors flex items-center gap-1.5 ${actif ? 'bg-cta text-white' : 'text-ink-3 hover:text-ink'}`}
          >
            {p.libelle}
            {badge && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${actif ? 'bg-white/20 text-white' : 'bg-primary-tint text-primary'}`}>
                {badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
