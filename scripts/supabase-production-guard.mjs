/**
 * Canonical, single-source guard against integration tests, E2E fixtures,
 * or other test-only/destructive tooling running privileged Supabase
 * operations against the SETNAR production project.
 *
 * Born from `docs/plans/AUDIT_PROFILE_REPRESENTATIVE_INTEGRITY_2026-09-01.md`
 * §14/§15: nothing in this repository previously verified *which* Supabase
 * project `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` pointed at
 * before running privileged (`service_role`) test code that includes real
 * `DELETE`s — only that the variables were non-empty
 * (`scripts/require-integration-env.mjs`). `.env.local` and
 * `.env.production.local` share the exact same variable names, so a shell
 * that loaded the wrong file was structurally one step away from running
 * destructive test cleanup against real data.
 *
 * Deliberately scoped to two variables only: `NEXT_PUBLIC_SUPABASE_URL` and
 * `SUPABASE_SERVICE_ROLE_KEY`. `SUPABASE_SERVICE_ROLE_KEY` is what makes an
 * operation destructive — it is the only credential in this project capable
 * of bypassing RLS (`representatives` has no DELETE policy for
 * `anon`/`authenticated` at all, confirmed in the audit above and in
 * `docs/adr/ADR-040-registerrepresentative-primeira-escrita-self-service-em-representatives.md`).
 * `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is deliberately NOT considered here:
 * it can never authorize a destructive write on its own, and the project's
 * own privileged scripts (`execute-lgpd-request.ts`,
 * `reconcile-billing-subscription.ts`) use `SUPABASE_SERVICE_ROLE_KEY`
 * without it — requiring it here would make this guard unusable for those
 * shapes without actually improving safety.
 *
 * `evaluateSupabaseIntegrationTarget` is pure and deterministic — no env
 * reads, no I/O, safe to unit test exhaustively
 * (`tests/supabase-production-guard.test.ts`). All side effects (reading
 * `process.env`, printing, `process.exit`) live only in
 * `assertSupabaseIntegrationTargetIsSafe`.
 */

// Confirmed 2026-09-01 via a read-only GET against `.env.production.local`'s
// `NEXT_PUBLIC_SUPABASE_URL` (hostname only — the service role key itself
// was never read into this file or printed anywhere), matching the
// production project already identified in
// `docs/plans/AUDIT_PROFILE_REPRESENTATIVE_INTEGRITY_2026-09-01.md`. If the
// SETNAR production Supabase project is ever migrated to a new ref, update
// this constant with the same kind of verification — never guess.
export const PRODUCTION_SUPABASE_PROJECT_REF = 'xiysyzauoifbcoviqblf';

/**
 * The only Supabase project this repository's own documentation names as
 * safe for destructive test/E2E use: `setnar-db-test`, the disposable
 * project used for `.env.local`, CI's `Preview` environment secrets, and
 * every "executado contra `setnar-db-test`" validation in
 * `supabase/README.md` (e.g. SET-10, confirmed by
 * `supabase/.temp/linked-project.json` at the time). `.env.example` states
 * the same rule in prose: "In Preview, use only a disposable Supabase
 * project ... never point tests at production data." An allowlist (rather
 * than a denylist of only the production ref) is deliberate — see
 * `evaluateSupabaseIntegrationTarget` below: an unrecognized third project
 * is treated the same as production, not assumed safe by default.
 */
export const ALLOWED_TEST_SUPABASE_PROJECT_REFS = Object.freeze(['smspbjmqhpjcjilzoexr']);

const SUPABASE_HOSTED_HOST_PATTERN = /^([a-z0-9]{20})\.supabase\.co$/;

/**
 * @param {{ supabaseUrl?: string | null, serviceRoleKey?: string | null }} input
 * @returns {{ verdict: 'ALLOW' | 'BLOCK' | 'SKIP', reason: string }}
 */
export function evaluateSupabaseIntegrationTarget({ supabaseUrl, serviceRoleKey }) {
  // No privileged credential at all: no destructive operation is possible
  // through this process — every service-role write path in this repo
  // requires SUPABASE_SERVICE_ROLE_KEY. This is the ordinary "no Supabase
  // project configured" dev machine (ADR-017), not a misconfiguration to
  // block; the caller's own self-skip logic (`canRun`/`skip: !canRun` in
  // each integration test) already handles it correctly.
  if (!serviceRoleKey) {
    return {
      verdict: 'SKIP',
      reason: 'SUPABASE_SERVICE_ROLE_KEY is not set — no privileged Supabase operation is possible in this process.',
    };
  }

  if (!supabaseUrl) {
    return {
      verdict: 'BLOCK',
      reason: 'SUPABASE_SERVICE_ROLE_KEY is set but NEXT_PUBLIC_SUPABASE_URL is missing — cannot prove the target is safe.',
    };
  }

  let hostname;
  try {
    hostname = new URL(supabaseUrl).hostname;
  } catch {
    return {
      verdict: 'BLOCK',
      reason: `NEXT_PUBLIC_SUPABASE_URL is not a valid URL (${JSON.stringify(supabaseUrl)}) — cannot prove the target is safe.`,
    };
  }

  const match = SUPABASE_HOSTED_HOST_PATTERN.exec(hostname);
  if (!match) {
    // Doesn't even look like a *.supabase.co hosted project (typo, custom
    // domain, local/self-hosted stack, ...) — cannot positively identify
    // which project this is. Fail closed rather than assume it's fine.
    return {
      verdict: 'BLOCK',
      reason: `NEXT_PUBLIC_SUPABASE_URL host is not a recognizable Supabase project host: "${hostname}".`,
    };
  }

  const projectRef = match[1];

  if (projectRef === PRODUCTION_SUPABASE_PROJECT_REF) {
    return {
      verdict: 'BLOCK',
      reason: `target is the SETNAR production Supabase project (${projectRef}).`,
    };
  }

  if (!ALLOWED_TEST_SUPABASE_PROJECT_REFS.includes(projectRef)) {
    return {
      verdict: 'BLOCK',
      reason:
        `target project ref "${projectRef}" is not in the allowlist of known safe development/test Supabase ` +
        'projects — an unrecognized project is treated the same as production until explicitly allowlisted.',
    };
  }

  return { verdict: 'ALLOW', reason: `target project ref ${projectRef} is the known disposable test project.` };
}

/**
 * Side-effecting wrapper: reads `env` (defaults to `process.env`), and
 * `process.exit(1)`s with a loud, unambiguous message if the evaluated
 * verdict is `BLOCK`. Call this as early as possible in any entrypoint that
 * may run privileged/destructive Supabase operations — before the first
 * Supabase client is even constructed, let alone called.
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{ verdict: 'ALLOW' | 'BLOCK' | 'SKIP', reason: string }}
 */
export function assertSupabaseIntegrationTargetIsSafe(env = process.env) {
  const result = evaluateSupabaseIntegrationTarget({
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  });

  if (result.verdict === 'BLOCK') {
    console.error(
      '\n🛑 FATAL: integration tests/E2E fixtures cannot run against this Supabase target.\n\n' +
        `   Reason: ${result.reason}\n\n` +
        `   The SETNAR production project (${PRODUCTION_SUPABASE_PROJECT_REF}) must never be targeted by\n` +
        '   integration tests, E2E fixtures, or any other test-only/destructive tooling.\n' +
        '   Point NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY at the dedicated\n' +
        '   disposable development/test Supabase project instead (see .env.example).\n\n' +
        '   No database operation was executed.\n',
    );
    process.exit(1);
  }

  return result;
}
