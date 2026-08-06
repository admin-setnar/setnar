### ADR-021 — Session-refresh middleware, refresh-only by design
**Decision.** `src/middleware.ts` calls `updateSession()`
(`shared/lib/supabase/middleware.ts`) on every non-static request. It does
exactly one thing: build a `@supabase/ssr` client bound to the request's/
response's cookies and call `supabase.auth.getUser()`, which refreshes the
access token when it is near expiry and writes the refreshed cookie back
onto the response. It does not decide what counts as a protected route —
that stays entirely in `/app/page.tsx`'s own `redirect()`.
**Why this needs its own Supabase client, distinct from
`shared/lib/supabase/server.ts`.** `server.ts` reads/writes cookies through
`next/headers`'s `cookies()`, which does not exist in middleware —
middleware runs before that request lifecycle even starts. Confirmed
against the installed `@supabase/ssr` (0.12.4) type definitions before
writing any of this, not assumed from memory:
`node_modules/@supabase/ssr/dist/module/createServerClient.d.ts`'s own JSDoc
documents a `getAll`/`setAll` shape specifically for middleware use,
including a second `headers` argument to `setAll` that must also be applied
to the response (`Cache-Control`, etc., so a response that just set an auth
cookie is never cached by a CDN/reverse proxy for a different user). The
deprecated `get`/`set`/`remove` shape is not used anywhere.
**Why the matcher excludes static assets, `_next/*` and images.** The same
cost concern ADR-001 already raised against putting *tenant* resolution in
middleware ("runs on every asset request for no gain") — a session check is
cheaper than a Host-based tenant lookup, but still pointless work against a
CSS bundle or a favicon that never carries a session cookie relevant to it.
**Why splitting "refresh" from "protect" into two places, not one
middleware that does both.** A route becomes (or stops being) protected by
editing that one page's own `redirect()`, without touching the single file
every request already pays the cost of running. Folding the protected-route
allowlist into middleware would mean every new protected route requires
editing a file with no direct connection to that route.
**Consequence.** Every request (except the excluded assets) now does one
`getUser()` round trip to Supabase, even for fully public pages (`/`,
`/termos`, `/entrar` itself). Accepted: this is the only correct place to
refresh a token before a Server Component renders — Server Components
cannot write cookies at all (`server.ts`'s own `setAll` silently no-ops
there, by design).
**Reversal cost.** Low — deleting `src/middleware.ts` returns to no
proactive session refresh (a session would only ever refresh reactively,
e.g. on a client-side Supabase call); it does not affect `/app`'s own
protection, which reads the session independently through
`getCurrentUser()`.
