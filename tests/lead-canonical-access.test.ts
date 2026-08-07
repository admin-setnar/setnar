import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260821000000_apply_canonical_access_to_leads.sql'),
  'utf8',
);

describe('SET-21 canonical public-access rule applied to leads — SQL contract', () => {
  it('gates the lead insert on the same helper every other public surface uses', () => {
    assert.match(
      migration,
      /if not private\.is_page_publicly_accessible\(p_representative_id, p_product_id\) then/,
    );
  });

  it('does not keep the old, narrower duplicated predicate around', () => {
    assert.doesNotMatch(migration, /pa\.status = 'published'\s*\n\s*and r\.status = 'active'/);
    assert.doesNotMatch(migration, /join public\.representatives r on r\.id = pa\.representative_id/);
  });

  it('keeps the anti-enumerating shape: canonical-access failure records an attempt and returns false, same as any other rejection', () => {
    const gateIndex = migration.indexOf('if not private.is_page_publicly_accessible');
    const afterGate = migration.slice(gateIndex, gateIndex + 300);
    assert.match(afterGate, /insert into public\.lead_submission_attempts \(ip_hash\) values \(p_ip_hash\);\s*\n\s*return false;/);
  });

  it('keeps rate limiting, payload validation and the advisory lock ahead of the canonical-access check, unchanged', () => {
    const lockIndex = migration.indexOf(
      'pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_ip_hash, 0))',
    );
    const rateLimitIndex = migration.indexOf('if v_attempts >= 5 then');
    const validationIndex = migration.indexOf("p_telefone_e164 !~ '^\\+[1-9]\\d{6,14}$'");
    const gateIndex = migration.indexOf('if not private.is_page_publicly_accessible');
    const insertLeadIndex = migration.indexOf('insert into public.leads');

    assert.ok(lockIndex > 0);
    assert.ok(rateLimitIndex > lockIndex);
    assert.ok(validationIndex > rateLimitIndex);
    assert.ok(gateIndex > validationIndex);
    assert.ok(insertLeadIndex > gateIndex);
  });

  it('re-asserts the service_role-only grant untouched by this migration', () => {
    assert.match(
      migration,
      /revoke execute on function public\.submit_lead\([\s\S]*?\) from public, anon, authenticated;/,
    );
    assert.match(
      migration,
      /grant execute on function public\.submit_lead\([\s\S]*?\) to service_role;/,
    );
  });
});
