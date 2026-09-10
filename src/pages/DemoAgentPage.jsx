/**
 * Démo publique de l'agent SAV — ACT-5.
 *
 * Un prospect envoie un vrai message et reçoit la réponse du vrai moteur :
 * même endpoint que le widget installé chez un marchand
 * (api/engine/webhooks/widget.js), même classification, mêmes agents
 * spécialisés, mêmes garde-fous d'escalade.
 *
 * Ce que la page montre en plus d'un chat : les signaux de décision. La
 * confiance, l'agent qui a répondu, et le fait que la demande soit passée à un
 * humain ou non. C'est la seule chose qui distingue visiblement Actero d'un
 * modèle avec un bon prompt — et c'est exactement ce qu'un marchand doit voir
 * avant de laisser une IA parler à ses clients.
 *
 * La boutique « BoutiqueMode.fr » est fictive et sa base de connaissances est
 * un jeu de démonstration. Le client de démo est isolé du compte de review
 * Shopify, et sur un plan borné : une page publique ne doit pas ouvrir un
 * robinet de dépense illimité.
 */
import { useState, useRef, useEffect } from 'react'
import { SEO } from '../components/SEO'
import { ArrowRight, Send, User, Sparkles, ShieldCheck, CornerDownLeft } from 'lucide-react'

const CLE_DEMO = 'demo_public_boutiquemode_2026'
const ENDPOINT = `/api/engine/webhooks/widget?api_key=${CLE_DEMO}`

// Les quatre premières questions décident de l'impression. Deux montrent que
// l'agent connaît la boutique, deux montrent qu'il connaît ses limites — et
// c'est la seconde paire qui rassure un marchand.
const SUGGESTIONS = [
  { texte: 'Je peux renvoyer une robe commandée il y a 3 semaines ?', note: 'connaît vos règles' },
  { texte: 'Je fais du 40, quelle taille pour un pantalon en lin ?', note: 'connaît vos produits' },
  { texte: 'Où en est ma commande 1082 ?', note: "n'invente rien" },
  { texte: 'Je veux parler à un vrai humain', note: 'passe la main' },
]

const ACCUEIL = {
  role: 'agent',
  texte:
    "Bonjour ! Je suis l'assistant de BoutiqueMode.fr. Livraison, retours, tailles, commandes — posez-moi une vraie question, je réponds comme je le ferais chez un vrai marchand.",
  meta: null,
}

function Jauge({ valeur }) {
  const pct = Math.round((valeur || 0) * 100)
  const teinte = pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-neutral-400'
  return (
    <span className="inline-flex items-center gap-1.5" title={`Confiance du modèle : ${pct} %`}>
      <span className="relative block h-1 w-10 overflow-hidden rounded-full bg-[#E6E8EC]">
        <span className={`absolute inset-y-0 left-0 ${teinte}`} style={{ width: `${pct}%` }} />
      </span>
      <span className="tabular-nums text-[11px] text-[#8A8578]">{pct} %</span>
    </span>
  )
}

function Signaux({ meta }) {
  if (!meta) return null
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-[#EDEFF2] pt-2 text-[11px] text-[#8A8578]">
      <Jauge valeur={meta.confiance} />
      <span
        className={
          meta.escalade
            ? 'rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-800'
            : 'rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-800'
        }
      >
        {meta.escalade ? 'transmis à un conseiller' : 'traité sans humain'}
      </span>
      <span className="tabular-nums">{meta.secondes} s</span>
    </div>
  )
}

