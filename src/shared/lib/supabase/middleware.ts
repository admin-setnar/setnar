import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

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
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
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
    },
  );

  // Must be called before any response is generated — a refresh completing
  // after the response is committed cannot be written back (see setAll's
  // own doc comment) and the next request would just refresh again.
  await supabase.auth.getUser();

  return response;
}
