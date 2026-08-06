### ADR-025 — `server.ts`'s `setAll` does not apply `@supabase/ssr`'s anti-cache headers; Next's own dynamic-rendering default already does
**Question raised, verified before deciding.** `@supabase/ssr` 0.12.4's
`createServerClient` passes a second argument to `setAll` — `headers`, the
`Cache-Control`/`Expires`/`Pragma` values the library's own type doc says
callers "must" apply alongside a cookie write, so that a response setting
an auth cookie is never cached by a CDN or reverse proxy and replayed to a
different user (`node_modules/@supabase/ssr/dist/module/types.d.ts`'s own
JSDoc on `SetAllCookies`, read directly, not assumed). `shared/lib/supabase/server.ts`'s
`setAll(cookiesToSet)` only ever declared the first parameter — the second
is silently dropped. `shared/lib/supabase/middleware.ts` already applies it
correctly (ADR-021); this ADR is only about `server.ts`.
**Verified live, not assumed, against a production build (`next build` +
`next start`), on the actual cookie-writing path.** A `fetch` wrapper was
injected into a real signed-in browser session to capture true response
headers (`Headers.entries()`, not guessed) for the exact Server Action that
calls `server.ts`'s `createClient()` and writes a fresh session cookie —
`signInAction`, via `POST /entrar` (confirmed by its own
`x-action-redirect: /app;push` header). The captured response:
`cache-control: private, no-cache, no-store, max-age=0, must-revalidate`.
The same exact string was independently observed on an unrelated dynamic
response (`/app`'s own `redirect()` for an unauthenticated visitor, via
plain `curl -D-`) — confirming this is Next's blanket default for *any*
dynamic response, not a coincidence specific to the sign-in action.
**Decision: documented, not applied.** `server.ts`'s `setAll` keeps
ignoring the `headers` argument. Every caller of `createClient()` already
calls `await cookies()` (line 17, above `createServerClient`) before
`setAll` can ever run — and `cookies()` is what forces a Next.js App Router
route out of static/cacheable rendering into fully dynamic rendering in the
first place. That forced-dynamic path is what emits the header captured
above, for every response from every caller of this function, whether or
not that particular call happens to write a cookie. Applying the library's
headers on top would be redundant in this stack today.
**Why this isn't "skip it because it currently doesn't bite," the same
class of reasoning ADR-019 explicitly rejected elsewhere.** The two cases
differ in what the fallback is if the assumption breaks. ADR-019's rejected
alternative would have made a *silent* wrong default the norm for every
caller, including security-critical ones, with no signal if the assumption
stopped holding. Here, the fallback if Next.js ever stopped forcing dynamic
rendering on `cookies()` usage would be a *missing* `Cache-Control` header
— which is not silent: it is directly observable with one `curl -D-`
against any route that reads `cookies()`, exactly how this ADR's own
finding was produced, and Next.js's own docs treat "reading `cookies()`
forces dynamic rendering" as foundational, documented App Router behaviour,
not an implementation detail likely to change silently.
**What `Expires`/`Pragma` add that `Cache-Control` alone captured above
does not — nothing observable in this stack.** The captured header omits
`Expires`/`Pragma` entirely; only `Cache-Control` is present. Both legacy
headers exist for HTTP/1.0-only caches to honour the same "do not store"
instruction `Cache-Control: no-store` already gives every HTTP/1.1+ cache —
Vercel's edge network and every modern browser are in the latter group.
Their absence changes nothing for the actual risk `@supabase/ssr`'s
contract exists to prevent.
**Reversal cost.** Low — applying the ignored `headers` argument the same
way `middleware.ts` already does is a five-line change if this assumption
is ever revisited (e.g. a future Next.js version changing dynamic-rendering
defaults, or a caller of `createClient()` appearing outside a context that
forces dynamic rendering).
