import { useEffect, useState } from 'react';
import PortalLayout from './PortalLayout.jsx';
import PortalLoginPage from './PortalLoginPage.jsx';
import PortalVerifyPage from './PortalVerifyPage.jsx';

export default function PortalApp() {
  const [route, setRoute] = useState(window.location.pathname);
  useEffect(() => {
    const onPop = () => setRoute(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = (p) => {
    window.history.pushState({}, '', p);
    setRoute(p);
  };

  let page;
  if (route === '/portal/login' || route === '/' || route === '') page = <PortalLoginPage />;
  else if (route === '/portal/verify') page = <PortalVerifyPage navigate={navigate} />;
  else page = <div>Page à venir · route: {route}</div>;

  return <PortalLayout navigate={navigate}>{page}</PortalLayout>;
}
