'use client';

import { createContext, useContext, type ReactNode } from 'react';

const AuthContext = createContext<boolean | null>(null);

/**
 * Makes "is there a session right now" available to Client Components —
 * the Navbar's only use case, so the value crossing the server/client
 * boundary is a bare boolean, not the full `AuthenticatedUser` (name/e-mail
 * have no reason to sit in every page's initial client payload; `/app`
 * reads those directly, server-side, when it actually needs them).
 *
 * Read once in `app/layout.tsx` via `getCurrentUser()` (wrapped in React's
 * `cache()` — see that function's own doc) and provided here, mirroring
 * `TenantProvider`'s exact shape for the same reason: one server-side read
 * per request, made available to every Client Component under it, instead
 * of every page re-deriving and re-threading it as a prop.
 */
export function AuthProvider({
  authenticated,
  children,
}: {
  authenticated: boolean;
  children: ReactNode;
}) {
  return <AuthContext.Provider value={authenticated}>{children}</AuthContext.Provider>;
}

export function useAuth(): boolean {
  const authenticated = useContext(AuthContext);
  if (authenticated === null) {
    throw new Error('useAuth must be used inside <AuthProvider>.');
  }
  return authenticated;
}
