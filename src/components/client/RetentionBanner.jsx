import { useQuery } from '@tanstack/react-query'
import { History } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { trackEvent } from '../../lib/analytics'

/**
 * ACT-36 — dire au marchand ce que sa formule lui cache.
 *
 * La limite de rétention est appliquée en base (RLS, migration
 * 20260910130000) : les lignes trop anciennes n'arrivent tout simplement
 * jamais au navigateur. Sans cette bannière, elles disparaîtraient **en
 * silence** — le marchand ne saurait pas qu'il lui manque quelque chose,
 * donc il n'aurait aucune raison de payer pour le récupérer.
 *
 * C'est la moitié qui rapporte : la limite crée le manque, la bannière le
 * rend visible et chiffré.
 *
 * Le comptage passe par `historique_masque()`, qui renvoie une date et deux
 * nombres — jamais du contenu. Ce qui est hors fenêtre reste hors de portée,
 * y compris pour cette bannière.
 */

const LIBELLE_PLAN_SUIVANT = { free: 'Starter', starter: 'Pro' }

export function RetentionBanner({ clientId, planId, onUpgrade }) {
  const { data } = useQuery({
    queryKey: ['historique-masque', clientId],
    enabled: !!clientId,
    // Le plan ne change pas d'une minute à l'autre, et cette requête compte
    // des lignes : inutile de la relancer à chaque montage d'onglet.
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('historique_masque', { p_client_id: clientId })
      if (error) throw error
      return data
    },
    // Un compteur indisponible ne doit pas casser la page : pas de bannière,
    // et l'onglet fonctionne normalement.
    retry: false,
  })

  const masquees = (data?.conversations || 0) + (data?.evenements || 0)
  if (!data?.limite || masquees === 0) return null

  const planSuivant = LIBELLE_PLAN_SUIVANT[planId] || 'Pro'
  const depuis = new Date(data.limite).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  const handleClick = () => {
    trackEvent('Upgrade Clicked', {
      from_plan: planId || 'unknown',
      to_plan: planSuivant.toLowerCase(),
      trigger: 'retention_limit',
      location: 'retention_banner',
      hidden_items: masquees,
    })
    if (onUpgrade) onUpgrade()
    else window.location.href = '/client/billing'
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 mb-4 rounded-xl bg-amber-50 border border-amber-200">
      <History className="w-4 h-4 text-amber-600 flex-shrink-0" aria-hidden="true" />
      <p className="text-[13px] text-amber-900 leading-snug">
        <strong>{masquees}</strong> {masquees > 1 ? 'éléments plus anciens sont masqués' : 'élément plus ancien est masqué'}.
        {' '}Votre formule conserve l'historique depuis le {depuis}.
      </p>
      <button
        onClick={handleClick}
        className="ml-auto text-[12px] font-semibold text-cta hover:underline flex-shrink-0 whitespace-nowrap"
      >
        Passer au plan {planSuivant}
      </button>
    </div>
  )
}
