import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createClient, type PostgrestError } from '@supabase/supabase-js';

/**
 * Regression test for the RLS policy cycle between `representatives` and
 * `product_activations` — fixed by
 * `supabase/migrations/20260805000000_fix_rls_policy_cycle.sql`.
 *
 * Why this file exists at all. `supabase/README.md` states plainly that
 * "nenhum teste automatizado deste repositório exercita RLS contra um banco
 * real", and this bug is exactly what that gap hides: with
 * `20260804000000_add_own_row_select_policies.sql` applied and this fix
 * missing, every one of the queries below returns HTTP 500 /
 * `42P17 infinite recursion detected in policy` — and NOTHING in the app
 * surfaces it. `SupabaseRepresentativeRepository.findPublishedActivation()`
 * does `if (error || !data) return null`, so `[productSlug]/page.tsx` calls
 * `notFound()` and every Commercial Page serves a plain 404 (confirmed
 * against a running dev server: `curl -H 'Host: joao-silva.setnar.com'
 * localhost:3000/conexao-green` → HTTP 404, no error, no log). A silent 404
 * on the one page the product exists to publish is precisely the failure a
 * unit test cannot see and a human reviewer reads right past.
 *
 * Anonymous only, deliberately. The cycle was reproduced on BOTH the
 * anonymous and the authenticated path (see 20260805000000's header for both
 * transcripts), but it fires for anon too — so proving it there needs no
 * throwaway `auth.users` row per CI run. `auth.uid()` being null does not
 * weaken the check: 42P17 is raised while the planner expands the policies,
 * before any row is matched.
 *
 * Same self-skipping posture as the other two integration suites: green on a
 * machine with no Supabase project (ADR-017), with `npm run test:integration`
 * (`scripts/require-integration-env.mjs`) turning that skip into a loud
 * failure for `npm run verify`/CI.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const canRun = Boolean(SUPABASE_URL && SUPABASE_KEY);
const skipReason =
  'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, with the migrations already applied, to run this suite.';

const supabase = canRun ? createClient(SUPABASE_URL!, SUPABASE_KEY!) : null;

/**
 * Asserts only the absence of the recursion error — never a row count. Which
 * rows an anonymous caller sees depends on what the configured project holds
 * (a published activation may or may not exist), and this suite must not
 * become a fixture-dependent test of `representatives_select_public`'s
 * scoping; that scoping is what `supabase/README.md`'s manual checklist
 * covers. Zero rows is a perfectly valid pass here. A 42P17 is not.
 */
function assertNoPolicyRecursion(label: string, error: PostgrestError | null): void {
  if (error?.code === '42P17') {
    assert.fail(
      `${label}: RLS policy cycle is back — Postgres returned ${error.code}: "${error.message}". ` +
        'See supabase/migrations/20260805000000_fix_rls_policy_cycle.sql. A new policy whose ' +
        'USING clause selects from another table whose own policies select back is what causes this.',
    );
  }
  assert.equal(error, null, `${label}: unexpected error ${error?.code}: ${error?.message}`);
}

describe('RLS policy cycle (Postgres, integration)', { skip: !canRun && skipReason }, () => {
  it('selects representatives without infinite recursion', async () => {
    const { error } = await supabase!
      .from('representatives')
      .select('id,slug,display_name,status')
      .limit(1);
    assertNoPolicyRecursion('representatives', error);
  });

  it('selects product_activations without infinite recursion', async () => {
    const { error } = await supabase!
      .from('product_activations')
      .select('id,representative_id,status')
      .limit(1);
    assertNoPolicyRecursion('product_activations', error);
  });

  it('selects leads without infinite recursion', async () => {
    // `leads_select_own` selects from `representatives`, so it inherits the
    // whole cycle through a neighbouring table even though `leads` itself has
    // no policy referencing `product_activations`.
    const { error } = await supabase!.from('leads').select('id').limit(1);
    assertNoPolicyRecursion('leads', error);
  });

  it('runs the Commercial Page query itself without infinite recursion', async () => {
    // Byte-for-byte the shape `SupabaseRepresentativeRepository` builds — the
    // embedded join is where the cycle actually reaches a real visitor.
    const { error } = await supabase!
      .from('product_activations')
      .select(
        `
        status,
        representative:representatives!inner (
          id, slug, display_name, license_id, phone, city, avatar_url, status
        ),
        product:products!inner ( id, slug, name )
      `,
      )
      .eq('status', 'published')
      .limit(1);
    assertNoPolicyRecursion('commercial page join', error);
  });
});

describe('RLS policy cycle — controls', { skip: !canRun && skipReason }, () => {
  it('reads the seeded catalog, proving the key and project are reachable', async () => {
    // If this fails too, the suite above is failing for some reason other
    // than the policy cycle — `products_select_public` is `using (true)` and
    // references no other table, so it cannot recurse.
    const { data, error } = await supabase!.from('products').select('slug');
    assert.equal(error, null, `products: unexpected error ${error?.code}: ${error?.message}`);
    assert.ok((data?.length ?? 0) > 0, 'expected the D1 catalog seed to be applied');
  });
});
