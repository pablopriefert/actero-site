import { useEffect, useState, useCallback } from 'react';

export function usePortalAuth() {
  const [state, setState] = useState({ loading: true, authed: false, email: null });

  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/portal/me', { credentials: 'same-origin' });
      if (r.ok) {
        const b = await r.json();
        setState({ loading: false, authed: true, email: b.customerEmail });
      } else {
        setState({ loading: false, authed: false, email: null });
      }
    } catch {
      setState({ loading: false, authed: false, email: null });
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect -- async fetch: setState is inside awaited callback in refresh */
  useEffect(() => { refresh(); }, [refresh]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const logout = useCallback(async () => {
    await fetch('/api/portal/logout', { method: 'POST', credentials: 'same-origin' });
    setState({ loading: false, authed: false, email: null });
  }, []);

  return { ...state, refresh, logout };
}
