import React, { useCallback, useEffect, useState } from 'react'
import { Sparkles, Loader2, AlertCircle, ArrowRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'

/**
 * « Sur vos 1 240 tickets, Actero en aurait réglé 61 % tout seul. »
 *
 * Le harnais qui produit cette phrase tourne depuis le 9 septembre, et il était
 * réservé à un écran d'administration : il fallait qu'un humain de chez nous le
 * lance et raconte le résultat au marchand. C'est la preuve la plus
 * convaincante qu'on ait, faite sur SES données, et elle ne lui était pas
 * montrée (ACT-18).
 *
 * Rien n'est envoyé à personne pendant l'analyse : le rejeu passe par
 * `api/engine/backtest-classify.js`, qui ne fait que de l'inférence — pas
 * d'exécuteur, pas d'email, pas d'écriture, et pas de consommation du quota
 * mensuel. `api/engine/backtest-etancheite.test.js` garde cette propriété.
 */

const SONDAGE_MS = 5000

export function BacktestCard({ clientId }) {
  // `undefined` = pas encore lu, `null` = aucune analyse. La distinction évite
  // un état de chargement séparé, donc un setState de plus dans un effet.
  const [backtest, setBacktest] = useState(undefined)
  const [lancement, setLancement] = useState(false)
  const [erreur, setErreur] = useState(null)

  const relire = useCallback(async () => {
    if (!clientId) return null
    const { data } = await supabase
      .from('ticket_backtests')
      .select('id, status, total_tickets, would_resolve_count, would_escalate_count, resolution_rate, sample, error, created_at, completed_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setBacktest(data || null)
    return data || null
  }, [clientId])

  /* eslint-disable react-hooks/set-state-in-effect -- lecture asynchrone : le setState est dans le callback awaité de relire (même motif que MigrationsView) */
  useEffect(() => {
    relire()
  }, [relire])

  // Tant qu'une analyse tourne, on redemande. Le bac à sable met quelques
  // minutes et écrit la ligne quand il a fini.
  useEffect(() => {
    if (backtest?.status !== 'running') return undefined
    const id = setInterval(relire, SONDAGE_MS)
    return () => clearInterval(id)
  }, [backtest?.status, relire])
  /* eslint-enable react-hooks/set-state-in-effect */

  const lancer = useCallback(async () => {
    setErreur(null)
    setLancement(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/jobs/backtest-marchand', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({ client_id: clientId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        // Le serveur explique lui-même pourquoi il refuse — historique trop
        // court, analyse déjà en cours, plafond du jour. Ces messages sont
        // faits pour être lus tels quels.
        setErreur(data?.message || 'L’analyse n’a pas pu démarrer.')
        return
      }
      await relire()
    } catch {
      setErreur('L’analyse n’a pas pu démarrer. Réessayez dans un instant.')
    } finally {
      setLancement(false)
    }
  }, [clientId, relire])

  if (backtest === undefined) return null

  const enCours = backtest?.status === 'running'
  const termine = backtest?.status === 'completed' && backtest.total_tickets > 0
  const echoue = backtest?.status === 'failed'

  return (
    <section className="rounded-2xl border border-[#E6E8EC] bg-white p-6">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-cta/10 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-5 h-5 text-cta" />
        </div>
        <div>
          <h2 className="text-[15px] font-bold text-[#1a1a1a]">Ce qu’Actero aurait fait</h2>
          <p className="text-[13px] text-[#6b6b6b] mt-0.5">
            On rejoue vos anciennes conversations dans l’agent pour voir combien il
            aurait traitées seul. <strong className="font-semibold text-[#1a1a1a]">Rien n’est envoyé
            à vos clients</strong> et votre quota mensuel n’est pas touché.
          </p>
        </div>
      </div>

      {termine && (
        <div className="rounded-xl bg-cta/5 border border-cta/15 p-5 mb-4">
          <div className="flex items-baseline gap-2">
            <span className="text-[40px] leading-none font-mono font-medium text-cta tabular-nums">
              {Math.round(backtest.resolution_rate)}%
            </span>
            <span className="text-[14px] text-[#1a1a1a]">
              de vos {backtest.total_tickets.toLocaleString('fr-FR')} conversations
            </span>
          </div>
          <p className="text-[13px] text-[#6b6b6b] mt-2">
            <strong className="font-semibold text-[#1a1a1a]">
              {backtest.would_resolve_count.toLocaleString('fr-FR')}
            </strong> auraient été traitées par l’agent seul,{' '}
            <strong className="font-semibold text-[#1a1a1a]">
              {backtest.would_escalate_count.toLocaleString('fr-FR')}
            </strong> passées à un humain.
          </p>
        </div>
      )}

      {termine && Array.isArray(backtest.sample) && backtest.sample.length > 0 && (
        <div className="mb-4">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-[#6b6b6b] mb-2">
            Quelques cas
          </p>
          <div className="space-y-1.5">
            {backtest.sample.slice(0, 4).map((cas, i) => (
              <div key={i} className="flex items-start gap-2.5 text-[13px]">
                <span
                  className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    cas.would_resolve ? 'bg-success' : 'bg-warn'
                  }`}
                  aria-hidden="true"
                />
                <span className="text-[#3a3a3a] leading-snug">
                  {String(cas.message || '').slice(0, 130)}
                  {String(cas.message || '').length > 130 ? '…' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {enCours && (
        <div className="flex items-center gap-2.5 rounded-xl bg-cream px-4 py-3 mb-4">
          <Loader2 className="w-4 h-4 text-cta animate-spin flex-shrink-0" />
          <span className="text-[13px] text-[#3a3a3a]">
            Analyse en cours. Quelques minutes — vous pouvez fermer cette page.
          </span>
        </div>
      )}

      {echoue && (
        <div className="flex items-start gap-2.5 rounded-xl bg-warn-bg px-4 py-3 mb-4">
          <AlertCircle className="w-4 h-4 text-warn flex-shrink-0 mt-0.5" />
          <span className="text-[13px] text-[#3a3a3a]">
            La dernière analyse n’a pas abouti. Vous pouvez la relancer.
          </span>
        </div>
      )}

      {erreur && (
        <div className="flex items-start gap-2.5 rounded-xl bg-warn-bg px-4 py-3 mb-4">
          <AlertCircle className="w-4 h-4 text-warn flex-shrink-0 mt-0.5" />
          <span className="text-[13px] text-[#3a3a3a]">{erreur}</span>
        </div>
      )}

      <button
        type="button"
        onClick={lancer}
        disabled={enCours || lancement}
        className="inline-flex items-center gap-2 rounded-full bg-cta hover:bg-cta-hover disabled:opacity-40 px-5 py-2.5 text-[14px] font-medium text-white transition-colors"
      >
        {lancement ? 'Démarrage…' : termine ? 'Relancer l’analyse' : 'Lancer l’analyse'}
        {!lancement && <ArrowRight className="w-4 h-4" />}
      </button>
    </section>
  )
}

export default BacktestCard
