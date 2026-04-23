import React from 'react'
import { Globe } from 'lucide-react'
import { Logo } from './Logo'

/**
 * Footer — unified, cream aesthetic, 4-col link structure.
 *
 * Replaces the former dark 5-col inline footer that used to live in
 * LandingPage.jsx, and the previous 1-line footer used on other pages.
 * Now every public page renders this component via <Footer onNavigate={…} />.
 *
 * Design key points :
 *   - Background cream #F9F7F1 (matches rest of the site)
 *   - 4 columns (Produit / Ressources / Entreprise / Légal) + brand column
 *   - All links are real <button onClick={() => onNavigate(path)}> with
 *     focus-visible ring for keyboard users
 *   - Compliance line pinned bottom-center
 *   - Globe lucide icon (no emoji) for the language chip
 */
const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta focus-visible:ring-offset-2 rounded-lg'

export const Footer = ({ onNavigate }) => {
  const columns = [
    {
      title: 'Produit',
      links: [
        { label: 'Fonctionnalités', path: '/fonctionnalites' },
        { label: 'Tarifs', path: '/tarifs' },
        { label: 'Démo', path: '/demo' },
        { label: 'Intégrations', path: '/integrations' },
        { label: 'Roadmap', path: '/roadmap' },
      ],
    },
    {
      title: 'Ressources',
      links: [
        { label: 'Academy', path: '/academy' },
        { label: 'Blog', path: '/blog' },
        { label: 'Prompt Library', path: '/prompt-library' },
        { label: 'Support', path: '/support' },
        { label: 'API Docs', path: '/api-docs' },
      ],
    },
    {
      title: 'Entreprise',
      links: [
        { label: 'À propos', path: '/a-propos' },
        { label: 'Partenaires', path: '/partenaires' },
        { label: 'Ambassadeurs', path: '/ambassadeurs' },
        { label: 'Careers', path: '/careers' },
        { label: 'Contact', path: '/contact' },
      ],
    },
    {
      title: 'Légal',
      links: [
        { label: 'Mentions légales', path: '/mentions-legales' },
        { label: 'Confidentialité', path: '/confidentialite' },
        { label: 'CGU', path: '/cgu' },
        { label: 'DPA', path: '/dpa' },
        { label: 'Sécurité', path: '/securite' },
      ],
    },
  ]

  return (
    <footer className="bg-[#F9F7F1] border-t border-gray-200 py-14 px-6 relative z-10 w-full mt-auto">
      <div className="max-w-6xl mx-auto">
        {/* ── Top grid : brand + 4 link columns ── */}
        <div className="grid grid-cols-2 md:grid-cols-[1.5fr_1fr_1fr_1fr_1fr] gap-8 pb-10 border-b border-gray-200">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3.5">
              <Logo className="w-6 h-6 text-[#262626]" />
              <span className="text-[17px] font-bold text-[#262626]">Actero</span>
            </div>
            <p className="text-[13px] leading-[1.5] text-[#716D5C] m-0 max-w-[280px] mb-5">
              L'agent IA français pour e-commerçants Shopify. Hébergé en France, conforme RGPD,
              opt-out TDM.
            </p>
            <div className="flex items-center gap-4">
              <a
                href="https://elevenlabs.io/startup-grants"
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-2 opacity-70 hover:opacity-100 transition-opacity ${focusRing}`}
              >
                <span className="text-[10px] font-semibold text-[#716D5C] uppercase tracking-widest">
                  Powered by
                </span>
                <img
                  src="/partners/elevenlabs-grants.png"
                  alt="ElevenLabs Startup Grants"
                  className="h-5 w-auto grayscale"
                />
              </a>
              <span className="text-gray-300">|</span>
              <a
                href="https://www.shopify.com/partners"
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center opacity-70 hover:opacity-100 transition-opacity ${focusRing}`}
              >
                <img
                  src="/partners/shopify-partner.png"
                  alt="Shopify Partners"
                  className="h-6 w-auto grayscale"
                />
              </a>
            </div>
          </div>

          {/* Link columns */}
          {columns.map((col) => (
            <div key={col.title}>
              <div className="text-[11px] font-bold text-[#262626] uppercase tracking-[0.12em] mb-3.5">
                {col.title}
              </div>
              <ul className="space-y-2 list-none p-0 m-0">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <button
                      onClick={() => onNavigate(l.path)}
                      className={`text-[13px] text-[#716D5C] hover:text-[#262626] transition-colors cursor-pointer bg-transparent border-none p-0 text-left ${focusRing}`}
                    >
                      {l.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* ── Bottom row : copyright + lang + status ── */}
        <div className="flex flex-col md:flex-row justify-between gap-4 pt-6 text-[12px] text-[#716D5C]">
          <div>© {new Date().getFullYear()} Actero SAS · Paris, France · Made with care</div>
          <div className="flex flex-wrap items-center gap-5">
            <span className="inline-flex items-center gap-1.5">
              <Globe className="w-4 h-4" strokeWidth={1.8} />
              Français
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
              Système opérationnel
            </span>
          </div>
        </div>

        {/* ── Compliance line ── */}
        <div className="mt-6 pt-6 border-t border-gray-200 text-center">
          <p className="text-[11px] text-[#9ca3af] font-medium">
            Conforme RGPD · Données hébergées en Europe · Chiffrement AES-256
          </p>
        </div>
      </div>
    </footer>
  )
}
