'use client';

import { useState } from 'react';

import type { SocialProvider } from '@/modules/auth/domain/auth';
import { signInWithProviderAction } from '@/modules/auth/presentation/actions';
import { useTenant } from '@/modules/tenancy/presentation/tenant-context';
import { Button } from '@/shared/ui/button';

/**
 * SocialAuthButtons
 *
 * Purpose: offer identity-provider sign-in. Which providers appear is a tenant
 * capability, not a hardcoded list.
 * Current behaviour: the gateway always resolves with `provider_unavailable`,
 * so the real loading and failure paths are exercised today. Wiring a real
 * provider later changes only `SupabaseAuthGateway.signInWithProvider`.
 */
const PROVIDER_LABEL: Record<SocialProvider, string> = {
  google: 'Google',
  microsoft: 'Microsoft',
};

export function SocialAuthButtons({
  onFailure,
  disabled = false,
}: {
  onFailure: (code: string) => void;
  disabled?: boolean;
}) {
  const { features } = useTenant();
  const [pending, setPending] = useState<SocialProvider | null>(null);

  const providers: SocialProvider[] = [
    ...(features.googleAuth ? (['google'] as const) : []),
    ...(features.microsoftAuth ? (['microsoft'] as const) : []),
  ];

  // No dangling "ou" divider with nothing under it: the separator is part of
  // this component precisely so it only ever renders alongside real buttons.
  if (providers.length === 0) return null;

  async function handleClick(provider: SocialProvider) {
    setPending(provider);
    const result = await signInWithProviderAction(provider);
    setPending(null);
    if (result.status === 'error') onFailure(result.code);
  }

  return (
    <>
      <div className="flex items-center gap-3 py-1" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        <span className="text-xs text-content-subtle">ou</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {providers.map((provider) => (
          <Button
            key={provider}
            type="button"
            variant="secondary"
            fullWidth
            loading={pending === provider}
            disabled={disabled || (pending !== null && pending !== provider)}
            onClick={() => void handleClick(provider)}
          >
            Continuar com {PROVIDER_LABEL[provider]}
          </Button>
        ))}
      </div>
    </>
  );
}
