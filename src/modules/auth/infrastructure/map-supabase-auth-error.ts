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
    case 'over_email_send_rate_limit':
      // Supabase's built-in e-mail service caps at 2/hour, project-wide —
      // unrelated to login-rate-limiter.ts's per-account/per-IP limiter, so
      // it needs its own code rather than reusing 'rate_limited'; that code
      // is reserved for the login attempt limiter and would tell the user
      // the wrong thing to do next (waiting won't help until the project's
      // e-mail quota resets).
      return 'email_service_unavailable';
    default:
      break;
  }

  // Older/self-hosted GoTrue versions do not always populate `code`; fall
  // back to the one message Supabase uses for both invalid-credential cases.
  if (error.status === 400 && /invalid login credentials/i.test(error.message)) {
    return 'invalid_credentials';
  }

  // Same reasoning as above, for sign-up instead of sign-in: hosted GoTrue
  // mostly sets 'user_already_exists'/'email_exists' in `error.code`, but
  // some self-hosted/older responses only carry the 422 status and this
  // plain-text message. Sign-up specific, so it sits beside the
  // invalid-credentials fallback above rather than replacing it.
  if (error.status === 422 && /already (been )?(registered|exists)/i.test(error.message)) {
    return 'email_already_registered';
  }

  return 'unknown';
}
