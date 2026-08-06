### ADR-023 — `?next=` is validated server-side before every `redirect()`, not trusted from the query string
**Decision.** `safeRedirectTarget()`
(`modules/auth/presentation/safe-redirect-target.ts`) is the single gate
every `?next=` value passes through before reaching a `redirect()` call:
`signInAction`, `signUpAction`, `signInWithProviderAction`, and
`GET /auth/callback`. It accepts only a same-origin path starting with
`/`, rejects `//host` (protocol-relative) and anything not starting with
`/`, and falls back to `/app` otherwise.
**Why this is a real vulnerability, not theoretical.** `?next=https://
site-malicioso.com` (or `?next=//site-malicioso.com`) makes a link that
visibly points at Setnar's own trusted domain end on an attacker's page
right after a real, successful login — a classic phishing-ready open
redirect, made more convincing precisely because the address bar shows the
genuine `setnar.com` domain up until the final hop.
**Why validated inside the Server Action, not only on the page reading
`searchParams`.** `/entrar`/`/criar-conta` do sanitise `next` before passing
it to the form (`safeRedirectTarget(next)` in each page), but that pass is
UX-only. A Server Action is a callable endpoint independent of the React
tree that happens to invoke it — nothing stops a request calling
`signInAction` directly with an arbitrary `next` argument, bypassing the
page entirely. The actual security boundary is the last point before
`redirect()` runs, which is inside `safeAuthCall`'s callback in each action.
**Why the backslash check, beyond the two cases the tests require.**
`/\site-malicioso.com` starts with `/` and is not literally `//`, so it
would pass a check that only looks for that exact prefix — some URL parsers
have historically normalised a leading `/\` the same as `//`. Costs nothing
to also reject, and there is no legitimate reason for a backslash in one of
this app's own paths.
**Tested, not just reasoned about.** `tests/safe-redirect-target.test.ts`
covers a valid relative path (accepted), an absolute URL (rejected), a
`//`-prefixed value (rejected), the backslash case, and empty/missing
input.
**Reversal cost.** Low — a single pure function; every call site already
goes through it, so removing or weakening the check is a one-line diff to
spot in review.
