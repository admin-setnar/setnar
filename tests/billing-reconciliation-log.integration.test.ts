import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, describe, it } from 'node:test';

import { createClient } from '@supabase/supabase-js';

import { createIntegrationServiceRoleClient } from './support/service-role-client';

/**
 * SET-33 — `billing_reconciliation_log` é a trilha auditável das execuções
 * de `scripts/reconcile-billing-subscription.ts`. RLS habilitado, zero
 * policies (mesmo padrão de `billing_events`/`analytics_events`): só o
 * service_role que o script já usa para tudo consegue ler/escrever.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(url && publicKey && serviceKey);
const service = canRun ? createIntegrationServiceRoleClient() : null;
const anon = canRun ? createClient(url!, publicKey!, { auth: { persistSession: false } }) : null;

let insertedId: number | null = null;

describe('billing_reconciliation_log (Postgres, integration)', { skip: !canRun }, () => {
  after(async () => {
    if (insertedId !== null) {
      await service!.from('billing_reconciliation_log').delete().eq('id', insertedId);
    }
  });

  it('accepts a service-role insert with the outcomes the script actually produces', async () => {
    for (const outcome of ['no_subscription', 'no_payment_found', 'gateway_error', 'ignored', 'applied', 'duplicate', 'unmatched']) {
      const { data, error } = await service!
        .from('billing_reconciliation_log')
        .insert({
          actor: 'integration-test',
          reason: `covers outcome=${outcome}`,
          outcome,
        })
        .select('id')
        .single();
      assert.equal(error, null, `outcome=${outcome} should be a legal value`);
      await service!.from('billing_reconciliation_log').delete().eq('id', data!.id);
    }
  });

  it('rejects an unrecognized outcome value', async () => {
    const { error } = await service!.from('billing_reconciliation_log').insert({
      actor: 'integration-test',
      reason: 'invalid outcome probe',
      outcome: 'not_a_real_outcome',
    });
    assert.ok(error);
  });

  it('requires actor and reason — never a silent anonymous/unexplained entry', async () => {
    const { error: noActor } = await service!
      .from('billing_reconciliation_log')
      .insert({ reason: 'missing actor', outcome: 'no_subscription' });
    assert.ok(noActor);

    const { error: noReason } = await service!
      .from('billing_reconciliation_log')
      .insert({ actor: 'integration-test', outcome: 'no_subscription' });
    assert.ok(noReason);
  });

  it('keeps a full row readable by service_role, for audit purposes', async () => {
    const reason = `readable-probe-${randomUUID()}`;
    const { data, error } = await service!
      .from('billing_reconciliation_log')
      .insert({ actor: 'integration-test', reason, outcome: 'no_subscription' })
      .select('id')
      .single();
    assert.equal(error, null);
    insertedId = data!.id;

    const { data: row, error: readError } = await service!
      .from('billing_reconciliation_log')
      .select('actor, reason, outcome')
      .eq('id', insertedId)
      .single();
    assert.equal(readError, null);
    assert.deepEqual(row, { actor: 'integration-test', reason, outcome: 'no_subscription' });
  });

  it('is completely unavailable to anon — no select, no insert', async () => {
    const { data: rows, error: selectError } = await anon!.from('billing_reconciliation_log').select('id').limit(1);
    assert.equal(selectError, null);
    assert.deepEqual(rows, []);

    const { error: insertError } = await anon!
      .from('billing_reconciliation_log')
      .insert({ actor: 'anon-should-fail', reason: 'anon-should-fail', outcome: 'no_subscription' });
    assert.ok(insertError);
  });
});
