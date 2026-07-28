'use client';

import { useState } from 'react';

import { useAuthModal } from '@/modules/auth/presentation/hooks/use-auth-modal';
import { SignInForm } from '@/modules/auth/presentation/sign-in-form';
import { useTenant } from '@/modules/tenancy/presentation/tenant-context';
import { Modal } from '@/shared/ui/modal';

/**
 * SignInModal
 *
 * Purpose: authenticate an existing representative without leaving the page.
 * The form itself is `SignInForm`, shared with the standalone `/entrar`
 * route; this component only owns the dialog chrome and the reset-on-close
 * behaviour.
 * Behaviour: once opened, the modal stays mounted so its exit animation can
 * play (see `AuthModals`). Remounting `SignInForm` via `key`, after that
 * animation finishes, clears its state for the next time it opens — without
 * visibly emptying the form while it is still closing.
 */
export function SignInModal({ open }: { open: boolean }) {
  const { close } = useAuthModal();
  const { brandName } = useTenant();
  const [instanceKey, setInstanceKey] = useState(0);

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) return;
    close();
    window.setTimeout(() => setInstanceKey((key) => key + 1), 200);
  }

  return (
    <Modal
      open={open}
      onOpenChange={handleOpenChange}
      title={`Entrar no ${brandName}`}
      description="Use o e-mail cadastrado para acessar sua conta."
    >
      <SignInForm key={instanceKey} />
    </Modal>
  );
}
