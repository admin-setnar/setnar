'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type AuthView = 'sign-in' | 'sign-up';

interface AuthModalContextValue {
  readonly view: AuthView | null;
  /** Views already opened once, so their exit animation can still play. */
  readonly mountedViews: readonly AuthView[];
  open: (view: AuthView) => void;
  close: () => void;
}

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

/**
 * Owns which authentication modal is open.
 *
 * State lives in a context because the triggers are spread across the page
 * (navbar, hero, final CTA) while the modals are rendered once, at the root.
 */
export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<AuthView | null>(null);
  const [mountedViews, setMountedViews] = useState<AuthView[]>([]);

  const open = useCallback((next: AuthView) => {
    setMountedViews((current) => (current.includes(next) ? current : [...current, next]));
    setView(next);
  }, []);

  const close = useCallback(() => setView(null), []);

  const value = useMemo<AuthModalContextValue>(
    () => ({ view, mountedViews, open, close }),
    [view, mountedViews, open, close],
  );

  return <AuthModalContext.Provider value={value}>{children}</AuthModalContext.Provider>;
}

export function useAuthModal(): AuthModalContextValue {
  const context = useContext(AuthModalContext);
  if (!context) {
    throw new Error('useAuthModal must be used inside <AuthModalProvider>.');
  }
  return context;
}
