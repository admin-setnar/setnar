### ADR-019 — `getCurrentTermsVersion()` also fails open on `createClient()` throwing, not only on the RPC's `{ error }`
**Bug, reproduced before any fix.** With `NEXT_PUBLIC_SUPABASE_URL`/
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` absent at build time, `next build`
succeeds, but `next start` turned `GET /termos` and `GET /privacidade` into
HTTP 500: `createServerClient()` (`shared/lib/supabase/server.ts`) throws
synchronously — `Error: Your project's URL and Key are required to create a
Supabase client!` — before `getCurrentTermsVersion()`'s existing `{ error }`
handling ever runs. Confirmed with a real build/start/curl cycle, not
inferred from reading the code.
**Decision.** The `try/catch` was added only inside `getCurrentTermsVersion()`
(`modules/auth/infrastructure/auth-gateway-factory.ts`), wrapping both the
`createClient()` call and the `.rpc('current_terms_version')` call. Each
branch logs a distinguishing `console.error` (config-throw vs RPC-error vs
RPC-throw) before returning `null` — the same contract the pre-existing
`{ error }` branch already had.
**What this covers now.** `/termos` and `/privacidade` render the full legal
text and "Versão indisponível no momento" across all three failure modes:
the RPC returns `{ error }`, the RPC call rejects unexpectedly, or
`createClient()` itself throws because the Supabase env vars are missing or
invalid. Verified both extremes end to end: no env vars → `200` with the
fallback label and a logged, distinguishable error; valid env vars → `200`
with the real version from `current_terms_version()`.
**What this deliberately does NOT cover — `createClient()` and
`getAuthGateway()` still throw, unchanged.** `signInAction`/`signUpAction`/
`signInWithProviderAction` (`modules/auth/presentation/actions.ts`) call
`getAuthGateway()`, which calls the same `createClient()` — neither catches.
A missing or invalid Supabase config still 500s every sign-in/sign-up
attempt. This is intentional, not an oversight left over from this fix:
unlike the legal pages, there is no safe degraded rendering for
authentication — a `SupabaseAuthGateway` built on a broken client (or, worse,
some placeholder client an alternative fix might have manufactured) is a
worse failure mode than a visible 500. **Do not "fix" this asymmetry by
making `createClient()` fail open or return `null`** — that would force
every caller, including the auth Server Actions, to null-check, and a
silently-degraded auth path is precisely the risk being avoided here for
`/termos` and `/privacidade` specifically, not a general policy.
**Alternative rejected: make `createClient()` itself catch and return `null`
or a stub client.** Rejected because it moves the fail-open decision into
the one place that cannot know which caller can tolerate it — every caller,
including the security-critical auth path, would inherit the same
permissive behavior.
**Reversal cost.** Low — confined to one function; removing the `try/catch`
restores the original throw-through behavior, and no other file depends on
the new contract.
