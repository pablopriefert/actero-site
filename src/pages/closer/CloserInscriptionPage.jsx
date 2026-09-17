import React, { useState } from 'react'
import { SEO } from '../../components/SEO'
import { supabase } from '../../lib/supabase'
import { appelCloser, connexionGoogleCloser } from '../../lib/espace-closer'
import { Alerte, BoutonGoogle, BoutonPrincipal, CadreCloser, Champ } from '../../components/closer/ui'

/**
 * /closer/inscription — la page non listée que Pablo transmet aux closers.
 *
 * E-mail : prénom, nom, e-mail, mot de passe → code à 6 chiffres → compte et
 * fiche closer (api/closer/verifier-code.js). Google : retour sur
 * /closer/callback, qui crée la fiche. Aucun chemin ne crée de client marchand.
 */
export function CloserInscriptionPage({ onNavigate }) {
  const [etape, setEtape] = useState('formulaire')
  const [prenom, setPrenom] = useState('')
  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [code, setCode] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState(null)
  const [compteExistant, setCompteExistant] = useState(false)
  const [info, setInfo] = useState(null)

  const demanderCode = async (e) => {
    e?.preventDefault()
    setErreur(null)
    setInfo(null)
    setEnCours(true)
    try {
      await appelCloser('envoyer-code', { methode: 'POST', corps: { prenom, nom, email, password: motDePasse } })
      setEtape('code')
      setInfo(`Un code à 6 chiffres vient de partir à ${email}.`)
    } catch (err) {
      setErreur(err.message)
    } finally {
      setEnCours(false)
    }
  }

  const verifier = async (e) => {
    e.preventDefault()
    setErreur(null)
    setCompteExistant(false)
    setEnCours(true)
    try {
      await appelCloser('verifier-code', { methode: 'POST', corps: { email, code } })
      const { error } = await supabase.auth.signInWithPassword({ email, password: motDePasse })
      onNavigate(error ? '/closer/connexion' : '/closer')
    } catch (err) {
      setErreur(err.message)
      setCompteExistant(err.code === 'compte_existant')
    } finally {
      setEnCours(false)
    }
  }

  const google = async () => {
    setErreur(null)
    try {
      await connexionGoogleCloser('inscription')
    } catch {
      setErreur('Connexion Google indisponible. Réessayez.')
    }
  }

  return (
    <>
      <SEO title="Devenir closer — Actero" description="Inscription au programme closers d’Actero." noindex />
      <CadreCloser titre="Devenez closer Actero" sousTitre="Votre lien d’abonnement, vos clients et vos commissions, au même endroit.">
        {etape === 'formulaire' ? (
          <div className="space-y-5">
            <BoutonGoogle onClick={google} libelle="S’inscrire avec Google" />
            <div className="flex items-center gap-3 text-[12px] text-ink-4">
              <span className="flex-1 h-px bg-border-cream" />ou<span className="flex-1 h-px bg-border-cream" />
            </div>
            <form onSubmit={demanderCode} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Champ libelle="Prénom" value={prenom} onChange={(e) => setPrenom(e.target.value)} autoComplete="given-name" required />
                <Champ libelle="Nom" value={nom} onChange={(e) => setNom(e.target.value)} autoComplete="family-name" required />
              </div>
              <Champ libelle="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
              <Champ
                libelle="Mot de passe (8 caractères minimum)"
                type="password"
                minLength={8}
                value={motDePasse}
                onChange={(e) => setMotDePasse(e.target.value)}
                autoComplete="new-password"
                required
              />
              {erreur && <Alerte>{erreur}</Alerte>}
              <BoutonPrincipal type="submit" disabled={enCours}>{enCours ? 'Envoi…' : 'Recevoir mon code'}</BoutonPrincipal>
            </form>
          </div>
        ) : (
          <form onSubmit={verifier} className="space-y-4">
            {info && <Alerte ton="info">{info}</Alerte>}
            <Champ
              libelle="Code reçu par e-mail"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              required
            />
            {erreur && (
              <Alerte>
                {erreur}
                {compteExistant && (
                  <button type="button" onClick={() => onNavigate('/closer/connexion')} className="ml-1 underline">Se connecter</button>
                )}
              </Alerte>
            )}
            <BoutonPrincipal type="submit" disabled={enCours || code.length !== 6}>{enCours ? 'Vérification…' : 'Créer mon espace'}</BoutonPrincipal>
            <div className="flex justify-between text-[13px]">
              <button type="button" onClick={() => { setEtape('formulaire'); setCode(''); setErreur(null) }} className="text-ink-3 hover:text-ink">
                Modifier mes informations
              </button>
              <button type="button" onClick={() => demanderCode()} disabled={enCours} className="text-cta hover:underline disabled:opacity-50">
                Renvoyer le code
              </button>
            </div>
          </form>
        )}
        <p className="mt-6 text-center text-[13px] text-ink-3">
          Déjà inscrit ?{' '}
          <button type="button" onClick={() => onNavigate('/closer/connexion')} className="text-cta hover:underline">Se connecter</button>
        </p>
      </CadreCloser>
    </>
  )
}
