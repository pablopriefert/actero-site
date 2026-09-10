import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import styles from './Aujourdhui.module.css'

/**
 * Aujourd'hui — direction « La nuit imprimée ».
 *
 * Remplace OverviewHome quand FEATURES.aujourdhuiHome est vrai. Ne rend que la
 * colonne de contenu : la coquille (sidebar, topbar) reste celle du dashboard,
 * sinon on afficherait deux navigations.
 *
 * Règle typographique portée par la direction : les humains ont la serif
 * (--font-display), la machine a la mono (--font-mono). On peut lire l'écran
 * sans lire un mot et savoir qui parle.
 *
 * Ce qui n'est PAS rendu, faute de données : les instruments par escalade
 * (3e message / 128 € contre plafond 80 € / 8e jour de transport). Le moteur
 * n'émet pas ces faits aujourd'hui ; les inventer rendrait l'écran joli et
 * faux. Ils réapparaîtront quand escalation_tickets portera le détail.
 */

// ── La nuit est une fenêtre FERMÉE : 20 h → 9 h. Passé 9 h du matin elle ne
//    s'allonge plus, sinon à 17 h l'écran parlerait de « cette nuit » à propos
//    de vingt-et-une heures, et le peigne compterait des bandes de plein jour.
function nightWindow(now) {
  const start = new Date(now)
  start.setMinutes(0, 0, 0)
  if (now.getHours() < 20) start.setDate(start.getDate() - 1)
  start.setHours(20)
  const matin = new Date(start)
  matin.setDate(matin.getDate() + 1)
  matin.setHours(9, 0, 0, 0)
  return { start, end: now < matin ? now : matin }
}

const CLASSIFICATION_LABELS = {
  suivi_commande: 'Suivi de commande',
  retour_echange: 'Retour & échange',
  remboursement: 'Remboursement',
  disponibilite: 'Disponibilité produit',
  adresse: 'Changement d’adresse',
  reclamation: 'Réclamation',
  autre: 'Autre demande',
}

// Pourquoi l'agent n'a pas tranché seul. Une phrase par classification —
// c'est ce qui permet de décider sans ouvrir le fil.
const CLASSIFICATION_MOTIFS = {
  remboursement: 'un remboursement à valider, au-dessus de ce que l’agent peut accorder seul',
  suivi_commande: 'un colis que le transporteur ne sait plus situer',
  retour_echange: 'un retour hors des conditions que vous avez fixées',
  reclamation: 'un ton négatif, et une demande explicite d’un humain',
  autre: 'aucune règle ne couvre ce cas',
}

const label = (slug) =>
  CLASSIFICATION_LABELS[slug] ||
  (slug ? String(slug).replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()) : 'Demande')

const hhmm = (iso) =>
  new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

// « 2 h 22 », « 34 min » — l'écart tel qu'on le dit à l'oral.
function ecart(fromIso, toDate) {
  const min = Math.max(0, Math.round((toDate - new Date(fromIso)) / 60000))
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  return `${h} h ${String(min % 60).padStart(2, '0')}`
}

const CHANNEL_GLYPHS = {
  email: <path d="M1 1 H11 V11 H1 Z M1 1 L6 6 L11 1" />,
  whatsapp: <path d="M1 1 H11 V11 H1 Z M11 11 L14 14" />,
  default: <path d="M1 11 V1 H11 V11" />,
}

/** Le A d'Actero — un seul tracé, jamais redessiné. */
const Amark = () => (
  <svg viewBox="0 0 32 32" aria-hidden="true">
    <path d="M16 2L2 30H10L16 18L22 30H30L16 2Z" fill="currentColor" />
  </svg>
)

