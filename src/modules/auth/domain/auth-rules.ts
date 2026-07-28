/**
 * Authentication business rules.
 *
 * These constants are the single source of truth: form validation, future
 * server validation and any provider configuration must all read from here so
 * the rule can never drift between layers. No framework imports allowed.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;
export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 80;

/** A password must combine letters and digits — length alone is not enough. */
export function hasLetterAndDigit(value: string): boolean {
  return /[A-Za-zÀ-ÿ]/.test(value) && /\d/.test(value);
}

/**
 * Login rate limiting: after this many failed attempts for the same e-mail
 * or the same IP within the window, further attempts return `rate_limited`
 * without reaching the identity provider. Enforced in Postgres (see
 * `supabase/migrations`), but the threshold itself lives here so it has one
 * source of truth regardless of where it is enforced.
 */
export const LOGIN_MAX_FAILED_ATTEMPTS = 5;
export const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
