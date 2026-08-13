import { isNextControlFlowError } from '@/shared/lib/next-control-flow-error';
import { toSafeLogError } from '@/shared/lib/safe-log-error';

/**
 * Wraps a feedback Server Action's body so an unexpected exception — most
 * commonly `getFeedbackGateway()` throwing on a missing/invalid Supabase
 * config — becomes a normal `{ status: 'error' }` instead of an unhandled
 * rejection. Structural copy of `safeRepresentativeWriteCall`
 * (`modules/representatives/presentation/safe-representative-write-call.ts`)
 * — kept as its own small copy rather than a cross-module import, same
 * "each module owns its own near-identical wrapper" posture that file's own
 * doc comment already explains for why auth/onboarding/representatives don't
 * share one either.
 */
export async function safeFeedbackCall<T extends { readonly status: string }>(
  call: () => Promise<T>,
): Promise<T | { readonly status: 'error' }> {
  try {
    return await call();
  } catch (error) {
    if (isNextControlFlowError(error)) {
      throw error;
    }
    console.error('safeFeedbackCall: unexpected exception in a feedback Server Action', toSafeLogError(error));
    return { status: 'error' };
  }
}
