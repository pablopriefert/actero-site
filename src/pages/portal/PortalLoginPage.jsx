import { useState } from 'react';
import { usePortalClient } from '../../hooks/usePortalClient.js';

export default function PortalLoginPage() {
  const { client } = usePortalClient();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const merchantName = client?.branding?.displayName;

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
      <div className="max-w-md mx-auto mt-20 p-10 bg-white rounded-2xl shadow-sm text-center">
        <h1 className="text-2xl font-bold tracking-tight mb-3">Vérifie ta boîte mail</h1>
        <p className="text-neutral-600 leading-relaxed">On t'a envoyé un lien de connexion à <strong className="text-neutral-900">{email}</strong>. Il expire dans 15 minutes.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="max-w-md mx-auto mt-20 p-10 bg-white rounded-2xl shadow-sm">
      <h1 className="text-2xl font-bold tracking-tight mb-2">Accède à ton espace SAV</h1>
      {merchantName && <p className="text-sm text-neutral-500 mb-6">pour tes commandes chez <span className="text-neutral-900 font-medium">{merchantName}</span></p>}
      <label className="block text-sm font-medium mb-1.5">Ton email</label>
      <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
        className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 mb-4 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-neutral-400" placeholder="paul@example.com" />
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      <button type="submit" disabled={busy}
        style={{ backgroundColor: 'var(--portal-primary, #000)' }}
        className="w-full text-white rounded-lg py-3 font-semibold disabled:opacity-50 hover:opacity-90 transition">
        {busy ? 'Envoi…' : 'Recevoir mon lien de connexion'}
      </button>
    </form>
  );
}
