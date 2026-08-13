import 'server-only';

import { cache } from 'react';

import type { AuthenticatedUser } from '@/modules/auth/domain/auth';
import type { AuthGateway } from '@/modules/auth/domain/auth-gateway';
import { SupabaseAuthGateway } from '@/modules/auth/infrastructure/supabase-auth-gateway';
import { getClientIp } from '@/shared/lib/get-client-ip';
import { isNextControlFlowError } from '@/shared/lib/next-control-flow-error';
import { toSafeLogError } from '@/shared/lib/safe-log-error';
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
      toSafeLogError(err),
    );
    return null;
  }

  try {
    const { data, error } = await supabase.rpc('current_terms_version');
    if (error || !data) {
      if (error) {
        console.error(
          'getCurrentTermsVersion: RPC current_terms_version retornou erro. Servindo fallback fail-open ("Versão indisponível no momento").',
          toSafeLogError(error),
        );
      }
      return null;
    }
    return data;
  } catch (err) {
    console.error(
      'getCurrentTermsVersion: RPC current_terms_version lançou exceção inesperada. Servindo fallback fail-open ("Versão indisponível no momento").',
      toSafeLogError(err),
    );
    return null;
  }
}

/**
 * The currently authenticated user, for `/app` (Sprint B's one protected
 * route) to decide whether to render or `redirect()` to `/entrar`.
 *
 * Fails OPEN to `null` on any unexpected error — including `createClient()`
 * throwing on a missing/invalid Supabase config, same trade-off as
 * `getCurrentTermsVersion` (ADR-019). Unlike that function, this one is safe
 * to fail open precisely because the caller's only use of a `null` result is
 * "treat as unauthenticated and redirect to sign in" — the exact same
 * outcome a real "no session" produces. Failing open here does not create a
 * silent, dangerous default the way it would for `getAuthGateway()`; it can
 * only ever make `/app` *more* strict (redirecting a legitimate session on a
 * transient error), never less.
 *
 * `full_name`/`tenant_id` come from `profiles` (readable only via the
 * `profiles_select_own` RLS policy — this query can never return another
 * user's row); `email` comes from the authenticated user object itself,
 * since `profiles` does not store it.
 *
 * The broad `catch` re-throws Next's own `DYNAMIC_SERVER_USAGE` control-flow
 * error instead of swallowing it — reproduced directly: without this check,
 * `next build`'s static-generation probe for `/app` (which reads `cookies()`
 * via `createClient()`) logged this function's own "unexpected exception"
 * message for what is not actually a failure. Worse than log noise: if that
 * signal never propagates, Next's static pass may not correctly learn the
 * route did dynamic work. See `isNextControlFlowError`.
 *
 * Wrapped in React's `cache()`: `app/layout.tsx` (every route, to drive
 * `AuthProvider`/the Navbar) and `/app/layout.tsx` both call this, and so do
 * `/entrar`/`/criar-conta` (to redirect an already-signed-in visitor away
 * from the form — see the README). Without `cache()`, a single request to
 * `/app` would pay for the `getUser()` network round trip and the
 * `profiles` query *twice* — once from the layout, once from the page.
 * `cache()` memoises by call-with-no-arguments per request, so every one of
 * those call sites shares the same in-flight `Promise` — confirmed with a
 * live `curl` run against `/app`, timed alongside `/` (which never calls
 * this), showing no measurable difference for an anonymous visitor (see
 * README).
 */
export const getCurrentUser = cache(async (): Promise<AuthenticatedUser | null> => {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) return null;

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, tenant_id, phone')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error(
        'getCurrentUser: authenticated user has no readable profiles row — treating as unauthenticated.',
        toSafeLogError(profileError),
      );
      return null;
    }

    return {
      id: user.id,
      name: profile.full_name,
      email: user.email ?? '',
      tenantId: profile.tenant_id,
      phone: typeof profile.phone === 'string' ? profile.phone : null,
    };
  } catch (err) {
    if (isNextControlFlowError(err)) {
      throw err;
    }
    console.error('getCurrentUser: unexpected exception reading the current session.', toSafeLogError(err));
    return null;
  }
});
