import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(url && publicKey && serviceKey);
const service = canRun ? createClient(url!, serviceKey!, { auth: { persistSession: false } }) : null;

let userId = '';
let representativeId = '';
let companyId = '';
let owner: SupabaseClient | null = null;

async function insertRepresentative(profileId: string) {
  const { data, error } = await service!
    .from('representatives')
    .insert({
      profile_id: profileId,
      company_id: companyId,
      slug: `checkout-slot-${randomUUID()}`,
      display_name: 'Teste Checkout Slot',
      authorization_id: `test-${randomUUID()}`,
      phone: '+5511988887777',
      status: 'active',
    })
    .select('id')
    .single();
  assert.equal(error, null);
  return data!.id as string;
}

describe('reserve_billing_checkout_slot RPC (Postgres, integration)', { skip: !canRun }, () => {
  before(async () => {
    const email = `checkout-slot-${randomUUID()}@example.invalid`;
    const password = `T3st-${randomUUID()}-Aa`;
    const { data: userData, error: userError } = await service!.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    assert.equal(userError, null);
    userId = userData.user!.id;
    owner = createClient(url!, publicKey!, { auth: { persistSession: false } });
    const { error: signInError } = await owner.auth.signInWithPassword({ email, password });
    assert.equal(signInError, null);

    const { data: company, error: companyError } = await service!.from('companies').select('id').limit(1).single();
    assert.equal(companyError, null);
    companyId = company!.id;

    representativeId = await insertRepresentative(userId);
  });

  after(async () => {
    if (representativeId) {
      await service!.from('subscriptions').delete().eq('representative_id', representativeId);
      await service!.from('representatives').delete().eq('id', representativeId);
    }
    if (userId) await service!.auth.admin.deleteUser(userId);
  });

  it('reserves a fresh slot at the founding price for a representative with no Subscription row', async () => {
    const { data, error } = await owner!.rpc('reserve_billing_checkout_slot');
    assert.equal(error, null);
    assert.equal(data?.[0]?.status, 'reserved');
    assert.equal(data?.[0]?.amount_cents, 2790);
    assert.equal(data?.[0]?.stale_external_subscription_id, null, 'nothing to cancel for a brand-new row');

    const { data: row } = await service!
      .from('subscriptions')
      .select('status, provider, payment_method')
      .eq('representative_id', representativeId)
      .single();
    assert.equal(row?.status, 'suspended');
    assert.equal(row?.provider, 'asaas');
    assert.equal(row?.payment_method, 'credit_card');
  });

  it('reuses the same row and price on an immediate retry, without creating a second row', async () => {
    const first = await owner!.rpc('reserve_billing_checkout_slot');
    const second = await owner!.rpc('reserve_billing_checkout_slot');
    assert.equal(second.error, null);
    assert.equal(second.data?.[0]?.status, 'reserved');
    assert.equal(second.data?.[0]?.id, first.data?.[0]?.id);

    const { count } = await service!
      .from('subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('representative_id', representativeId);
    assert.equal(count, 1);
  });

  it('rejects a reservation once the Subscription is already active', async () => {
    await service!.from('subscriptions').update({ status: 'active' }).eq('representative_id', representativeId);
    const { data, error } = await owner!.rpc('reserve_billing_checkout_slot');
    assert.equal(error, null);
    assert.equal(data?.[0]?.status, 'already_active');
  });

  it('converts a suspended manual row into a priced automated reservation, respecting the founding-slot cap', async () => {
    await service!
      .from('subscriptions')
      .update({ provider: 'manual', status: 'suspended', amount_cents: null, payment_method: null })
      .eq('representative_id', representativeId);

    const { data, error } = await owner!.rpc('reserve_billing_checkout_slot');
    assert.equal(error, null);
    assert.equal(data?.[0]?.status, 'reserved');
    assert.equal(data?.[0]?.amount_cents, 2790);

    const { data: row } = await service!
      .from('subscriptions')
      .select('provider, payment_method, amount_cents')
      .eq('representative_id', representativeId)
      .single();
    assert.equal(row?.provider, 'asaas');
    assert.equal(row?.payment_method, 'credit_card');
    assert.equal(row?.amount_cents, 2790);
  });

  it('clears a stale external_subscription_id and normalizes status/current_period_end when resuming after cancellation', async () => {
    await service!
      .from('subscriptions')
      .update({
        status: 'canceled',
        current_period_end: new Date(Date.now() - 86_400_000).toISOString(),
        external_subscription_id: 'stale-external-id',
        external_customer_id: 'stale-customer-id',
        provider: 'asaas',
        amount_cents: 2790,
        payment_method: 'credit_card',
      })
      .eq('representative_id', representativeId);

    const { data, error } = await owner!.rpc('reserve_billing_checkout_slot');
    assert.equal(error, null);
    assert.equal(data?.[0]?.status, 'reserved');
    assert.equal(data?.[0]?.amount_cents, 2790, 'reuses the price already locked in, does not re-price');
    assert.equal(
      data?.[0]?.stale_external_subscription_id,
      'stale-external-id',
      'the abandoned id is handed back so the caller can cancel it at Asaas',
    );

    const { data: row } = await service!
      .from('subscriptions')
      .select('status, current_period_end, external_subscription_id, external_customer_id')
      .eq('representative_id', representativeId)
      .single();
    assert.equal(row?.status, 'suspended');
    assert.equal(row?.current_period_end, null);
    assert.equal(row?.external_subscription_id, null, 'a stale external id must never survive into a fresh checkout attempt');
    assert.equal(row?.external_customer_id, null);
  });

  it('excludes a stale, unconfirmed reservation from another representative from the founding-slot count', async (t) => {
    // Inserted directly (not via UPDATE) so `subscriptions_set_updated_at`
    // (a BEFORE UPDATE trigger — never fires on INSERT) never overwrites the
    // backdated `updated_at`. This is the only way to simulate a reservation
    // older than the reclaim TTL without a raw SQL connection, which this
    // supabase-js-based suite does not have.
    const ghostEmail = `checkout-slot-ghost-${randomUUID()}@example.invalid`;
    const { data: ghostUser, error: ghostUserError } = await service!.auth.admin.createUser({
      email: ghostEmail,
      password: `T3st-${randomUUID()}-Aa`,
      email_confirm: true,
    });
    assert.equal(ghostUserError, null);
    const ghostRepresentativeId = await insertRepresentative(ghostUser!.user!.id);
    t.after(async () => {
      await service!.from('subscriptions').delete().eq('representative_id', ghostRepresentativeId);
      await service!.from('representatives').delete().eq('id', ghostRepresentativeId);
      await service!.auth.admin.deleteUser(ghostUser!.user!.id);
    });

    const { error: ghostInsertError } = await service!.from('subscriptions').insert({
      representative_id: ghostRepresentativeId,
      status: 'suspended',
      provider: 'asaas',
      payment_method: 'credit_card',
      amount_cents: 2790,
      currency: 'BRL',
      updated_at: new Date(Date.now() - 48 * 3_600_000).toISOString(),
    });
    assert.equal(ghostInsertError, null);

    await service!.from('subscriptions').delete().eq('representative_id', representativeId);
    const { data, error } = await owner!.rpc('reserve_billing_checkout_slot');
    assert.equal(error, null);
    assert.equal(
      data?.[0]?.status,
      'reserved',
      'a stale, abandoned reservation from another representative must not count against the founding-slot cap',
    );
  });
});
