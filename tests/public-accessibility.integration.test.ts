import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { createIntegrationServiceRoleClient } from './support/service-role-client';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(url && publicKey && serviceKey);
const service = canRun ? createIntegrationServiceRoleClient() : null;
const anon = canRun ? createClient(url!, publicKey!) : null;

let userId = '';
let representativeId = '';
let activationId = '';
let productId = '';
let representativeSlug = '';
let productSlug = '';
let outsiderUserId = '';
let ownerClient: SupabaseClient | null = null;
let outsiderClient: SupabaseClient | null = null;

async function publicActivationCount(): Promise<number> {
  const { data, error } = await anon!.from('product_activations').select('id').eq('id', activationId);
  assert.equal(error, null);
  return data?.length ?? 0;
}

describe('central public page accessibility (Postgres, integration)', { skip: !canRun }, () => {
  before(async () => {
    const email = `public-access-${randomUUID()}@example.invalid`;
    const password = `T3st-${randomUUID()}-Aa`;
    const { data: userData, error: userError } = await service!.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    assert.equal(userError, null);
    userId = userData.user!.id;
    ownerClient = createClient(url!, publicKey!, { auth: { persistSession: false } });
    const { error: ownerSignInError } = await ownerClient.auth.signInWithPassword({ email, password });
    assert.equal(ownerSignInError, null);

    const outsiderEmail = `analytics-outsider-${randomUUID()}@example.invalid`;
    const outsiderPassword = `T3st-${randomUUID()}-Bb`;
    const { data: outsiderData, error: outsiderError } = await service!.auth.admin.createUser({
      email: outsiderEmail,
      password: outsiderPassword,
      email_confirm: true,
    });
    assert.equal(outsiderError, null);
    outsiderUserId = outsiderData.user!.id;
    outsiderClient = createClient(url!, publicKey!, { auth: { persistSession: false } });
    const { error: outsiderSignInError } = await outsiderClient.auth.signInWithPassword({
      email: outsiderEmail,
      password: outsiderPassword,
    });
    assert.equal(outsiderSignInError, null);

    const { data: product, error: productError } = await service!
      .from('products')
      .select('id, company_id, slug')
      .limit(1)
      .single();
    assert.equal(productError, null);
    productId = product!.id;
    productSlug = product!.slug;
    representativeSlug = `access-${randomUUID()}`;

    const { data: representative, error: representativeError } = await service!
      .from('representatives')
      .insert({
        profile_id: userId,
        company_id: product!.company_id,
        slug: representativeSlug,
        display_name: 'Teste Acessibilidade',
        authorization_id: `test-${randomUUID()}`,
        phone: '+5511999999999',
        status: 'active',
      })
      .select('id')
      .single();
    assert.equal(representativeError, null);
    representativeId = representative!.id;

    const { error: subscriptionError } = await service!
      .from('subscriptions')
      .insert({ representative_id: representativeId, status: 'active', provider: 'test' });
    assert.equal(subscriptionError, null);

    const { data: activation, error: activationError } = await service!
      .from('product_activations')
      .insert({
        representative_id: representativeId,
        product_id: productId,
        status: 'published',
        published_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    assert.equal(activationError, null);
    activationId = activation!.id;
  });

  after(async () => {
    if (representativeId) {
      await service!.from('analytics_events').delete().eq('representative_id', representativeId);
      await service!.from('product_activations').delete().eq('representative_id', representativeId);
      await service!.from('subscriptions').delete().eq('representative_id', representativeId);
      await service!.from('representatives').delete().eq('id', representativeId);
    }
    if (userId) await service!.auth.admin.deleteUser(userId);
    if (outsiderUserId) await service!.auth.admin.deleteUser(outsiderUserId);
  });

  it('exposes a complete published page', async () => {
    assert.equal(await publicActivationCount(), 1);
  });

  it('hides persisted published when Subscription is inactive, without rewriting status', async () => {
    await service!.from('subscriptions').update({ status: 'suspended' }).eq('representative_id', representativeId);
    assert.equal(await publicActivationCount(), 0);
    const { data } = await service!.from('product_activations').select('status').eq('id', activationId).single();
    assert.equal(data?.status, 'published');
    await service!.from('subscriptions').update({ status: 'active' }).eq('representative_id', representativeId);
  });

  // SET-25/20260823000000 added a grace clause to is_subscription_active() —
  // 'canceled' stays active while current_period_end is still in the future.
  // Never re-verified through the three consumers this function actually
  // gates (this RLS policy, Analytics below, and the publish RPC) until now.
  it('keeps a published page publicly accessible during the post-cancellation grace period', async () => {
    const futureEnd = new Date(Date.now() + 5 * 86_400_000).toISOString();
    await service!
      .from('subscriptions')
      .update({ status: 'canceled', current_period_end: futureEnd })
      .eq('representative_id', representativeId);
    assert.equal(await publicActivationCount(), 1);

    const { data, error } = await service!.rpc('record_page_visit', {
      p_representative_slug: representativeSlug,
      p_product_slug: productSlug,
      p_referrer: null,
      p_ip_hash: `grace-${randomUUID()}`,
      p_user_agent: 'Mozilla/5.0',
    });
    assert.equal(error, null);
    assert.equal(data, true);

    await service!
      .from('subscriptions')
      .update({ status: 'active', current_period_end: null })
      .eq('representative_id', representativeId);
  });

  it('hides a published page and rejects Analytics once the grace period has elapsed', async () => {
    const pastEnd = new Date(Date.now() - 86_400_000).toISOString();
    await service!
      .from('subscriptions')
      .update({ status: 'canceled', current_period_end: pastEnd })
      .eq('representative_id', representativeId);
    assert.equal(await publicActivationCount(), 0);

    const { data, error } = await service!.rpc('record_whatsapp_click', {
      p_representative_slug: representativeSlug,
      p_product_slug: productSlug,
      p_referrer: null,
      p_ip_hash: `post-grace-${randomUUID()}`,
      p_user_agent: 'Mozilla/5.0',
    });
    assert.equal(error, null);
    assert.equal(data, false);

    await service!
      .from('subscriptions')
      .update({ status: 'active', current_period_end: null })
      .eq('representative_id', representativeId);
  });

  it('blocks republication once the grace period has elapsed, through the same gate that publishes', async () => {
    const pastEnd = new Date(Date.now() - 86_400_000).toISOString();
    await service!
      .from('subscriptions')
      .update({ status: 'canceled', current_period_end: pastEnd })
      .eq('representative_id', representativeId);

    const { data: unpublish, error: unpublishError } = await ownerClient!.rpc('set_activation_status', {
      p_product_id: productId,
      p_status: 'unpublished',
    });
    assert.equal(unpublishError, null);
    assert.equal(unpublish?.[0]?.status, 'updated');

    const { data: republish, error: republishError } = await ownerClient!.rpc('set_activation_status', {
      p_product_id: productId,
      p_status: 'published',
    });
    assert.equal(republishError, null);
    assert.equal(republish?.[0]?.status, 'subscription_not_active');

    await service!
      .from('subscriptions')
      .update({ status: 'active', current_period_end: null })
      .eq('representative_id', representativeId);
    await service!.from('product_activations').update({ status: 'published' }).eq('id', activationId);
  });

  it('hides persisted published when representative is suspended', async () => {
    await service!.from('representatives').update({ status: 'suspended' }).eq('id', representativeId);
    assert.equal(await publicActivationCount(), 0);
    await service!.from('representatives').update({ status: 'active' }).eq('id', representativeId);
  });

  for (const [label, value] of [['missing', null], ['empty', ''], ['invalid', 'not-a-phone']] as const) {
    it(`rejects a new phone write when the value is ${label}`, async () => {
      const { error } = await service!.from('representatives').update({ phone: value }).eq('id', representativeId);
      assert.ok(error, `the database unexpectedly accepted a ${label} phone`);
      assert.equal(await publicActivationCount(), 1, 'the rejected write must preserve the valid public page');
    });
  }

  it('hides persisted published when display name is invalid', async () => {
    await service!.from('representatives').update({ display_name: 'Mononym' }).eq('id', representativeId);
    assert.equal(await publicActivationCount(), 0);
    await service!.from('representatives').update({ display_name: 'Teste Acessibilidade' }).eq('id', representativeId);
  });

  it('hides persisted published when display name is empty', async () => {
    await service!.from('representatives').update({ display_name: '' }).eq('id', representativeId);
    assert.equal(await publicActivationCount(), 0);
    await service!.from('representatives').update({ display_name: 'Teste Acessibilidade' }).eq('id', representativeId);
  });

  for (const status of ['draft', 'unpublished'] as const) {
    it(`hides an activation in ${status}`, async () => {
      await service!.from('product_activations').update({ status }).eq('id', activationId);
      assert.equal(await publicActivationCount(), 0);
      await service!.from('product_activations').update({ status: 'published' }).eq('id', activationId);
    });
  }

  it('records both event types for a currently accessible page', async () => {
    for (const fn of ['record_page_visit', 'record_whatsapp_click'] as const) {
      const ipHash = `accessible-${fn}-${randomUUID()}`;
      const { data, error } = await service!.rpc(fn, {
        p_representative_slug: representativeSlug,
        p_product_slug: productSlug,
        p_referrer: null,
        p_ip_hash: ipHash,
        p_user_agent: 'Mozilla/5.0',
      });
      assert.equal(error, null);
      assert.equal(data, true);
      const { data: event } = await service!
        .from('analytics_events')
        .select('id, representative_id, product_id')
        .eq('ip_hash', ipHash)
        .single();
      assert.ok(event?.id);
      assert.equal(event?.representative_id, representativeId);
      assert.equal(event?.product_id, productId);
      await service!.from('analytics_events').delete().eq('id', event!.id);
    }
  });

  it('rejects Analytics for a crossed representative/product pair', async (t) => {
    const { data: otherProduct } = await service!
      .from('products')
      .select('slug')
      .neq('id', productId)
      .limit(1)
      .maybeSingle();
    if (!otherProduct) {
      t.skip('The configured catalog has only one product.');
      return;
    }

    const { data, error } = await service!.rpc('record_page_visit', {
      p_representative_slug: representativeSlug,
      p_product_slug: otherProduct.slug,
      p_referrer: null,
      p_ip_hash: `crossed-${randomUUID()}`,
      p_user_agent: 'Mozilla/5.0',
    });
    assert.equal(error, null);
    assert.equal(data, false);
  });

  it('rejects Analytics whenever the same page is not publicly accessible', async () => {
    await service!.from('subscriptions').update({ status: 'suspended' }).eq('representative_id', representativeId);
    const { data, error } = await service!.rpc('record_whatsapp_click', {
      p_representative_slug: representativeSlug,
      p_product_slug: productSlug,
      p_referrer: null,
      p_ip_hash: `inaccessible-${randomUUID()}`,
      p_user_agent: 'Mozilla/5.0',
    });
    assert.equal(error, null);
    assert.equal(data, false);
    await service!.from('subscriptions').update({ status: 'active' }).eq('representative_id', representativeId);
  });

  it('rejects a click when the representative becomes inactive after render', async () => {
    await service!.from('representatives').update({ status: 'suspended' }).eq('id', representativeId);
    const { data, error } = await service!.rpc('record_whatsapp_click', {
      p_representative_slug: representativeSlug,
      p_product_slug: productSlug,
      p_referrer: null,
      p_ip_hash: `inactive-after-render-${randomUUID()}`,
      p_user_agent: 'Mozilla/5.0',
    });
    assert.equal(error, null);
    assert.equal(data, false);
    await service!.from('representatives').update({ status: 'active' }).eq('id', representativeId);
  });

  it('prevents the phone from being removed after render', async () => {
    const { error } = await service!.from('representatives').update({ phone: null }).eq('id', representativeId);
    assert.ok(error);
    assert.equal(await publicActivationCount(), 1);
  });

  it('filters bots without persisting an event', async () => {
    const ipHash = `bot-${randomUUID()}`;
    const { data, error } = await service!.rpc('record_page_visit', {
      p_representative_slug: representativeSlug,
      p_product_slug: productSlug,
      p_referrer: null,
      p_ip_hash: ipHash,
      p_user_agent: 'Googlebot/2.1',
    });
    assert.equal(error, null);
    assert.equal(data, true);
    const { count } = await service!
      .from('analytics_events')
      .select('id', { count: 'exact', head: true })
      .eq('ip_hash', ipHash);
    assert.equal(count, 0);
  });

  it('truncates referrer to 2048 characters', async () => {
    const ipHash = `referrer-${randomUUID()}`;
    const { data, error } = await service!.rpc('record_page_visit', {
      p_representative_slug: representativeSlug,
      p_product_slug: productSlug,
      p_referrer: `https://example.invalid/${'x'.repeat(3000)}`,
      p_ip_hash: ipHash,
      p_user_agent: 'Mozilla/5.0',
    });
    assert.equal(error, null);
    assert.equal(data, true);
    const { data: event } = await service!.from('analytics_events').select('id, referrer').eq('ip_hash', ipHash).single();
    assert.equal(event?.referrer?.length, 2048);
    await service!.from('analytics_events').delete().eq('id', event!.id);
  });

  it('keeps the fixed five-click rate limit', async () => {
    const ipHash = `rate-${randomUUID()}`;
    const results: boolean[] = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const { data, error } = await service!.rpc('record_whatsapp_click', {
        p_representative_slug: representativeSlug,
        p_product_slug: productSlug,
        p_referrer: null,
        p_ip_hash: ipHash,
        p_user_agent: 'Mozilla/5.0',
      });
      assert.equal(error, null);
      results.push(data === true);
    }
    assert.deepEqual(results, [true, true, true, true, true, false]);
    await service!.from('analytics_events').delete().eq('ip_hash', ipHash);
  });

  it('keeps safe Analytics columns tenant-scoped and ip_hash unavailable to the owner', async () => {
    const ipHash = `rls-${randomUUID()}`;
    const { data: event, error: insertError } = await service!
      .from('analytics_events')
      .insert({
        representative_id: representativeId,
        product_id: productId,
        event_type: 'visit',
        referrer: null,
        ip_hash: ipHash,
      })
      .select('id')
      .single();
    assert.equal(insertError, null);

    const { data: ownerRows, error: ownerError } = await ownerClient!
      .from('analytics_events')
      .select('id, event_type')
      .eq('id', event!.id);
    assert.equal(ownerError, null);
    assert.equal(ownerRows?.length, 1);

    const { data: outsiderRows, error: outsiderError } = await outsiderClient!
      .from('analytics_events')
      .select('id, event_type')
      .eq('id', event!.id);
    assert.equal(outsiderError, null);
    assert.equal(outsiderRows?.length, 0);

    const { error: hashError } = await ownerClient!.from('analytics_events').select('ip_hash').eq('id', event!.id);
    assert.ok(hashError);
    assert.match(hashError.message, /permission denied/i);

    await service!.from('analytics_events').delete().eq('id', event!.id);
  });
});
