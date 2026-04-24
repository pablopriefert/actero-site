import React from 'react'
import { Shield } from 'lucide-react'

/**
 * PartnersMarquee — défilement horizontal infini des badges partenaires.
 *
 * Les 4 logos sont normalisés en 1920×500 (même canvas), donc on peut
 * leur appliquer la même hauteur sans recalage custom. Container fixe
 * 200×56px par item pour rythme visuel constant.
 *
 * Anim CSS pure 20s linear infinite, items dupliqués 3× dans le DOM pour
 * loop seamless (la keyframe avance de -100%/3 = exactement une copie
 * complète des items, donc frame 0 == frame 20s). Respecte
 * prefers-reduced-motion. Pas de pause au hover — le défilement doit
 * rester continu, même si le curseur survole la bande (demande user).
 */
/**
 * Heights custom par logo selon leur aspect ratio — compense la
 * différence de largeur pour que chaque logo ait une surface visuelle
 * équivalente (~3 800-4 200 px²).
 * mH = mobile height, dH = desktop height (en px).
 *
 *   aspect ratio   | dH  | width auto @ dH
 *   -------------- | --- | ---------------
 *   auth0    2.2:1 | 42  | ~92px   (surface 3864)
 *   eleven   3.84  | 32  | ~123px  (surface 3936)
 *   google   8.3   | 22  | ~183px  (surface 4026)
 *   shopify  6.2   | 26  | ~161px  (surface 4186)
 */
const partners = [
  {
    name: 'ElevenLabs Grants',
    src: '/partners/v2/elevenlabs-grants.png',
    href: 'https://elevenlabs.io/startup-grants',
    mH: 28, dH: 38,
  },
  {
    name: 'Shopify Partner',
    src: '/partners/v2/shopify-partner.png',
    href: 'https://www.shopify.com/partners',
    mH: 22, dH: 26,
  },
  {
    name: 'Google for Startups',
    src: '/partners/v2/google-for-startups.png',
    href: 'https://startup.google.com/',
    mH: 18, dH: 22,
  },
  {
    name: 'Auth0 for Startups',
    src: '/partners/v2/auth0-startup.png',
    href: 'https://auth0.com/startups',
    mH: 34, dH: 42,
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
                  style={{ '--mH': `${partner.mH}px`, '--dH': `${partner.dH}px` }}
                  className="partners-marquee-img w-auto object-contain opacity-80 hover:opacity-100 transition-opacity duration-300"
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
          /* Gap fixe entre items = espacement uniforme peu importe la
             largeur naturelle de chaque logo. */
          gap: 5rem; /* 80px mobile */
          animation: partners-scroll 20s linear infinite;
          will-change: transform;
        }
        /* TASK 6: pause on hover for smooth interactivity */
        .partners-marquee-wrap:hover .partners-marquee-track {
          animation-play-state: paused;
        }
        @media (min-width: 768px) {
          .partners-marquee-track {
            gap: 7rem; /* 112px desktop — plus d'air */
          }
        }
        /* Item = largeur naturelle du logo, height du container = plafond
           généreux pour centrer les logos verticalement même quand ils sont
           plus courts (type Google for Startups @ 22px) */
        .partners-marquee-item {
          flex: 0 0 auto;
          height: 48px;
          display: flex;
          align-items: center;
        }
        @media (min-width: 768px) {
          .partners-marquee-item {
            height: 56px;
          }
        }
        /* Image height custom par logo via CSS vars inline pour
           normaliser la surface visuelle (wide logos plus courts,
           narrow logos plus grands) */
        .partners-marquee-img {
          height: var(--mH);
        }
        @media (min-width: 768px) {
          .partners-marquee-img {
            height: var(--dH);
          }
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
