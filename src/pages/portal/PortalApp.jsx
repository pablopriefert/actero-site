import { useEffect, useState } from 'react';
import PortalLayout from './PortalLayout.jsx';
import PortalLoginPage from './PortalLoginPage.jsx';
import PortalVerifyPage from './PortalVerifyPage.jsx';
import PortalTicketsListPage from './PortalTicketsListPage.jsx';
import PortalTicketDetailPage from './PortalTicketDetailPage.jsx';
import PortalOrdersListPage from './PortalOrdersListPage.jsx';
import PortalOrderDetailPage from './PortalOrderDetailPage.jsx';
import { PortalToneContext } from '../../hooks/usePortalTone.js';
import { DEFAULT_PORTAL_TONE } from '../../lib/portal-tone.js';
import { usePortalClient } from '../../hooks/usePortalClient.js';

export default function PortalApp() {
  const [route, setRoute] = useState(window.location.pathname);
  const { client } = usePortalClient();

  useEffect(() => {
    const onPop = () => setRoute(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = (p) => {
    window.history.pushState({}, '', p);
    setRoute(p);
  };

  // Tone pulled from resolve-client response if present, otherwise default.
  // TODO: extend /api/portal/resolve-client to return client_settings.portal_tone.
  const tone = client?.portalTone || DEFAULT_PORTAL_TONE;

  let page;
  const ticketMatch = route.match(/^\/portal\/tickets\/([^/]+)$/);
  const orderMatch = route.match(/^\/portal\/orders\/([^/]+)$/);
  if (route === '/portal/login' || route === '/' || route === '') page = <PortalLoginPage />;
  else if (route === '/portal/verify') page = <PortalVerifyPage navigate={navigate} />;
  else if (route === '/portal/tickets') page = <PortalTicketsListPage navigate={navigate} />;
  else if (ticketMatch) page = <PortalTicketDetailPage ticketId={ticketMatch[1]} navigate={navigate} />;
  else if (route === '/portal/orders') page = <PortalOrdersListPage navigate={navigate} />;
  else if (orderMatch) page = <PortalOrderDetailPage orderName={orderMatch[1]} navigate={navigate} />;
  else page = <div>Page à venir · route: {route}</div>;

  return (
    <PortalToneContext.Provider value={tone}>
      <PortalLayout navigate={navigate}>{page}</PortalLayout>
    </PortalToneContext.Provider>
  );
}
