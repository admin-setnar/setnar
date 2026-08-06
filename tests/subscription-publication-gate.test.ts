import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { resolve } from 'node:path';

import { setActivationStatusErrorCopy } from '@/modules/representatives/presentation/activation-error-messages';

const MIGRATION_PATH = resolve(
  process.cwd(),
  'supabase/migrations/20260816000000_add_subscription_publication_gate.sql',
);
const PREVIOUS_WRITE_PATH_PATH = resolve(
  process.cwd(),
  'supabase/migrations/20260807000000_add_product_activation_write_path.sql',
);

const sql = readFileSync(MIGRATION_PATH, 'utf8');
const previousWritePathSql = readFileSync(PREVIOUS_WRITE_PATH_PATH, 'utf8');

function position(fragment: string): number {
  const index = sql.indexOf(fragment);
  assert.notEqual(index, -1, `Expected E2 migration to contain: ${fragment}`);
  return index;
}

describe('E2 Subscription publication gate SQL contract', () => {
  it('redefines only set_activation_status and reuses the E1 Subscription rule', () => {
    assert.match(sql, /create or replace function public\.set_activation_status\s*\(/);
    assert.doesNotMatch(sql, /create or replace function public\.activate_product\s*\(/);
    assert.match(sql, /not public\.is_subscription_active\(v_representative_id\)/);
    assert.doesNotMatch(sql, /from public\.subscriptions/i);
  });

  it('keeps the normative first-failure order for suspended, unsubscribed, nameless, and phoneless representatives', () => {
    const representative = position("return query select 'representative_not_active'::text");
    const subscription = position("return query select 'subscription_not_active'::text");
    const displayName = position("return query select 'display_name_required'::text");
    const phone = position("return query select 'phone_required'::text");

    assert.ok(representative < subscription);
    assert.ok(subscription < displayName);
    assert.ok(displayName < phone);
  });

  it('lets an active representative with an active Subscription reach publication', () => {
    const subscriptionGate = position('if not public.is_subscription_active(v_representative_id) then');
    const publishUpdate = position("set status = 'published'");
    assert.ok(subscriptionGate < publishUpdate);
  });

  it('keeps draft creation outside E2 and keeps unpublication outside the publication gate', () => {
    assert.match(previousWritePathSql, /insert into public\.product_activations \(representative_id, product_id\)/);
    assert.doesNotMatch(previousWritePathSql, /insert into public\.product_activations[\s\S]*is_subscription_active/);

    const unpublishBranch = position("if p_status = 'unpublished' then");
    const publicationGate = position("if v_rep_status <> 'active' then");
    assert.ok(unpublishBranch < publicationGate);
  });

  it('preserves published -> unpublished and rejects draft -> unpublished as before', () => {
    assert.match(
      sql,
      /if v_current_status = 'draft' then[\s\S]*'invalid_transition'::text[\s\S]*set status = 'unpublished'/,
    );
  });

  it('keeps same-state calls idempotent before any publication precondition', () => {
    const idempotentReturn = position("if v_current_status = p_status then");
    const publicationGate = position("if v_rep_status <> 'active' then");
    assert.ok(idempotentReturn < publicationGate);
  });

  it('keeps the write RPC unavailable to anon', () => {
    assert.match(
      sql,
      /revoke execute on function public\.set_activation_status\(uuid, text\) from anon;/,
    );
    assert.match(
      sql,
      /grant execute on function public\.set_activation_status\(uuid, text\) to authenticated;/,
    );
  });
});

describe('subscription_not_active error copy', () => {
  it('specifically directs the Representative to regularize the SETNAR Subscription', () => {
    const copy = setActivationStatusErrorCopy({
      status: 'rejected',
      reason: 'subscription_not_active',
    });

    assert.deepEqual(copy, {
      title: 'Regularize sua assinatura para publicar',
      description: 'Ative ou regularize sua assinatura SETNAR e tente publicar novamente.',
    });
    assert.doesNotMatch(`${copy.title} ${copy.description}`, /WhatsApp/i);
  });
});
