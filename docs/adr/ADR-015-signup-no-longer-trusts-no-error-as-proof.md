### ADR-015 — `signUp()` no longer trusts "no `error`" as proof of success
**Decision.** `SupabaseAuthGateway.signUp()` now runs a duplicate-account
check (`isDuplicateSignUp`, in its own file) on `result.user` before treating
a Supabase response as a real success, and calls `this.supabase.auth.signOut()`
before returning `failure('email_already_registered')` when that check trips.
**Why `signUp()` needed this at all.** `@supabase/auth-js`'s own JSDoc on
`signUp()` (vendored at `node_modules/@supabase/auth-js/src/GoTrueClient.ts`)
documents that calling `signUp()` for an existing confirmed user, with
**Confirm email** and **Confirm phone** both enabled, returns an
"obfuscated/fake user object" with **no `error` at all**. The gateway's only
check before this change was `if (!result.user) return failure('unknown')` —
which that fake object satisfies, so the app reported a brand-new account
created for someone else's already-registered e-mail. This was reproduced in
manual browser testing against this exact code before the fix: creating an
account with an already-registered e-mail sometimes rendered the success
screen with no error shown at all.
**Why `identities` and not some other field.** An empty (or absent)
`identities` array is the signal Supabase uses to mark that fake object —
a genuinely new sign-up always comes back with one populated identity. It
is intentionally a pure function in its own file
(`is-duplicate-signup.ts`), not a private method on the gateway: the
gateway file starts with `import 'server-only'`, which a `tsx --test` unit
test cannot import (it runs in plain Node, no Next.js runtime), so the
check had to live somewhere importable on its own.
**Known limitation, recorded rather than solved.** The same empty-`identities`
signal is, in some GoTrue versions, also what comes back for an account that
already exists but is still waiting on its own confirmation e-mail — so this
function cannot tell "already exists and confirmed" apart from "already
exists and unconfirmed". Left as-is because both sub-cases should show the
user the same message today ("this e-mail already has an account"); telling
them apart would require a second query and only matters once the product
needs two different messages for them.
**Why the `signOut()` call is essential, not defensive extra.** `@supabase/ssr`
(`shared/lib/supabase/server.ts`) writes whatever session comes back from any
auth call straight into an httpOnly cookie, unconditionally — it has no
concept of "this response turned out to be a mistake". If Supabase's fake
object for a duplicate sign-up ever carries a session (some GoTrue
configurations return one), returning `failure('email_already_registered')`
without also calling `signOut()` would leave the browser authenticated as
the pre-existing account while the screen shows an error — a session mix-up,
not merely a wrong message.
**Reversal cost.** Medium. Removing the check reopens the exact bug this
ADR fixes; removing only the `signOut()` call keeps the correct error code
but reintroduces the session-mix-up risk silently, which is the more
dangerous partial rollback to watch for.
