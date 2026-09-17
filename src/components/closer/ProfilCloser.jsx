import React, { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { appelCloser } from '../../lib/espace-closer'
import { Alerte, BoutonPrincipal, Champ } from './ui'

/** Profil et paiement : identité, téléphone, SIRET, titulaire, IBAN masqué. */
export function ProfilCloser({ fiche }) {
  const client = useQueryClient()
  const [telephone, setTelephone] = useState(fiche.telephone ?? '')
  const [siret, setSiret] = useState(fiche.siret ?? '')
  const [titulaire, setTitulaire] = useState(fiche.titulaire_iban ?? '')
  const [iban, setIban] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState(null)
  const [info, setInfo] = useState(null)

  const enregistrer = async (e) => {
    e.preventDefault()
    setErreur(null)
    setInfo(null)
    setEnCours(true)
    try {
      await appelCloser('profil', {
        methode: 'PATCH',
        corps: { telephone, siret, titulaire_iban: titulaire, ...(iban.trim() ? { iban } : {}) },
      })
      setIban('')
      setInfo('Profil enregistré.')
      await client.invalidateQueries({ queryKey: ['closer-moi'] })
    } catch (err) {
      setErreur(err.message)
    } finally {
      setEnCours(false)
    }
  }

  return (
    <section className="max-w-xl space-y-6">
      <h1 className="text-[28px] font-normal">Profil et paiement</h1>
      <dl className="grid grid-cols-2 gap-4 text-[14px]">
        <div><dt className="text-ink-3">Nom</dt><dd className="text-ink">{fiche.prenom} {fiche.nom}</dd></div>
        <div><dt className="text-ink-3">E-mail</dt><dd className="text-ink break-all">{fiche.email}</dd></div>
        <div><dt className="text-ink-3">Code closer</dt><dd className="font-mono text-ink">{fiche.code}</dd></div>
        <div><dt className="text-ink-3">IBAN enregistré</dt><dd className="font-mono text-ink">{fiche.iban_masque ?? 'aucun'}</dd></div>
      </dl>
      <form onSubmit={enregistrer} className="space-y-4">
        <Champ libelle="Téléphone" type="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} autoComplete="tel" />
        <Champ libelle="SIRET (14 chiffres)" inputMode="numeric" value={siret} onChange={(e) => setSiret(e.target.value)} />
        <Champ libelle="Titulaire du compte" value={titulaire} onChange={(e) => setTitulaire(e.target.value)} autoComplete="name" />
        <Champ
          libelle={fiche.iban_masque ? 'Nouvel IBAN (laisser vide pour garder l’actuel)' : 'IBAN'}
          value={iban}
          onChange={(e) => setIban(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        <p className="text-[13px] text-ink-3">L’IBAN est chiffré dès sa réception ; seuls ses quatre derniers caractères s’affichent ensuite.</p>
        {erreur && <Alerte>{erreur}</Alerte>}
        {info && <Alerte ton="info">{info}</Alerte>}
        <BoutonPrincipal type="submit" disabled={enCours}>{enCours ? 'Enregistrement…' : 'Enregistrer'}</BoutonPrincipal>
      </form>
    </section>
  )
}
