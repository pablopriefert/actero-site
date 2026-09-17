import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { appelAdmin } from '../../../lib/admin-closers'
import { montant } from '../../../lib/affichage-closer'
import { Chargement, ErreurChargement } from '../../closer/ui'
import { useToast } from '../../ui/Toast'

/** Révèle l'IBAN d'un closer à la demande ; chaque lecture est journalisée côté serveur. */
function IbanARevele({ closerId }) {
  const toast = useToast()
  const [iban, setIban] = useState(null)
  const [enCours, setEnCours] = useState(false)
  const reveler = async () => {
    setEnCours(true)
    try {
      setIban(await appelAdmin('closer-iban', { query: { closer_id: closerId } }))
    } catch (err) {
      toast.error(err.message)
    } finally {
      setEnCours(false)
    }
  }
  if (iban) {
    return (
      <p className="font-mono text-[14px] text-ink break-all">
        {iban.iban} <span className="font-sans text-ink-3">· {iban.titulaire}</span>
      </p>
    )
  }
  return (
    <button type="button" onClick={reveler} disabled={enCours} className="text-[13px] text-cta hover:underline disabled:opacity-50">
      {enCours ? 'Lecture…' : 'Révéler l’IBAN (lecture journalisée)'}
    </button>
  )
}

/** À payer : les commissions validées, regroupées par closer. */
export function CommissionsAPayer() {
  const toast = useToast()
  const client = useQueryClient()
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-closer-commissions', 'validee'],
    queryFn: () => appelAdmin('closer-commissions', { query: { statut: 'validee' } }),
  })
  const payer = useMutation({
    mutationFn: (id) => appelAdmin('closer-commissions', { methode: 'PATCH', corps: { id, action: 'marquer_payee' } }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['admin-closer-commissions'] })
      client.invalidateQueries({ queryKey: ['admin-closers'] })
    },
    onError: (err) => toast.error(err.message),
  })

  if (isLoading) return <Chargement />
  if (error) return <ErreurChargement erreur={error} />
  const commissions = data?.commissions ?? []
  if (commissions.length === 0) return <p className="text-[14px] text-ink-3">Rien à payer.</p>

  const parCloser = new Map()
  for (const c of commissions) {
    const cle = c.closer?.id ?? c.closer_id
    if (!parCloser.has(cle)) parCloser.set(cle, { closer: c.closer, commissions: [] })
    parCloser.get(cle).commissions.push(c)
  }

  return (
    <div className="space-y-4">
      {[...parCloser.entries()].map(([id, groupe]) => {
        const total = groupe.commissions.reduce((s, c) => s + c.montant_centimes, 0)
        return (
          <section key={id} className="border border-border-cream rounded-2xl p-5 space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-[18px] font-normal">{groupe.closer ? `${groupe.closer.prenom} ${groupe.closer.nom}` : 'Closer inconnu'}</h2>
              <span className="font-mono text-[18px] text-ink">{montant(total)}</span>
            </div>
            {groupe.closer?.profil_complet
              ? <IbanARevele closerId={id} />
              : <p className="text-[13px] text-ink-3">Profil de paiement incomplet : impossible de payer pour l’instant.</p>}
            <ul className="divide-y divide-border-cream">
              {groupe.commissions.map((c) => (
                <li key={c.id} className="py-2 flex flex-wrap items-center justify-between gap-2 text-[14px]">
                  <span className="text-ink-2">{c.boutique}</span>
                  <span className="flex items-center gap-3">
                    <span className="font-mono text-ink">{montant(c.montant_centimes)}</span>
                    <button
                      type="button"
                      disabled={payer.isPending || !groupe.closer?.profil_complet}
                      onClick={() => payer.mutate(c.id)}
                      className="h-8 px-3 rounded-full bg-cta hover:bg-cta-hover text-white text-[13px] disabled:opacity-50"
                    >
                      Marquer payée
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
