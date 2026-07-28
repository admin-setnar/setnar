'use client';

import { useState } from 'react';

import { useAuthModal } from '@/modules/auth/presentation/hooks/use-auth-modal';
import { SignUpForm } from '@/modules/auth/presentation/sign-up-form';
import { useTenant } from '@/modules/tenancy/presentation/tenant-context';
import { Modal } from '@/shared/ui/modal';

/**
 * SignUpModal
 *
 * Purpose: self-service account creation — the primary conversion event of
 * the gateway page. The form itself is `SignUpForm`, shared with the
 * standalone `/criar-conta` route; this component only owns the dialog
 * chrome and the reset-on-close behaviour (see `SignInModal` for why a `key`
 * remount, not a manual `reset()`, is what clears state between opens).
 */
export function SignUpModal({ open }: { open: boolean }) {
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
      title={`Criar conta no ${brandName}`}
      description="Leva menos de dois minutos. Você configura seus produtos logo depois."
    >
      <SignUpForm key={instanceKey} />
    </Modal>
  );
}
