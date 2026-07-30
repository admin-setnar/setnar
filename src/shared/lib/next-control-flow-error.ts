/**
 * Recognises Next.js's own internal control-flow exceptions, so a broad
 * `catch` never mistakes one for a real failure:
 *
 * - `redirect()`/`permanentRedirect()` — digest starts with `NEXT_REDIRECT`.
 * - `notFound()`/`forbidden()`/`unauthorized()` — digest starts with
 *   `NEXT_HTTP_ERROR_FALLBACK`.
 * - The `DYNAMIC_SERVER_USAGE` error Next throws internally while probing,
 *   at build time, whether a route can be statically rendered — thrown the
 *   moment a dynamic API (`cookies()`, `headers()`, …) is read during that
 *   probe. Reproduced directly: `next build` logged this from
 *   `getCurrentUser()` for `/app` (which reads `cookies()` via
 *   `createClient()`) before this check existed.
 *
 * None of these are real errors. Swallowing the first two breaks navigation
 * (see ADR-020). Swallowing the third is worse than a cosmetic log: if it
 * never propagates, Next's static-generation pass may not correctly learn
 * that the route performed dynamic work, and could treat a per-request page
 * as safe to cache as a static shell — every visitor served whatever the
 * first render happened to produce, session or no session.
 *
 * None of the three is exported from a stable, public Next.js entrypoint in
 * the installed version (15.5.22): `next/navigation` does not re-export
 * `isRedirectError`/`isHTTPAccessFallbackError` (confirmed against
 * `node_modules/next/dist/client/components/navigation.d.ts`), and
 * `isDynamicServerError` only exists under the internal
 * `next/dist/client/components/hooks-server-context` path — not re-exported
 * anywhere public either. Checking the `digest` string directly avoids
 * depending on Next's internal module layout, which is not part of its
 * semver contract and can move without notice. Re-check this against each
 * module's public exports the next time `next` is upgraded across a major
 * version — if any of the three move to a public entrypoint, prefer the
 * real helper over this string check.
 */
export function isNextControlFlowError(error: unknown): boolean {
  const digest = (error as { digest?: unknown } | null | undefined)?.digest;
  return (
    typeof digest === 'string' &&
    (digest.startsWith('NEXT_REDIRECT') ||
      digest.startsWith('NEXT_HTTP_ERROR_FALLBACK') ||
      digest === 'DYNAMIC_SERVER_USAGE')
  );
}
