import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { appelAdmin, rejouerFacturesStripe, resumeRejeu } from '../../../lib/admin-closers'
import { dateCourte, LIBELLES_PLAN } from '../../../lib/affichage-closer'
import { Alerte, Chargement, Champ, ErreurChargement, Tableau } from '../../closer/ui'
import { useToast } from '../../ui/Toast'
import { useActionEnCours } from './useActionEnCours'

const nomDuCloser = (k) => (k ? `${k.prenom} ${k.nom} (${k.code})` : 'ce closer')

/** Le résultat du rejeu des factures Stripe d'un client, ou son erreur. */
export function ResultatRejeu({ rejeu }) {
  if (rejeu.erreur) return <Alerte>{rejeu.erreur}</Alerte>
  const r = resumeRejeu(rejeu.resultats)
  if (r.factures === 0) {
    return <Alerte ton="info">Aucune facture payée chez Stripe pour ce client : rien à rejouer.</Alerte>
  }
  return (
    <Alerte ton="info">
      <p>
        {r.factures} {r.factures > 1 ? 'factures payées relues' : 'facture payée relue'} chez Stripe.
        {' '}Commissions créées : <span className="font-mono">{r.creees}</span>
        {' '}· déjà créées : <span className="font-mono">{r.dejaCreees}</span>
      </p>
      {r.autres.length > 0 && (
        <ul className="mt-1 list-disc pl-5">
          {r.autres.map((a) => (
            <li key={a.issue}>
              {a.libelle} : <span className="font-mono">{a.nombre}</span>{a.conseil ? ` — ${a.conseil}` : ''}
            </li>
          ))}
        </ul>
      )}
    </Alerte>
  )
}

/**
 * Attributions : chercher un client, rattacher, changer ou retirer son closer,
 * et rejouer ses factures Stripe.
 * Décision d'Actero : les règles du lien ne s'appliquent pas ; les commissions
 * déjà créées ne bougent pas. Le rejeu crée celles d'une facture payée avant le
 * rattachement, ou dont l'événement Stripe s'est perdu, sans doublon.
 */
