import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260820000000_secure_lead_submission_boundary.sql'),
  'utf8',
);
const factory = readFileSync(
  resolve(process.cwd(), 'src/modules/leads/infrastructure/lead-gateway-factory.ts'),
  'utf8',
);
const writeClient = readFileSync(
  resolve(process.cwd(), 'src/modules/leads/infrastructure/lead-write-client.ts'),
  'utf8',
);
const gateway = readFileSync(
  resolve(process.cwd(), 'src/modules/leads/infrastructure/supabase-lead-gateway.ts'),
  'utf8',
);
const route = readFileSync(resolve(process.cwd(), 'src/app/api/leads/route.ts'), 'utf8');

describe('SET-20 lead trust boundary — SQL contract', () => {
  it('removes submit_lead from browser roles and grants only service_role', () => {
    assert.match(
      migration,
      /revoke execute on function public\.submit_lead\([\s\S]*?\) from public, anon, authenticated;/,
    );
    assert.match(
      migration,
      /grant execute on function public\.submit_lead\([\s\S]*?\) to service_role;/,
    );
    assert.doesNotMatch(migration, /grant execute[\s\S]*to anon|grant execute[\s\S]*to authenticated/);
  });

  it('serializes the complete check-and-record decision per hash', () => {
    const lockIndex = migration.indexOf(
      'pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_ip_hash, 0))',
    );
    const countIndex = migration.indexOf('select count(*) into v_attempts');
    const leadInsertIndex = migration.indexOf('insert into public.leads');

    assert.ok(lockIndex > 0);
    assert.ok(countIndex > lockIndex);
    assert.ok(leadInsertIndex > countIndex);
    assert.match(migration, /if v_attempts >= 5 then[\s\S]*?return false;/);
  });

  it('fails closed on a missing bucket and preserves the boolean rejection contract', () => {
    assert.match(
      migration,
      /if p_ip_hash is null or length\(trim\(p_ip_hash\)\) = 0 then[\s\S]*?return false;/,
    );
    assert.match(migration, /returns boolean/);
  });
});

describe('SET-20 lead trust boundary — application contract', () => {
  it('uses a dedicated server-only service-role client for lead writes', () => {
    assert.match(writeClient, /^import 'server-only';/);
    assert.match(writeClient, /process\.env\.SUPABASE_SERVICE_ROLE_KEY/);
    assert.doesNotMatch(writeClient, /NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY/);
    assert.match(factory, /createLeadWriteClient\(\)/);
    assert.doesNotMatch(factory, /shared\/lib\/supabase\/server/);
  });

  it('derives the hash only from a trusted IP and never uses a global unknown bucket', () => {
    assert.match(gateway, /if \(!input\.ip\)[\s\S]*?return 'rejected';/);
    assert.match(gateway, /p_ip_hash: hash\(input\.ip\)/);
    assert.doesNotMatch(gateway, /hash\(input\.ip \?\? 'unknown'\)/);
    assert.doesNotMatch(route, /ipHash|ip_hash|LOGIN_ATTEMPT_SALT/);
  });

  it('keeps legitimate route rejection anti-enumerating', () => {
    assert.match(route, /result === 'submitted'/);
    assert.match(route, /NextResponse\.json\(\{ ok: false \}, \{ status: result === 'rejected' \? 429 : 500 \}\)/);
    assert.match(route, /status: result === 'rejected' \? 429 : 500/);
  });
});
