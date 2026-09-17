import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { appelAdmin } from '../../../lib/admin-closers'
import { LIBELLES_FORMULE, LIBELLES_PLAN, montant } from '../../../lib/affichage-closer'
import { Alerte, BoutonPrincipal, Chargement, Champ, ErreurChargement } from '../../closer/ui'

const FORMULES = ['mensuel', 'trimestriel', 'annuel']

/**
 * Le formulaire d'une saisie, pour un client choisi. Monté avec une `key` par
 * client : le montant pré-rempli repart de la grille à chaque choix.
 */
function FormulaireSaisie({ client, mois, onFait }) {
  const [formule, setFormule] = useState(client.formule ?? 'mensuel')
  const [moisSaisi, setMoisSaisi] = useState(mois)
  const [euros, setEuros] = useState(client.montant_pre_rempli ? String(client.montant_pre_rempli / 100) : '')
  const [note, setNote] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState(null)

  const enregistrer = async (e) => {
    e.preventDefault()
    setErreur(null)
    setEnCours(true)
    try {
      await appelAdmin('closer-commissions', {
        methode: 'POST',
        corps: {
          client_id: client.id,
          formule,
          montant_centimes: Math.round(Number(String(euros).replace(',', '.')) * 100),
          mois: formule === 'mensuel' ? moisSaisi : undefined,
          note,
        },
      })
      await onFait()
      setNote('')
    } catch (err) {
      setErreur(err.message)
    } finally {
      setEnCours(false)
    }
  }

  return (
    <form onSubmit={enregistrer} className="border border-border-cream rounded-2xl p-5 space-y-4 max-w-xl">
      <h2 className="text-[18px] font-normal">{client.boutique}</h2>
      <label className="block">
        <span className="block text-[13px] text-ink-2 mb-1.5">Formule</span>
        <select value={formule} onChange={(e) => setFormule(e.target.value)} className="w-full h-11 px-3 rounded-xl border border-border-cream bg-white text-[15px]">
          {FORMULES.map((f) => <option key={f} value={f}>{LIBELLES_FORMULE[f]}</option>)}
        </select>
      </label>
      {formule === 'mensuel' && (
        <Champ libelle="Mois concerné" type="month" value={moisSaisi} onChange={(e) => setMoisSaisi(e.target.value)} required />
      )}
      <Champ libelle="Montant (€)" inputMode="decimal" value={euros} onChange={(e) => setEuros(e.target.value)} required />
      <Champ libelle="Note (obligatoire)" value={note} onChange={(e) => setNote(e.target.value)} required minLength={3} />
      {erreur && <Alerte>{erreur}</Alerte>}
      <BoutonPrincipal type="submit" disabled={enCours}>{enCours ? 'Enregistrement…' : 'Saisir la commission'}</BoutonPrincipal>
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
                  {aSaisir && <span className="text-[12px] text-ink bg-warn-bg rounded-full px-2 py-0.5">Mensualité de {data.mois_courant} à saisir</span>}
                </div>
                <div className="text-[12px] text-ink-3">
                  {LIBELLES_PLAN[c.plan] ?? c.plan} · {LIBELLES_FORMULE[c.formule] ?? 'formule inconnue'} · {c.facturation} · {closer ? `${closer.prenom} ${closer.nom}` : 'closer inconnu'}
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
