import React from 'react'
import { Shield } from 'lucide-react'

/**
 * PartnersMarquee — défilement horizontal infini des badges partenaires.
 *
 * Défile lentement en continu (40s par cycle), pause au hover pour
 * permettre la lecture. Les logos sont dupliqués dans le DOM pour
 * que l'animation boucle sans saut visuel (pattern standard marquee).
 *
 * Hauteur des logos harmonisée à ~40px pour cohérence visuelle,
 * avec un filtre grayscale subtil qui revient à la couleur au hover
 * pour garder le look discret de trust bar (vs promo agressive).
 *
 * Animation en CSS pur (no JS scroll) — 60fps garanti, respecte
 * prefers-reduced-motion via media query.
 */
const partners = [
  { name: 'ElevenLabs Grants', src: '/partners/elevenlabs-grants.webp', href: 'https://elevenlabs.io/startup-grants' },
  { name: 'Shopify Partner', src: '/partners/shopify-partner.png', href: 'https://www.shopify.com/partners' },
  { name: 'Google for Startups', src: '/partners/google-for-startups.png', href: 'https://startup.google.com/' },
  { name: 'Auth0 Startup', src: '/partners/auth0-startup.jpg', href: 'https://auth0.com/startups' },
]

export function PartnersMarquee() {
  // Duplique 3× pour un loop visuellement infini (3× > cycle duration / item width)
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
                  className="h-8 md:h-10 w-auto opacity-70 hover:opacity-100 transition-opacity duration-300"
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

      {/* Marquee styles — scoped via unique classnames */}
      <style>{`
        .partners-marquee-wrap {
          overflow: hidden;
          position: relative;
          mask-image: linear-gradient(
            90deg,
            transparent 0,
            #000 64px,
            #000 calc(100% - 64px),
            transparent 100%
          );
          -webkit-mask-image: linear-gradient(
            90deg,
            transparent 0,
            #000 64px,
            #000 calc(100% - 64px),
            transparent 100%
          );
        }
        .partners-marquee-track {
          display: flex;
          align-items: center;
          gap: 4rem;
          width: fit-content;
          animation: partners-scroll 40s linear infinite;
        }
        .partners-marquee-wrap:hover .partners-marquee-track {
          animation-play-state: paused;
        }
        .partners-marquee-item {
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 120px;
          padding: 0 0.5rem;
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
          }
        }
      `}</style>
    </section>
  )
}
