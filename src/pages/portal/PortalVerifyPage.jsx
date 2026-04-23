import { useEffect, useState } from 'react';
import { Loader2, Clock, AlertCircle } from 'lucide-react';
import { usePortalClient } from '../../hooks/usePortalClient.js';
import { usePortalTone } from '../../hooks/usePortalTone.js';
import { applyTone } from '../../lib/portal-tone.js';

export default function PortalVerifyPage({ navigate }) {
  const { client } = usePortalClient();
  const tone = usePortalTone();
  const [state, setState] = useState('verifying');

  useEffect(() => {
    if (!client) return;
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) { setState('error'); return; }
    fetch('/api/portal/verify-token', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token, clientId: client.clientId }),
    }).then((r) => {
      if (r.ok) { setState('ok'); navigate('/portal/tickets'); }
      else setState('expired');
    }).catch(() => setState('error'));
  }, [client, navigate]);

  // Auto-redirect on expired state after 4s
  useEffect(() => {
    if (state !== 'expired') return;
    const t = setTimeout(() => {
      navigate('/portal/login');
    }, 4000);
    return () => clearTimeout(t);
  }, [state, navigate]);

  if (state === 'ok') return null;

  const config = {
    verifying: {
      Icon: Loader2,
      iconClass: 'text-[#1F3A12] animate-spin',
      tint: 'bg-[#E8F5EC] ring-[#A8C490]',
      title: 'Connexion en cours…',
      description: applyTone(
        'On vérifie ton lien magique. Ça ne prend qu\'un instant.',
        'Nous vérifions votre lien magique. Ça ne prend qu\'un instant.',
        tone,
      ),
      cta: null,
    },
    expired: {
      Icon: Clock,
      iconClass: 'text-[#B45309]',
      tint: 'bg-[#FEF3C7] ring-[#F59E0B]/30',
      title: 'Lien expiré',
      description: applyTone(
        'Ce lien de connexion n\'est plus valide. On te redirige vers la page de connexion…',
        'Ce lien de connexion n\'est plus valide. Nous vous redirigeons vers la page de connexion…',
        tone,
      ),
      cta: {
        label: 'Recevoir un nouveau lien',
        onClick: () => navigate('/portal/login'),
      },
    },
    error: {
      Icon: AlertCircle,
      iconClass: 'text-[#DC2626]',
      tint: 'bg-[#FEE2E2] ring-[#FCA5A5]',
      title: 'Impossible de te connecter',
      description: applyTone(
        'Une erreur est survenue. Réessaye avec un nouveau lien.',
        'Une erreur est survenue. Réessayez avec un nouveau lien.',
        tone,
      ),
      cta: {
        label: 'Recevoir un nouveau lien',
        onClick: () => navigate('/portal/login'),
      },
    },
  }[state];

  const { Icon, iconClass, tint, title, description, cta } = config;

  return (
    <div
      role="status"
      aria-live="polite"
      className="max-w-md mx-auto mt-20 p-10 bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.06)] text-center"
    >
      <div className={`mx-auto w-14 h-14 rounded-2xl flex items-center justify-center mb-5 ring-1 ${tint}`}>
        <Icon className={`w-6 h-6 ${iconClass}`} aria-hidden="true" />
      </div>
      <h1
        style={{ fontFamily: "'Instrument Serif', Georgia, serif", letterSpacing: '-0.3px' }}
        className="text-2xl font-bold text-[#1A1A1A] mb-2"
      >
        {title}
      </h1>
      <p className="text-[#5A5A5A] leading-relaxed text-sm">{description}</p>
      {cta && (
        <button
          onClick={cta.onClick}
          className="mt-6 inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-[#1F3A12] hover:bg-[#162C0D] text-white text-sm font-medium transition"
        >
          {cta.label}
        </button>
      )}
    </div>
  );
}
