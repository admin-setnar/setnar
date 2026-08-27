import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

/**
 * SET-84 D5 — `origin` (`analytics_events`) was added by
 * `20260908000000_add_origin_to_analytics_events.sql`, after the explicit
 * column-scoped SELECT grant for `authenticated`
 * (`20260817000000_secure_analytics_and_public_access.sql`) was already
 * written — that grant lists columns by name, so a column added later is
 * invisible to `authenticated` until a new migration re-asserts it. This
 * test guards the fix: the new migration grants `origin` additively,
 * without touching the already-applied grant or exposing `ip_hash`.
 */
const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260908000003_grant_analytics_events_origin_to_authenticated.sql'),
  'utf8',
);
const priorGrantMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260817000000_secure_analytics_and_public_access.sql'),
  'utf8',
);

describe('analytics_events.origin grant to authenticated (SET-84 D5)', () => {
  it('grants select(origin) to authenticated', () => {
    assert.match(migration, /grant select \(origin\)\s*\n\s*on table public\.analytics_events to authenticated;/);
  });

  it('the grant statement itself never mentions ip_hash — only explanatory comments may', () => {
    const grantStatement = migration.match(/^grant select[\s\S]*?;$/m)?.[0] ?? '';
    assert.ok(grantStatement.length > 0, 'expected a grant statement in the migration');
    assert.doesNotMatch(grantStatement, /ip_hash/);
  });

  it('the grant statement itself never mentions anon', () => {
    const grantStatement = migration.match(/^grant select[\s\S]*?;$/m)?.[0] ?? '';
    assert.doesNotMatch(grantStatement, /anon/);
  });

  it('does not edit the already-applied 20260817000000 grant — additive, new migration only', () => {
    assert.doesNotMatch(priorGrantMigration, /origin/);
  });
});
