import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createClient } from '@supabase/supabase-js';

/**
 * Integration coverage for `analytics_events`'s RLS
 * (`supabase/migrations/20260810000000_add_analytics_events.sql`, AN1).
 *
 * Automates ONLY the anonymous side of `analytics_events_select_own`.
 * Unlike `leads`/`representatives`, `analytics_events` has no SECURITY
 * DEFINER function to insert through yet (`record_page_visit`/
 * `record_whatsapp_click` are AN2/AN4, not this step) and zero INSERT
 * policy exists on the table itself — so there is currently NO path,
 * anonymous or authenticated, that can put a row into it. Combined with
 * this project having no service role key
 * (`register-representative.integration.test.ts` documents the same
 * constraint for a different table), that makes two things untestable at
 * this step, not just inconvenient to test:
 *
 *   1. Proving `analytics_events_select_own` actually SCOPES rows to their
 *      owning representative (representative A cannot see representative
 *      B's events) — needs at least one real row to check against.
 *   2. Exercising the `event_type` CHECK constraint through the publishable
 *      key — moot regardless of seeding, because zero INSERT policy exists
 *      here: ANY insert attempt through the publishable key is rejected by
 *      RLS before the CHECK constraint is ever reached, valid value or not.
 *      Verified manually instead (`supabase/README.md`, passo 14), via the
 *      SQL Editor — which bypasses RLS but never bypasses CHECK/FK
 *      constraints.
 *
 * Both become automatable once AN2/AN4 exist: `record_page_visit`/
 * `record_whatsapp_click`, like `submit_lead`, will be granted to `anon`,
 * so a future suite can seed real rows anonymously and then check
 * cross-representative isolation with two authenticated sessions — that
 * suite's own follow-up, not a gap silently dropped here.
 *
 * What IS provable without any account or seeded row: an anonymous caller
 * (no session, `auth.uid()` null) reaches `analytics_events` without a
 * relation-missing or policy-recursion error, and sees zero rows, because
 * `is_own_representative()`'s `auth.uid()` comparison never matches null.
 *
 * Same self-skipping posture as the other integration suites: green on a
 * machine with no Supabase project (ADR-017), with `npm run test:integration`
 * turning that skip into a loud failure for `npm run verify`/CI.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const canRun = Boolean(SUPABASE_URL && SUPABASE_KEY);
const skipReason =
  'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, with the migration already applied, to run this suite.';

const supabase = canRun ? createClient(SUPABASE_URL!, SUPABASE_KEY!) : null;

describe('analytics_events RLS (Postgres, integration)', { skip: !canRun && skipReason }, () => {
  it('is reachable by an anonymous caller without a relation-missing or policy-recursion error', async () => {
    const { error } = await supabase!.from('analytics_events').select('id').limit(1);
    if (error?.code === '42P17') {
      assert.fail(
        `RLS policy cycle detected on analytics_events: ${error.message}. See ` +
          "supabase/migrations/20260805000000_fix_rls_policy_cycle.sql for the mechanism " +
          "this table's policy (analytics_events_select_own, via is_own_representative()) was " +
          'written to avoid.',
      );
    }
    assert.notEqual(
      error?.code,
      'PGRST205',
      'analytics_events does not exist on the configured project (PostgREST: table not found in ' +
        'schema cache) — apply 20260810000000_add_analytics_events.sql (supabase/README.md, passo ' +
        '14) first.',
    );
    assert.equal(error, null, `unexpected error ${error?.code}: ${error?.message}`);
  });

  it('returns zero rows for an anonymous caller — is_own_representative(...) never matches a null auth.uid()', async () => {
    const { data, error } = await supabase!.from('analytics_events').select('id');
    assert.equal(error, null, `unexpected error ${error?.code}: ${error?.message}`);
    assert.equal(data?.length ?? 0, 0, 'an anonymous caller must never see any analytics_events row');
  });
});

describe('analytics_events RLS — controls', { skip: !canRun && skipReason }, () => {
  it('reads the seeded catalog, proving the key and project are reachable', async () => {
    // If this fails too, the suite above is failing for some reason other
    // than analytics_events itself — same control shape as the other
    // integration suites in this project.
    const { data, error } = await supabase!.from('products').select('slug');
    assert.equal(error, null, `products: unexpected error ${error?.code}: ${error?.message}`);
    assert.ok((data?.length ?? 0) > 0, 'expected the D1 catalog seed to be applied');
  });
});
