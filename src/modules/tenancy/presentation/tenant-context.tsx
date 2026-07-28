'use client';

import { createContext, useContext, type ReactNode } from 'react';

import type { TenantClientView } from '@/modules/tenancy/domain/tenant';

const TenantContext = createContext<TenantClientView | null>(null);

/**
 * Makes the resolved tenant available to Client Components.
 *
 * The tenant is resolved on the server (from the Host header) and only the
 * client-safe slice crosses the boundary. Client code must never re-resolve a
 * tenant or read hostnames itself.
 */
export function TenantProvider({
  tenant,
  children,
}: {
  tenant: TenantClientView;
  children: ReactNode;
}) {
  return <TenantContext.Provider value={tenant}>{children}</TenantContext.Provider>;
}

export function useTenant(): TenantClientView {
  const tenant = useContext(TenantContext);
  if (!tenant) {
    throw new Error('useTenant must be used inside <TenantProvider>.');
  }
  return tenant;
}
