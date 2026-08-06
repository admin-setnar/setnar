### ADR-024 — Session-refresh middleware fails open on "missing or invalid" config, exactly ADR-019's own scope — with the two causes kept distinguishable, logged once per process
**Bug, reproduced before any fix, on every route.** An external audit
reported HTTP 500 on `/`, `/termos` and `/privacidade` — not just the
authenticated routes ADR-019/ADR-020 already cover — whenever
`NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are unset.
Confirmed with a real `next build` + `next start` + `curl` cycle, not
inferred from reading the code: `src/middleware.ts` calls `updateSession()`
(`shared/lib/supabase/middleware.ts`) on every non-static request (ADR-021),
which passed `process.env...!` straight into `createServerClient`. That
throws synchronously — `Error: Your project's URL and Key are required to
create a Supabase client!` — before any page's own code, including
ADR-019's fail-open `getCurrentTermsVersion()`, ever runs. Because
middleware sits in front of everything, this one throw took down `/` too,
which has no Supabase call of its own at all.
**First version of this fix was too narrow, and contradicted ADR-019 —
caught in review, not shipped.** ADR-019 states its own scope explicitly:
`getCurrentTermsVersion()` fails open "because the Supabase env vars are
missing or invalid" (that ADR's own wording, above). A first pass at this
fix only guarded on *missing* vars in middleware, leaving a
present-but-malformed URL still throwing there — which still 500'd
`/termos` and `/privacidade` before either page's own ADR-019 fail-open
code could run, silently narrowing ADR-019's stated guarantee for exactly
the two pages it names. Two ADRs disagreeing about the same case in the
same README is a bug in the README, not an acceptable trade-off — fixed
below by matching ADR-019's scope, not by re-arguing it.
**Three scenarios exist here, verified separately, and they are not the
same bug.**
1. **Env vars absent (or present but empty — `NEXT_PUBLIC_SUPABASE_URL=`
   with no value, the common shape of "set but left blank" on Vercel).**
   `createServerClient` throws on its own presence check. Falls under
   ADR-019's "missing" branch.
2. **Env vars present, well-formed, pointing at a project that does not
   exist** (verified against `https://nao-existe-xyz123.supabase.co`).
   `createServerClient` does not throw — it only checks presence, not
   reachability — and `supabase.auth.getUser()`'s own network failure is
   caught internally by `@supabase/ssr`/`@supabase/auth-js` and returned as
   an error value, not thrown. `/`, `/termos`, `/privacidade` were already
   `200` and `/app` already `307` to `/entrar?next=/app` in this scenario,
   **before any change in this ADR** — confirmed by curl against the
   unmodified code first, specifically to delimit what needed fixing from
   what already worked. This is a network failure, not a configuration
   error, is not mentioned anywhere in ADR-019's "missing or invalid"
   wording, and stays out of scope here.
3. **Env vars present but malformed** (verified with
   `NEXT_PUBLIC_SUPABASE_URL=not-a-valid-url`). `@supabase/supabase-js`'s
   `SupabaseClient` constructor validates the URL eagerly and throws
   `Error: Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL.` — a
   different, real error, still reproducing the same 500. Falls under
   ADR-019's "invalid" branch — the case the first version of this ADR
   missed.
