'use server';

import { redirect } from 'next/navigation';

import { registerRepresentative } from '@/modules/representatives/application/register-representative';
import { formatPhoneToE164 } from '@/modules/representatives/domain/representative-rules';
import { getRepresentativeOnboardingGateway } from '@/modules/representatives/infrastructure/representative-onboarding-gateway-factory';
import type { RegisterRepresentativeFailure } from '@/modules/representatives/presentation/representative-onboarding-error-messages';
import { safeOnboardingCall } from '@/modules/representatives/presentation/safe-onboarding-call';
import {
  representativeOnboardingSchema,
  type RepresentativeOnboardingFormValues,
} from '@/modules/representatives/presentation/schemas/representative-onboarding.schema';

/**
 * Server Action — the only entry point `OnboardingForm` uses to reach
 * `register_representative`. Re-validates with the same Zod schema the form
 * already uses client-side: client validation is for feedback, this is the
 * one that actually guarantees nothing malformed reaches the gateway — same
 * split `modules/auth/presentation/actions.ts` already uses.
 *
 * D3.B.5: success now navigates via `redirect('/app')`, called *inside* the
 * `safeOnboardingCall` callback so its `NEXT_REDIRECT` throw is recognised
 * and re-thrown, not swallowed — see `safe-onboarding-call.ts` and ADR-020,
 * same care `signUpAction`/`signInAction` already take. A normal return is
 * therefore always a failure (`'rejected'` or `'error'`) — same convention
 * every auth Server Action already establishes: a normal return means
 * failure, success means navigation. `/app` itself (not this action) is what
 * now decides whether to render the onboarding form or the hub, based on
 * whether the signed-in User already has a Representative
 * (`RepresentativeAccountRepository`).
 */
export async function registerRepresentativeAction(
  values: RepresentativeOnboardingFormValues,
): Promise<RegisterRepresentativeFailure> {
  const parsed = representativeOnboardingSchema.safeParse(values);
  if (!parsed.success) return { status: 'error' };

  return safeOnboardingCall(async () => {
    const gateway = await getRepresentativeOnboardingGateway();
    const result = await registerRepresentative(gateway, {
      slug: parsed.data.slug,
      displayName: parsed.data.displayName,
      licenseId: parsed.data.licenseId,
      phone: parsed.data.phone ? formatPhoneToE164(parsed.data.phone) : null,
      city: parsed.data.city ? parsed.data.city : null,
    });
    if (result.status === 'rejected' || result.status === 'error') return result;
    redirect('/app');
  });
}
