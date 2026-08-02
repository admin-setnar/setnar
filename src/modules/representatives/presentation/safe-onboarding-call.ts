import type { RegisterRepresentativeResult } from '@/modules/representatives/domain/representative-onboarding-gateway';
import { isNextControlFlowError } from '@/shared/lib/next-control-flow-error';

/**
 * Wraps the onboarding Server Action's body so an unexpected exception —
 * most commonly `getRepresentativeOnboardingGateway()` throwing on a
 * missing/invalid Supabase config — becomes a normal `{ status: 'error' }`
 * instead of an unhandled rejection. Structural copy of
 * `modules/auth/presentation/safe-auth-call.ts`, adapted to
 * `RegisterRepresentativeResult` instead of `AuthFailure` — see that file
 * for the full reasoning, repeated here only where it differs.
 *
 * The return type unions `T` with the NARROW `{ status: 'error' }` shape the
 * catch block actually returns — not the full `RegisterRepresentativeResult`
 * union. That distinction matters: `safeAuthCall`'s `Promise<T | AuthFailure>`
 * works as a narrowing helper (e.g. in `signUpAction`, T infers as
 * `AuthFailure | AuthPendingConfirmation`, excluding `AuthSuccess`, once its
 * callback returns early for every non-success status and calls `redirect()`
 * — typed `never` — for the rest) specifically because `AuthFailure` is one
 * variant of `AuthResult`, not the whole union. Unioning with the FULL
 * `RegisterRepresentativeResult` here instead would silently force `'created'`
 * back into every caller's return type regardless of what T narrows to,
 * defeating the exact narrowing `registerRepresentativeAction` relies on to
 * declare its own return type as `RegisterRepresentativeFailure`.
 *
 * `registerRepresentativeAction` calls `getRepresentativeOnboardingGateway()`
 * *inside* the callback passed here, not before — calling it before would
 * run it outside this `try`, defeating the wrapper while looking protected
 * (same ADR-020 reasoning `safe-auth-call.ts` documents).
 *
 * Deliberately does NOT catch Next.js's own control-flow throws
 * (`redirect()`, `notFound()`, …) — those must propagate for Next to act on
 * them. `registerRepresentativeAction` calls `redirect('/app')` on success
 * inside this exact callback shape (D3.B.5) — this check is what lets that
 * throw reach Next instead of being swallowed as an "unexpected exception".
 *
 * Lives outside `actions.ts` on purpose: `actions.ts` has `'use server'` and
 * imports `getRepresentativeOnboardingGateway`, which is `server-only` —
 * importing it from a plain `tsx --test` process throws unconditionally
 * (same constraint `safe-auth-call.ts` documents). This file has no such
 * import, so it can be unit-tested directly.
 */
export async function safeOnboardingCall<T extends RegisterRepresentativeResult>(
  call: () => Promise<T>,
): Promise<T | Extract<RegisterRepresentativeResult, { status: 'error' }>> {
  try {
    return await call();
  } catch (error) {
    if (isNextControlFlowError(error)) {
      throw error;
    }
    console.error('safeOnboardingCall: unexpected exception in an onboarding Server Action', error);
    return { status: 'error' };
  }
}
