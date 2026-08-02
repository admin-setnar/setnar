import type {
  RegisterRepresentativeInput,
  RegisterRepresentativeResult,
  RepresentativeOnboardingGateway,
} from '@/modules/representatives/domain/representative-onboarding-gateway';

/**
 * Representative onboarding use case.
 *
 * No extra business rule beyond the call itself — same shape as `sign-in.ts`
 * (as opposed to `sign-up.ts`, which has one: `acceptedTerms`). This
 * function exists anyway, isolating the gateway call, so the presentation
 * layer never calls `gateway.register()` directly and every unexpected
 * exception becomes a domain result instead of an unhandled rejection.
 */
export async function registerRepresentative(
  gateway: RepresentativeOnboardingGateway,
  input: RegisterRepresentativeInput,
): Promise<RegisterRepresentativeResult> {
  try {
    return await gateway.register(input);
  } catch {
    return { status: 'error' };
  }
}
