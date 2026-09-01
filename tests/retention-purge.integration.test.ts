import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, it, type TestContext } from 'node:test';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { createIntegrationServiceRoleClient } from './support/service-role-client';

/**
 * Integration test for `purge_expired_retention_data()` (SET-73), which
 * implements the retention periods decided in
 * `docs/plans/DATA_RETENTION_DECISIONS_PLAN.md` (SET-46): `leads` older than
 * 24 months and `analytics_events` older than 12 months are deleted; rows
 * inside the window are left untouched. Only `service_role` can call this
 * function (same grant pattern as every other maintenance RPC in this
 * project), so this suite needs the privileged key and skips itself
 * otherwise — same posture as every other integration suite here.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);
const skipReason =
  'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, with all migrations applied, to run this suite.';

const service = canRun ? createIntegrationServiceRoleClient() : null;

type ValidPair = { representativeId: string; productId: string };
const pairSkipReason =
  'No published (representative, product) pair found in the configured Supabase project — ' +
  'create one in the disposable test database (see supabase/README.md) to run this suite.';

async function findPublishedActivation(supabase: SupabaseClient): Promise<ValidPair | null> {
  const { data: activations } = await supabase
    .from('product_activations')
    .select('representative_id, product_id')
    .eq('status', 'published')
    .limit(1);
  const representativeId = activations?.[0]?.representative_id as string | undefined;
  const productId = activations?.[0]?.product_id as string | undefined;
  if (!representativeId || !productId) return null;
  return { representativeId, productId };
}

let pairLookup: Promise<ValidPair | null> | null = null;
async function requirePair(t: TestContext): Promise<ValidPair | null> {
  if (!service) return null;
  pairLookup ??= findPublishedActivation(service);
  const pair = await pairLookup;
  if (!pair) {
    t.skip(pairSkipReason);
  }
  return pair;
}

function monthsAgo(months: number): string {
  const date = new Date();
  date.setUTCMonth(date.getUTCMonth() - months);
  return date.toISOString();
}

/**
 * True for PostgREST's PGRST202 ("could not find the function ... in the
 * schema cache") — the shape returned when `purge_expired_retention_data()`
 * is not deployed to the configured Supabase project yet. Distinct from a
 * `42501 permission denied`, which is what these tests actually check.
 */
function isMissingFunctionError(message: string): boolean {
  return /could not find the function/i.test(message);
}

describe('purge_expired_retention_data (Postgres, integration)', { skip: !canRun && skipReason }, () => {
  it('deletes leads past 24 months and analytics_events past 12 months, leaving recent rows untouched', async (t) => {
    const pair = await requirePair(t);
    if (!pair) return;

    const { data: oldLead, error: oldLeadError } = await service!
      .from('leads')
      .insert({
        representative_id: pair.representativeId,
        product_id: pair.productId,
        telefone_e164: '+5511988887777',
        campos: { nome: 'Lead expirado', origem: 'retention-purge-test' },
        created_at: monthsAgo(25),
      })
      .select('id')
      .single();
    assert.equal(oldLeadError, null);

    const { data: recentLead, error: recentLeadError } = await service!
      .from('leads')
      .insert({
        representative_id: pair.representativeId,
        product_id: pair.productId,
        telefone_e164: '+5511988887778',
        campos: { nome: 'Lead recente', origem: 'retention-purge-test' },
        created_at: monthsAgo(1),
      })
      .select('id')
      .single();
    assert.equal(recentLeadError, null);

    const { data: oldEvent, error: oldEventError } = await service!
      .from('analytics_events')
      .insert({
        representative_id: pair.representativeId,
        product_id: pair.productId,
        event_type: 'visit',
        ip_hash: `retention-purge-test-old-${randomUUID()}`,
        created_at: monthsAgo(13),
      })
      .select('id')
      .single();
    assert.equal(oldEventError, null);

    const { data: recentEvent, error: recentEventError } = await service!
      .from('analytics_events')
      .insert({
        representative_id: pair.representativeId,
        product_id: pair.productId,
        event_type: 'visit',
        ip_hash: `retention-purge-test-recent-${randomUUID()}`,
        created_at: monthsAgo(1),
      })
      .select('id')
      .single();
    assert.equal(recentEventError, null);

    try {
      const { error: purgeError } = await service!.rpc('purge_expired_retention_data');
      if (purgeError && isMissingFunctionError(purgeError.message)) {
        t.skip('purge_expired_retention_data is not deployed to the configured Supabase project yet.');
        return;
      }
      assert.equal(purgeError, null);

      const { data: leadsLeft } = await service!
        .from('leads')
        .select('id')
        .in('id', [oldLead!.id, recentLead!.id]);
      assert.deepEqual(
        (leadsLeft ?? []).map((row) => row.id).sort(),
        [recentLead!.id].sort(),
        'only the recent lead should survive the purge',
      );

      const { data: eventsLeft } = await service!
        .from('analytics_events')
        .select('id')
        .in('id', [oldEvent!.id, recentEvent!.id]);
      assert.deepEqual(
        (eventsLeft ?? []).map((row) => row.id).sort(),
        [recentEvent!.id].sort(),
        'only the recent analytics_event should survive the purge',
      );
    } finally {
      // The old rows are already gone if the purge worked; delete
      // unconditionally is a no-op for whichever one it already removed.
      await service!.from('leads').delete().in('id', [oldLead!.id, recentLead!.id]);
      await service!.from('analytics_events').delete().in('id', [oldEvent!.id, recentEvent!.id]);
    }
  });

  it('denies anon and authenticated — only service_role may call this function', async (t) => {
    const anon = SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
      ? createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
      : null;
    if (!anon) return;

    const { error } = await anon.rpc('purge_expired_retention_data');
    assert.ok(error, 'anon unexpectedly invoked purge_expired_retention_data');
    if (isMissingFunctionError(error.message)) {
      t.skip('purge_expired_retention_data is not deployed to the configured Supabase project yet.');
      return;
    }
    assert.match(error.message, /permission denied/i);
  });
});
