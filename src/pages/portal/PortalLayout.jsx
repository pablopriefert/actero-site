import { usePortalClient } from '../../hooks/usePortalClient.js';
import { usePortalAuth } from '../../hooks/usePortalAuth.js';

export default function PortalLayout({ children, navigate }) {
  const { client, loading, error } = usePortalClient();
  const { authed, email, logout } = usePortalAuth();

  if (loading) return <div className="p-10 text-center">Chargement…</div>;
  if (error || !client) return <div className="p-10 text-center text-red-600">Ce portail n'est pas disponible.</div>;

  const merchantName = client.branding.displayName;

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="flex items-center justify-between px-6 py-4 border-b bg-white">
        <div className="flex items-baseline gap-3">
          <span className="text-xl font-bold tracking-tight">Actero</span>
          <span className="text-sm text-neutral-500">·</span>
          <span className="text-sm text-neutral-600">Espace SAV · <span className="text-neutral-900 font-medium">{merchantName}</span></span>
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
          <button onClick={() => navigate('/portal/tickets')} className="text-neutral-700 hover:text-black font-medium">Conversations</button>
          <button onClick={() => navigate('/portal/orders')} className="text-neutral-700 hover:text-black font-medium">Commandes</button>
        </nav>
      )}
      <main className="p-6 max-w-4xl mx-auto">{children}</main>
      <footer className="text-center py-6 text-xs text-neutral-400">
        Propulsé par <a href="https://actero.fr" className="text-neutral-500 hover:text-neutral-700">Actero</a>
      </footer>
    </div>
  );
}
