import React from 'react'
import {
  Check,
  MessageSquare,
  ShoppingCart,
  Eye,
  Zap,
  Tag,
  Clock,
  BarChart3,
  ArrowRight,
} from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { FadeInUp } from '../ui/scroll-animations'
import { Logo } from '../layout/Logo'

const serif = { fontFamily: 'var(--font-display, "Instrument Serif", Georgia, serif)' }

/**
 * Spotlight — layout partagé pour une section "feature" en split :
 * une colonne texte (eyebrow + titre serif + description + liste de features
 * + métrique) et une colonne média (mockup visuel). `reversed` inverse
 * l'ordre des colonnes en desktop pour alterner le rythme.
 */
function Spotlight({ eyebrow, badge, Icon, title, titleAccent, desc, features, metric, media, reversed, bg }) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <section className={`py-24 md:py-32 px-6 ${bg}`}>
      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 md:gap-20 items-center">
        {/* Texte */}
        <FadeInUp className={reversed ? 'md:order-2' : ''}>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-[#E8F5EC] flex items-center justify-center">
              <Icon className="w-5 h-5 text-[#003725]" strokeWidth={1.9} />
            </div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-cta">{eyebrow}</p>
          </div>

          <h2
            className="font-normal leading-[1.06] text-[#1A1A1A] mb-4"
            style={{ ...serif, fontSize: 'clamp(32px, 4.2vw, 50px)', letterSpacing: '-0.02em' }}
          >
            {title}
            <br />
            <span className="italic text-[#8B7A50]">{titleAccent}</span>
          </h2>

          <p className="text-[16.5px] text-[#5A5A5A] leading-[1.6] mb-7 max-w-lg">{desc}</p>

          <ul className="space-y-3.5 mb-8">
            {features.map((f, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-0.5 w-5 h-5 rounded-full bg-[#E8F5EC] flex items-center justify-center flex-shrink-0">
                  <Check className="w-3 h-3 text-cta" strokeWidth={3} />
                </span>
                <span className="text-[15px] text-[#3A3A3A] leading-[1.5]">{f}</span>
              </li>
            ))}
          </ul>

          <div className="inline-flex items-center gap-2.5 rounded-full bg-[#003725] text-white pl-3 pr-4 py-2">
            <BarChart3 className="w-4 h-4 text-[#A8C490]" strokeWidth={2} />
            <span className="text-[14px] font-semibold">
              {metric}
              <sup className="ml-0.5 text-[#A8C490] font-medium">*</sup>
            </span>
          </div>
          {badge && (
            <p className="mt-4 text-[12.5px] font-semibold text-cta">
              Inclus {badge}
            </p>
          )}
          <p className="mt-2 text-[11px] italic text-[#9CA3AF]">
            * Objectifs produit, benchmark pilote
          </p>
        </FadeInUp>

        {/* Média */}
        <motion.div
          className={reversed ? 'md:order-1' : ''}
          initial={prefersReducedMotion ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          {media}
        </motion.div>
      </div>
    </section>
  )
}

/* ─────────────────────── Média : conversation SAV ─────────────────────── */
function SavMedia() {
  const channels = ['Email', 'Live chat', 'Gorgias', 'Zendesk']
  return (
    <div
      className="rounded-3xl bg-white border border-black/[0.06] overflow-hidden"
      style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 30px 60px -25px rgba(0,55,37,0.18)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.05]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#003725] flex items-center justify-center">
            <Logo className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-[14px] font-semibold text-[#1A1A1A] leading-tight">
              Assistant Actero
            </div>
            <div className="flex items-center gap-1.5 text-[11.5px] text-[#716D5C]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
              En ligne
            </div>
          </div>
        </div>
        <span className="text-[11px] font-bold text-cta bg-[#E8F5EC] px-2.5 py-1 rounded-full">
          Résolu · 8s
        </span>
      </div>

      {/* Conversation */}
      <div className="bg-[#FBFAF7] px-5 py-6 space-y-4">
        <div className="flex justify-end">
          <div className="max-w-[80%] bg-white border border-black/[0.05] text-[#1A1A1A] text-[13.5px] leading-[1.5] rounded-2xl rounded-br-md px-4 py-2.5 shadow-sm">
            Bonjour, je voudrais changer l'adresse de livraison de ma commande #10842 📦
          </div>
        </div>
        <div className="flex items-end gap-2">
          <div className="w-6 h-6 rounded-lg bg-[#E8F5EC] flex items-center justify-center flex-shrink-0">
            <Logo className="w-3 h-3 text-[#003725]" />
          </div>
          <div className="max-w-[82%] bg-[#003725] text-white text-[13.5px] leading-[1.55] rounded-2xl rounded-bl-md px-4 py-2.5">
            C'est fait ✅ J'ai mis à jour l'adresse de la commande #10842. Votre colis part
            demain — vous recevrez le lien de suivi par email.
          </div>
        </div>
      </div>

      {/* Channels footer */}
      <div className="px-5 py-4 border-t border-black/[0.05] flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-[#9CA3AF] font-medium mr-1">Répond sur</span>
        {channels.map((c) => (
          <span
            key={c}
            className="text-[11.5px] font-semibold text-[#3A3A3A] bg-[#F4F0E6] border border-[#EFE7D6] px-2.5 py-1 rounded-full"
          >
            {c}
          </span>
        ))}
      </div>
    </div>
  )
}

/* ──────────────────── Média : relance panier abandonné ─────────────────── */
function CartMedia() {
  return (
    <div
      className="rounded-3xl bg-white border border-black/[0.06] overflow-hidden"
      style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 30px 60px -25px rgba(0,55,37,0.18)' }}
    >
      {/* Header — trigger */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.05]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#FEF3C7] flex items-center justify-center">
            <ShoppingCart className="w-4 h-4 text-[#B45309]" strokeWidth={2} />
          </div>
          <span className="text-[13.5px] font-semibold text-[#1A1A1A]">Panier abandonné détecté</span>
        </div>
        <span className="text-[11.5px] text-[#716D5C]">il y a 22 min</span>
      </div>

      {/* Product row */}
      <div className="px-5 py-4 flex items-center gap-3 border-b border-black/[0.05]">
        <div
          className="w-12 h-12 rounded-xl flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #8B7A50 0%, #C9B98F 100%)' }}
        />
        <div className="flex-1">
          <div className="text-[13.5px] font-semibold text-[#1A1A1A]">Sac cabas cuir · Camel</div>
          <div className="text-[12px] text-[#716D5C]">Quantité 1 · abandonné au checkout</div>
        </div>
        <div className="text-[15px] font-bold text-[#1A1A1A] tabular-nums">129 €</div>
      </div>

      {/* Agent-composed message */}
      <div className="bg-[#FBFAF7] px-5 py-5">
        <div className="flex items-center gap-2 mb-2.5">
          <div className="w-6 h-6 rounded-lg bg-[#E8F5EC] flex items-center justify-center">
            <Logo className="w-3 h-3 text-[#003725]" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-cta">
            Message personnalisé
          </span>
        </div>
        <div className="bg-white border border-black/[0.05] rounded-2xl px-4 py-3 text-[13.5px] leading-[1.55] text-[#1A1A1A] shadow-sm">
          Bonjour Marie 👋 Votre <b>sac cabas Camel</b> vous attend toujours. Voici{' '}
          <b className="text-cta">−10 %</b> valable 24h pour finaliser votre commande.
        </div>
        <div className="flex items-center gap-2 mt-3">
          <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-white bg-[#003725] px-3.5 py-2 rounded-full">
            Finaliser ma commande
            <ArrowRight className="w-3 h-3" />
          </span>
          <span className="inline-flex items-center gap-1 text-[12px] font-bold text-cta bg-[#E8F5EC] px-2.5 py-1.5 rounded-full">
            <Tag className="w-3 h-3" strokeWidth={2.4} />
            −10 %
          </span>
        </div>
      </div>

      {/* Footer — channels */}
      <div className="px-5 py-3.5 border-t border-black/[0.05] flex items-center gap-2 text-[11.5px] text-[#716D5C]">
        <Zap className="w-3.5 h-3.5 text-cta" strokeWidth={2.2} />
        Relance envoyée automatiquement · Email + SMS
      </div>
    </div>
  )
}

/* ───────────────────────────── Sections ───────────────────────────── */
export const SavSpotlight = () => (
  <Spotlight
    bg="bg-[#F9F7F1]"
    eyebrow="Agent SAV"
    Icon={MessageSquare}
    badge="dès le plan Free"
    title="Chaque ticket traité,"
    titleAccent="dans le ton de votre marque."
    desc="Un agent qui lit votre catalogue et vos politiques, comprend la demande, et répond — ou agit — comme le ferait votre meilleur agent support. 24h/24, en quelques secondes."
    features={[
      'Multi-canal natif : email, live chat, Gorgias & Zendesk',
      'Retours, échanges, suivi de commande, questions produit',
      'Comprend les photos envoyées par vos clients (Claude Vision)',
      'Écrit avec le ton exact de votre marque',
      "Escalade vers un humain quand c'est vraiment nécessaire",
    ]}
    metric="50 à 70% des tickets résolus sans humain"
    media={<SavMedia />}
  />
)

export const CartSpotlight = () => (
  <Spotlight
    bg="bg-white"
    reversed
    eyebrow="Relance paniers"
    Icon={ShoppingCart}
    badge="dès le plan Free"
    title="Chaque panier abandonné,"
    titleAccent="relancé personnellement."
    desc="Pas une séquence email générique. Un agent proactif qui compose, pour chaque client, un message unique — bon produit, bonne offre, bon moment — et relance sur le bon canal."
    features={[
      'Message 1:1 : produit précis, remise conditionnelle, lien checkout',
      'Timing intelligent selon le comportement d’achat',
      'Remises conditionnelles pour protéger votre marge',
      'Relance multi-canal : email + SMS',
      'CA récupéré suivi en temps réel dans votre dashboard',
    ]}
    metric="+15% de CA panier récupéré en moyenne"
    media={<CartMedia />}
  />
)
