import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

import { PRODUCTION_SUPABASE_PROJECT_REF, ALLOWED_TEST_SUPABASE_PROJECT_REFS } from '../scripts/supabase-production-guard.mjs';

/**
 * Proves the actual bypass this hardening closes: a test file/helper
 * invoked directly with `tsx`, with NO `--import` preload and NO npm
 * script involved, must still be unable to construct a privileged
 * `service_role` Supabase client against production. Deliberately not a
 * mock of `process.exit`/`assertSupabaseIntegrationTargetIsSafe` — this
 * spawns a real, separate `tsx` process running the real fixture, importing
 * the real `createIntegrationServiceRoleClient()`, so it fails the same way
 * an actual accidental direct invocation would.
 *
 * No real Supabase project is touched: `createClient()` alone performs no
 * network call, and a BLOCK verdict aborts before it would even be
 * reached — confirmed by the fixture only printing its marker line AFTER
 * a client is successfully constructed.
 */
const fixturePath = resolve(process.cwd(), 'tests/support/__fixtures__/attempt-service-role-client.ts');
const FAKE_KEY = 'fake-not-a-real-service-role-key';

function runFixture(env: Record<string, string | undefined>) {
  return spawnSync(process.execPath, [resolve(process.cwd(), 'node_modules/tsx/dist/cli.mjs'), fixturePath], {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    encoding: 'utf8',
    timeout: 30_000,
  });
}

describe('createIntegrationServiceRoleClient() boundary — direct-invocation bypass', () => {
  it('BLOCKs a bare tsx invocation targeting production, before constructing any client', () => {
    const result = runFixture({
      NEXT_PUBLIC_SUPABASE_URL: `https://${PRODUCTION_SUPABASE_PROJECT_REF}.supabase.co`,
      SUPABASE_SERVICE_ROLE_KEY: FAKE_KEY,
    });

    assert.equal(result.status, 1, `expected exit 1, got ${result.status}. stderr: ${result.stderr}`);
    assert.match(result.stderr, /FATAL/);
    assert.match(result.stderr, /production/i);
    assert.doesNotMatch(result.stdout, /SERVICE_ROLE_CLIENT_CONSTRUCTED/);
  });

  it('BLOCKs a bare tsx invocation targeting an unrecognized project', () => {
    const result = runFixture({
      NEXT_PUBLIC_SUPABASE_URL: 'https://aaaaaaaaaaaaaaaaaaaa.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: FAKE_KEY,
    });

    assert.equal(result.status, 1);
    assert.doesNotMatch(result.stdout, /SERVICE_ROLE_CLIENT_CONSTRUCTED/);
  });

  it('ALLOWs a bare tsx invocation targeting the known safe test project', () => {
    const result = runFixture({
      NEXT_PUBLIC_SUPABASE_URL: `https://${ALLOWED_TEST_SUPABASE_PROJECT_REFS[0]}.supabase.co`,
      SUPABASE_SERVICE_ROLE_KEY: FAKE_KEY,
    });

    assert.equal(result.status, 0, `expected exit 0, got ${result.status}. stderr: ${result.stderr}`);
    assert.match(result.stdout, /SERVICE_ROLE_CLIENT_CONSTRUCTED/);
  });

  it('does not attempt privileged construction at all when no service role key is configured (ADR-017)', () => {
    const result = runFixture({
      NEXT_PUBLIC_SUPABASE_URL: `https://${PRODUCTION_SUPABASE_PROJECT_REF}.supabase.co`,
      SUPABASE_SERVICE_ROLE_KEY: undefined,
    });

    // createIntegrationServiceRoleClient() returns null (SKIP), the fixture
    // never reaches its console.log, but the process itself must not crash.
    assert.equal(result.status, 0);
    assert.doesNotMatch(result.stdout, /SERVICE_ROLE_CLIENT_CONSTRUCTED/);
  });
});
