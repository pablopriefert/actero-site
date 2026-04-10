import React, { useState } from 'react'
import { Linkedin, Twitter, Youtube, Mail, ArrowRight } from 'lucide-react'
import { Logo } from './Logo'

export const Footer = ({ onNavigate }) => {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (email && email.includes('@')) {
      setSubscribed(true);
      setEmail('');
      setTimeout(() => setSubscribed(false), 4000);
    }
  };

  const columns = [
    {
      title: 'Produit',
      links: [
        { label: 'Fonctionnalités', path: '/#comment-ca-marche' },
        { label: 'Tarifs', path: '/tarifs' },
        { label: 'Playbooks', path: '/guide-support' },
        { label: 'Intégrations', path: '/#comment-ca-marche' },
        { label: 'Demo', path: '/audit' },
      ],
    },
    {
      title: 'Entreprise',
      links: [
        { label: 'À propos', path: '/entreprise' },
        { label: 'Contact', path: '/audit' },
        { label: 'Blog', path: '/guide-support' },
        { label: 'Carrières', path: '/entreprise' },
      ],
    },
    {
      title: 'Ressources',
      links: [
        { label: 'Documentation', path: '/guide-support' },
        { label: 'Guides', path: '/guide-support' },
        { label: 'FAQ', path: '/faq' },
        { label: 'Support', path: '/support' },
      ],
    },
    {
      title: 'Légal',
      links: [
        { label: 'Mentions légales', path: '/mentions-legales' },
        { label: 'CGU', path: '/utilisation' },
        { label: 'Politique de confidentialité', path: '/confidentialite' },
        { label: 'RGPD', path: '/confidentialite' },
      ],
    },
  ];

  const handleNavigate = (path) => {
    if (path.startsWith('/#')) {
      const hash = path.substring(2);
      if (window.location.pathname === '/') {
        const el = document.getElementById(hash);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      } else {
        onNavigate('/');
        setTimeout(() => {
          const el = document.getElementById(hash);
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }, 150);
      }
    } else {
      onNavigate(path);
    }
  };

  return (
    <footer className="bg-[#F9F7F1] border-t border-gray-200 pt-16 pb-10 px-6 relative z-10 w-full mt-auto">
      <div className="max-w-6xl mx-auto">
        {/* Top — Newsletter + Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 pb-12 border-b border-gray-200">
          {/* Newsletter (left) */}
          <div className="lg:col-span-4">
            <div className="flex items-center gap-2 mb-4">
              <Logo className="w-6 h-6 text-[#262626]" />
              <span className="font-bold tracking-tight text-[#262626] text-lg">
                Actero
              </span>
            </div>
            <p className="text-sm font-semibold text-[#262626] mb-2">
              Recevez nos meilleurs conseils e-commerce
            </p>
            <p className="text-xs text-[#716D5C] mb-4 leading-relaxed">
              Un email par semaine. Playbooks IA, benchmarks, cas clients. Zéro spam.
            </p>
            <form onSubmit={handleSubscribe} className="flex items-center gap-2">
              <div className="relative flex-1">
                <Mail className="w-4 h-4 text-[#716D5C] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vous@entreprise.com"
                  className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-full text-sm text-[#262626] placeholder:text-[#716D5C]/60 focus:outline-none focus:border-[#0F5F35] transition-colors"
                />
              </div>
              <button
                type="submit"
                className="flex items-center justify-center w-10 h-10 rounded-full bg-[#0F5F35] text-white hover:bg-[#003725] transition-colors shrink-0"
                aria-label="S'inscrire"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
            {subscribed && (
              <p className="text-xs font-semibold text-[#0F5F35] mt-2">
                Merci ! On vous écrit très vite.
              </p>
            )}

            {/* Powered by strip */}
            <div className="flex items-center gap-4 mt-6">
              <a
                href="https://elevenlabs.io/startup-grants"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 opacity-70 hover:opacity-100 transition-opacity"
              >
                <span className="text-[10px] font-semibold text-[#716D5C] uppercase tracking-widest">Powered by</span>
                <img
                  src="/elevenlabs-grants.webp"
                  alt="ElevenLabs Startup Grants"
                  className="h-4 w-auto grayscale"
                />
              </a>
              <span className="text-gray-300">|</span>
              <a
                href="https://www.shopify.com/partners"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center opacity-70 hover:opacity-100 transition-opacity"
              >
                <img
                  src="/shopify-partners.svg"
                  alt="Shopify Partners"
                  className="h-5 w-auto grayscale"
                />
              </a>
            </div>
          </div>

          {/* 4 columns */}
          <div className="lg:col-span-8 grid grid-cols-2 md:grid-cols-4 gap-8">
            {columns.map((col) => (
              <div key={col.title}>
                <h4 className="text-xs font-bold uppercase tracking-widest text-[#262626] mb-4">
                  {col.title}
                </h4>
                <ul className="space-y-3">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <button
                        onClick={() => handleNavigate(link.path)}
                        className="text-sm text-[#716D5C] hover:text-[#0F5F35] transition-colors text-left"
                      >
                        {link.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom — Copyright + Socials */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-8">
          <p className="text-xs font-semibold text-[#716D5C]">
            © 2026 Actero. Tous droits réservés.
          </p>

          <div className="flex items-center gap-3">
            <a
              href="https://www.linkedin.com/company/actero"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn"
              className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center text-[#716D5C] hover:text-[#0F5F35] hover:border-[#0F5F35] transition-colors"
            >
              <Linkedin className="w-4 h-4" />
            </a>
            <a
              href="https://twitter.com/actero"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Twitter / X"
              className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center text-[#716D5C] hover:text-[#0F5F35] hover:border-[#0F5F35] transition-colors"
            >
              <Twitter className="w-4 h-4" />
            </a>
            <a
              href="https://youtube.com/@actero"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="YouTube"
              className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center text-[#716D5C] hover:text-[#0F5F35] hover:border-[#0F5F35] transition-colors"
            >
              <Youtube className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