export function Attributions() {
  const toast = useToast()
  const client = useQueryClient()
  const { enCours, lancer } = useActionEnCours()
  const [saisie, setSaisie] = useState('')
  const [recherche, setRecherche] = useState('')
  const [rejeux, setRejeux] = useState({})
  const { data, isFetching, error } = useQuery({
    queryKey: ['admin-closer-attribution', recherche],
    queryFn: () => appelAdmin('closer-attribution', { query: { q: recherche } }),
  })

  const closers = data?.closers ?? []
  const clients = data?.clients ?? []

  const changer = (c, closerId) => {
    const avant = closers.find((k) => k.id === c.closer_id)
    const apres = closers.find((k) => k.id === closerId)
    let question
    if (!closerId) question = `Retirer ${nomDuCloser(avant)} de ${c.boutique} ?\nLes commissions déjà créées ne bougent pas ; ce client n’en créera plus.`
    else if (c.closer_id) question = `Changer le closer de ${c.boutique} : ${nomDuCloser(avant)} → ${nomDuCloser(apres)} ?\nLes commissions déjà créées ne bougent pas ; les suivantes iront au nouveau closer.`
    else question = `Rattacher ${c.boutique} à ${nomDuCloser(apres)} ?\nLes commissions suivantes iront à ce closer.`
    return lancer(`attribution:${c.id}`, async () => {
      try {
        await appelAdmin('closer-attribution', { methode: 'PATCH', corps: { client_id: c.id, closer_id: closerId || null } })
        toast.success(closerId ? 'Closer rattaché.' : 'Closer retiré.')
        await Promise.all([
          client.invalidateQueries({ queryKey: ['admin-closer-attribution'] }),
          client.invalidateQueries({ queryKey: ['admin-closers'] }),
        ])
      } catch (err) {
        toast.error(err.message)
      }
    }, { confirmation: question })
  }

  const rejouer = (c) => lancer(`rejeu:${c.id}`, async () => {
    try {
      const { resultats } = await rejouerFacturesStripe(c.id)
      setRejeux((avant) => ({ ...avant, [c.id]: { resultats } }))
      await Promise.all([
        client.invalidateQueries({ queryKey: ['admin-closer-commissions'] }),
        client.invalidateQueries({ queryKey: ['admin-closers'] }),
      ])
    } catch (err) {
      setRejeux((avant) => ({ ...avant, [c.id]: { erreur: err.message } }))
    }
  }, {
    confirmation: `Relire chez Stripe les factures payées de ${c.boutique} et créer les commissions manquantes ?\nAucune commission n’est créée deux fois. Cela peut prendre jusqu’à une minute.`,
  })

  return (
    <div className="space-y-4">
      <form onSubmit={(e) => { e.preventDefault(); setRecherche(saisie.trim()) }} className="flex gap-2 items-end max-w-xl">
        <div className="flex-1">
          <Champ libelle="Boutique ou e-mail de contact" value={saisie} onChange={(e) => setSaisie(e.target.value)} />
        </div>
        <button type="submit" className="h-11 px-4 rounded-full bg-cta hover:bg-cta-hover text-white text-[14px]">Chercher</button>
      </form>
      {error && <ErreurChargement erreur={error} />}
      {isFetching && <Chargement />}
      {!isFetching && recherche.length >= 2 && clients.length === 0 && <p className="text-[14px] text-ink-3">Aucun client trouvé.</p>}
      {clients.length > 0 && (
        <Tableau entetes={['Client', 'Plan', 'Closer', 'Depuis', '']}>
          {clients.map((c) => (
            <React.Fragment key={c.id}>
              <tr className="border-t border-border-cream align-top">
                <td className="px-4 py-3">
                  <div className="text-ink">{c.boutique}</div>
                  <div className="text-[12px] text-ink-3">{c.contact_email}</div>
                </td>
                <td className="px-4 py-3 text-ink-2">{LIBELLES_PLAN[c.plan] ?? c.plan}</td>
                <td className="px-4 py-3">
                  <select
                    value={c.closer_id ?? ''}
                    onChange={(e) => changer(c, e.target.value)}
                    disabled={enCours !== null}
                    aria-label={`Closer de ${c.boutique}`}
                    className="h-9 px-2 rounded-xl border border-border-cream bg-white text-[14px] disabled:opacity-50"
                  >
                    <option value="">Aucun</option>
                    {closers.map((k) => (
                      <option key={k.id} value={k.id}>{nomDuCloser(k)}{k.statut === 'suspendu' ? ' — suspendu' : ''}</option>
                    ))}
                  </select>
                  {enCours === `attribution:${c.id}` && <p className="mt-1 text-[12px] text-ink-3">Enregistrement…</p>}
                </td>
                <td className="px-4 py-3 text-ink-2 whitespace-nowrap">
                  {dateCourte(c.rattache_le)}{c.source ? ` · ${c.source === 'lien' ? 'lien' : 'manuel'}` : ''}
                </td>
                <td className="px-4 py-3">
                  {c.closer_id && (
                    <div className="flex flex-wrap items-center justify-end gap-3">
                      <button
                        type="button"
                        disabled={enCours !== null}
                        onClick={() => rejouer(c)}
                        className="h-8 px-3 rounded-full border border-border-cream text-[13px] text-ink whitespace-nowrap hover:border-ink-4 disabled:opacity-50"
                      >
                        {enCours === `rejeu:${c.id}` ? 'Relecture des factures…' : 'Rejouer les factures Stripe'}
                      </button>
                      <button
                        type="button"
                        disabled={enCours !== null}
                        onClick={() => changer(c, null)}
                        className="text-[13px] text-ink-3 hover:text-ink disabled:opacity-50"
                      >
                        Retirer
                      </button>
                    </div>
                  )}
                </td>
              </tr>
              {rejeux[c.id] && (
                <tr>
                  <td colSpan={5} className="px-4 pb-4">
                    <ResultatRejeu rejeu={rejeux[c.id]} />
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </Tableau>
      )}
    </div>
  )
}
