'use client';

import { useState } from 'react';

import type { AuthErrorCode } from '@/modules/auth/domain/auth';
import { signOutAction } from '@/modules/auth/presentation/actions';
import { authErrorCopy } from '@/modules/auth/presentation/auth-error-messages';
import { Button } from '@/shared/ui/button';
import { FormAlert } from '@/shared/ui/form-alert';

/**
 * LogoutButton
 *
 * Only ever renders its own failure state — `signOutAction` redirects to
 * `/` on success (a thrown `NEXT_REDIRECT`, not a normal return), so a
 * result only reaches this component when sign-out actually failed. Same
 * `try/finally` shape as `SocialAuthButtons`' click handler (ADR-020): the
 * pending state must clear even on that failure path, not only on success.
 */
export function LogoutButton() {
  const [pending, setPending] = useState(false);
  const [failureCode, setFailureCode] = useState<AuthErrorCode | null>(null);

  async function handleClick() {
    setPending(true);
    setFailureCode(null);
    try {
      const result = await signOutAction();
      if (result.status === 'error') setFailureCode(result.code);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      {failureCode ? <FormAlert tone="error" {...authErrorCopy(failureCode)} /> : null}
      <Button variant="secondary" loading={pending} onClick={() => void handleClick()}>
        Sair
      </Button>
    </div>
  );
}
