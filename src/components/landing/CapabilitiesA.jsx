import React from 'react'
import { CheckCircle2, MessageSquare, ShoppingCart, Workflow } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { FadeInUp } from '../ui/scroll-animations'

/**
 * CapabilitiesA — 3 piliers (variation A).
 *
 * Actero ne fait PAS que du SAV. Le produit adresse 3 piliers à parts
 * égales :
 *   1. Agent SAV (tickets, retours, questions produit)
 *   2. Relance paniers abandonnés (agent proactif)
 *   3. Automatisations & workflows e-commerce
 *
 * Design :
 * — Background cream #F9F7F1
 * — 3 cards blanc rounded-[20px], grid 3 cols desktop
 * — Icon container cream square #F4F0E6 avec Lucide icon
 * — Badge « Dès Free » en pill cta/10
 * — Highlight footer avec check icon + border-t (1 metric par pilier)
 * — Task 3 : stagger reveal (80ms between cards) + hover lift -4px
 *   + icon scale+rotate on hover + metric scale on hover
 */
export const CapabilitiesA = () => {
  const serif = { fontFamily: 'var(--font-display, "Instrument Serif", Georgia, serif)' }
  const prefersReducedMotion = useReducedMotion()

  const caps = [
    {
      badge: 'Dès Free',
      Icon: MessageSquare,
      title: 'Agent SAV',
      desc:
        "Répond automatiquement aux tickets, retours, changements d'adresse et questions produit sur email, chat, Gorgias, Zendesk et WhatsApp — avec le ton de votre marque.",
      highlight: '60% de tickets résolus sans humain',
      highlightMarker: '*',
    },
    {
      badge: 'Dès Free',
      Icon: ShoppingCart,
      title: 'Relance paniers abandonnés',
      desc:
        "Un agent proactif qui relance chaque client avec un message personnalisé (produit, remise conditionnelle, lien checkout) — pas une séquence email générique.",
      highlight: '+15% de CA récupéré en moyenne',
      highlightMarker: '*',
    },
    {
      badge: 'Dès Starter',
      Icon: Workflow,
      title: 'Automatisations & workflows',
      desc:
        "Routage intelligent, escalades conditionnelles, suivis post-achat, recommandations produits. 10+ playbooks e-commerce prêts à l'emploi, personnalisables sans code.",
      highlight: '10+ playbooks e-commerce prêts à brancher',
      highlightMarker: '',
    },
  ]

  /* Stagger parent variants — 80ms between children */
  const containerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: prefersReducedMotion ? 0 : 0.08,
      },
    },
  }

  /* Each card fades up */
  const cardVariants = {
    hidden: prefersReducedMotion
      ? { opacity: 1, y: 0 }
      : { opacity: 0, y: 24 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
    },
  }

  return (
    <section className="py-24 md:py-32 bg-[#F9F7F1] px-6">
      <div className="max-w-6xl mx-auto">
        <FadeInUp className="text-center mb-16">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] mb-3.5 text-cta">
            3 piliers · 1 agent
          </p>
          <h2
            className="font-normal leading-[1.05] text-[#1A1A1A] mb-4"
            style={{ ...serif, fontSize: 'clamp(36px, 5vw, 56px)', letterSpacing: '-0.02em' }}
          >
            Tout ce qui consomme votre équipe<br className="hidden md:block" />
            <span className="italic text-[#716D5C]">tourne maintenant tout seul.</span>
          </h2>
          <p className="text-[17px] text-[#5A5A5A] max-w-xl mx-auto leading-[1.5]">
            SAV, relance paniers, automatisations : les 3 moteurs Actero, mesurés en temps réel
            dans votre dashboard.
          </p>
        </FadeInUp>

        {/* TASK 3: stagger container */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-5"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
        >
          {caps.map((c, i) => {
            const Icon = c.Icon
            return (
              <motion.div
                key={i}
                variants={cardVariants}
                whileHover={
                  prefersReducedMotion
                    ? {}
                    : {
                        y: -4,
                        boxShadow: '0 14px 40px -10px rgba(0,55,37,0.14)',
                        transition: { duration: 0.25, ease: 'easeOut' },
                      }
                }
                className="bg-white rounded-[20px] p-8 border border-black/[0.05] h-full flex flex-col group cursor-default"
              >
                <div className="flex items-center gap-3 mb-5">
                  {/* TASK 3: icon scale + rotate on card hover */}
                  <motion.div
                    className="w-10 h-10 rounded-lg bg-[#F4F0E6] flex items-center justify-center"
                    whileHover={
                      prefersReducedMotion
                        ? {}
                        : { scale: 1.1, rotate: 3, transition: { duration: 0.2, ease: 'easeOut' } }
                    }
                  >
                    <Icon className="w-5 h-5 text-[#003725]" strokeWidth={1.8} />
                  </motion.div>
                  <span className="text-[10px] font-bold text-cta bg-[#E8F5EC] px-2 py-0.5 rounded-full uppercase tracking-[0.1em]">
                    {c.badge}
                  </span>
                </div>
                <h3
                  className="text-[22px] font-bold text-[#1A1A1A] mb-3 leading-[1.15]"
                  style={{ letterSpacing: '-0.01em' }}
                >
                  {c.title}
                </h3>
                <p className="text-[14.5px] text-[#5A5A5A] leading-[1.6] mb-6 flex-1">{c.desc}</p>
                <div className="flex items-center gap-2 pt-5 border-t border-black/[0.06]">
                  <CheckCircle2 className="w-4 h-4 text-cta flex-shrink-0" />
                  {/* TASK 3: metric scale on hover */}
                  <motion.span
                    className="text-[13.5px] font-semibold text-[#003725]"
                    whileHover={
                      prefersReducedMotion
                        ? {}
                        : { scale: 1.05, transition: { duration: 0.2, ease: 'easeOut' } }
                    }
                    style={{ display: 'inline-block' }}
                  >
                    {c.highlight}
                    {c.highlightMarker && (
                      <sup className="ml-0.5 text-[#716D5C] font-medium">{c.highlightMarker}</sup>
                    )}
                  </motion.span>
                </div>
              </motion.div>
            )
          })}
        </motion.div>
        <p className="mt-5 text-[11px] italic text-[#716D5C] text-center leading-[1.4]">
          * Objectifs produit, benchmark pilote
        </p>
      </div>
    </section>
  )
}
