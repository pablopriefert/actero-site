import React, { useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { alerteRemboursement, appelAdmin, STATUTS_HISTORIQUE } from '../../../lib/admin-closers'
import { dateCourte, LIBELLES_FORMULE, LIBELLES_PLAN, LIBELLES_STATUT_COMMISSION, LIBELLES_TYPE, montant } from '../../../lib/affichage-closer'
import { Alerte, Chargement, ErreurChargement, Tableau } from '../../closer/ui'
import { MontantCommission, NoteCommission } from './commun'

const FILTRES = [
  { id: 'tous', libelle: 'Tout' },
  { id: 'payee', libelle: 'Payées' },
  { id: 'refusee', libelle: 'Refusées' },
  { id: 'annulee', libelle: 'Annulées' },
]

/** La date qui situe une commission dans l'historique : son paiement, sinon sa création. */
function repere(c) {
  return c.statut === 'payee' && c.payee_at
    ? { libelle: 'Payée le', date: c.payee_at }
    : { libelle: 'Créée le', date: c.created_at }
}

const horodatage = (c) => Date.parse(repere(c).date) || 0

/**
 * Historique : les commissions sorties de la file — payées, refusées,
 * annulées —, les plus récentes d'abord, avec leur note complète. Une
 * commission payée dont la facture a été remboursée ensuite est signalée :
 * rien n'est repris automatiquement, la décision revient à Actero.
 */
export function Historique() {
  const [filtre, setFiltre] = useState('tous')
  const reponses = useQueries({
    queries: STATUTS_HISTORIQUE.map((statut) => ({
      queryKey: ['admin-closer-commissions', statut],
      queryFn: () => appelAdmin('closer-commissions', { query: { statut } }),
    })),
  })

  if (reponses.some((r) => r.isLoading)) return <Chargement />
  const enErreur = reponses.find((r) => r.error)
  if (enErreur) return <ErreurChargement erreur={enErreur.error} />

  const tronques = STATUTS_HISTORIQUE.filter((_, i) => reponses[i].data?.tronque)
  const toutes = reponses.flatMap((r) => r.data?.commissions ?? [])
  const nombre = (id) => (id === 'tous' ? toutes.length : toutes.filter((c) => c.statut === id).length)
  const visibles = (filtre === 'tous' ? toutes : toutes.filter((c) => c.statut === filtre))
    .sort((a, b) => horodatage(b) - horodatage(a))
  const total = visibles.reduce((s, c) => s + (Number.isInteger(c.montant_centimes) ? c.montant_centimes : 0), 0)

  return (
    <div className="space-y-4">
      {tronques.map((statut) => (
        <Alerte key={statut} ton="info">
          Plus de 500 commissions « {LIBELLES_STATUT_COMMISSION[statut]} » : seules les 500 plus récentes sont affichées et comptées.
        </Alerte>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Filtrer l’historique" className="flex flex-wrap gap-2">
          {FILTRES.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFiltre(f.id)}
              aria-pressed={filtre === f.id}
              className={`h-8 px-3 rounded-full border text-[13px] ${filtre === f.id ? 'border-cta bg-primary-tint text-ink' : 'border-border-cream text-ink-3 hover:text-ink'}`}
            >
              {f.libelle} <span className="font-mono">{nombre(f.id)}</span>
            </button>
          ))}
        </div>
        <p className="text-[14px] text-ink-3">
          Total : <span className="font-mono text-ink">{montant(total)}</span>
        </p>
      </div>
      {visibles.length === 0
        ? <p className="text-[14px] text-ink-3">Aucune commission dans l’historique.</p>
        : (
          <Tableau entetes={['Date', 'Statut', 'Client', 'Closer', 'Offre', 'Montant', 'Note']}>
            {visibles.map((c) => {
              const { libelle, date } = repere(c)
              const remboursement = alerteRemboursement(c)
              return (
                <tr key={c.id} className="border-t border-border-cream align-top">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-[12px] text-ink-3">{libelle}</div>
                    <div className="text-ink-2">{dateCourte(date)}</div>
                  </td>
                  <td className="px-4 py-3 space-y-1.5">
                    <div className="text-ink">{LIBELLES_STATUT_COMMISSION[c.statut] ?? c.statut}</div>
                    {remboursement && (
                      <div className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[12px] font-medium text-red-700 whitespace-nowrap">
                        <AlertTriangle className="w-3 h-3 shrink-0" aria-hidden="true" />
                        {remboursement}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-ink">{c.boutique}</div>
                    <div className="text-[12px] text-ink-3">{c.source === 'stripe' ? 'Stripe' : 'Saisie manuelle'}</div>
                  </td>
                  <td className="px-4 py-3 text-ink-2">{c.closer ? `${c.closer.prenom} ${c.closer.nom}` : '—'}</td>
                  <td className="px-4 py-3 text-ink-2">{LIBELLES_PLAN[c.plan]} · {LIBELLES_FORMULE[c.formule]} · {LIBELLES_TYPE[c.type]}</td>
                  <td className="px-4 py-3"><MontantCommission commission={c} /></td>
                  <td className="px-4 py-3 min-w-[16rem]">
                    {c.note ? <NoteCommission note={c.note} /> : <span className="text-ink-3">—</span>}
                  </td>
                </tr>
              )
            })}
          </Tableau>
        )}
    </div>
  )
}
