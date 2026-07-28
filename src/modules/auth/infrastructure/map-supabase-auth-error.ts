import type { AuthErrorCode } from '@/modules/auth/domain/auth';

/**
 * The slice of `@supabase/supabase-js`'s `AuthError` this function actually
 * reads. Kept as a narrow structural type — not imported from the SDK — so
 * this stays a pure function testable with a plain object, no live Supabase
 * client required.
 */
export interface SupabaseAuthErrorLike {
  readonly status?: number;
  readonly code?: string;
  readonly message: string;
}

/**
 * Translates a Supabase Auth error into a domain `AuthErrorCode`.
 *
 * Deliberately has no branch that distinguishes "no account with this
 * e-mail" from "wrong password" — Supabase itself already collapses both
 * into the same `invalid_credentials` code for `signInWithPassword`, and
 * this function must never reintroduce that distinction, or the login form
 * becomes an account-enumeration oracle. See the antienumeration test.
 */
export function mapSupabaseAuthError(error: SupabaseAuthErrorLike): AuthErrorCode {
  switch (error.code) {
    case 'user_already_exists':
    case 'email_exists':
      return 'email_already_registered';
    case 'invalid_credentials':
      return 'invalid_credentials';
    case 'weak_password':
      return 'weak_password';
    default:
      break;
  }

  // Older/self-hosted GoTrue versions do not always populate `code`; fall
  // back to the one message Supabase uses for both invalid-credential cases.
  if (error.status === 400 && /invalid login credentials/i.test(error.message)) {
    return 'invalid_credentials';
  }

  return 'unknown';
}
