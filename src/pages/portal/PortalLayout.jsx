import { usePortalClient } from '../../hooks/usePortalClient.js';
import { usePortalTheme } from '../../hooks/usePortalTheme.js';
import { usePortalAuth } from '../../hooks/usePortalAuth.js';

export default function PortalLayout({ children, navigate }) {
  const { client, loading, error } = usePortalClient();
  const { authed, email, logout } = usePortalAuth();
  usePortalTheme(client?.branding);

  if (loading) return <div className="p-10 text-center">Chargement…</div>;
  if (error || !client) return <div className="p-10 text-center text-red-600">Ce portail n'est pas disponible.</div>;

  const b = client.branding;
  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="flex items-center justify-between px-6 py-4 border-b bg-white">
        <div className="flex items-center gap-3">
          {b.logoUrl && <img src={b.logoUrl} alt={b.displayName} className="h-8" />}
          <span className="font-medium">{b.displayName} · Mon espace SAV</span>
        </div>
        {authed && (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-neutral-600">{email}</span>
            <button onClick={logout} className="text-neutral-500 hover:text-neutral-900">Déconnexion</button>
          </div>
        )}
      </header>
      {authed && (
        <nav className="flex gap-4 px-6 py-3 bg-white border-b text-sm">
          <button onClick={() => navigate('/portal/tickets')}>Conversations</button>
          <button onClick={() => navigate('/portal/orders')}>Commandes</button>
        </nav>
      )}
      <main className="p-6 max-w-4xl mx-auto">{children}</main>
    </div>
  );
}
