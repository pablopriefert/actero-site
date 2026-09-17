import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { appelAdmin, centimesSaisis, eurosDeLaGrille, LIBELLES_CANAL, moisLisible } from '../../../lib/admin-closers'
import { LIBELLES_FORMULE, LIBELLES_PLAN, montant } from '../../../lib/affichage-closer'
import { Alerte, BoutonPrincipal, Chargement, Champ, ErreurChargement } from '../../closer/ui'
import { useActionEnCours } from './useActionEnCours'

const FORMULES = ['mensuel', 'trimestriel', 'annuel']

/**
 * Le formulaire d'une saisie, pour un client choisi (monté avec une `key` par
 * client). Le montant suit la grille du plan et de la formule choisis tant que
 * l'admin ne l'a pas modifié à la main.
 */
export function FormulaireSaisie({ client, mois, onFait }) {
  const [formule, setFormule] = useState(client.formule ?? 'mensuel')
  const [moisSaisi, setMoisSaisi] = useState(mois)
  // null tant que l'admin n'a pas touché au montant : il suit alors la grille.
  const [eurosManuels, setEurosManuels] = useState(null)
  const [note, setNote] = useState('')
  const [erreur, setErreur] = useState(null)
  const [reussite, setReussite] = useState(null)
  const { enCours, lancer } = useActionEnCours()

  const grille = eurosDeLaGrille(client.plan, formule)
  const euros = eurosManuels ?? grille
  const unique = formule !== 'mensuel'
  const plan = LIBELLES_PLAN[client.plan] ?? client.plan

  const enregistrer = (e) => {
    e.preventDefault()
    setErreur(null)
    setReussite(null)
    const centimes = centimesSaisis(euros)
    if (centimes === null) {
      setErreur('Montant invalide : un nombre d’euros positif, par exemple 100 ou 12,50.')
      return
    }
    const quoi = unique
      ? `Commission unique de ${montant(centimes)} (${LIBELLES_FORMULE[formule]})`
      : `Mensualité de ${moisLisible(moisSaisi)} (${montant(centimes)})`
    lancer(client.id, async () => {
      try {
        await appelAdmin('closer-commissions', {
          methode: 'POST',
          corps: {
            client_id: client.id,
            formule,
            montant_centimes: centimes,
            mois: unique ? undefined : moisSaisi,
            note,
          },
        })
        setReussite(`${quoi} enregistrée pour ${client.boutique}. Elle attend votre validation dans « À valider ».`)
        setNote('')
        await onFait()
      } catch (err) {
        setErreur(err.message)
      }
    }, {
      confirmation: unique
        ? `Enregistrer une commission unique de ${montant(centimes)} pour ${client.boutique} ?\nUn client ne donne droit qu’à une seule commission unique : elle ne pourra pas être saisie une seconde fois.`
        : undefined,
    })
  }

  return (
    <form onSubmit={enregistrer} className="border border-border-cream rounded-2xl p-5 space-y-4 max-w-xl">
      <div>
        <h2 className="text-[18px] font-normal">{client.boutique}</h2>
        <p className="text-[13px] text-ink-3">{plan} · {LIBELLES_CANAL[client.facturation] ?? client.facturation}</p>
      </div>
      <label className="block">
        <span className="block text-[13px] text-ink-2 mb-1.5">Formule</span>
        <select value={formule} onChange={(e) => setFormule(e.target.value)} className="w-full h-11 px-3 rounded-xl border border-border-cream bg-white text-[15px]">
          {FORMULES.map((f) => <option key={f} value={f}>{LIBELLES_FORMULE[f]}</option>)}
        </select>
      </label>
      {!unique && (
        <div className="space-y-1">
          <Champ libelle="Mois concerné" type="month" value={moisSaisi} onChange={(e) => setMoisSaisi(e.target.value)} required />
          <p className="text-[12px] text-ink-3">{moisLisible(moisSaisi)}</p>
        </div>
      )}
      <div className="space-y-1">
        <Champ libelle="Montant (€)" inputMode="decimal" value={euros} onChange={(e) => setEurosManuels(e.target.value)} required />
        <p className="text-[12px] text-ink-3">
          {grille ? `Grille ${plan} ${LIBELLES_FORMULE[formule].toLowerCase()} : ${grille} €.` : `Hors grille (${plan}) : saisissez le montant convenu.`}
          {eurosManuels !== null && grille && eurosManuels !== grille && (
            <>
              {' '}
              <button type="button" onClick={() => setEurosManuels(null)} className="text-cta hover:underline">Reprendre la grille</button>
            </>
          )}
        </p>
      </div>
      <Champ libelle="Note (obligatoire)" value={note} onChange={(e) => setNote(e.target.value)} required minLength={3} />
      {unique && (
        <p className="text-[13px] text-ink-2">Commission unique : un client n’y a droit qu’une fois. Une confirmation vous sera demandée.</p>
      )}
      {erreur && <Alerte>{erreur}</Alerte>}
      {reussite && <Alerte ton="succes">{reussite}</Alerte>}
      <BoutonPrincipal type="submit" disabled={enCours !== null}>{enCours !== null ? 'Enregistrement…' : 'Saisir la commission'}</BoutonPrincipal>
    </form>
  )
}

