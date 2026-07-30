import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  failure,
  pendingConfirmation,
  success,
  type AuthResult,
  type SignInCredentials,
  type SignInResult,
  type SignUpData,
  type SocialProvider,
} from '@/modules/auth/domain/auth';
import type { AuthGateway } from '@/modules/auth/domain/auth-gateway';
import { isDuplicateSignUp } from '@/modules/auth/infrastructure/is-duplicate-signup';
import {
  clearLoginAttempts,
  isLoginBlocked,
  recordLoginFailure,
} from '@/modules/auth/infrastructure/login-rate-limiter';
import { mapSupabaseAuthError } from '@/modules/auth/infrastructure/map-supabase-auth-error';

const TENANT_ID = 'setnar';

/**
 * Supabase adapter for `AuthGateway`.
 *
 * A fresh instance is created per request by `getAuthGateway()` — it holds a
 * request-scoped Supabase client and the caller's IP, so it must never be
 * cached as a singleton across requests.
 */
export class SupabaseAuthGateway implements AuthGateway {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly clientIp: string | null,
  ) { }

  async signUp(data: SignUpData): Promise<AuthResult> {
    // tenant_id, terms_accepted_at and terms_version are never sent here —
    // the database decides them itself (see handle_new_user() in the
    // migration). Only full_name, a non-sensitive display value, crosses.
    const { data: result, error } = await this.supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: { data: { full_name: data.name.trim() } },
    });
    if (error) return failure(mapSupabaseAuthError(error));
    if (!result.user) return failure('unknown');

    if (isDuplicateSignUp(result.user)) {
      // Supabase answered with no `error` for an e-mail that already has an
      // account (see is-duplicate-signup.ts). @supabase/ssr writes whatever
      // session comes back straight to a cookie (shared/lib/supabase/server.ts),
      // so signing out here is essential, not optional — without it, the
      // browser would end up authenticated as the existing account while the
      // screen shows an error.
      await this.supabase.auth.signOut();
      return failure('email_already_registered');
    }

    const name = data.name.trim();
    const email = data.email.trim().toLowerCase();

    if (!result.session) {
      // "Confirm email" is enabled on this project: the account was created
      // for real, but it is not authenticated yet — that only happens once
      // the user clicks the link in the confirmation e-mail.
      return pendingConfirmation(name, email);
    }

    return success({
      id: result.user.id,
      name,
      email,
      tenantId: TENANT_ID,
    });
  }

  async signIn(credentials: SignInCredentials): Promise<SignInResult> {
    const blocked = await isLoginBlocked(this.supabase, credentials.email, this.clientIp);
    if (blocked) return failure('rate_limited');

    const { data: result, error } = await this.supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });

    if (error) {
      await recordLoginFailure(this.supabase, credentials.email, this.clientIp);
      // Supabase itself returns the same code for "no such e-mail" and
      // "wrong password" — mapSupabaseAuthError preserves that on purpose.
      return failure(mapSupabaseAuthError(error));
    }

    await clearLoginAttempts(this.supabase, credentials.email);

    return success({
      id: result.user.id,
      name: readFullName(result.user.user_metadata),
      email: (result.user.email ?? credentials.email).trim().toLowerCase(),
      tenantId: TENANT_ID,
    });
  }

  async signInWithProvider(_provider: SocialProvider): Promise<SignInResult> {
    return failure('provider_unavailable');
  }
}

function readFullName(metadata: Record<string, unknown> | undefined): string {
  const value = metadata?.['full_name'];
  return typeof value === 'string' && value.length > 0 ? value : 'Representante';
}