**Decision.** `updateSession()` fails open on both scenario 1 and scenario
3, matching `getCurrentTermsVersion()`'s own scope exactly: an explicit
presence check first (also catching the empty-string case — `!''` is
`true` — so a blank-but-set var reads as "missing", not a third category),
then a `try/catch` scoped narrowly to the `createServerClient(...)` call
itself (nothing else) to catch scenario 3's synchronous validation throw.
Both branches return `NextResponse.next({ request })` unchanged — no
client is built, no refresh attempted, the request proceeds exactly as if
middleware did not exist for it — and each logs its own distinguishable,
**once-per-process** `console.error` (a module-level `{ missing, invalid }`
flag pair, tracked independently so hitting one first never suppresses the
other): *"...not set — session refresh is disabled..."* for scenario 1,
*"...are set but invalid — session refresh is disabled..."* for scenario 3.
Neither message is a substring of the other, checked directly in
`tests/supabase-middleware.test.ts`.
**Why a `try/catch` here doesn't repeat ADR-019's own rejected
alternative.** ADR-019 rejects making `createClient()` itself catch and
fail open, because that would force *every* caller — including the
security-critical auth Server Actions — to inherit the same permissive
behaviour, with no way for a caller that needs to fail loud (`getAuthGateway()`)
to opt out. That objection is about *where* the catch lives, not about
catching at all: this `try/catch` lives in `updateSession()` itself, wraps
only the `createServerClient(...)` call (a synchronous, no-network,
config-validation step — confirmed by reading `validateSupabaseUrl` in
`node_modules/@supabase/supabase-js/src/lib/helpers.ts` before writing
this, not assumed), and is invisible to every other caller.
`shared/lib/supabase/server.ts`'s `createClient()` is untouched and still
throws — sign-in/sign-up still 500 on the exact same misconfiguration, per
ADR-019's own explicit carve-out, unchanged by this ADR.
**Why "fail loud" for middleware means a distinct log line, not a 500 on a
public page.** ADR-019 already forecloses 500ing `/termos`/`/privacidade`
for this exact cause; there is no principled reason `/` — which makes no
Supabase call of its own — should be *worse* protected than pages that
call Supabase directly. "Loud" here is aimed at whoever reads production
logs, not at the visitor: a present-but-malformed URL is a real deploy bug
(a truncated copy-paste, a typo) that must not read identically to "nobody
has configured Supabase yet" in the log, even though both currently
produce the same HTTP response. Collapsing the two into one `try/catch`
with one message — the shape of the fix's first, rejected draft — would
have hidden that distinction; two messages, two independently-tracked
flags, keep it.
**Why once per process, not once per request.** Middleware runs on every
non-static request (ADR-021) for the entire lifetime of a misconfigured
deployment; a `console.error` per request would flood the log with the
same fact on every hit, from the first request onward, with nothing new to
learn from repetition. Verified against a running server, not only against
a unit test: two consecutive `curl`s (`GET /`, `GET /termos`) against a
build with the env vars absent produced exactly one matching log line, not
two — `grep -c` against the captured server output confirmed this
directly.
**Why `getCurrentUser()`'s fail-closed-to-`null` behaviour needed no
change.** `/app`'s protection does not depend on this middleware at all —
`getCurrentUser()` (`auth-gateway-factory.ts`) calls `createClient()`
independently and already catches any exception, including both the
missing- and invalid-config throws, returning `null`. Verified unchanged
after this fix, for both scenario 1 and scenario 3: `/app` still redirects
`307` to `/entrar?next=/app`.
**What this deliberately does NOT cover.** `getAuthGateway()` and
`createClient()` (`shared/lib/supabase/server.ts`) are unchanged — ADR-019
already explains why sign-in/sign-up must keep failing loud (a visible 500,
not a degraded log line) on the same misconfiguration, and that reasoning
is untouched here. Only the middleware's own client construction got the
guard.
**Tested, not just reasoned about.** `tests/supabase-middleware.test.ts`
imports `updateSession` and `resetUpdateSessionWarningsForTests` directly
— `updateSession` has no `import 'server-only'`, unlike `server.ts`, so no
mock or stub of the Next.js runtime is needed. The reset export exists only
because the warn-once state is deliberately module-level (see "once per
process" above), which would otherwise let only the first test per
process observe a given warning; it is not used outside this test file.
Six cases: both vars missing, only one missing, both set to empty strings,
a malformed-but-present URL, a second call proving the once-per-process
dedupe, and a case proving the missing/invalid flags don't suppress each
other. Full `npm run verify`
(`typecheck && lint && test && test:integration && build`) passes end to
end after this change.
**Reversal cost.** Low — confined to `updateSession()`; removing the
`try/catch` around client construction restores the narrower,
ADR-019-inconsistent behaviour this revision fixes, while removing the
whole guard restores the original throw-through bug.
