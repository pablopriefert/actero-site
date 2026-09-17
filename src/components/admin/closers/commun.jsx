import React from 'react'
import { AlertTriangle } from 'lucide-react'
import { LIBELLES_SIGNAUX } from '../../../../api/lib/signaux-closer.js'
import { montant } from '../../../lib/affichage-closer'
import { lignesDeNote } from '../../../lib/admin-closers'

/**
 * Les briques communes aux files « À valider », « À payer » et « Historique » :
 * le montant, la note complète et les signaux d'une commission.
 */

/** Le montant de la commission et, quand il est connu, ce que le client a payé. */
export function MontantCommission({ commission }) {
  const paye = commission.montant_facture_centimes
  const connu = Number.isInteger(paye)
  // La commission dépasse le paiement (code promo, remise) : à vérifier.
  const aVerifier = connu && paye < commission.montant_centimes
  return (
    <div className="whitespace-nowrap">
      <div className="font-mono text-ink">{montant(commission.montant_centimes)}</div>
      {connu && (
        <div className={`text-[12px] ${aVerifier ? 'text-red-700' : 'text-ink-3'}`}>
          Payé par le client : <span className="font-mono">{montant(paye)}</span>
        </div>
      )}
    </div>
  )
}

/** La note complète : une ligne par événement (saisie, refus, remboursement). */
export function NoteCommission({ note }) {
  const lignes = lignesDeNote(note)
  if (lignes.length === 0) return null
  return (
    <ul className="space-y-0.5 text-[12px] text-ink-3">
      {lignes.map((ligne, i) => <li key={`${i}-${ligne}`}>{ligne}</li>)}
    </ul>
  )
}

/**
 * Les signaux d'une commission (api/lib/signaux-closer.js) : où regarder avant
 * de valider ou de payer. `avantVirement` fait ressortir un IBAN récent.
 */
export function SignauxCommission({ signaux, avantVirement = false }) {
  if (!signaux?.length) return null
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Signaux à vérifier">
      {signaux.map((s) => {
        const fort = avantVirement && s === 'iban_recent'
        return (
          <li
            key={s}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] ${fort ? 'border border-red-200 bg-red-50 font-medium text-red-700' : 'bg-warn-bg text-ink'}`}
          >
            <AlertTriangle className="w-3 h-3 shrink-0" aria-hidden="true" />
            {LIBELLES_SIGNAUX[s] ?? s}
          </li>
        )
      })}
    </ul>
  )
}
