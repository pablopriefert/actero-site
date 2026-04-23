import { createContext, useContext } from 'react';
import { DEFAULT_PORTAL_TONE } from '../lib/portal-tone.js';

/**
 * PortalToneContext — provides the customer-facing tone ('tu' | 'vous')
 * from client_settings.portal_tone down to portal pages.
 *
 * Default is 'tu' (informal).
 *
 * TODO: extend /api/portal/resolve-client to return client_settings.portal_tone
 * so PortalApp can hydrate this context from the server. For now, context
 * just mirrors the default and the UI renders 'tu' strings.
 */
export const PortalToneContext = createContext(DEFAULT_PORTAL_TONE);

export function usePortalTone() {
  return useContext(PortalToneContext);
}
