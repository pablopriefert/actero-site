import { createContext, useContext } from 'react'

export const TenantContext = createContext(null);

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (context === undefined || context === null) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
};
