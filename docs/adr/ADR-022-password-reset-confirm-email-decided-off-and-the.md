### ADR-022 — Password reset: Confirm email decided OFF, and the flow this closes for Sprint B
**Decision, closing what ADR-016 left open.** "Confirm email" is turned OFF
in the Supabase dashboard (`supabase/README.md` §2) — a closed product
decision for this sprint, not a "to be decided" note anymore.
`auth.signUp()` therefore always returns an active session immediately.
`AuthPendingConfirmation`/the `awaitingConfirmation` branch in
`sign-up-form.tsx` stay in the code exactly as ADR-016 built them — dead in
production today, not removed or simplified, ready for the day self-hosted
SMTP exists and this setting is switched back on.
**Two-step flow, mirroring Supabase's own documented pattern.** (1)
`/esqueci-senha` calls `requestPasswordResetAction` →
`AuthGateway.requestPasswordReset(email, redirectTo)` →
`supabase.auth.resetPasswordForEmail()`, with `redirectTo` pointing at
`GET /auth/callback?next=/redefinir-senha`. (2) The user clicks the e-mail
link; `GET /auth/callback` — **the first Route Handler in this project** —
exchanges the PKCE `code` for a session via `exchangeCodeForSession()` and
redirects to `/redefinir-senha`. (3) That page's form calls
`updatePasswordAction` → `AuthGateway.updatePassword()`, authorized entirely
by the session the callback just established — the form itself has no
e-mail field; identity comes from the cookie, never from user input.
**Why a Route Handler, and not a Server Component or Server Action, for step
2.** Exchanging the code is not a pure render — it has a real side effect
(writing an auth cookie) triggered by a `GET` request from an e-mail
client, which cannot invoke a Server Action. `shared/lib/supabase/server.ts`'s
own docstring already lists Route Handlers as one of its three valid
consumers; this is the first time anything in the app actually needed one.
**Anti-enumeration, verified, not assumed.** `requestPasswordReset`'s
success path never checks whether the account exists —
`SupabaseAuthGateway.requestPasswordReset` returns success on `!error`
unconditionally, and Supabase's own `resetPasswordForEmail` is documented
to answer identically (no `error`) for both an existing and a non-existent
e-mail; only a project-wide send-limit produces a real `error`.
`ForgotPasswordForm`'s success copy ("Se este e-mail tiver uma conta,
enviamos um link…") matches that behaviour instead of contradicting it.
**`reset_link_expired` is its own `AuthErrorCode`, not reused `unknown`.**
`SupabaseAuthGateway.updatePassword` checks for a session explicitly before
calling `updateUser()` — the only way to reach that method without one is
an expired, already-used, or tampered link — and that failure needs
different copy ("request a new link") from every other `unknown` case
("try again"), the same bar ADR-020 applied when it chose to *reuse*
`unknown` for a different failure instead of adding a code.
**Shares the project's 2-e-mails/hour Supabase cap (ADR-014), not a new
one.** `resetPasswordForEmail`'s errors are mapped through the existing
`mapSupabaseAuthError`, which already turns Supabase's
`over_email_send_rate_limit` into `email_service_unavailable` — the same
code sign-up's duplicate-e-mail-service-error path uses. Recorded here as a
real constraint, not blocking anything: password-reset e-mails and sign-up
confirmation e-mails (dormant while Confirm email is off) draw from the
same 2/hour project-wide quota. Revisit if reset volume and any future
confirmation-e-mail volume start competing for it.
**Reversal cost.** Medium — the three routes and the Route Handler would
need to be removed together; `AuthGateway.requestPasswordReset`/
`updatePassword` have no other caller today.
