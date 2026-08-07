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
  /** Runs in the same click as the modal transition (for example, to close a mobile menu). */
  onOpen?: () => void;
}

export function AuthTriggerButton({ view, onOpen, ...props }: AuthTriggerButtonProps) {
  const { open } = useAuthModal();

  function handleClick() {
    open(view);
    onOpen?.();
  }

  return <Button type="button" onClick={handleClick} {...props} />;
}
