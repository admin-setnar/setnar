/**
 * Gate for `npm run test:integration` — does NOT run the RPC tests itself
 * (those already ran, or were gracefully skipped, as part of `npm run test`;
 * running them again here would double the load against the real Postgres
 * project for no benefit). Its only job is to turn "the integration suite
 * couldn't run" into a hard, loud failure for `npm run verify`/CI, instead
 * of the silent shrink `tests/login-rate-limiter.integration.test.ts`'s own
 * `skip: !canRun` produces on its own (confirmed: with the two env vars
 * below missing, `npm run test`'s summary goes from "tests 40 / pass 40" to
 * "tests 34 / pass 34" — both read as "everything passed").
 *
 * `npm run test` itself must stay green on a machine with no Supabase
 * project configured (ADR-017) — that requirement is unchanged and this
 * script does not run as part of it. This script exists only in
 * `test:integration`/`verify`, so a plain `npm run test` locally is
 * unaffected either way.
 *
 * Anti-production check first, unconditionally: by the time this script
 * runs, `npm run test` (which actually executes the privileged
 * `*.integration.test.ts` files) has already run — see
 * `scripts/preload-supabase-production-guard.mjs`'s doc comment for why the
 * real enforcement point is a `--import` preload on the `test` script, not
 * here. This call stays as defense-in-depth for anyone invoking
 * `test:integration` directly, and to fail loud+early if it somehow runs
 * before `test`.
 */
import { assertSupabaseIntegrationTargetIsSafe } from './supabase-production-guard.mjs';

assertSupabaseIntegrationTargetIsSafe();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    '\n❌ PRIVILEGED INTEGRATION TESTS NOT RUN — Analytics/Leads grants, backend\n' +
      '   persistence, public accessibility, concurrency and tenant-scoped RLS were not\n' +
      '   fully exercised this run.\n\n' +
      '   Privileged integration suites self-skip\n' +
      '   when NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/\n' +
      '   SUPABASE_SERVICE_ROLE_KEY are\n' +
      '   missing — `npm run test` alone stays green when that happens (ADR-017\n' +
      '   requires it to, for local dev without a Supabase project). This script\n' +
      '   exists so `npm run verify`/CI does not stay green under the same\n' +
      '   condition: set all three env vars, apply every migration, and\n' +
      '   re-run.\n',
  );
  process.exit(1);
}

console.log('✔ Integration env present — public and privileged security suites were exercised by `npm run test`.');
