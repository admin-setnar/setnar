### ADR-018 — `email_hash` opacity blocks unlock-by-stranger; lockout-by-stranger is reachable through the real form and is an accepted risk, not a bug
**Decision.** `is_login_blocked`, `record_login_failure` and
`clear_login_attempts` remain `SECURITY DEFINER`, `grant execute to anon,
authenticated` (ADR-012, unchanged). No `SUPABASE_SERVICE_ROLE_KEY` was
introduced. `record_login_failure`'s cleanup was additionally scoped to the
identity being written (`supabase/migrations/20260730000000_...sql`) as
hygiene — the cross-identity data-destruction bug was already closed by
`20260729000000_fix_login_attempts_cleanup.sql`; this migration only narrows
which rows each call's cleanup touches, it does not fix a vulnerability.
**Two distinct findings below — do not conflate them; they have different
verdicts.**

**Finding A — unlocking a victim (`clear_login_attempts`) requires the salted
hash, which nothing outside the server can produce. Not exploitable.** The
hash is `sha256(salt:normalizedEmail)`, computed only in
`login-rate-limiter.ts`'s `hash()` — a `server-only` module — from
`LOGIN_ATTEMPT_SALT`, a server-only env var (no `NEXT_PUBLIC_` prefix).
Verified empirically, not assumed: a production build's `.next/static`
output (what actually ships to browsers) was grepped for both the variable
name and its literal value — zero matches either way; both appear only in
`.next/server`, which never leaves the Vercel function. None of the three
RPCs ever returns a hash to the caller, so there is no oracle to recover one.
An attacker who knows only a victim's plaintext e-mail has no path to the
matching hash short of brute-forcing a 256-bit random salt.

**Finding B — locking a victim out (`record_login_failure`) needs no hash at
all: it is reachable through the real sign-in form by anyone who knows the
victim's e-mail address. Exploitable today. Accepted as risk, not fixed.**
Reproduced against the actual running application, not a raw RPC call: 5
wrong-password submissions on the real `/entrar` form for a fresh target
e-mail each rendered "E-mail ou senha não conferem"; the 6th rendered
"Muitas tentativas seguidas" (`rate_limited`). No hash, no salt, no secret
was used — the attacker only ever typed a public e-mail address and an
arbitrary wrong password into the same form a real visitor uses. A
front-door-equivalent regression test lives in
`tests/login-rate-limiter.integration.test.ts` (it reproduces `hash()`
inline and drives the RPCs with `auth-rules.ts`'s real thresholds, since
`login-rate-limiter.ts`/`supabase-auth-gateway.ts` cannot be imported from a
plain `tsx --test` process — the same `server-only` constraint ADR-015
already documents).
**Why this is being accepted rather than fixed.** This is the rate limiter
working exactly as ADR-012 designed it: blocking by identity (e-mail), not
by caller, so credential stuffing against one account is stopped regardless
of which IP it comes from. Any lockout keyed on "how many times has X failed
recently" is triggerable by anyone who can cause a failure for X, and the
only identity available before authentication succeeds is the e-mail address
itself — not a secret, since it is what any visitor types into the public
form. This trade-off is standard for per-account lockout mechanisms
industry-wide; it is not specific to this implementation.
**Product consequence, recorded plainly.** Any SETNAR-licensed
representative can be locked out of `/entrar` for the 15-minute window
(`LOGIN_RATE_LIMIT_WINDOW_MS`, `auth-rules.ts`) by anyone who knows or
guesses their e-mail — no account access, no password, no secret required.
This is a real, user-facing availability cost, not a hypothetical.
**What was NOT done, and why.** *Blocking only by IP, dropping the
per-e-mail limit* — rejected: ADR-012 already explains why an IP-only limit
fails on Brazilian mobile CGNAT (too loose to catch a targeted attack, or it
locks out every unrelated user sharing that carrier's IP); removing the
e-mail-keyed limit to close this DoS would reopen the credential-stuffing
protection it exists for, a worse trade. *A lockout that also invalidates an
already-active session* — not implemented, and this finding does not need
it: the block only prevents a *new* sign-in for that e-mail; a session
already established before the lockout is unaffected. The blast radius here
is "cannot log in for up to 15 minutes", not "gets signed out."
**Signal that would make us revisit.** A real abuse report (a licensee
actually locked out by someone else, not a theoretical), or CAPTCHA becoming
available first. `supabase/README.md` §4 now names CAPTCHA
(Turnstile/hCaptcha on Supabase's own auth endpoints) as the next lever for
native rate limiting; the same lever raises the cost of triggering this
lockout too, since it requires solving a challenge per attempt instead of a
bare form submission.

**Operational consequence, surfaced while investigating the hash — not a
security finding, recorded because it matters.** `hash()`
(`login-rate-limiter.ts:23-29`) throws if `LOGIN_ATTEMPT_SALT` is unset,
with no fallback. Because `isLoginBlocked`/`recordLoginFailure` sit directly
in `SupabaseAuthGateway.signIn()`'s path, an unset `LOGIN_ATTEMPT_SALT` in
production does not degrade rate limiting — it throws before
`signInWithPassword` is ever called, taking down every sign-in attempt for
every user immediately. This is the opposite of `isLoginBlocked`'s own
documented fail-open trade-off, which only covers RPC *errors*, not a
missing env var upstream of the call. Rotating `LOGIN_ATTEMPT_SALT` has
equivalent severity from a different angle: every hash already stored in
`login_attempts` was computed with the old salt, so a rotation makes every
existing row permanently unmatchable against any hash computed with the new
salt — functionally equivalent to truncating the table for every identity at
once. Neither is changed by this ADR; both are recorded here because they
surfaced during this investigation, not because a fix is proposed.

**Alternative rejected: move these RPCs behind `SUPABASE_SERVICE_ROLE_KEY`.**
This project has never held a service-role key — ADR-011/012 were built
specifically to avoid needing one, and `20260728000000_create_profiles.sql`'s
own header says so. Introducing one now trades a risk that is already
structurally bounded for Finding A (breaking a salted hash to touch one
table) for an unbounded one (a leaked service-role key bypasses RLS on every
table in the project) — and would do nothing for Finding B, which needs no
hash to begin with.
**Alternative rejected: hash inside Postgres instead of the TypeScript
layer.** Floated as cheaper, but worse for Finding A: it would mean these
RPCs accept a *plaintext* e-mail and salt it server-side, removing the
barrier that finding depends on — anyone who knows a victim's e-mail could
recover the "hash" path with no secret at all.

**Reversal cost.** Low for Finding B specifically if CAPTCHA is added later —
raises the cost of triggering the lockout without changing the
identity-keyed design. Low to revisit the service-role alternative for
Finding A if the threat model changes (e.g. a future endpoint that must
return a hash to a client for some reason).
