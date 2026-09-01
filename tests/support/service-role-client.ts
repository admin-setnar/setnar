import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { assertSupabaseIntegrationTargetIsSafe } from '../../scripts/supabase-production-guard.mjs';

/**
 * The ONLY sanctioned way for a test file (integration or E2E) to obtain a
 * privileged `service_role` Supabase client. Never construct
 * `createClient(url, serviceRoleKey, ...)` directly in a test file —
 * `tests/service-role-client-boundary-consolidation.test.ts` enforces this
 * statically.
 *
 * Why this exists, on top of the `--import` preload
 * (`scripts/preload-supabase-production-guard.mjs`) already wired into the
 * `test`/`test:e2e` npm scripts: that preload only runs when tests are
 * launched through those scripts. A test file invoked directly — `npx tsx
 * --test tests/foo.integration.test.ts`, bypassing `npm run test` entirely —
 * never loads the preload, and until this helper existed, every integration
 * test constructed its `service_role` client inline with no destination
 * check at all. This function is the last, unavoidable choke point: no
 * matter how a test process was started, a privileged client cannot be
 * constructed without first passing through
 * `assertSupabaseIntegrationTargetIsSafe()`, which `process.exit(1)`s before
 * ANY Supabase call if the target is production, unrecognized, or
 * ambiguous. See
 * `docs/plans/AUDIT_PROFILE_REPRESENTATIVE_INTEGRITY_2026-09-01.md` §14/§15
 * and `tests/service-role-client-boundary.test.ts` (proves this by actually
 * spawning a bare `tsx` process with no preload, no npm script involved).
 *
 * Returns `null` when `SUPABASE_SERVICE_ROLE_KEY` is absent — same contract
 * every call site already had (`canRun ? createClient(...) : null`) and the
 * same ADR-017 requirement `assertSupabaseIntegrationTargetIsSafe()` itself
 * already honors (SKIP, not BLOCK, when there is no privileged credential
 * to protect).
 */
export function createIntegrationServiceRoleClient(env: NodeJS.ProcessEnv = process.env): SupabaseClient | null {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return null;

  // Aborts the whole process (before any Supabase call) if the target is
  // not the known safe test project. Reaching the line below means ALLOW.
  assertSupabaseIntegrationTargetIsSafe(env);

  if (!supabaseUrl) {
    // Unreachable in practice — assertSupabaseIntegrationTargetIsSafe()
    // already BLOCKs a missing URL whenever serviceRoleKey is present — kept
    // as a type-narrowing guard, not a new safety condition.
    throw new Error('createIntegrationServiceRoleClient() called without NEXT_PUBLIC_SUPABASE_URL configured.');
  }

  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}
