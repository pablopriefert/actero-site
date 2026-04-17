import { useEffect, useState } from 'react';
import { usePortalClient } from '../../hooks/usePortalClient.js';

export default function PortalVerifyPage({ navigate }) {
  const { client } = usePortalClient();
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

  if (state === 'verifying') return <p>Connexion…</p>;
  if (state === 'expired') return <p>Ce lien a expiré. <a href="/portal/login">Redemande-en un</a>.</p>;
  if (state === 'error') return <p>Erreur inconnue.</p>;
  return null;
}
