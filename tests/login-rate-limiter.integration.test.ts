import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';

import { createClient } from '@supabase/supabase-js';

import {
  LOGIN_MAX_FAILED_ATTEMPTS_PER_EMAIL,
  LOGIN_RATE_LIMIT_WINDOW_MS,
} from '@/modules/auth/domain/auth-rules';

/**
 * The login rate limiter's logic lives in Postgres now (see
 * `supabase/migrations`), not in a testable-in-isolation Node module — a
 * module-level counter does not survive across requests on a serverless
 * deployment, which is exactly why it was moved. That makes this an
 * integration test against the real RPCs, not a unit test with an injected
 * clock.
 *
 * Skips instead of failing when the project is not configured, so
 * `npm run verify` stays green on any machine without a Supabase project
 * wired up (this file's own dev machine included, until the migration is
 * applied there).
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const canRun = Boolean(SUPABASE_URL && SUPABASE_KEY);
const skipReason =
  'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, with the migration already applied, to run this suite.';

describe('login rate limiter RPCs (Postgres, integration)', { skip: !canRun && skipReason }, () => {
  const supabase = canRun ? createClient(SUPABASE_URL!, SUPABASE_KEY!) : null;

  function testIdentity() {
    // A fresh, never-reused email/IP per test avoids collisions with rows
    // any previous run left behind (they self-expire, but a run right after
    // another should not depend on that).
    const suffix = randomUUID();
    return { email: `rate-limiter-test-${suffix}@example.invalid`, ip: `test-ip-${suffix}` };
  }

  it('stays unblocked below the limit, then blocks once the limit is reached', async () => {
    const { email, ip } = testIdentity();
    const maxAttempts = 2;
    const windowSeconds = 60;

    const before = await supabase!.rpc('is_login_blocked', {
      p_email_hash: email,
      p_ip_hash: ip,
      p_max_attempts_email: maxAttempts,
      p_max_attempts_ip: maxAttempts,
      p_window_seconds: windowSeconds,
    });
    assert.equal(before.error, null);
    assert.equal(before.data, false);

    await supabase!.rpc('record_login_failure', {
      p_email_hash: email,
      p_ip_hash: ip,
      p_window_seconds: windowSeconds,
    });

    const afterOne = await supabase!.rpc('is_login_blocked', {
      p_email_hash: email,
      p_ip_hash: ip,
      p_max_attempts_email: maxAttempts,
      p_max_attempts_ip: maxAttempts,
      p_window_seconds: windowSeconds,
    });
    assert.equal(afterOne.data, false, 'one failure must not block a 2-attempt limit');

    await supabase!.rpc('record_login_failure', {
      p_email_hash: email,
      p_ip_hash: ip,
      p_window_seconds: windowSeconds,
    });

    const afterTwo = await supabase!.rpc('is_login_blocked', {
      p_email_hash: email,
      p_ip_hash: ip,
      p_max_attempts_email: maxAttempts,
      p_max_attempts_ip: maxAttempts,
      p_window_seconds: windowSeconds,
    });
    assert.equal(afterTwo.data, true, 'the second failure must trip a 2-attempt limit');
  });

  it('blocks independently by IP, even across different e-mails', async () => {
    const { ip } = testIdentity();
    const maxAttempts = 2;
    const windowSeconds = 60;

    await supabase!.rpc('record_login_failure', {
      p_email_hash: `rate-limiter-test-${randomUUID()}-a@example.invalid`,
      p_ip_hash: ip,
      p_window_seconds: windowSeconds,
    });
    await supabase!.rpc('record_login_failure', {
      p_email_hash: `rate-limiter-test-${randomUUID()}-b@example.invalid`,
      p_ip_hash: ip,
      p_window_seconds: windowSeconds,
    });

    const blocked = await supabase!.rpc('is_login_blocked', {
      p_email_hash: `rate-limiter-test-${randomUUID()}-untried@example.invalid`,
      p_ip_hash: ip,
      p_max_attempts_email: maxAttempts,
      p_max_attempts_ip: maxAttempts,
      p_window_seconds: windowSeconds,
    });
    assert.equal(
      blocked.data,
      true,
      'two failures from the same IP against different e-mails must still trip the IP limit',
    );
  });

  it('clear_login_attempts un-blocks the e-mail on the next successful sign-in', async () => {
    const { email, ip } = testIdentity();
    const maxAttempts = 1;
    const windowSeconds = 60;

    await supabase!.rpc('record_login_failure', {
      p_email_hash: email,
      p_ip_hash: ip,
      p_window_seconds: windowSeconds,
    });

    const blocked = await supabase!.rpc('is_login_blocked', {
      p_email_hash: email,
      p_ip_hash: ip,
      p_max_attempts_email: maxAttempts,
      p_max_attempts_ip: maxAttempts,
      p_window_seconds: windowSeconds,
    });
    assert.equal(blocked.data, true);

    await supabase!.rpc('clear_login_attempts', { p_email_hash: email });

    const afterClear = await supabase!.rpc('is_login_blocked', {
      p_email_hash: email,
      p_ip_hash: ip,
      p_max_attempts_email: maxAttempts,
      p_max_attempts_ip: maxAttempts,
      p_window_seconds: windowSeconds,
    });
    assert.equal(afterClear.data, false);
  });

  it('releases the block once the window expires', async () => {
    const { email, ip } = testIdentity();
    const maxAttempts = 1;
    const windowSeconds = 1;

    await supabase!.rpc('record_login_failure', {
      p_email_hash: email,
      p_ip_hash: ip,
      p_window_seconds: windowSeconds,
    });

    const blocked = await supabase!.rpc('is_login_blocked', {
      p_email_hash: email,
      p_ip_hash: ip,
      p_max_attempts_email: maxAttempts,
      p_max_attempts_ip: maxAttempts,
      p_window_seconds: windowSeconds,
    });
    assert.equal(blocked.data, true);

    await new Promise((resolve) => setTimeout(resolve, 1500));

    const afterWindow = await supabase!.rpc('is_login_blocked', {
      p_email_hash: email,
      p_ip_hash: ip,
      p_max_attempts_email: maxAttempts,
      p_max_attempts_ip: maxAttempts,
      p_window_seconds: windowSeconds,
    });
    assert.equal(afterWindow.data, false);
  });

  it('a caller-supplied p_window_seconds cannot wipe another identity\'s attempts', async () => {
    const victim = testIdentity();
    const attacker = testIdentity();
    const maxAttempts = 1;
    const windowSeconds = 900;

    await supabase!.rpc('record_login_failure', {
      p_email_hash: victim.email,
      p_ip_hash: victim.ip,
      p_window_seconds: windowSeconds,
    });

    const blockedBefore = await supabase!.rpc('is_login_blocked', {
      p_email_hash: victim.email,
      p_ip_hash: victim.ip,
      p_max_attempts_email: maxAttempts,
      p_max_attempts_ip: maxAttempts,
      p_window_seconds: windowSeconds,
    });
    assert.equal(blockedBefore.data, true);

    // Attacker: an identity unrelated to the victim, calling with a
    // degenerate window. Before the fix, this wipes every row in
    // login_attempts regardless of email_hash/ip_hash — including the
    // victim's — because the cleanup DELETE trusted this value.
    await supabase!.rpc('record_login_failure', {
      p_email_hash: attacker.email,
      p_ip_hash: attacker.ip,
      p_window_seconds: 0,
    });

    const blockedAfter = await supabase!.rpc('is_login_blocked', {
      p_email_hash: victim.email,
      p_ip_hash: victim.ip,
      p_max_attempts_email: maxAttempts,
      p_max_attempts_ip: maxAttempts,
      p_window_seconds: windowSeconds,
    });
    assert.equal(
      blockedAfter.data,
      true,
      'an unrelated caller recording a failure with p_window_seconds = 0 must not clear existing attempts',
    );
  });
});

/**
 * RPC-LEVEL test, NOT a signIn() test. This calls is_login_blocked /
 * record_login_failure directly — it does not call
 * SupabaseAuthGateway.signIn() and does not prove the front door is
 * exploitable. It only proves that the real RPCs, driven with
 * auth-rules.ts's real thresholds and a hash reproduced from the real
 * algorithm, trip a lockout for an identity the caller never authenticated
 * as.
 *
 * `login-rate-limiter.ts` and `supabase-auth-gateway.ts` both start with
 * `import 'server-only'`, which throws unconditionally the moment anything
 * requires them outside Next.js's bundler (confirmed directly:
 * `node_modules/server-only/index.js` is an unconditional `throw`) — the same
 * constraint ADR-015 already documents as the reason `is-duplicate-signup.ts`
 * had to be extracted into its own importable file. Neither file can be
 * imported from a plain `tsx --test` process, so `SupabaseAuthGateway.signIn()`
 * cannot be exercised from this suite at all.
 *
 * The actual front-door claim (typing a wrong password in the real /entrar
 * form locks out an e-mail known to the attacker) was verified separately,
 * manually, against a running `npm run dev` instance, with every attempt's
 * raw rendered result recorded: attempts 1-5 each rendered "E-mail ou senha
 * não conferem", attempt 6 rendered "Muitas tentativas seguidas". That
 * verification is not automated and is not part of this test.
 */
