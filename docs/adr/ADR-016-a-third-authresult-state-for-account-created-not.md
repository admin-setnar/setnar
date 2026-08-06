### ADR-016 — A third `AuthResult` state for "account created, not yet authenticated"
**Decision.** `AuthResult` is now `AuthSuccess | AuthFailure | AuthPendingConfirmation`.
`signIn` and `signInWithProvider` — which can never produce that third state,
since there is no account to create — return the narrower `SignInResult =
AuthSuccess | AuthFailure` instead, threaded through `AuthGateway`,
both sign-in use cases, both gateway adapters, and `signInAction`/
`signInWithProviderAction`. Only `signUpAction` still returns the 3-state
`AuthResult`.
**Why this needed a real domain state instead of a UI-only tweak.** Before
this change, `signUp()` returned `success(...)` whenever `result.user`
existed post duplicate-check, without checking `result.session` — so a
project with **Confirm email** enabled (the correct, secure default) made
`sign-up-form.tsx` render "Você já está autenticado no Setnar" for an
account that was not, in fact, authenticated: no session exists until the
user clicks the confirmation link. This was reproduced in manual browser
testing: the confirmation e-mail arrived and clicking its link did create a
real session (verified via the `amr: [{ method: 'otp' }]` claim in the
resulting cookie/JWT) — proving the earlier "already authenticated" message
had been false at the moment it was shown.
**Why narrow `SignInResult` instead of leaving every method on `AuthResult`.**
Once `AuthResult` grew a third state, every caller of `signIn`/
`signInWithProvider` would otherwise need a dead branch for a state their
own gateway methods can never return — `sign-in-form.tsx` and
`social-auth-buttons.tsx` would have to handle `'pending_confirmation'`
just to satisfy the type checker, for a case that can't happen on those
paths. Narrowing the type instead of the runtime check means the compiler
enforces "sign-in only ever succeeds or fails", not a code comment.
**Consequence.** `sign-up-form.tsx` now has three render branches instead of
two: error, pending confirmation, and success — each mapped from a distinct,
named domain state, not inferred from the shape of the success payload.
**Reversal cost.** Medium — collapsing back to two states means deciding
what a project with Confirm email enabled should show instead, and touching
every file this ADR lists again.
**Update (Sprint B) — the "Confirm email enabled" premise above is now
explicitly decided the other way.** This ADR was written when that setting's
final value was still open. It has since been turned OFF as a closed
product decision (`supabase/README.md` §2) — see ADR-022 for the full
reasoning and what that decision enables. Nothing above is invalidated:
`AuthPendingConfirmation`/`awaitingConfirmation` remain exactly as this ADR
built them, deliberately dead code today, not removed.
