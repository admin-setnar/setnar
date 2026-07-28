'use client';

import { useState } from 'react';

import { signInWithProvider } from '@/modules/auth/application/sign-in-with-provider';
import type { SocialProvider } from '@/modules/auth/domain/auth';
import { getAuthGateway } from '@/modules/auth/infrastructure/auth-gateway-factory';
import { useTenant } from '@/modules/tenancy/presentation/tenant-context';
import { Button } from '@/shared/ui/button';

/**
 * SocialAuthButtons
 *
 * Purpose: offer identity-provider sign-in. Which providers appear is a tenant
 * capability, not a hardcoded list.
 * Current behaviour: the mock gateway resolves with `provider_unavailable`, so
 * the real loading and failure paths are exercised today. Wiring a provider
 * later changes only the gateway.
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

  if (providers.length === 0) return null;

  async function handleClick(provider: SocialProvider) {
    setPending(provider);
    const result = await signInWithProvider(getAuthGateway(), provider);
    setPending(null);
    if (result.status === 'error') onFailure(result.code);
  }

  return (
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
  );
}
