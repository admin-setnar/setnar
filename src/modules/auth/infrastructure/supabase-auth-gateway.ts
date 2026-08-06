import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  failure,
  passwordActionSucceeded,
  pendingConfirmation,
  success,
  type AuthResult,
  type PasswordActionResult,
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
    // The database derives tenant and terms. full_name and the normalized
    // commercial phone cross as metadata only so handle_new_user() can create
    // the private profiles snapshot atomically. Metadata is not canonical:
    // phone is personal data, not an auth credential or phone-login factor;
    // representatives.phone becomes canonical after onboarding.
    const { data: result, error } = await this.supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: { data: { full_name: data.name.trim(), phone: data.phone } },
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
      // The operational setup documented in supabase/README keeps Confirm
      // email off, so a session is expected. Keep this no-session result safe
      // because the remote Auth setting is external and may differ or change.
      return pendingConfirmation(name, email);
    }

    return success({
      id: result.user.id,
      name,
      email,
      tenantId: TENANT_ID,
      phone: data.phone,
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
      phone: readPhone(result.user.user_metadata),
    });
  }

  async signInWithProvider(_provider: SocialProvider): Promise<SignInResult> {
    return failure('provider_unavailable');
  }

  async signOut(): Promise<void> {
    const { error } = await this.supabase.auth.signOut();
    // Thrown, not swallowed: safeAuthCall (the one caller) treats this as an
    // unexpected failure and shows an error instead of redirecting — see the
    // AuthGateway.signOut() doc for why a logout must never look successful
    // when it wasn't.
    if (error) throw error;
  }

  async requestPasswordReset(email: string, redirectTo: string): Promise<PasswordActionResult> {
    const { error } = await this.supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) return failure(mapSupabaseAuthError(error));
    // Supabase's own behaviour here is already anti-enumeration: `error` is
    // null for both an existing and a non-existent e-mail (it only ever
    // populates for things like the project's send-rate limit). Returning
    // success unconditionally on `!error` preserves that; adding an
    // existence check here would be the thing that breaks it, not fixes it.
    return passwordActionSucceeded();
  }

  async updatePassword(newPassword: string): Promise<PasswordActionResult> {
    // Checked explicitly, not inferred from updateUser()'s error shape:
    // GoTrue's error code for "no/invalid session" isn't a documented,
    // stable string to switch on, whereas "is there a user" is unambiguous.
    // The only way to reach this method without a session is an expired,
    // already-used, or tampered reset link.
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) return failure('reset_link_expired');

    const { error } = await this.supabase.auth.updateUser({ password: newPassword });
    if (error) return failure(mapSupabaseAuthError(error));
    return passwordActionSucceeded();
  }
}

function readFullName(metadata: Record<string, unknown> | undefined): string {
  const value = metadata?.['full_name'];
  return typeof value === 'string' && value.length > 0 ? value : 'Representante';
}

function readPhone(metadata: Record<string, unknown> | undefined): string | null {
  const value = metadata?.['phone'];
  return typeof value === 'string' ? value : null;
}
