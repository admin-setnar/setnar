import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ALLOWED_TEST_SUPABASE_PROJECT_REFS,
  PRODUCTION_SUPABASE_PROJECT_REF,
  evaluateSupabaseIntegrationTarget,
} from '../scripts/supabase-production-guard.mjs';

/**
 * Deterministic unit coverage for `evaluateSupabaseIntegrationTarget` —
 * pure, no env reads, no network, no real Supabase project touched. Cases
 * A–F match `docs/plans/AUDIT_PROFILE_REPRESENTATIVE_INTEGRITY_2026-09-01.md`'s
 * hardening request 1:1.
 */
const ALLOWED_TEST_REF = ALLOWED_TEST_SUPABASE_PROJECT_REFS[0]!;
const FAKE_KEY = 'fake-not-a-real-service-role-key';

describe('evaluateSupabaseIntegrationTarget', () => {
  it('Case A — allowed dev/test project + service role key: ALLOW', () => {
    const result = evaluateSupabaseIntegrationTarget({
      supabaseUrl: `https://${ALLOWED_TEST_REF}.supabase.co`,
      serviceRoleKey: FAKE_KEY,
    });
    assert.equal(result.verdict, 'ALLOW');
  });

  it('Case B — production project ref: BLOCK', () => {
    const result = evaluateSupabaseIntegrationTarget({
      supabaseUrl: `https://${PRODUCTION_SUPABASE_PROJECT_REF}.supabase.co`,
      serviceRoleKey: FAKE_KEY,
    });
    assert.equal(result.verdict, 'BLOCK');
    assert.match(result.reason, /production/i);
  });

  it('Case C — URL absent (service role key present): BLOCK', () => {
    const result = evaluateSupabaseIntegrationTarget({ supabaseUrl: undefined, serviceRoleKey: FAKE_KEY });
    assert.equal(result.verdict, 'BLOCK');
    assert.match(result.reason, /NEXT_PUBLIC_SUPABASE_URL/);
  });

  it('Case C variant — URL is an empty string (service role key present): BLOCK', () => {
    const result = evaluateSupabaseIntegrationTarget({ supabaseUrl: '', serviceRoleKey: FAKE_KEY });
    assert.equal(result.verdict, 'BLOCK');
  });

  it('Case D — URL is not a valid URL at all: BLOCK', () => {
    const result = evaluateSupabaseIntegrationTarget({ supabaseUrl: 'not a url', serviceRoleKey: FAKE_KEY });
    assert.equal(result.verdict, 'BLOCK');
    assert.match(result.reason, /not a valid URL/);
  });

  it('Case D variant — URL is a bare hostname without a scheme: BLOCK', () => {
    const result = evaluateSupabaseIntegrationTarget({
      supabaseUrl: `${ALLOWED_TEST_REF}.supabase.co`,
      serviceRoleKey: FAKE_KEY,
    });
    assert.equal(result.verdict, 'BLOCK');
  });

  it('Case E — well-formed Supabase host, but a project ref not in the allowlist: BLOCK', () => {
    const result = evaluateSupabaseIntegrationTarget({
      supabaseUrl: 'https://aaaaaaaaaaaaaaaaaaaa.supabase.co',
      serviceRoleKey: FAKE_KEY,
    });
    assert.equal(result.verdict, 'BLOCK');
    assert.match(result.reason, /not in the allowlist/);
  });

  it('Case E variant — host that is not a *.supabase.co project host at all: BLOCK', () => {
    const result = evaluateSupabaseIntegrationTarget({ supabaseUrl: 'https://setnar.com', serviceRoleKey: FAKE_KEY });
    assert.equal(result.verdict, 'BLOCK');
    assert.match(result.reason, /not a recognizable Supabase project host/);
  });

  it('Case F — partially configured (service role key set, URL missing): BLOCK', () => {
    const result = evaluateSupabaseIntegrationTarget({ supabaseUrl: null, serviceRoleKey: FAKE_KEY });
    assert.equal(result.verdict, 'BLOCK');
  });

  it('no SUPABASE_SERVICE_ROLE_KEY at all (ordinary machine, ADR-017): SKIP, never BLOCK', () => {
    const noKeyCases = [
      { supabaseUrl: undefined, serviceRoleKey: undefined },
      { supabaseUrl: `https://${PRODUCTION_SUPABASE_PROJECT_REF}.supabase.co`, serviceRoleKey: undefined },
      { supabaseUrl: 'not a url', serviceRoleKey: '' },
    ];
    for (const input of noKeyCases) {
      const result = evaluateSupabaseIntegrationTarget(input);
      assert.equal(result.verdict, 'SKIP', `expected SKIP for ${JSON.stringify(input)}, got ${result.verdict}`);
    }
  });

  it('production ref check wins even if it were ever added to the allowlist by mistake', () => {
    // Defense-in-depth: PRODUCTION_SUPABASE_PROJECT_REF must never appear in
    // ALLOWED_TEST_SUPABASE_PROJECT_REFS, and the evaluator checks the
    // production ref before consulting the allowlist either way.
    assert.ok(!ALLOWED_TEST_SUPABASE_PROJECT_REFS.includes(PRODUCTION_SUPABASE_PROJECT_REF));
  });
});
