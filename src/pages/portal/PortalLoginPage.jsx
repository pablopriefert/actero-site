import { useState } from 'react';
import { usePortalClient } from '../../hooks/usePortalClient.js';

export default function PortalLoginPage() {
  const { client } = usePortalClient();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    if (!client) return;
    setBusy(true); setError(null);
    try {
      const r = await fetch('/api/portal/magic-link', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clientId: client.clientId, slug: client.slug, email }),
      });
      if (r.status === 429) throw new Error('Trop de demandes. Réessaye dans 15 minutes.');
      if (!r.ok) throw new Error('Erreur. Réessaye.');
      setSent(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="max-w-md mx-auto mt-20 p-8 bg-white rounded-xl shadow-sm text-center">
        <h1 className="text-xl font-semibold mb-2">Vérifie ta boîte mail</h1>
        <p className="text-neutral-600">On t'a envoyé un lien de connexion à <strong>{email}</strong>. Il expire dans 15 minutes.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="max-w-md mx-auto mt-20 p-8 bg-white rounded-xl shadow-sm">
      <h1 className="text-xl font-semibold mb-4">Accède à ton espace SAV</h1>
      <label className="block text-sm font-medium mb-1">Ton email</label>
      <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
        className="w-full border rounded px-3 py-2 mb-4" placeholder="paul@example.com" />
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      <button type="submit" disabled={busy}
        className="w-full bg-[var(--portal-primary,#0F766E)] text-white rounded py-2 font-medium disabled:opacity-50">
        {busy ? 'Envoi…' : 'Recevoir mon lien de connexion'}
      </button>
    </form>
  );
}
