import { failure, type AuthFailure } from '@/modules/auth/domain/auth';

/**
 * Next.js's `redirect()`/`notFound()` (and `forbidden()`/`unauthorized()`)
 * work by throwing an `Error` whose `digest` starts with `NEXT_REDIRECT` or
 * `NEXT_HTTP_ERROR_FALLBACK` — that digest is how the framework's own
 * rendering pipeline recognises the throw as flow control, not a real error,
 * and turns it into an actual redirect/404 instead of an error boundary.
 *
 * The installed Next.js version (15.5.22) does define `isRedirectError` /
 * `isHTTPAccessFallbackError`, but only under internal paths
 * (`next/dist/client/components/redirect-error`,
 * `next/dist/client/components/http-access-fallback/http-access-fallback`)
 * — neither is re-exported from the public, documented `next/navigation`
 * entrypoint (confirmed: `next/navigation.d.ts` only re-exports
 * `./dist/client/components/navigation`, which does not include either).
 * Deep-importing `next/dist/*` would tie this file to Next's internal
 * module layout, which is not part of its semver contract and can move
 * without notice. Checking the digest prefix directly is the same
 * technique those internal helpers use, without the deep import.
 *
 * If a future Next.js major changes this digest scheme, this check quietly
 * stops matching, and the exact failure this file exists to prevent comes
 * back: a `redirect()`/`notFound()` call added to an auth Server Action
 * later (Sprint B's planned post-login redirect) would get swallowed by
 * `safeAuthCall` and rendered as `failure('unknown')` instead of navigating.
 * Re-check this against `next/navigation`'s public exports the next time
 * `next` is upgraded across a major version.
 */
function isNextFlowControlError(error: unknown): boolean {
  const digest = (error as { digest?: unknown } | null | undefined)?.digest;
  return (
    typeof digest === 'string' &&
    (digest.startsWith('NEXT_REDIRECT') || digest.startsWith('NEXT_HTTP_ERROR_FALLBACK'))
  );
}

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
 * Deliberately does NOT catch Next.js flow-control throws (`redirect()`,
 * `notFound()`): those must propagate for Next to act on them. See
 * `isNextFlowControlError` above.
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
    if (isNextFlowControlError(error)) {
      throw error;
    }
    console.error('safeAuthCall: unexpected exception in an auth Server Action', error);
    return failure('unknown');
  }
}
