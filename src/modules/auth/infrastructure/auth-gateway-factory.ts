import 'server-only';

import type { AuthGateway } from '@/modules/auth/domain/auth-gateway';
import { SupabaseAuthGateway } from '@/modules/auth/infrastructure/supabase-auth-gateway';
import { getClientIp } from '@/shared/lib/get-client-ip';
import { createClient } from '@/shared/lib/supabase/server';

/**
 * Composition root for authentication.
 *
 * The one place that decides which adapter the application uses. A new
 * gateway is built on every call, never cached: it wraps a Supabase client
 * bound to the current request's cookies, so a module-level singleton would
 * leak one user's session into another's request.
 *
 * Server-only — every caller is a Server Action or Route Handler. Client
 * Components never import this; they call the Server Actions in
 * `modules/auth/presentation/actions.ts` instead.
 */
export async function getAuthGateway(): Promise<AuthGateway> {
  const [supabase, clientIp] = await Promise.all([createClient(), getClientIp()]);
  return new SupabaseAuthGateway(supabase, clientIp);
}

/**
 * The version of /termos and /privacidade currently in force — read from the
 * database, never duplicated as a constant here, so a signed consent record
 * and the copy a user actually saw can never drift apart (see
 * `current_terms_version()` in `supabase/migrations`).
 */
export async function getCurrentTermsVersion(): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('current_terms_version');
  if (error || !data) {
    throw new Error('Could not resolve the current terms version.');
  }
  return data;
}
