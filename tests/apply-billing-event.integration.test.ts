import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(url && publicKey && serviceKey);
const service = canRun ? createClient(url!, serviceKey!, { auth: { persistSession: false } }) : null;

let userId = '';
let representativeId = '';
let subscriptionId = '';

function futureDate(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

async function callEvent(overrides: {
  eventId: string;
  eventType: string;
  asaasSubscriptionId?: string | null;
  asaasCustomerId?: string | null;
  externalReference?: string | null;
  nextDueDate?: string | null;
}) {
  return service!.rpc('apply_billing_event', {
    p_event_id: overrides.eventId,
    p_event_type: overrides.eventType,
    p_asaas_subscription_id: overrides.asaasSubscriptionId ?? null,
    p_asaas_customer_id: overrides.asaasCustomerId ?? null,
    p_external_reference: overrides.externalReference ?? null,
    p_next_due_date: overrides.nextDueDate ?? null,
    p_payload: { synthetic: true },
  });
}

async function subscriptionRow() {
  const { data } = await service!
    .from('subscriptions')
    .select('status, external_subscription_id, external_customer_id, current_period_end')
    .eq('id', subscriptionId)
    .single();
  return data;
}

describe('apply_billing_event RPC (Postgres, integration)', { skip: !canRun }, () => {
  before(async () => {
    const email = `billing-event-${randomUUID()}@example.invalid`;
    const { data: userData, error: userError } = await service!.auth.admin.createUser({
      email,
      password: `T3st-${randomUUID()}-Aa`,
      email_confirm: true,
    });
    assert.equal(userError, null);
    userId = userData.user!.id;

    const { data: company, error: companyError } = await service!.from('companies').select('id').limit(1).single();
    assert.equal(companyError, null);

    const { data: representative, error: representativeError } = await service!
      .from('representatives')
      .insert({
        profile_id: userId,
        company_id: company!.id,
        slug: `billing-event-${randomUUID()}`,
        display_name: 'Teste Apply Billing Event',
        authorization_id: `test-${randomUUID()}`,
        phone: '+5511988887777',
        status: 'active',
      })
      .select('id')
      .single();
    assert.equal(representativeError, null);
    representativeId = representative!.id;

    const { data: subscription, error: subscriptionError } = await service!
      .from('subscriptions')
      .insert({
        representative_id: representativeId,
        status: 'suspended',
        provider: 'asaas',
        payment_method: 'credit_card',
        amount_cents: 2790,
        currency: 'BRL',
      })
      .select('id')
      .single();
    assert.equal(subscriptionError, null);
    subscriptionId = subscription!.id;
  });

  after(async () => {
    if (representativeId) {
      await service!.from('billing_events').delete().eq('subscription_id', subscriptionId);
      await service!.from('subscriptions').delete().eq('representative_id', representativeId);
      await service!.from('representatives').delete().eq('id', representativeId);
    }
    if (userId) await service!.auth.admin.deleteUser(userId);
  });

  it('activates the subscription on the first CHECKOUT_PAID, matched by externalReference', async () => {
    const { data, error } = await callEvent({
      eventId: `evt-${randomUUID()}`,
      eventType: 'CHECKOUT_PAID',
      asaasSubscriptionId: 'sub_test_1',
      asaasCustomerId: 'cus_test_1',
      externalReference: subscriptionId,
      nextDueDate: futureDate(30),
    });
    assert.equal(error, null);
    assert.equal(data?.[0]?.outcome, 'applied');
    assert.equal(data?.[0]?.subscription_id, subscriptionId);

    const row = await subscriptionRow();
    assert.equal(row?.status, 'active');
    assert.equal(row?.external_subscription_id, 'sub_test_1');
    assert.equal(row?.external_customer_id, 'cus_test_1');
    assert.equal(row?.current_period_end?.slice(0, 10), futureDate(30));
  });

  it('is idempotent on a duplicate event id — same event, no double effect', async () => {
    const eventId = `evt-${randomUUID()}`;
    const first = await callEvent({
      eventId,
      eventType: 'PAYMENT_RECEIVED',
      asaasSubscriptionId: 'sub_test_1',
      nextDueDate: futureDate(45),
    });
    assert.equal(first.data?.[0]?.outcome, 'applied');

    const duplicate = await callEvent({
      eventId,
      eventType: 'PAYMENT_RECEIVED',
      asaasSubscriptionId: 'sub_test_1',
      nextDueDate: futureDate(45),
    });
    assert.equal(duplicate.error, null);
    assert.deepEqual(duplicate.data?.[0], { outcome: 'duplicate', subscription_id: null });
  });

  it('matches a later event by external_subscription_id alone, no externalReference needed', async () => {
    const { data, error } = await callEvent({
      eventId: `evt-${randomUUID()}`,
      eventType: 'PAYMENT_CONFIRMED',
      asaasSubscriptionId: 'sub_test_1',
      nextDueDate: futureDate(60),
    });
    assert.equal(error, null);
    assert.equal(data?.[0]?.outcome, 'applied');

    const row = await subscriptionRow();
    assert.equal(row?.current_period_end?.slice(0, 10), futureDate(60));
  });

  it('never regresses current_period_end when a late event carries an earlier date', async () => {
    const before_ = await subscriptionRow();
    const { error } = await callEvent({
      eventId: `evt-${randomUUID()}`,
      eventType: 'PAYMENT_CONFIRMED',
      asaasSubscriptionId: 'sub_test_1',
      nextDueDate: futureDate(5),
    });
    assert.equal(error, null);

    const after_ = await subscriptionRow();
    assert.equal(after_?.current_period_end, before_?.current_period_end);
  });

  it('suspends only from active on PAYMENT_OVERDUE, and ignores a repeat once already suspended', async () => {
    const first = await callEvent({
      eventId: `evt-${randomUUID()}`,
      eventType: 'PAYMENT_OVERDUE',
      asaasSubscriptionId: 'sub_test_1',
    });
    assert.equal(first.data?.[0]?.outcome, 'applied');
    assert.equal((await subscriptionRow())?.status, 'suspended');

    const second = await callEvent({
      eventId: `evt-${randomUUID()}`,
      eventType: 'PAYMENT_OVERDUE',
      asaasSubscriptionId: 'sub_test_1',
    });
    assert.equal(second.error, null);
    assert.equal(second.data?.[0]?.outcome, 'ignored');
    assert.equal((await subscriptionRow())?.status, 'suspended');

    // Reactivate for the tests that follow.
    const reactivate = await callEvent({
      eventId: `evt-${randomUUID()}`,
      eventType: 'PAYMENT_RECEIVED',
      asaasSubscriptionId: 'sub_test_1',
      nextDueDate: futureDate(90),
    });
    assert.equal(reactivate.data?.[0]?.outcome, 'applied');
  });

  it('ignores an out-of-scope event type without touching subscriptions or requiring a match', async () => {
    const { data, error } = await callEvent({
      eventId: `evt-${randomUUID()}`,
      eventType: 'CHECKOUT_CREATED',
    });
    assert.equal(error, null);
    assert.deepEqual(data?.[0], { outcome: 'ignored', subscription_id: null });
  });

  it('reports "unmatched" for a relevant event that matches no subscription', async () => {
    const { data, error } = await callEvent({
      eventId: `evt-${randomUUID()}`,
      eventType: 'PAYMENT_RECEIVED',
      asaasSubscriptionId: 'sub_does_not_exist',
      nextDueDate: futureDate(30),
    });
    assert.equal(error, null);
    assert.deepEqual(data?.[0], { outcome: 'unmatched', subscription_id: null });
  });

  it('reports "unmatched" instead of erroring on a malformed externalReference', async () => {
    const { data, error } = await callEvent({
      eventId: `evt-${randomUUID()}`,
      eventType: 'CHECKOUT_PAID',
      externalReference: 'not-a-valid-uuid',
      nextDueDate: futureDate(30),
    });
    assert.equal(error, null);
    assert.deepEqual(data?.[0], { outcome: 'unmatched', subscription_id: null });
  });

  it('keeps the RPC unavailable to anon/authenticated', async () => {
    const anon = createClient(url!, publicKey!, { auth: { persistSession: false } });
    const { error } = await anon.rpc('apply_billing_event', {
      p_event_id: `evt-${randomUUID()}`,
      p_event_type: 'CHECKOUT_PAID',
      p_asaas_subscription_id: null,
      p_asaas_customer_id: null,
      p_external_reference: subscriptionId,
      p_next_due_date: null,
      p_payload: {},
    });
    assert.ok(error);
  });
});
