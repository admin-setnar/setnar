import assert from 'node:assert/strict';
import { globSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

/**
 * Static companion to `tests/service-role-client-boundary.test.ts`: proves
 * that no test file constructs a privileged `service_role` Supabase client
 * on its own — every one of them must go through
 * `createIntegrationServiceRoleClient()` (`tests/support/service-role-client.ts`),
 * the one place the anti-production guard is wired in. Same "consolidation"
 * style already used by `tests/analytics-integrity-consolidation.test.ts`/
 * `tests/authenticated-app-consolidation.test.ts` — read the real source,
 * assert on it, no mocking.
 *
 * `tests/support/service-role-client.ts` itself, and this file's own
 * fixture (`tests/support/__fixtures__/attempt-service-role-client.ts`,
 * which exists specifically to call the real constructor), are the only
 * allowed exceptions.
 */
const SANCTIONED_FILES = new Set([
  resolve(process.cwd(), 'tests/support/service-role-client.ts'),
  resolve(process.cwd(), 'tests/support/__fixtures__/attempt-service-role-client.ts'),
]);

// Matches createClient(...) calls whose argument list mentions a service-role
// credential by any of the variable names this codebase actually uses for
// it (serviceKey, SERVICE_ROLE_KEY, SERVICE_ROLE, serviceRoleKey) — the
// exact shape every direct construction had before this hardening (verified
// against the pre-patch `git diff`).
const DIRECT_SERVICE_ROLE_CLIENT_PATTERN = /createClient\([^)]*(serviceKey|SERVICE_ROLE_KEY|SERVICE_ROLE|serviceRoleKey)[^)]*\)/;

function testAndE2eSourceFiles(): string[] {
  return [
    ...globSync('tests/**/*.test.ts', { cwd: process.cwd() }),
    ...globSync('tests/e2e/**/*.ts', { cwd: process.cwd() }),
  ]
    .map((p) => resolve(process.cwd(), p))
    .filter((p, index, all) => all.indexOf(p) === index); // dedupe overlap between the two globs
}

describe('no test/E2E file constructs a service-role Supabase client outside the sanctioned helper', () => {
  it('scans every tests/**/*.test.ts and tests/e2e/**/*.ts file', () => {
    const files = testAndE2eSourceFiles();
    // Sanity floor so a glob regression (e.g. wrong cwd, pattern typo) fails
    // loudly instead of this test silently passing over zero files.
    assert.ok(files.length > 50, `expected to scan a large number of test files, found only ${files.length}`);

    const offenders: string[] = [];
    for (const file of files) {
      if (SANCTIONED_FILES.has(file)) continue;
      const source = readFileSync(file, 'utf8');
      if (DIRECT_SERVICE_ROLE_CLIENT_PATTERN.test(source)) offenders.push(file);
    }

    assert.deepEqual(
      offenders,
      [],
      `these files construct a service-role client directly instead of calling ` +
        `createIntegrationServiceRoleClient(): ${offenders.join(', ')}`,
    );
  });
});
