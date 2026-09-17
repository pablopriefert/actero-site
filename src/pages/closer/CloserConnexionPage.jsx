import React, { useState } from 'react'
import { SEO } from '../../components/SEO'
import { supabase } from '../../lib/supabase'
import { connexionGoogleCloser } from '../../lib/espace-closer'
import { Alerte, BoutonGoogle, BoutonPrincipal, CadreCloser, Champ } from '../../components/closer/ui'

/** /closer/connexion — e-mail et mot de passe, ou Google ; mot de passe oublié. */
export function CloserConnexionPage({ onNavigate }) {
  const [email, setEmail] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [envoiOubli, setEnvoiOubli] = useState(false)
  const [erreur, setErreur] = useState(null)
  const [info, setInfo] = useState(null)

  const connecter = async (e) => {
    e.preventDefault()
    setErreur(null)
    setInfo(null)
    setEnCours(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password: motDePasse })
      if (error) {
        setErreur('E-mail ou mot de passe incorrect.')
        return
      }
      onNavigate('/closer')
    } catch {
      // Une panne réseau laissait le bouton bloqué sur « Connexion… ».
      setErreur('Connexion impossible. Vérifiez votre réseau et réessayez.')
    } finally {
      setEnCours(false)
    }
  }

  // L'erreur de l'envoi était ignorée : la page annonçait un e-mail parti
  // alors que Supabase l'avait refusé (trop de demandes, par exemple).
  const oublie = async () => {
    if (envoiOubli) return
    setErreur(null)
    setInfo(null)
    if (!email) {
      setErreur('Indiquez votre e-mail, puis cliquez de nouveau sur « Mot de passe oublié ».')
      return
    }
    setEnvoiOubli(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` })
      if (error) {
        setErreur(error.status === 429
          ? 'Trop de demandes de réinitialisation. Réessayez dans quelques minutes.'
          : 'L’e-mail de réinitialisation n’a pas pu partir. Réessayez.')
        return
      }
      setInfo('Si un compte existe pour cette adresse, un e-mail de réinitialisation vient de partir.')
    } catch {
      setErreur('L’e-mail de réinitialisation n’a pas pu partir. Vérifiez votre réseau et réessayez.')
    } finally {
      setEnvoiOubli(false)
    }
  }

  const google = async () => {
    setErreur(null)
    try {
      await connexionGoogleCloser('connexion')
    } catch {
      setErreur('Connexion Google indisponible. Réessayez.')
    }
  }

  return (
    <>
      <SEO title="Connexion closer — Actero" description="Connexion à l’espace closer d’Actero." noindex />
      <CadreCloser titre="Espace closer" sousTitre="Connectez-vous pour retrouver votre lien, vos clients et vos commissions.">
        <div className="space-y-5">
          <BoutonGoogle onClick={google} libelle="Continuer avec Google" />
          <div className="flex items-center gap-3 text-[12px] text-ink-4">
            <span className="flex-1 h-px bg-border-cream" />ou<span className="flex-1 h-px bg-border-cream" />
          </div>
          <form onSubmit={connecter} className="space-y-4">
            <Champ libelle="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            <Champ libelle="Mot de passe" type="password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} autoComplete="current-password" required />
            {erreur && <Alerte>{erreur}</Alerte>}
            {info && <Alerte ton="info">{info}</Alerte>}
            <BoutonPrincipal type="submit" disabled={enCours}>{enCours ? 'Connexion…' : 'Se connecter'}</BoutonPrincipal>
            <button
              type="button"
              onClick={oublie}
              disabled={envoiOubli}
              className="block mx-auto text-[13px] text-ink-3 hover:text-ink disabled:opacity-50"
            >
              {envoiOubli ? 'Envoi…' : 'Mot de passe oublié ?'}
            </button>
          </form>
        </div>
        <p className="mt-6 text-center text-[13px] text-ink-3">
          Pas encore closer ?{' '}
          <button type="button" onClick={() => onNavigate('/closer/inscription')} className="text-cta hover:underline">S’inscrire</button>
        </p>
      </CadreCloser>
    </>
  )
}
