### ADR-014 — `email_service_unavailable` is its own code, and a message fallback covers sign-up duplicates too
**Decision.** `mapSupabaseAuthError` gained a case for GoTrue's
`over_email_send_rate_limit` → new code `email_service_unavailable`, and a
second message-text fallback (status 422, `/already (been )?(registered|exists)/i`)
alongside the existing invalid-credentials one, for sign-up duplicates when
`error.code` isn't populated.
**Why a new code instead of reusing `rate_limited`.** They are unrelated
limits with unrelated remedies. `rate_limited` (ADR-012) is this app's own
per-account/per-IP login-attempt limiter — waiting a few minutes clears it.
`over_email_send_rate_limit` is Supabase's built-in transactional e-mail
service, capped at 2 e-mails/hour for the whole project, not per user;
telling a user blocked by the project-wide e-mail cap to "wait a few
minutes and try logging in again" (the `rate_limited` copy) is simply wrong
advice — the fix is either time (up to an hour) or moving off Supabase's
built-in mailer, never a login retry.
**Why the sign-up message fallback exists, mirroring the sign-in one.**
`invalid_credentials` already had a text fallback because older/self-hosted
GoTrue does not always populate `error.code` (see the fallback this file
already had for sign-in). The same gap exists on the sign-up side: nothing
in this codebase previously caught a duplicate-account message without a
matching `code`, so it silently fell through to `unknown`, discarding
information the response actually carried.
**Consequence.** Both branches were unreachable by the fabricated-object
unit tests in `tests/map-supabase-auth-error.test.ts` before this change, and
still are only proven against fabricated error shapes, not a live GoTrue
response — the same caveat the "Verification status" table above already
records for the pre-existing `invalid_credentials` fallback.
**Reversal cost.** Low — two `switch`/`if` branches and one `AuthErrorCode`
member; removing them only widens what falls into `unknown`, it does not
change any other behaviour.
