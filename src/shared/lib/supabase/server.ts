import 'server-only';

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 *
 * A new client is created per call rather than cached, because each one is
 * bound to the cookie store of the request that created it — caching a
 * singleton would leak one user's session cookies into another request.
 *
 * Infrastructure detail — never import this outside `modules/*\/infrastructure`.
 * UI reaches Supabase only through the `AuthGateway` port.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // Server Components cannot set cookies — only Server Actions and
          // Route Handlers can. `shared/lib/supabase/middleware.ts` is what
          // refreshes an expiring session ahead of a Server Component render
          // (see ADR-021); this client's own `setAll` intentionally stays a
          // no-op sink for that case.
          //
          // The second `setAll` argument (`headers` — the anti-cache headers
          // `@supabase/ssr` asks every caller to apply alongside a cookie
          // write) is deliberately not read here — see ADR-025 in the
          // README for why: confirmed live against a production build that
          // Next's own dynamic-rendering default already emits an
          // equal-or-stronger `Cache-Control`, for every caller of this
          // function, because every one of them already calls `cookies()`
          // above (which is what forces Next out of static/cached
          // rendering in the first place). Do not add this back without
          // re-reading that ADR — the point of documenting it there was to
          // stop this exact "the contract says apply it" instinct from
          // re-adding dead code.
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from a Server Component — safe to ignore.
          }
        },
      },
    },
  );
}
