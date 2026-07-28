import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  failure,
  success,
  type AuthResult,
  type SignInCredentials,
  type SignUpData,
  type SocialProvider,
} from '@/modules/auth/domain/auth';
import type { AuthGateway } from '@/modules/auth/domain/auth-gateway';
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
  ) {}

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

    return success({
      id: result.user.id,
      name: data.name.trim(),
      email: data.email.trim().toLowerCase(),
      tenantId: TENANT_ID,
    });
  }

  async signIn(credentials: SignInCredentials): Promise<AuthResult> {
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

  async signInWithProvider(_provider: SocialProvider): Promise<AuthResult> {
    return failure('provider_unavailable');
  }
}

function readFullName(metadata: Record<string, unknown> | undefined): string {
  const value = metadata?.['full_name'];
  return typeof value === 'string' && value.length > 0 ? value : 'Representante';
}
