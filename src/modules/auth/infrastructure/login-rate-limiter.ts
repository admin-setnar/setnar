import 'server-only';

import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  LOGIN_MAX_FAILED_ATTEMPTS,
  LOGIN_RATE_LIMIT_WINDOW_MS,
} from '@/modules/auth/domain/auth-rules';

/**
 * Login rate limiting, enforced in Postgres (see `supabase/migrations`) via
 * three `SECURITY DEFINER` RPCs, not in application memory. A module-level
 * counter would not survive across requests on a serverless deployment —
 * each one can land on a different, freshly-started instance — so state has
 * to live somewhere shared. This module holds no state of its own; it only
 * hashes the identifiers and calls the database.
 *
 * E-mail and IP are hashed before they ever leave this module, so the
 * `login_attempts` table never stores either in plain text.
 */
function hash(value: string): string {
  const salt = process.env.LOGIN_ATTEMPT_SALT;
  if (!salt) {
    throw new Error('LOGIN_ATTEMPT_SALT is not configured.');
  }
  return createHash('sha256').update(`${salt}:${value}`).digest('hex');
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function isLoginBlocked(
  supabase: SupabaseClient,
  email: string,
  ip: string | null,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_login_blocked', {
    p_email_hash: hash(normalizeEmail(email)),
    p_ip_hash: ip ? hash(ip) : null,
    p_max_attempts: LOGIN_MAX_FAILED_ATTEMPTS,
    p_window_seconds: LOGIN_RATE_LIMIT_WINDOW_MS / 1000,
  });

  // Fails closed on an unexpected RPC error: better a false "not blocked"
  // than blocking every login because of a transient database issue —
  // signInWithPassword remains the actual authority on the credentials.
  if (error) return false;
  return data === true;
}

export async function recordLoginFailure(
  supabase: SupabaseClient,
  email: string,
  ip: string | null,
): Promise<void> {
  await supabase.rpc('record_login_failure', {
    p_email_hash: hash(normalizeEmail(email)),
    p_ip_hash: ip ? hash(ip) : null,
    p_window_seconds: LOGIN_RATE_LIMIT_WINDOW_MS / 1000,
  });
}

export async function clearLoginAttempts(supabase: SupabaseClient, email: string): Promise<void> {
  await supabase.rpc('clear_login_attempts', {
    p_email_hash: hash(normalizeEmail(email)),
  });
}
