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
 * Login rate limiting: after this many failed attempts within the window,
 * further attempts return `rate_limited` without reaching the identity
 * provider. Enforced in Postgres (see `supabase/migrations`), but the
 * thresholds themselves live here so they have one source of truth
 * regardless of where they are enforced.
 *
 * The e-mail and IP thresholds are deliberately different. Many Brazilian
 * mobile carriers put users behind CGNAT, so a large number of unrelated
 * people can share one public IP — a per-IP limit as tight as the per-email
 * one would let one person's failed attempts lock out everyone else on the
 * same carrier connection. The per-IP limit is set high enough to absorb
 * that sharing while still catching a scan across many accounts from one
 * origin; the per-email limit stays tight because it has no such false-
 * positive risk.
 */
export const LOGIN_MAX_FAILED_ATTEMPTS_PER_EMAIL = 5;
export const LOGIN_MAX_FAILED_ATTEMPTS_PER_IP = 30;
export const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