describe(
  'is_login_blocked / record_login_failure RPCs with real business thresholds (Postgres, integration) — direct RPC calls, does NOT exercise signIn()',
  { skip: !canRun && skipReason },
  () => {
    const supabase = canRun ? createClient(SUPABASE_URL!, SUPABASE_KEY!) : null;
    const salt = process.env.LOGIN_ATTEMPT_SALT;

    function hash(value: string): string {
      return createHash('sha256').update(`${salt}:${value}`).digest('hex');
    }

    it('is_login_blocked flips to true after LOGIN_MAX_FAILED_ATTEMPTS_PER_EMAIL direct record_login_failure calls (RPC-level, not signIn())', async () => {
      assert.ok(salt, 'LOGIN_ATTEMPT_SALT must be set for this test to reflect the real hash.');

      const targetEmail = `frontdoor-${randomUUID()}@example.invalid`;
      const emailHash = hash(targetEmail.trim().toLowerCase());
      const attackerIpHash = hash(`attacker-ip-${randomUUID()}`);
      const windowSeconds = LOGIN_RATE_LIMIT_WINDOW_MS / 1000;

      const before = await supabase!.rpc('is_login_blocked', {
        p_email_hash: emailHash,
        p_ip_hash: attackerIpHash,
        p_max_attempts_email: LOGIN_MAX_FAILED_ATTEMPTS_PER_EMAIL,
        p_max_attempts_ip: 999_999, // isolated from the e-mail threshold being tested
        p_window_seconds: windowSeconds,
      });
      assert.equal(before.data, false);

      for (let i = 0; i < LOGIN_MAX_FAILED_ATTEMPTS_PER_EMAIL; i++) {
        await supabase!.rpc('record_login_failure', {
          p_email_hash: emailHash,
          p_ip_hash: attackerIpHash,
          p_window_seconds: windowSeconds,
        });
      }

      const after = await supabase!.rpc('is_login_blocked', {
        p_email_hash: emailHash,
        p_ip_hash: attackerIpHash,
        p_max_attempts_email: LOGIN_MAX_FAILED_ATTEMPTS_PER_EMAIL,
        p_max_attempts_ip: 999_999,
        p_window_seconds: windowSeconds,
      });
      assert.equal(
        after.data,
        true,
        `${LOGIN_MAX_FAILED_ATTEMPTS_PER_EMAIL} recorded failures against a real target e-mail must trip the real business threshold`,
      );
    });
  },
);
