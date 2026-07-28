import { createBrowserClient } from '@supabase/ssr';

/**
 * Supabase client for Client Components.
 *
 * Infrastructure detail — never import this outside `modules/*\/infrastructure`.
 * UI reaches Supabase only through the `AuthGateway` port.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
