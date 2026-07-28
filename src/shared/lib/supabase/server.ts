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
          // Route Handlers can. Middleware would be needed to refresh an
          // expiring session from a Server Component; out of scope for this
          // sprint (no protected route exists yet to need it).
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
