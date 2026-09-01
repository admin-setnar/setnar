import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { createIntegrationServiceRoleClient } from './support/service-role-client';

/**
 * SET-84 D5 — runtime double-check of `20260908000003_grant_analytics_events_origin_to_authenticated.sql`:
 * `tests/analytics-events-origin-grant.test.ts` proves the migration's SQL
 * text is correct; this proves it actually takes effect against a real
 * database. Same reasoning `rls-own-row-isolation.integration.test.ts`
 * already gives for having both a static and a runtime suite — a grant that
 * reads right on paper can still be wrong against the deployed schema.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(url && publicKey && serviceKey);
const service = canRun ? createIntegrationServiceRoleClient() : null;

let userId = '';
let representativeId = '';
let subscriptionId = '';
let activationId = '';
let authenticatedClient: SupabaseClient | null = null;

describe('analytics_events.origin readable by its own representative (Postgres, integration)', { skip: !canRun }, () => {
  before(async () => {
    const { data: product, error: productError } = await service!
      .from('products')
      .select('id, slug, company_id')
      .limit(1)
      .single();
    assert.equal(productError, null);

    const email = `origin-grant-${randomUUID()}@example.invalid`;
    const password = `T3st-${randomUUID()}-Aa`;
    const { data: userData, error: userError } = await service!.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    assert.equal(userError, null);
    userId = userData.user!.id;

    const slug = `origin-grant-${randomUUID()}`;
    const { data: representative, error: representativeError } = await service!
      .from('representatives')
      .insert({
        profile_id: userId,
        company_id: product!.company_id,
        slug,
        display_name: 'Fixture Origin Grant',
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
      .insert({ representative_id: representativeId, status: 'active', provider: 'test' })
      .select('id')
      .single();
    assert.equal(subscriptionError, null);
    subscriptionId = subscription!.id;

    const { data: activation, error: activationError } = await service!
      .from('product_activations')
      .insert({
        representative_id: representativeId,
        product_id: product!.id,
        status: 'published',
        published_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    assert.equal(activationError, null);
    activationId = activation!.id;

    const { data: visitAccepted, error: visitError } = await service!.rpc('record_page_visit', {
      p_representative_slug: slug,
      p_product_slug: product!.slug,
      p_referrer: null,
      p_ip_hash: `origin-grant-test-${randomUUID()}`,
      p_user_agent: 'Mozilla/5.0',
      p_origin: 'instagram_post',
    });
    assert.equal(visitError, null);
    assert.equal(visitAccepted, true);

    authenticatedClient = createClient(url!, publicKey!, { auth: { persistSession: false } });
    const { error: signInError } = await authenticatedClient.auth.signInWithPassword({ email, password });
    assert.equal(signInError, null);
  });

  after(async () => {
    const cleanupErrors: string[] = [];
    const recordError = (label: string, error: { message: string } | null) => {
      if (error) cleanupErrors.push(`${label}: ${error.message}`);
    };

    if (representativeId) {
      recordError(
        'analytics_events',
        (await service!.from('analytics_events').delete().eq('representative_id', representativeId)).error,
      );
    }
    if (activationId) recordError('activation', (await service!.from('product_activations').delete().eq('id', activationId)).error);
    if (subscriptionId) recordError('subscription', (await service!.from('subscriptions').delete().eq('id', subscriptionId)).error);
    if (representativeId) recordError('representative', (await service!.from('representatives').delete().eq('id', representativeId)).error);
    if (userId) recordError('auth user', (await service!.auth.admin.deleteUser(userId)).error);

    assert.deepEqual(cleanupErrors, [], 'the disposable origin-grant fixture must be fully removed');
  });

  it('lets the representative read origin from its own analytics_events row', async () => {
    const { data, error } = await authenticatedClient!
      .from('analytics_events')
      .select('origin')
      .eq('representative_id', representativeId)
      .single();
    assert.equal(error, null, `select(origin) unexpectedly denied: ${error?.message}`);
    assert.equal(data!.origin, 'instagram_post');
  });

  it('still denies ip_hash to the same representative on the same row', async () => {
    const { error } = await authenticatedClient!
      .from('analytics_events')
      .select('ip_hash')
      .eq('representative_id', representativeId)
      .single();
    assert.ok(error, 'ip_hash unexpectedly readable by authenticated — the D5 grant must stay additive, never widen this');
    assert.match(error!.message, /permission denied/i);
  });
});
