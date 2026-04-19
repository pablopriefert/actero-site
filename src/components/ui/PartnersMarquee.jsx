import React from 'react'
import { Shield } from 'lucide-react'

/**
 * PartnersMarquee — défilement horizontal infini des badges partenaires.
 *
 * Les 4 logos sont normalisés en 1920×500 (même canvas), donc on peut
 * leur appliquer la même hauteur sans recalage custom. Container fixe
 * 200×56px par item pour rythme visuel constant.
 *
 * Anim CSS pure 40s linear infinite, pause au hover, items dupliqués 3×
 * dans le DOM pour loop seamless. Respecte prefers-reduced-motion.
 */
const partners = [
  {
    name: 'ElevenLabs Grants',
    src: '/partners/elevenlabs-grants.png',
    href: 'https://elevenlabs.io/startup-grants',
  },
  {
    name: 'Shopify Partner',
    src: '/partners/shopify-partner.png',
    href: 'https://www.shopify.com/partners',
  },
  {
    name: 'Google for Startups',
    src: '/partners/google-for-startups.png',
    href: 'https://startup.google.com/',
  },
  {
    name: 'Auth0 for Startups',
    src: '/partners/auth0-startup.png',
    href: 'https://auth0.com/startups',
  },
]

export function PartnersMarquee() {
  // Duplique 3× pour loop visuellement infini
  const items = [...partners, ...partners, ...partners]

  return (
    <section
      className="py-10 bg-white border-b border-gray-100"
      aria-label="Nos partenaires et certifications"
    >
      <div className="max-w-6xl mx-auto px-6">
        {/* Header */}
        <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-[#9ca3af] mb-6">
          Partenaires &amp; certifications
        </p>

        {/* Marquee container */}
        <div className="partners-marquee-wrap">
          <div className="partners-marquee-track">
            {items.map((partner, i) => (
              <a
                key={`${partner.name}-${i}`}
                href={partner.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${partner.name} — voir le programme`}
                className="partners-marquee-item"
              >
                <img
                  src={partner.src}
                  alt={partner.name}
                  loading="lazy"
                  className="h-10 md:h-12 w-auto object-contain opacity-70 hover:opacity-100 transition-opacity duration-300"
                />
              </a>
            ))}
          </div>
        </div>

        {/* Trust mini-footer */}
        <div className="mt-6 flex items-center justify-center gap-2 text-[11px] font-medium text-[#9ca3af]">
          <Shield className="w-3.5 h-3.5" />
          <span>Hébergé en UE · Conforme RGPD · SOC 2 en cours</span>
        </div>
      </div>

      {/* Marquee styles scoped */}
      <style>{`
        .partners-marquee-wrap {
          overflow: hidden;
          position: relative;
          mask-image: linear-gradient(
            90deg,
            transparent 0,
            #000 32px,
            #000 calc(100% - 32px),
            transparent 100%
          );
          -webkit-mask-image: linear-gradient(
            90deg,
            transparent 0,
            #000 32px,
            #000 calc(100% - 32px),
            transparent 100%
          );
        }
        .partners-marquee-track {
          display: flex;
          align-items: center;
          width: fit-content;
          animation: partners-scroll 40s linear infinite;
        }
        .partners-marquee-wrap:hover .partners-marquee-track {
          animation-play-state: paused;
        }
        .partners-marquee-item {
          flex: 0 0 auto;
          width: 220px;
          height: 72px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 1rem;
        }
        @keyframes partners-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(calc(-100% / 3)); }
        }
        @media (prefers-reduced-motion: reduce) {
          .partners-marquee-track {
            animation: none;
            flex-wrap: wrap;
            justify-content: center;
            gap: 1rem;
          }
        }
      `}</style>
    </section>
  )
}
