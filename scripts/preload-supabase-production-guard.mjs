/**
 * `--import` preload for `node`, wired into the `test` npm script.
 *
 * Why a preload and not just the check already inside
 * `scripts/require-integration-env.mjs`: `npm run verify` runs `test` BEFORE
 * `test:integration` (`typecheck && lint && test && test:integration &&
 * build`) — the actual privileged/destructive `*.integration.test.ts` files
 * execute as part of `test` (they self-skip per-file when their own env
 * vars are absent), not `test:integration` (which only gates that they
 * *did* run, after the fact). A check placed solely in
 * `require-integration-env.mjs` would run too late to stop anything.
 *
 * `--import` runs this module in the same `node` process before it loads
 * the real entrypoint (tsx's CLI, then every matched test file) — so a
 * `process.exit(1)` here happens before any test file, and therefore any
 * Supabase client or query, is ever created.
 */
import { assertSupabaseIntegrationTargetIsSafe } from './supabase-production-guard.mjs';

assertSupabaseIntegrationTargetIsSafe();
