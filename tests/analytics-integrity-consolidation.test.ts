import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260817000000_secure_analytics_and_public_access.sql'),
  'utf8',
);
const factory = readFileSync(
  resolve(process.cwd(), 'src/modules/analytics/infrastructure/analytics-gateway-factory.ts'),
  'utf8',
);
const writeClient = readFileSync(
  resolve(process.cwd(), 'src/modules/analytics/infrastructure/analytics-write-client.ts'),
  'utf8',
);
const gateway = readFileSync(
  resolve(process.cwd(), 'src/modules/analytics/infrastructure/supabase-analytics-gateway.ts'),
  'utf8',
);
const clickRoute = readFileSync(resolve(process.cwd(), 'src/app/api/track-click/route.ts'), 'utf8');
const clickClient = readFileSync(
  resolve(process.cwd(), 'src/modules/representatives/presentation/whatsapp-cta.tsx'),
  'utf8',
);

describe('Stage 1 Analytics trust boundary — SQL contract', () => {
  it('removes both persistent RPCs from browser roles and grants only service_role', () => {
    for (const fn of ['record_page_visit', 'record_whatsapp_click']) {
      assert.match(
        migration,
        new RegExp(`revoke execute on function public\\.${fn}\\(text, text, text, text, text\\) from public, anon, authenticated;`),
      );
      assert.match(
        migration,
        new RegExp(`grant execute on function public\\.${fn}\\(text, text, text, text, text\\) to service_role;`),
      );
    }
  });

  it('makes ip_hash unavailable while retaining an authenticated safe-column read model', () => {
    assert.match(migration, /revoke select on table public\.analytics_events from anon, authenticated;/);
    assert.match(
      migration,
      /grant select \(id, representative_id, product_id, event_type, referrer, created_at\)[\s\S]*to authenticated;/,
    );
    assert.doesNotMatch(
      migration.match(/grant select \([\s\S]*?to authenticated;/)?.[0] ?? '',
      /ip_hash/,
    );
  });

  it('uses one composed public-access concept in RLS, publication, visit and click', () => {
    assert.match(migration, /create or replace function private\.page_publication_blocker/);
    assert.match(migration, /create or replace function private\.is_page_publicly_accessible/);
    assert.match(
      migration,
      /create policy "product_activations_select_published"[\s\S]*private\.is_page_publicly_accessible\(representative_id, product_id\)/,
    );
    assert.match(migration, /v_blocker := private\.page_publication_blocker\(v_representative_id, p_product_id\)/);
    assert.equal(
      migration.match(/and private\.is_page_publicly_accessible\(r\.id, p\.id\);/g)?.length,
      2,
      'both persistent event functions must call the central accessibility rule',
    );
  });

  it('keeps policy helpers outside the PostgREST-exposed public schema', () => {
    assert.match(migration, /create schema if not exists private;/);
    assert.match(migration, /revoke all on schema private from public;/);
    assert.doesNotMatch(migration, /function public\.(page_publication_blocker|is_page_publicly_accessible|has_publicly_accessible_page)/);
    assert.match(migration, /grant execute on function private\.is_page_publicly_accessible\(uuid, uuid\) to anon, authenticated;/);
  });

  it('checks activation, company, representative, subscription, valid name and valid E.164 phone', () => {
    assert.match(migration, /p\.company_id = r\.company_id/);
    assert.match(migration, /pa\.representative_id = r\.id[\s\S]*pa\.product_id = p\.id/);
    assert.match(migration, /if v_status <> 'active'/);
    assert.match(migration, /not public\.is_subscription_active\(p_representative_id\)/);
    assert.match(migration, /regexp_split_to_array\(trim\(v_display_name\), '\\s\+'/);
    assert.match(migration, /trim\(v_phone\) !~ '\^\\\+\[1-9\]\\d\{6,14\}\$'/);
  });

  it('adds representative/product referential integrity and a period-oriented index', () => {
    assert.match(migration, /foreign key \(representative_id, product_id\)/);
    assert.match(migration, /references public\.product_activations \(representative_id, product_id\)/);
    assert.match(migration, /raise exception 'analytics_events has % representative\/product pair\(s\)/);
    assert.match(migration, /\(representative_id, created_at desc\)/);
  });

  it('does not rewrite, delete, fabricate, schedule or purge legacy business data', () => {
    assert.doesNotMatch(migration, /delete\s+from\s+public\.(analytics_events|representatives|product_activations)/i);
    assert.doesNotMatch(migration, /update\s+public\.product_activations\s+set\s+status\s*=\s*'unpublished'\s+where\s+status/i);
    assert.doesNotMatch(migration, /cron|scheduler|pg_cron/i);
  });
});

describe('Stage 1 Analytics trust boundary — application contract', () => {
  it('uses a dedicated server-only service-role client for Analytics writes', () => {
    assert.match(writeClient, /^import 'server-only';/);
    assert.match(writeClient, /process\.env\.SUPABASE_SERVICE_ROLE_KEY/);
    assert.doesNotMatch(writeClient, /NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY/);
    assert.match(factory, /createAnalyticsWriteClient\(\)/);
    assert.doesNotMatch(factory, /shared\/lib\/supabase\/server/);
  });

  it('keeps the browser payload minimal and resolves identity on the server', () => {
    assert.match(clickClient, /JSON\.stringify\(\{ productSlug, referrer: document\.referrer \|\| null \}\)/);
    assert.doesNotMatch(clickClient, /representativeId|productId|ipHash|subscription|tenant/i);
    assert.match(clickRoute, /resolveRepresentativeActivation/);
    assert.doesNotMatch(clickRoute, /ipHash|representativeId|productId/);
  });

  it('derives the persisted hash only from the server-resolved IP plus the server-only salt', () => {
    assert.match(gateway, /createHash\('sha256'\)/);
    assert.match(gateway, /process\.env\.ANALYTICS_IP_SALT/);
    assert.match(gateway, /if \(!input\.ip\)/);
    assert.match(gateway, /p_ip_hash: hash\(input\.ip\)/);
    assert.doesNotMatch(gateway, /hash\(input\.ip \?\? 'unknown'\)/);
    assert.doesNotMatch(clickClient, /ipHash|ip_hash|ANALYTICS_IP_SALT/);
  });
});
