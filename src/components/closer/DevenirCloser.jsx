import React, { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { appelCloser } from '../../lib/espace-closer'
import { Alerte, BoutonPrincipal, Champ } from './ui'

/**
 * Un compte sans fiche closer (un marchand, par exemple) : « Devenir closer »
 * crée la fiche. Rien d'autre ne change sur le compte.
 */
export function DevenirCloser() {
  const client = useQueryClient()
  const [prenom, setPrenom] = useState('')
  const [nom, setNom] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState(null)

  const creer = async (e) => {
    e.preventDefault()
    setErreur(null)
    setEnCours(true)
    try {
      await appelCloser('devenir-closer', { methode: 'POST', corps: { prenom, nom } })
      await client.invalidateQueries({ queryKey: ['closer-moi'] })
    } catch (err) {
      setErreur(err.message)
    } finally {
      setEnCours(false)
    }
  }

  return (
    <section className="max-w-md">
      <h1 className="text-[28px] font-normal">Devenir closer</h1>
      <p className="mt-2 text-[15px] text-ink-3">Ce compte n’a pas encore d’espace closer. Créez-le : votre lien d’abonnement est prêt tout de suite.</p>
      <form onSubmit={creer} className="mt-6 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Champ libelle="Prénom" value={prenom} onChange={(e) => setPrenom(e.target.value)} autoComplete="given-name" />
          <Champ libelle="Nom" value={nom} onChange={(e) => setNom(e.target.value)} autoComplete="family-name" />
        </div>
        {erreur && <Alerte>{erreur}</Alerte>}
        <BoutonPrincipal type="submit" disabled={enCours}>{enCours ? 'Création…' : 'Devenir closer'}</BoutonPrincipal>
      </form>
    </section>
  )
}
