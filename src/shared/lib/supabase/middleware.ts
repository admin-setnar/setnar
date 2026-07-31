import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Logged at most once per process, not once per request — this middleware
 * runs on every non-static request (ADR-021), so a naive `console.error`
 * inside `updateSession` would produce one line per hit for the entire
 * lifetime of a misconfigured deployment. `missing`/`invalid` are tracked
 * independently: which one fires first does not suppress the other, since
 * they are different root causes and ADR-024 requires them to stay
 * distinguishable in the log, not just deduplicated together.
 */
const loggedOnce = { missing: false, invalid: false };

/**
 * Test-only: `updateSession`'s warn-once state is module-level by design
 * (see `loggedOnce` above), so a test suite that drives the same process
 * through more than one misconfiguration scenario needs a way to reset it
 * between cases — otherwise only the first test to trip a given reason
 * would ever observe its log line. Not used anywhere outside
 * `tests/supabase-middleware.test.ts`.
 */
export function resetUpdateSessionWarningsForTests(): void {
  loggedOnce.missing = false;
  loggedOnce.invalid = false;
}

/**
 * Supabase client for middleware — distinct from `server.ts`'s, on purpose.
 *
 * `server.ts` reads/writes cookies through `next/headers`' `cookies()`, which
 * only exists inside the Server Component/Server Action/Route Handler
 * request lifecycle — it is not available in middleware, which runs before
 * that lifecycle even starts. Middleware instead reads/writes cookies
 * directly on the `NextRequest`/`NextResponse` objects it is handed.
 *
 * This is also the only place in the app that can refresh a near-expiry
 * access token *before* a page renders: Server Components cannot write
 * cookies at all (`server.ts`'s own `setAll` silently no-ops there, by
 * design — see its comment), so without this middleware a refreshed token
 * would have nowhere to be written back to.
 *
 * Follows the exact `getAll`/`setAll` shape `@supabase/ssr`'s own
 * `createServerClient` JSDoc documents for middleware use (checked against
 * the installed version, 0.12.4 — `node_modules/@supabase/ssr/dist/module/createServerClient.d.ts`
 * and `types.d.ts`), including the `setAll` second argument (`headers`) the
 * library expects call sites to also apply to the response — not assumed
 * from memory. The deprecated `get`/`set`/`remove` shape is not used.
 *
 * **Fails open on missing config AND on present-but-invalid config — see
 * ADR-024, which corrects this ADR's own earlier, narrower version.**
 * ADR-019 already established that `/termos` and `/privacidade` must fail
 * open on `createClient()` throwing "because the Supabase env vars are
 * missing or invalid" (its own words) — `getCurrentTermsVersion()` wraps
 * that call in one blanket `try/catch` regardless of *why* it throws.
 * Middleware runs in front of every page, including those two, so it has
 * to honour the same "missing or invalid" scope, or it 500s the request
 * before either page's own fail-open code ever runs — which is exactly
 * what a narrower, presence-only guard did.
 *
 * The two causes are kept **distinguishable in the log**, not folded into
 * one message: an absent env var is an expected, common state (a fresh
 * clone, a preview deploy with no Supabase project yet); a present but
 * malformed value (e.g. a truncated `NEXT_PUBLIC_SUPABASE_URL` from a
 * copy-paste error) is a real deploy bug that should look different in the
 * log even though both currently produce the same outward behaviour (public
 * pages render, session refresh is skipped). "Fail loud" for this file does
 * not mean 500 a public page — ADR-019 already forecloses that for
 * `/termos`/`/privacidade`, and there is no reason `/` should be worse
 * protected than pages that call Supabase directly — it means the operator
 * reading logs can tell "not configured yet" apart from "configured wrong"
 * without needing to reproduce the request.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    if (!loggedOnce.missing) {
      loggedOnce.missing = true;
      console.error(
        'updateSession: NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY not set — session refresh is disabled for every request until these are configured.',
      );
    }
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  let supabase;
  try {
    supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          // Write to the request too, not only the response: so that if
          // anything downstream in this same middleware pass reads cookies
          // again, it sees the refreshed values rather than the stale ones
          // the request arrived with.
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([key, value]) => {
            response.headers.set(key, value);
          });
        },
      },
    });
  } catch (err) {
    // Only reachable for a synchronous, config-validation throw (a
    // malformed URL — `@supabase/supabase-js`'s `validateSupabaseUrl`) —
    // no network call has been attempted yet at this point, so there is
    // nothing unsafe about failing open here the same way the missing-var
    // branch above does.
    if (!loggedOnce.invalid) {
      loggedOnce.invalid = true;
      console.error(
        'updateSession: NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are set but invalid — session refresh is disabled for every request until this is fixed.',
        err,
      );
    }
    return NextResponse.next({ request });
  }

  // Must be called before any response is generated — a refresh completing
  // after the response is committed cannot be written back (see setAll's
  // own doc comment) and the next request would just refresh again.
  await supabase.auth.getUser();

  return response;
}