export function AujourdhuiHome({ clientId, planName, setActiveTab }) {
  // Pas de chargement de polices ici : depuis l'unification, Inter Tight
  // et DM Mono sont importées globalement dans src/index.css. Cet écran prend
  // les tokens de l'app (voir Aujourdhui.module.css) et n'a plus de familles
  // à lui.

  const now = useMemo(() => new Date(), [])
  const { start, end } = useMemo(() => nightWindow(now), [now])

  const { data: nuit } = useQuery({
    queryKey: ['aujourdhui-nuit', clientId, start.toISOString(), end.toISOString()],
    queryFn: async () => {
      const { data } = await supabase
        .from('automation_events')
        .select('event_category, ticket_type, created_at, time_saved_seconds')
        .eq('client_id', clientId)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at', { ascending: true })
      return data || []
    },
    enabled: !!clientId,
    refetchInterval: 60_000,
  })

  const { data: escalades = [] } = useQuery({
    queryKey: ['aujourdhui-escalades', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('escalation_tickets')
        .select('id, classification, customer_name, customer_email, message_preview, created_at, priority, status')
        .eq('client_id', clientId)
        .not('status', 'in', '("resolved","closed")')
        .order('created_at', { ascending: true })
        .limit(3)
      return data || []
    },
    enabled: !!clientId,
    refetchInterval: 60_000,
  })

  const { data: appris } = useQuery({
    queryKey: ['aujourdhui-appris', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_recommendations')
        .select('id, title, description, expected_impact')
        .eq('client_id', clientId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
      return data?.[0] || null
    },
    enabled: !!clientId,
    staleTime: 5 * 60_000,
  })

  // ── Dérivés ──
  const events = nuit || []
  const regles = events.filter((e) => e.event_category === 'ticket_resolved')

  // Le peigne : une bande par heure écoulée depuis 20 h, un trait par conversation.
  const bandes = useMemo(() => {
    const heures = Math.max(1, Math.ceil((end - start) / 3_600_000))
    return Array.from({ length: heures }, (_, i) => {
      const h = new Date(start.getTime() + i * 3_600_000)
      return {
        h: h.getHours(),
        n: regles.filter((e) => {
          const d = new Date(e.created_at)
          return d >= h && d < new Date(h.getTime() + 3_600_000)
        }).length,
      }
    })
  }, [regles, start, end])

  const registre = useMemo(() => {
    const par = new Map()
    for (const e of regles) {
      const k = e.ticket_type || 'autre'
      par.set(k, (par.get(k) || 0) + 1)
    }
    return [...par.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
  }, [regles])

  const mediane = useMemo(() => {
    const v = regles.map((e) => e.time_saved_seconds).filter((n) => typeof n === 'number' && n > 0).sort((a, b) => a - b)
    if (!v.length) return null
    return v[Math.floor(v.length / 2)]
  }, [regles])

  const plusAncienne = escalades[0]
  const nEsc = escalades.length
  const grave = (e) => e?.priority === 1 || e?.classification === 'reclamation'

  const enMots = ['Aucun', 'Un', 'Deux', 'Trois', 'Quatre', 'Cinq', 'Six'][nEsc] || String(nEsc)
  // Nuit sans trafic ET sans décision : le peigne n'a rien à peigner, et un
  // axe de 312 px sans un seul trait se lit comme un écran cassé.
  const vide = regles.length === 0 && nEsc === 0

  return (
    <div className={styles.root}>
      <main className={styles.contenu} style={{ '--bandes': bandes.length }}>

        {/* ── Cartouche ── */}
        <div className={styles.bloc}>
          <p className={styles.datation}>
            {now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} · {hhmm(now.toISOString())}
          </p>
        </div>

        <div className={`${styles.bloc} ${styles.cartouche}`}>
          <p className={styles.compte}>{regles.length}</p>
          <h1 className={styles.etat}>
            {regles.length === 0
              ? <>conversation réglée cette nuit. L’agent n’a rien eu à traiter.</>
              : <>conversation{regles.length > 1 ? 's' : ''} réglée{regles.length > 1 ? 's' : ''} cette nuit, pendant que vous dormiez.{' '}</>}
            {nEsc > 0 && (
              <>
                <b>{enMots} client{nEsc > 1 ? 's' : ''}</b> attend{nEsc > 1 ? 'ent' : ''} votre décision.
              </>
            )}
          </h1>
        </div>

        {(mediane || plusAncienne) && (
          <div className={styles.bloc}>
            <p className={styles.mesure}>
              {mediane ? `Médiane ${mediane} s` : null}
              {mediane && plusAncienne ? ' · ' : null}
              {plusAncienne ? `plus ancienne en attente ${ecart(plusAncienne.created_at, now)}` : null}
            </p>
          </div>
        )}

        <div className={styles.clot} role="presentation" />

        {/* ── Le peigne de nuit ── */}
        {regles.length > 0 && (
        <section className={`${styles.bloc} ${styles['bloc--axe']} ${styles.peigne}`} aria-labelledby="peigne-t">
          <h2 id="peigne-t" className={styles['sr-only']}>Charge de la nuit, heure par heure</h2>

          <div className={styles.gout} aria-hidden="true">
            {bandes.map((b, i) => {
              // La coupure : l'axe s'interrompt à la minute de chaque escalade.
              const coupure = escalades.find((e) => new Date(e.created_at).getHours() === b.h)
              return (
                <div className={styles.bande} key={i}>
                  {i % 3 === 0 && <span className={styles.heure}>{String(b.h).padStart(2, '0')}</span>}
                  {Array.from({ length: b.n }, (_, j) => <i key={j} />)}
                  {coupure && (
                    <span
                      className={styles.trou}
                      style={{ '--m': new Date(coupure.created_at).getMinutes() }}
                    />
                  )}
                </div>
              )
            })}
          </div>

          <p className={styles.legende}>
            {regles.length === 0
              ? 'Rien n’est passé par l’agent depuis vingt heures. Si vous attendiez du trafic, c’est le signe à regarder en premier.'
              : `Vingt heures à ${hhmm(end.toISOString())} : ${bandes.length} heures de veille, sans vous.`}
          </p>

          <table className={styles['sr-only']}>
            <caption>{regles.length} conversations réglées depuis 20 h.</caption>
            <thead><tr><th scope="col">Heure</th><th scope="col">Conversations réglées</th></tr></thead>
            <tbody>
              {bandes.map((b, i) => (
                <tr key={i}><th scope="row">{String(b.h).padStart(2, '0')} h</th><td>{b.n}</td></tr>
              ))}
            </tbody>
            <tfoot><tr><th scope="row">Total</th><td>{regles.length}</td></tr></tfoot>
          </table>
        </section>
        )}

        {vide && (
          <>
            <div className={styles.bloc}>
              <p className={styles.legende}>
                Rien n’est passé par l’agent depuis vingt heures. Si votre bulle est en ligne et
                que vous attendiez du trafic, c’est le premier signe à regarder.
              </p>
            </div>

            <article className={`${styles.bloc} ${styles['bloc--axe']} ${styles.esc} ${styles.note}`}>
              <div className={styles.gout}>
                <span className={styles.epingle} aria-hidden="true" />
              </div>
              <div className={styles.feuille}>
                <p className={styles.chapeau}><span>Vérifier que l’agent répond</span></p>
                <p className={styles['note-t']}>
                  Un essai suffit à distinguer les deux cas : un agent qui n’a rien reçu, et un
                  agent qui ne répond plus.
                </p>
                <div className={styles.motif}>
                  <Amark />
                  <p>une nuit vide n’est une bonne nouvelle que si la bulle est bien en ligne</p>
                </div>
                <div className={styles.actes}>
                  <button type="button" className={styles['acte-1']} onClick={() => setActiveTab?.('simulator')}>
                    Tester mon agent
                  </button>
                  <button type="button" className={styles['acte-2']} onClick={() => setActiveTab?.('widget')}>
                    Voir ma bulle SAV
                  </button>
                </div>
              </div>
            </article>
          </>
        )}

        {nEsc > 0 && (
          <>
            {/* ── Rupture d'échelle : au-dessus une durée, en dessous un ordre ── */}
            <div className={`${styles.bloc} ${styles['bloc--axe']} ${styles.rupture}`}>
              <div className={styles.gout} aria-hidden="true">
                <svg className={styles.rg} viewBox="0 0 20 14">
                  <path className={styles['rg-mask']} d="M6.5 1 H13.5 V13 H6.5 Z" />
                  <path className={styles['rg-l']} d="M4 12 L9 3.34" />
                  <path className={styles['rg-l']} d="M9 12 L14 3.34" />
                </svg>
              </div>
              <h2 className={styles.sectionlabel}>Ce qui attend votre décision</h2>
            </div>

            {escalades.map((e, i) => (
              <React.Fragment key={e.id}>
                {i > 0 && (
                  <div className={`${styles.bloc} ${styles['bloc--axe']} ${styles.intervalle} ${styles['intervalle--greffe']}`}>
                    <span className={styles['intervalle-t']}>
                      <span>+{ecart(escalades[i - 1].created_at, new Date(e.created_at))}</span>
                    </span>
                  </div>
                )}

                <article className={`${styles.bloc} ${styles['bloc--axe']} ${styles.esc}`}>
                  <div className={styles.gout}>
                    <span className={styles['esc-h']}>{hhmm(e.created_at)}</span>
                    <span
                      className={`${styles.epingle} ${grave(e) ? styles['epingle--grave'] : ''}`}
                      aria-hidden="true"
                    />
                  </div>

                  <div className={`${styles.feuille} ${grave(e) ? styles['feuille--grave'] : ''}`}>
                    <p className={styles.chapeau}>
                      <svg viewBox="0 0 12 12" aria-hidden="true">{CHANNEL_GLYPHS.default}</svg>
                      <span>{label(e.classification)} · {hhmm(e.created_at)}</span>
                      {i > 0 && (
                        <span className={styles.apres}>
                          +{ecart(escalades[i - 1].created_at, new Date(e.created_at))} après {(escalades[i - 1].customer_name || 'la précédente').split(' ')[0]}
                        </span>
                      )}
                    </p>

                    {e.message_preview && (
                      <blockquote className={styles.dit}>
                        <span className={styles.guil}>«</span>&#8239;{e.message_preview}&#8239;<span className={styles.guil}>»</span>
                      </blockquote>
                    )}
                    <p className={styles.qui}>— {e.customer_name || e.customer_email || 'Client inconnu'}</p>

                    <div className={styles.motif}>
                      <Amark />
                      <p>{CLASSIFICATION_MOTIFS[e.classification] || CLASSIFICATION_MOTIFS.autre}</p>
                    </div>

                    <div className={styles.actes}>
                      <button type="button" className={styles['acte-1']} onClick={() => setActiveTab?.('escalations')}>
                        Répondre moi-même
                      </button>
                      <button type="button" className={styles['acte-2']} onClick={() => setActiveTab?.('escalations')}>
                        Voir le fil
                      </button>
                    </div>
                  </div>
                </article>
              </React.Fragment>
            ))}

            <div className={`${styles.bloc} ${styles['bloc--axe']} ${styles.intervalle}`}>
              <span className={styles['intervalle-t']}>
                <span>+{ecart(escalades[nEsc - 1].created_at, now)}</span>
              </span>
            </div>
          </>
        )}

        {!vide && (
        <div className={`${styles.bloc} ${styles['bloc--axe']} ${styles.terminus}`}>
          <div className={styles.gout}><span className={styles.repere} aria-hidden="true" /></div>
          <p className={styles.maintenant}>Maintenant · {hhmm(now.toISOString())}</p>
        </div>
        )}

        {/* ── Le pli — seulement s'il y a quelque chose dessous ── */}
        {(registre.length > 0 || appris) && (
        <div className={styles['pli-wrap']}>
          <svg className={styles.pli} viewBox="0 0 1000 6" preserveAspectRatio="none" aria-hidden="true">
            <path className={styles.crete} d="M0 3 Q500 1 1000 3" strokeWidth="1" fill="none" vectorEffect="non-scaling-stroke" />
            <path className={styles.creux} d="M0 4 Q500 2 1000 4" strokeWidth="1" fill="none" vectorEffect="non-scaling-stroke" />
          </svg>
        </div>
        )}

        {/* ── Sous le pli — la bande n'est peinte que s'il y a quelque chose ── */}
        {(registre.length > 0 || appris) && (
        <section className={styles.souspli}>
          {registre.length > 0 && (
            <>
              <div className={styles.bloc}>
                <h2 className={styles.sectionlabel}>Traité sans vous</h2>
              </div>
              <div className={styles.bloc}>
                <div className={styles.registre}>
                  {registre.map(([slug, n]) => (
                    <div
                      className={styles.lg}
                      key={slug}
                      style={{ '--n': n }}
                      aria-label={`${label(slug)}, ${n} conversation${n > 1 ? 's' : ''} réglée${n > 1 ? 's' : ''}`}
                    >
                      <span className={styles.l}>{label(slug)}</span>
                      <span className={styles.segs} aria-hidden="true"><i /></span>
                      <span className={styles.n}>{n}</span>
                    </div>
                  ))}
                  <div className={`${styles.lg} ${styles.somme}`}>
                    <span />
                    <span className={`${styles.n} ${styles.s}`}>Σ {regles.length}</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {appris && (
            <article className={`${styles.bloc} ${styles['bloc--axe']} ${styles.esc} ${styles.note}`}>
              <div className={styles.gout}>
                <span className={styles['esc-h']}>à venir</span>
                <span className={styles.epingle} aria-hidden="true" />
              </div>
              <div className={styles.feuille}>
                <p className={styles.chapeau}><span>Ce qu’il a appris cette nuit</span></p>
                <p className={styles['note-t']}>{appris.title}</p>
                {appris.expected_impact && (
                  <div className={styles.motif}>
                    <Amark />
                    <p>{appris.expected_impact}</p>
                  </div>
                )}
                <div className={styles.actes}>
                  <button type="button" className={styles['acte-1']} onClick={() => setActiveTab?.('knowledge')}>
                    Ajouter la réponse
                  </button>
                </div>
              </div>
            </article>
          )}
        </section>
        )}

        {planName && <p className={styles['sr-only']}>Plan {planName}</p>}
      </main>
    </div>
  )
}

export default AujourdhuiHome
