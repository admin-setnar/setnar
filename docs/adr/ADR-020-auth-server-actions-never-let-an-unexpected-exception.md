### ADR-020 — Auth Server Actions never let an unexpected exception become a silent no-op; `safeAuthCall` is the one place that decides
**Bug, reproduced before any fix, in all three call sites.** With
`NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` absent,
`getAuthGateway()` throwing inside `signInAction`/`signUpAction`/
`signInWithProviderAction` (`modules/auth/presentation/actions.ts`) had no
consistent, safe outcome:
- **Sign-in and sign-up forms** (`sign-in-form.tsx`, `sign-up-form.tsx`):
  react-hook-form's `handleSubmit` (`node_modules/react-hook-form/dist/index.esm.mjs:3007-3030`)
  already wraps the `onSubmit` callback in its own `try/catch`, so
  `isSubmitting` correctly resets — the button does **not** get stuck — but
  it then re-throws the caught error, which becomes an unhandled promise
  rejection. No `FormAlert` ever renders: `setFailureCode` is never reached.
  Confirmed in-browser: the submit `POST` returned `500`, no `[role=alert]`
  element existed afterward, and the button read "Entrar"/"Criar conta",
  not disabled.
- **Social sign-in button** (`social-auth-buttons.tsx`): worse, confirmed by
  temporarily enabling `googleAuth` on the tenant and clicking it — no
  `try/finally` existed around `signInWithProviderAction`, so
  `setPending(null)` (originally placed *after* the `await`) never ran.
  `aria-busy` stayed `"true"` and the spinner kept animating indefinitely;
  `onFailure` was never called either.
Both are the same root cause as ADR-019 — an exception the caller never
expected — but the correct fix here is the opposite of ADR-019's: this path
must fail **closed and visibly**, not open and silently. Silently proceeding
past a broken `getAuthGateway()` is not an option for authentication in the
first place, and silently doing *nothing* visible to the user is just as
wrong as a fake success would be.
**Decision.** `safeAuthCall<T>(call: () => Promise<T>)`
(`modules/auth/presentation/safe-auth-call.ts`) wraps the body of all three
Server Actions. On an unexpected exception it logs `console.error` with the
real error, then returns `failure('unknown')` — turning a would-be
unhandled rejection into a normal `AuthFailure` the existing UI already
knows how to render (`FormAlert` via `authErrorCopy`). `social-auth-buttons.tsx`
additionally wraps its own `setPending(null)` in a `finally`, so the spinner
clears even in the (now theoretical, but not guaranteed forever) case of a
throw reaching the client.
**Why `getAuthGateway()` is called *inside* the callback passed to
`safeAuthCall`, not before it.** `return safeAuthCall(async () =>
signIn(await getAuthGateway(), parsed.data))` — not
`const gateway = await getAuthGateway(); return safeAuthCall(async () =>
signIn(gateway, ...))`. The latter would run `getAuthGateway()` outside the
`try`, protecting nothing while reading as if it were protected. Covered by
a dedicated test (`tests/safe-auth-call.test.ts`) that fails the *first*
step of the callback, not the use case, and asserts the use case body never
runs.
**Why `'unknown'` was reused instead of a new `AuthErrorCode`.** It already
exists for exactly this shape of problem — Zod parse failures in the same
file already return `failure('unknown')`, and `mapSupabaseAuthError` falls
back to it for anything unrecognised. Its copy ("Não foi possível concluir
agora / Tente novamente em instantes") is already generic enough to not
imply a specific domain cause, and is already visually and semantically
distinct from every specific code (`invalid_credentials`, `rate_limited`,
etc.). A new code would only be justified if it needed different copy or
different handling; it doesn't.
**Why the catch does not swallow `redirect()`/`notFound()`.** Both work by
throwing an `Error` whose `digest` starts with `NEXT_REDIRECT` or
`NEXT_HTTP_ERROR_FALLBACK` — Next's own rendering pipeline depends on that
throw reaching it uncaught. No auth action calls either today, so this is
inert right now, but Sprint B's planned post-login redirect will add one to
`signInAction`. A blind `catch` would then turn every successful login's
redirect into a visible "Não foi possível concluir agora" — the failure
mode is worse than doing nothing, because it actively contradicts a
successful sign-in. `safeAuthCall` checks the `digest` prefix and re-throws
when it matches; see the full rationale and the "what breaks this on a
Next.js upgrade" note in `safe-auth-call.ts`'s own comment, including why a
public, stable Next.js export was not available to depend on instead
(`next/navigation` does not re-export `isRedirectError`/
`isHTTPAccessFallbackError` in the installed 15.5.22).
**Why `safeAuthCall` lives outside `actions.ts`.** `actions.ts` has
`'use server'` and imports `getAuthGateway`, which starts with `import
'server-only'` — unconditionally throwing the moment anything requires it
outside Next's bundler, the same constraint ADR-015 already documents as
the reason `isDuplicateSignUp` was extracted into its own file. `actions.ts`
itself is therefore still not unit-testable; `safeAuthCall` is, because it
has no such import.
**This ADR and ADR-019 form one policy, not two unrelated fixes — read them
together.** Both exist because `createClient()`/`getAuthGateway()` throw on
misconfiguration, and both had to decide what a *caller* does with that.
The two decisions are deliberately opposite, and that asymmetry is the
point, not an inconsistency to "clean up" later:
- `/termos`, `/privacidade` (ADR-019): fail **open**, degrade **silently**
  to the user (only the version label changes) — these pages have a safe
  default rendering and must never 500.
- Auth Server Actions (this ADR): fail **closed to the network's actual
  effect** (no login/signup happens) but **visibly** to the user (an alert
  explains something went wrong) — there is no safe default "pretend it
  worked" rendering for authentication, and doing nothing visible is its
  own bug, the one this ADR fixes.
**What is NOT covered, and is manual-only.** No end-to-end browser
assertion runs in CI; the three flows above were verified by hand against a
running `npm run dev` instance with the Supabase env vars removed (and, for
the social button, `googleAuth` temporarily flipped to `true` on the tenant
and reverted after — confirmed clean via `git diff`). `safeAuthCall`'s
mechanism is unit-tested; the actual wiring inside `actions.ts` (that each
call site truly puts `getAuthGateway()` inside the callback, not before it)
is not and cannot be, for the same `server-only` reason `actions.ts` itself
has no tests.
**Reversal cost.** Low for the `try/finally` in `social-auth-buttons.tsx`.
Low-to-medium for `safeAuthCall` itself — removing it restores the original
unhandled-rejection/stuck-spinner behavior this ADR exists to prevent, and
any future auth Server Action that skips wrapping its body in
`safeAuthCall` silently reopens the same hole for that one action.