export const DemoAgentPage = ({ onNavigate }) => {
  const [messages, setMessages] = useState([ACCUEIL])
  const [saisie, setSaisie] = useState('')
  const [enCours, setEnCours] = useState(false)
  const finRef = useRef(null)
  const champRef = useRef(null)
  const sessionRef = useRef(
    `demo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  )

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, enCours])

  async function envoyer(texte) {
    const contenu = (texte ?? saisie).trim()
    if (!contenu || enCours) return

    setMessages((m) => [...m, { role: 'client', texte: contenu }])
    setSaisie('')
    setEnCours(true)
    const depart = performance.now()

    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: contenu, session_id: sessionRef.current }),
      })
      const data = await res.json().catch(() => ({}))
      const secondes = ((performance.now() - depart) / 1000).toFixed(1)

      if (res.status === 429) {
        setMessages((m) => [
          ...m,
          {
            role: 'agent',
            texte:
              data.response ||
              "Vous allez plus vite que la démo. Laissez-lui une minute — c'est une limite de la page publique, pas de l'agent.",
            meta: null,
          },
        ])
        return
      }

      setMessages((m) => [
        ...m,
        {
          role: 'agent',
          texte: data.response || "Je n'ai pas réussi à répondre à l'instant. Reformulez votre question ?",
          meta: data.response
            ? { confiance: data.confidence, escalade: Boolean(data.escalated), secondes }
            : null,
        },
      ])
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: 'agent',
          texte:
            "La connexion a échoué. C'est la démo qui est en cause, pas l'agent — réessayez dans un instant.",
          meta: null,
        },
      ])
    } finally {
      setEnCours(false)
      champRef.current?.focus()
    }
  }

  return (
    <>
      <SEO
        title="Démo de l'agent SAV Actero — parlez-lui maintenant"
        description="Posez une vraie question à l'agent SAV Actero et voyez sa réponse, sa confiance et sa décision d'escalade. Aucun compte requis."
        path="/demo"
      />

      <main className="min-h-screen bg-[#FFFFFF] px-5 py-12 md:py-16">
        <div className="mx-auto flex max-w-3xl flex-col gap-8">

          {/* ── Cadrage : ce qui est faux, ce qui est vrai ── */}
          <header className="flex flex-col gap-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-cta">Démo en direct</p>
            <h1
              className="text-[#1A1A1A]"
              style={{
                fontFamily: 'var(--font-display, "Inter Tight", ui-sans-serif, sans-serif)',
                fontSize: 'clamp(30px, 4.4vw, 46px)',
                lineHeight: 1.08,
                letterSpacing: '-0.02em',
              }}
            >
              Parlez à l'agent.
            </h1>
            <p className="max-w-xl text-[16px] leading-relaxed text-[#5A5A5A]">
              <strong className="font-semibold text-[#1A1A1A]">BoutiqueMode.fr est une boutique fictive.
              L'agent, lui, est le vrai</strong> : même moteur, mêmes règles et mêmes garde-fous que
              chez un marchand qui nous paie. Rien de scripté, aucune réponse préparée.
            </p>
          </header>

          {/* ── La conversation ── */}
          <section
            className="flex flex-col overflow-hidden rounded-2xl border border-[#E6E8EC] bg-white shadow-[0_1px_3px_rgba(26,26,26,0.04)]"
            aria-label="Conversation avec l'agent de démonstration"
          >
            <div className="flex items-center gap-2.5 border-b border-[#EDEFF2] px-5 py-3.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-cta/10">
                <Sparkles className="h-3.5 w-3.5 text-cta" />
              </span>
              <div className="flex flex-col leading-tight">
                <span className="text-[13px] font-semibold text-[#1A1A1A]">Assistant BoutiqueMode.fr</span>
                <span className="text-[11px] text-[#8A8578]">Propulsé par Actero · Claude Sonnet 5</span>
              </div>
            </div>

            <div className="flex max-h-[26rem] flex-col gap-4 overflow-y-auto px-5 py-5">
              {messages.map((m, i) => (
                <div key={i} className={`flex gap-2.5 ${m.role === 'client' ? 'justify-end' : ''}`}>
                  {m.role === 'agent' && (
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cta/10">
                      <Sparkles className="h-3 w-3 text-cta" />
                    </span>
                  )}
                  <div
                    className={
                      m.role === 'client'
                        ? 'max-w-[85%] rounded-2xl rounded-br-sm bg-cta px-3.5 py-2.5 text-[14px] leading-relaxed text-white'
                        : 'max-w-[85%] rounded-2xl rounded-bl-sm bg-[#F7F5EF] px-3.5 py-2.5 text-[14px] leading-relaxed text-[#1A1A1A]'
                    }
                  >
                    <p className="whitespace-pre-wrap">{m.texte}</p>
                    {m.role === 'agent' && <Signaux meta={m.meta} />}
                  </div>
                  {m.role === 'client' && (
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#E6E8EC]">
                      <User className="h-3 w-3 text-[#716D5C]" />
                    </span>
                  )}
                </div>
              ))}

              {enCours && (
                <div className="flex items-center gap-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cta/10">
                    <Sparkles className="h-3 w-3 text-cta" />
                  </span>
                  <span className="text-[13px] italic text-[#8A8578]">
                    l'agent cherche dans la base de connaissances…
                  </span>
                </div>
              )}
              <div ref={finRef} />
            </div>

            {/* ── Saisie ── */}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                envoyer()
              }}
              className="flex items-center gap-2 border-t border-[#EDEFF2] px-4 py-3"
            >
              <input
                ref={champRef}
                value={saisie}
                onChange={(e) => setSaisie(e.target.value)}
                maxLength={500}
                disabled={enCours}
                placeholder="Posez votre question…"
                aria-label="Votre message"
                className="flex-1 bg-transparent text-[14px] text-[#1A1A1A] placeholder:text-[#A8A296] focus:outline-none focus-visible:ring-2 focus-visible:ring-cta/40 rounded px-1 py-1.5 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={enCours || !saisie.trim()}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-cta text-white transition-opacity hover:opacity-90 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta/40"
                aria-label="Envoyer"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </section>

          {/* ── Questions suggérées ── */}
          <section className="flex flex-col gap-2.5">
            <p className="flex items-center gap-1.5 text-[12px] text-[#8A8578]">
              <CornerDownLeft className="h-3 w-3" /> Essayez une de ces questions
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.texte}
                  onClick={() => envoyer(s.texte)}
                  disabled={enCours}
                  className="group flex flex-col items-start gap-1 rounded-xl border border-[#E6E8EC] bg-white px-3.5 py-3 text-left transition-colors hover:border-cta/40 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta/40"
                >
                  <span className="text-[13.5px] leading-snug text-[#1A1A1A]">{s.texte}</span>
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-[#A8A296]">
                    {s.note}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* ── Lecture des signaux ── */}
          <section className="flex flex-col gap-3 rounded-2xl border border-[#E6E8EC] bg-white px-5 py-4">
            <h2 className="flex items-center gap-2 text-[14px] font-semibold text-[#1A1A1A]">
              <ShieldCheck className="h-4 w-4 text-cta" />
              Ce que les chiffres sous chaque réponse veulent dire
            </h2>
            <dl className="grid gap-2.5 text-[13px] sm:grid-cols-3">
              <div className="flex flex-col gap-0.5">
                <dt className="font-medium text-[#1A1A1A]">La confiance</dt>
                <dd className="text-[#5A5A5A]">
                  En dessous de 75 %, l'agent ne répond pas seul : il transmet.
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="font-medium text-[#1A1A1A]">L'escalade</dt>
                <dd className="text-[#5A5A5A]">
                  Demande d'humain, litige, ou information qu'il ne peut pas prouver.
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="font-medium text-[#1A1A1A]">Le numéro de commande</dt>
                <dd className="text-[#5A5A5A]">
                  Aucune boutique n'est connectée ici, donc il demande — il n'invente pas.
                </dd>
              </div>
            </dl>
          </section>

          {/* ── Suite ── */}
          <section className="flex flex-col items-start gap-3 border-t border-[#E6E8EC] pt-6">
            <p className="max-w-xl text-[15px] leading-relaxed text-[#5A5A5A]">
              Branché sur votre Shopify, le même agent lit vos vraies commandes, votre suivi
              transporteur et vos propres règles de retour. La mise en route prend une après-midi.
            </p>
            <button
              onClick={() => onNavigate && onNavigate('/signup')}
              className="inline-flex items-center gap-2 rounded-full bg-[#1A1A1A] px-5 py-2.5 text-[14px] font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta/40"
            >
              Créer mon agent gratuitement
              <ArrowRight className="h-4 w-4" />
            </button>
            <p className="text-[12px] text-[#A8A296]">
              Sans carte bancaire · 50 tickets par mois offerts
            </p>
          </section>

        </div>
      </main>
    </>
  )
}

export default DemoAgentPage
