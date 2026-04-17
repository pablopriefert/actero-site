import { usePortalClient } from '../../hooks/usePortalClient.js';
import { usePortalAuth } from '../../hooks/usePortalAuth.js';

export default function PortalLayout({ children, navigate }) {
  const { client, loading, error } = usePortalClient();
  const { authed, email, logout } = usePortalAuth();

  if (loading) return <div className="p-10 text-center">Chargement…</div>;
  if (error || !client) return <div className="p-10 text-center text-red-600">Ce portail n'est pas disponible.</div>;

  const isMerchantBranded = client.branding?.source === 'merchant';
  const merchantName = client.merchantName;
  const customName = client.branding?.displayName;
  const customLogo = client.branding?.logoUrl;
  const primaryColor = isMerchantBranded ? (client.branding?.primaryColor || '#1F3A12') : '#1F3A12';

  const headerContent = isMerchantBranded ? (
    <div className="flex items-center gap-3">
      {customLogo ? (
        <img src={customLogo} alt={customName || merchantName} className="h-8 max-w-[180px] object-contain" />
      ) : (
        <span className="text-xl font-bold tracking-tight">{customName || merchantName}</span>
      )}
      <span className="text-sm text-[#8B8070]">·</span>
      <span className="text-sm text-[#5A5A5A]">Espace SAV</span>
    </div>
  ) : (
    <div className="flex items-baseline gap-3">
      <div className="flex items-center gap-2">
        <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M16 2L2 30H10L16 18L22 30H30L16 2Z" fill="#1A1A1A" />
        </svg>
        <span className="text-xl font-bold tracking-[-0.3px] text-[#1A1A1A]">Actero</span>
      </div>
      <span className="text-sm text-[#8B8070]">·</span>
      <span className="text-sm text-[#5A5A5A]">Espace SAV · <span className="text-[#1A1A1A] font-medium">{merchantName}</span></span>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FAFAFA]" style={{ '--portal-primary': primaryColor }}>
      <header className="flex items-center justify-between px-6 py-4 border-b bg-white">
        {headerContent}
        {authed && (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-[#5A5A5A]">{email}</span>
            <button onClick={logout} className="text-[#8B8070] hover:text-[#1A1A1A]">Déconnexion</button>
          </div>
        )}
      </header>
      {authed && (
        <nav className="flex gap-4 px-6 py-3 bg-white border-b text-sm">
          <button onClick={() => navigate('/portal/tickets')} className="text-[#5A5A5A] hover:text-[#1F3A12] font-medium">Conversations</button>
          <button onClick={() => navigate('/portal/orders')} className="text-[#5A5A5A] hover:text-[#1F3A12] font-medium">Commandes</button>
        </nav>
      )}
      <main className="p-6 max-w-4xl mx-auto">{children}</main>
      {!(isMerchantBranded && client.branding?.hideActeroBranding) && (
        <footer className="text-center py-6 text-xs text-[#8B8070]">
          {isMerchantBranded ? (
            <>Propulsé par <a href="https://actero.fr" className="text-[#8B8070] hover:text-[#5A5A5A]">Actero</a></>
          ) : (
            <a href="https://actero.fr" className="text-[#8B8070] hover:text-[#5A5A5A]">Actero</a>
          )}
        </footer>
      )}
    </div>
  );
}
