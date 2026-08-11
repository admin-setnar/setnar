import { isNextControlFlowError } from '@/shared/lib/next-control-flow-error';
import { toSafeLogError } from '@/shared/lib/safe-log-error';

/**
 * Wraps a Representative write Server Action's body so an unexpected
 * exception — most commonly a factory (`getProductActivationGateway()`,
 * `getRepresentativeProfileGateway()`) throwing on a missing/invalid Supabase
 * config — becomes a normal `{ status: 'error' }` instead of an unhandled
 * rejection. Structural copy of `safeOnboardingCall`
 * (`presentation/safe-onboarding-call.ts`), which is itself a structural copy
 * of `modules/auth/presentation/safe-auth-call.ts` — see that file for the
 * full reasoning, repeated here only where it differs.
 *
 * Generic over `T` rather than narrowed to one result union, unlike
 * `safeOnboardingCall`: every caller here (`activateProductAction`,
 * `setActivationStatusAction`, `updateRepresentativeProfileAction`) calls a
 * different gateway method returning a different result type, and none of
 * them ever `redirect()`s on success (each updates the hub in place via
 * `revalidatePath`, none navigates) — so the narrowing problem that
 * `safeOnboardingCall`'s doc comment describes for `registerRepresentativeAction`
 * does not apply to any of them. Shared across all three instead of one
 * near-identical copy per action, unlike the auth/onboarding split: THAT
 * split exists because `safeOnboardingCall` is narrowed to
 * `RegisterRepresentativeResult` for a real, documented typing reason: no
 * such reason exists here, so a second or third copy would be duplication
 * with no behavioral difference to justify it.
 *
 * The `isNextControlFlowError` re-throw is kept anyway, at negligible cost,
 * as the same defensive posture every Server Action wrapper in this codebase
 * already takes — not because any of today's three callers calls
 * `redirect()`/`notFound()`.
 */
export async function safeRepresentativeWriteCall<T extends { readonly status: string }>(
  call: () => Promise<T>,
): Promise<T | { readonly status: 'error' }> {
  try {
    return await call();
  } catch (error) {
    if (isNextControlFlowError(error)) {
      throw error;
    }
    console.error(
      'safeRepresentativeWriteCall: unexpected exception in a Representative write Server Action',
      toSafeLogError(error),
    );
    return { status: 'error' };
  }
}
