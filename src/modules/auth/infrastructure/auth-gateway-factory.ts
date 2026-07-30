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
 *
 * Fails OPEN on an unexpected RPC error OR on `createClient()` throwing
 * (missing/invalid `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`):
 * returns `null` instead of letting either propagate, same trade-off as
 * `isLoginBlocked` in `login-rate-limiter.ts`. /termos and /privacidade are
 * public, mandatory pages — neither a database hiccup nor a Supabase
 * misconfiguration may turn them into a 500. The caller renders the legal
 * text regardless and degrades only the version label; the text itself does
 * not depend on this RPC.
 *
 * This is deliberately NOT how `getAuthGateway()` above behaves: sign-in/
 * sign-up must fail loud on the same misconfiguration, since silently
 * proceeding without a working Supabase client there is worse than a 500.
 * `createClient()` itself stays throwing for that reason — only this one
 * caller catches it. Do not "fix" that asymmetry by making `createClient()`
 * itself fail open.
 */
export async function getCurrentTermsVersion(): Promise<string | null> {
  let supabase;
  try {
    supabase = await createClient();
  } catch (err) {
    console.error(
      'getCurrentTermsVersion: createClient() lançou — Supabase provavelmente sem configuração válida. Servindo fallback fail-open ("Versão indisponível no momento").',
      err,
    );
    return null;
  }

  try {
    const { data, error } = await supabase.rpc('current_terms_version');
    if (error || !data) {
      if (error) {
        console.error(
          'getCurrentTermsVersion: RPC current_terms_version retornou erro. Servindo fallback fail-open ("Versão indisponível no momento").',
          error,
        );
      }
      return null;
    }
    return data;
  } catch (err) {
    console.error(
      'getCurrentTermsVersion: RPC current_terms_version lançou exceção inesperada. Servindo fallback fail-open ("Versão indisponível no momento").',
      err,
    );
    return null;
  }
}
