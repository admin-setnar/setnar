import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { mapSupabaseAuthError } from '@/modules/auth/infrastructure/map-supabase-auth-error';

describe('mapSupabaseAuthError', () => {
  it('maps a duplicate account error to email_already_registered', () => {
    const code = mapSupabaseAuthError({
      status: 422,
      code: 'user_already_exists',
      message: 'User already registered',
    });
    assert.equal(code, 'email_already_registered');
  });

  it('maps a weak-password rejection to weak_password', () => {
    const code = mapSupabaseAuthError({
      status: 422,
      code: 'weak_password',
      message: 'Password is too weak',
    });
    assert.equal(code, 'weak_password');
  });

  it('maps an invalid-credentials response to invalid_credentials', () => {
    const code = mapSupabaseAuthError({
      status: 400,
      code: 'invalid_credentials',
      message: 'Invalid login credentials',
    });
    assert.equal(code, 'invalid_credentials');
  });

  it('falls back on the message when no code is present (older/self-hosted GoTrue)', () => {
    const code = mapSupabaseAuthError({
      status: 400,
      message: 'Invalid login credentials',
    });
    assert.equal(code, 'invalid_credentials');
  });

  it('falls back to unknown for anything unrecognised', () => {
    const code = mapSupabaseAuthError({
      status: 500,
      message: 'internal server error',
    });
    assert.equal(code, 'unknown');
  });

  it('maps the built-in e-mail service rate limit to its own code, not rate_limited', () => {
    const code = mapSupabaseAuthError({
      status: 429,
      code: 'over_email_send_rate_limit',
      message: 'Email rate limit exceeded',
    });
    assert.equal(code, 'email_service_unavailable');
    assert.notEqual(code, 'rate_limited');
  });

  it('falls back on the message for a duplicate sign-up when no code is present (self-hosted GoTrue)', () => {
    const code = mapSupabaseAuthError({
      status: 422,
      message: 'A user with this email address has already been registered',
    });
    assert.equal(code, 'email_already_registered');
  });

  it('antienumeration: a non-existent e-mail and a wrong password map to the exact same code', () => {
    // These are two distinct real-world failures that a naive implementation
    // could be tempted to distinguish. Supabase itself already returns the
    // identical shape for both on signInWithPassword; this test locks that
    // in so the mapping function can never grow a branch that tells them
    // apart, which would turn the login form into an account-enumeration
    // oracle.
    const wrongPassword = mapSupabaseAuthError({
      status: 400,
      code: 'invalid_credentials',
      message: 'Invalid login credentials',
    });
    const noSuchAccount = mapSupabaseAuthError({
      status: 400,
      code: 'invalid_credentials',
      message: 'Invalid login credentials',
    });

    assert.equal(wrongPassword, 'invalid_credentials');
    assert.equal(noSuchAccount, 'invalid_credentials');
    assert.equal(wrongPassword, noSuchAccount);
  });
});
