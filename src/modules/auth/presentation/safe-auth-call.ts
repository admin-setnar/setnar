import { failure, type AuthFailure } from '@/modules/auth/domain/auth';
import { isNextControlFlowError } from '@/shared/lib/next-control-flow-error';
import { toSafeLogError } from '@/shared/lib/safe-log-error';

/**
 * Wraps an auth Server Action's body so an unexpected exception — most
 * commonly `getAuthGateway()` throwing on a missing/invalid Supabase config
 * — becomes a normal `AuthFailure` instead of an unhandled rejection.
 *
 * `signInAction`/`signUpAction`/`signInWithProviderAction` call
 * `getAuthGateway()` *inside* the callback passed here, not before — calling
 * it before would run it outside this `try`, defeating the wrapper while
 * looking protected. See ADR-020.
 *
 * Deliberately does NOT catch Next.js's own control-flow throws
 * (`redirect()`, `notFound()`, …) — those must propagate for Next to act on
 * them. See `isNextControlFlowError` (`shared/lib/next-control-flow-error.ts`).
 *
 * Lives outside `actions.ts` on purpose: `actions.ts` has `'use server'` and
 * imports `getAuthGateway`, which is `server-only` — importing it from a
 * plain `tsx --test` process throws unconditionally (same constraint ADR-015
 * documents for `isDuplicateSignUp`). This file has no such import, so it
 * can be unit-tested directly.
 */
export async function safeAuthCall<T>(call: () => Promise<T>): Promise<T | AuthFailure> {
  try {
    return await call();
  } catch (error) {
    if (isNextControlFlowError(error)) {
      throw error;
    }
    console.error('safeAuthCall: unexpected exception in an auth Server Action', toSafeLogError(error));
    return failure('unknown');
  }
}
