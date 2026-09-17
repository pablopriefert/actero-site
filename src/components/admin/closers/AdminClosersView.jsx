import React, { useState } from 'react'
import { ListeClosers } from './ListeClosers'
import { FileCommissions } from './FileCommissions'
import { CommissionsAPayer } from './CommissionsAPayer'
import { SaisieManuelle } from './SaisieManuelle'
import { Attributions } from './Attributions'

const ONGLETS = [
  { id: 'closers', libelle: 'Closers' },
  { id: 'a-valider', libelle: 'À valider' },
  { id: 'a-payer', libelle: 'À payer' },
  { id: 'saisie', libelle: 'Saisie manuelle' },
  { id: 'attributions', libelle: 'Attributions' },
]

/**
 * Section « Closers » de l'admin — premier écran du chantier C, dans le style
 * actuel (spec 2026-09-14-closers-espace-commissions-design.md).
 *
 * Toute la section est masquée dans les enregistrements de session : elle
 * affiche des e-mails, des téléphones, des SIRET et l'IBAN révélé.
 *   Amplitude : `amp-mask` (rejeu, texte des descendants compris) et
 *               `data-amp-mask` (texte des clics capturés, descendants compris) ;
 *   Sentry :    `sentry-mask`, masqué par défaut même avec `maskAllText: false`,
 *               descendants compris (options par défaut de replayIntegration).
 * Seul le texte est masqué, pas les attributs : aucune donnée personnelle dans
 * un `title` ou un `aria-label`. Une fenêtre en portail sortirait du masque.
 */
export function AdminClosersView() {
  const [onglet, setOnglet] = useState('closers')
  return (
    <div className="amp-mask sentry-mask space-y-6 font-sans text-ink" data-amp-mask="true" data-sentry-mask="true">
      <header>
        <h1 className="text-[28px] font-normal">Closers</h1>
        <p className="mt-1 text-[14px] text-ink-3">Valider chaque commission, faire le virement, puis la marquer payée.</p>
      </header>
      <nav aria-label="Section closers" className="flex gap-6 border-b border-border-cream overflow-x-auto">
        {ONGLETS.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => setOnglet(o.id)}
            aria-current={onglet === o.id ? 'page' : undefined}
            className={`h-10 text-[14px] border-b-2 whitespace-nowrap ${onglet === o.id ? 'border-cta text-ink' : 'border-transparent text-ink-3 hover:text-ink'}`}
          >
            {o.libelle}
          </button>
        ))}
      </nav>
      {onglet === 'closers' && <ListeClosers />}
      {onglet === 'a-valider' && <FileCommissions />}
      {onglet === 'a-payer' && <CommissionsAPayer />}
      {onglet === 'saisie' && <SaisieManuelle />}
      {onglet === 'attributions' && <Attributions />}
    </div>
  )
}