/**
 * Saisie manuelle : clients Shopify, Enterprise ou corrections. Les clients
 * Shopify dont la mensualité du mois manque sont listés en tête (tri serveur).
 */
export function SaisieManuelle() {
  const client = useQueryClient()
  const { data, isLoading, error } = useQuery({ queryKey: ['admin-closers'], queryFn: () => appelAdmin('closers') })
  const [choisi, setChoisi] = useState(null)

  if (isLoading) return <Chargement />
  if (error) return <ErreurChargement erreur={error} />
  const clients = data?.clients ?? []
  const closers = new Map((data?.closers ?? []).map((k) => [k.id, k]))
  const selection = clients.find((c) => c.id === choisi)

  const fait = async () => {
    await client.invalidateQueries({ queryKey: ['admin-closers'] })
    await client.invalidateQueries({ queryKey: ['admin-closer-commissions'] })
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6 items-start">
      <ul className="border border-border-cream rounded-2xl divide-y divide-border-cream">
        {clients.length === 0 && <li className="p-4 text-[14px] text-ink-3">Aucun client rattaché.</li>}
        {clients.map((c) => {
          const aSaisir = c.facturation === 'shopify' && c.etat === 'actif' && c.formule === 'mensuel' && !c.mensualite_du_mois_saisie
          const closer = closers.get(c.closer_id)
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setChoisi(c.id)}
                aria-pressed={choisi === c.id}
                className={`w-full text-left p-4 ${choisi === c.id ? 'bg-primary-tint' : 'hover:bg-cream'}`}
              >
                <div className="flex justify-between gap-2">
                  <span className="text-ink">{c.boutique}</span>
                  {aSaisir && <span className="text-[12px] text-ink bg-warn-bg rounded-full px-2 py-0.5">Mensualité de {moisLisible(data.mois_courant)} à saisir</span>}
                </div>
                <div className="text-[12px] text-ink-3">
                  {LIBELLES_PLAN[c.plan] ?? c.plan} · {LIBELLES_FORMULE[c.formule] ?? 'formule inconnue'} · {LIBELLES_CANAL[c.facturation] ?? c.facturation} · {closer ? `${closer.prenom} ${closer.nom}` : 'closer inconnu'}
                  {c.montant_pre_rempli ? ` · grille ${montant(c.montant_pre_rempli)}` : ''}
                </div>
              </button>
            </li>
          )
        })}
      </ul>
      {selection
        ? <FormulaireSaisie key={selection.id} client={selection} mois={data.mois_courant} onFait={fait} />
        : <p className="text-[14px] text-ink-3">Choisissez un client rattaché.</p>}
    </div>
  )
}
