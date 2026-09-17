import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { appelAdmin } from '../../../lib/admin-closers'
import { montant } from '../../../lib/affichage-closer'
import { Alerte, Chargement, ErreurChargement } from '../../closer/ui'
import { useToast } from '../../ui/Toast'
import { MontantCommission, NoteCommission, SignauxCommission } from './commun'
import { useActionEnCours } from './useActionEnCours'

/**
 * Révèle l'IBAN d'un closer à la demande ; chaque lecture est journalisée côté
 * serveur (un double clic n'en fait qu'une). L'IBAN révélé porte son propre
 * masque d'enregistrement, en plus de celui de la section (AdminClosersView) :
 * il reste masqué si ce bloc est affiché ailleurs.
 */
function IbanARevele({ closerId }) {
  const toast = useToast()
  const [iban, setIban] = useState(null)
  const { enCours, lancer } = useActionEnCours()
  const reveler = () => lancer(closerId, async () => {
    try {
      setIban(await appelAdmin('closer-iban', { query: { closer_id: closerId } }))
    } catch (err) {
      toast.error(err.message)
    }
  })
  if (iban) {
    return (
      <p className="amp-mask sentry-mask font-mono text-[14px] text-ink break-all" data-amp-mask="true" data-sentry-mask="true">
        {iban.iban} <span className="font-sans text-ink-3">· {iban.titulaire}</span>
      </p>
    )
  }
  return (
    <button type="button" onClick={reveler} disabled={enCours !== null} className="text-[13px] text-cta hover:underline disabled:opacity-50">
      {enCours !== null ? 'Lecture…' : 'Révéler l’IBAN (lecture journalisée)'}
    </button>
  )
}

const nomDuCloser = (closer) => (closer ? `${closer.prenom} ${closer.nom}` : 'Closer inconnu')

/**
 * À payer : les commissions validées, regroupées par closer. Un IBAN modifié
 * il y a moins de 72 h est une alerte avant virement (compte volé, virement
 * détourné) : elle s'affiche en tête du closer et dans la confirmation.
 */
export function CommissionsAPayer() {
  const toast = useToast()
  const client = useQueryClient()
  const { enCours, lancer } = useActionEnCours()
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-closer-commissions', 'validee'],
    queryFn: () => appelAdmin('closer-commissions', { query: { statut: 'validee' } }),
  })

  const payer = (c, closer) => {
    const alerte = c.signaux?.includes('iban_recent')
      ? 'ATTENTION : l’IBAN de ce closer a été modifié il y a moins de 72 h. Vérifiez-le auprès du closer par un autre canal avant tout virement.\n\n'
      : ''
    return lancer(c.id, async () => {
      try {
        await appelAdmin('closer-commissions', { methode: 'PATCH', corps: { id: c.id, action: 'marquer_payee' } })
        await Promise.all([
          client.invalidateQueries({ queryKey: ['admin-closer-commissions'] }),
          client.invalidateQueries({ queryKey: ['admin-closers'] }),
        ])
      } catch (err) {
        toast.error(err.message)
      }
    }, {
      confirmation: `${alerte}Confirmez-vous avoir viré ${montant(c.montant_centimes)} à ${nomDuCloser(closer)} pour ${c.boutique} ?\nLa commission passera en « Payée ».`,
    })
  }

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
      {data?.tronque && (
        <Alerte ton="info">Plus de 500 commissions à payer : seules les 500 plus récentes sont affichées. Payez-les, puis rechargez.</Alerte>
      )}
      {[...parCloser.entries()].map(([id, groupe]) => {
        const total = groupe.commissions.reduce((s, c) => s + c.montant_centimes, 0)
        const ibanRecent = groupe.commissions.some((c) => c.signaux?.includes('iban_recent'))
        return (
          <section key={id} className="border border-border-cream rounded-2xl p-5 space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-[18px] font-normal">{nomDuCloser(groupe.closer)}</h2>
              <span className="font-mono text-[18px] text-ink">{montant(total)}</span>
            </div>
            {ibanRecent && (
              <Alerte>
                <strong className="font-medium">Alerte avant virement :</strong> l’IBAN de ce closer a été modifié il y a moins de 72 h.
                Vérifiez-le auprès du closer par un autre canal (téléphone) avant de faire le virement.
              </Alerte>
            )}
            {groupe.closer?.profil_complet
              ? <IbanARevele closerId={id} />
              : <p className="text-[13px] text-ink-3">Profil de paiement incomplet : impossible de payer pour l’instant.</p>}
            <ul className="divide-y divide-border-cream">
              {groupe.commissions.map((c) => (
                <li key={c.id} className="py-3 flex flex-wrap items-start justify-between gap-3 text-[14px]">
                  <div className="min-w-0 space-y-1.5">
                    <div className="text-ink-2">{c.boutique}</div>
                    <NoteCommission note={c.note} />
                    <SignauxCommission signaux={c.signaux} avantVirement />
                  </div>
                  <div className="flex items-start gap-3">
                    <MontantCommission commission={c} />
                    <button
                      type="button"
                      disabled={enCours !== null || !groupe.closer?.profil_complet}
                      onClick={() => payer(c, groupe.closer)}
                      className="h-8 px-3 rounded-full bg-cta hover:bg-cta-hover text-white text-[13px] whitespace-nowrap disabled:opacity-50"
                    >
                      {enCours === c.id ? 'Enregistrement…' : 'Marquer payée'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
