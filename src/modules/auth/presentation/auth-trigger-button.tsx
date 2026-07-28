'use client';

import type { ComponentProps } from 'react';

import { useAuthModal, type AuthView } from '@/modules/auth/presentation/hooks/use-auth-modal';
import { Button } from '@/shared/ui/button';

/**
 * AuthTriggerButton
 *
 * Purpose: the only client-side island the marketing sections need. It keeps
 * Hero, Navbar and CTA as Server Components while still opening a modal.
 * Usage: <AuthTriggerButton view="sign-up" size="lg">Criar conta</AuthTriggerButton>
 */
export interface AuthTriggerButtonProps extends Omit<ComponentProps<typeof Button>, 'onClick'> {
  view: AuthView;
}

export function AuthTriggerButton({ view, ...props }: AuthTriggerButtonProps) {
  const { open } = useAuthModal();
  return <Button type="button" onClick={() => open(view)} {...props} />;
}
