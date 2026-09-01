import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import { createIntegrationServiceRoleClient } from './support/service-role-client';

/**
 * SET-21: submit_lead must reject exactly when the page is not publicly
 * accessible by the same rule every other public surface uses — not by its
 * own, narrower predicate. Unlike lead-submission.integration.test.ts (which
 * discovers a pre-existing published pair, since it never needs to mutate
 * Subscription/representative/profile state), these tests need a disposable
 * fixture they can toggle through every precondition — the same posture
 * public-accessibility.integration.test.ts already uses for
 * record_page_visit/record_whatsapp_click.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(url && serviceKey);
const service = canRun ? createIntegrationServiceRoleClient() : null;

let userId = '';
let representativeId = '';
let activationId = '';
let productId = '';

function freshIpHash(label: string): string {
  return `lead-canonical-access-${label}-${randomUUID()}`;
}

async function submitLead(ipHash: string): Promise<boolean | null> {
  const { data, error } = await service!.rpc('submit_lead', {
    p_representative_id: representativeId,
    p_product_id: productId,
    p_telefone_e164: '+5511988887777',
    p_nome: 'Lead Canonico Teste',
    p_cidade: null,
    p_email: null,
    p_origem: 'lead-canonical-access-integration-test',
    p_referrer: null,
    p_ip_hash: ipHash,
  });
  assert.equal(error, null);
  return data as boolean | null;
}

describe('submit_lead consumes the canonical public-access rule (Postgres, integration)', { skip: !canRun }, () => {
  before(async () => {
    const email = `lead-canonical-access-${randomUUID()}@example.invalid`;
    const password = `T3st-${randomUUID()}-Aa`;
    const { data: userData, error: userError } = await service!.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    assert.equal(userError, null);
    userId = userData.user!.id;

    const { data: product, error: productError } = await service!
      .from('products')
      .select('id, company_id')
      .limit(1)
      .single();
    assert.equal(productError, null);
    productId = product!.id;

    const { data: representative, error: representativeError } = await service!
      .from('representatives')
      .insert({
        profile_id: userId,
        company_id: product!.company_id,
        slug: `lead-canonical-access-${randomUUID()}`,
        display_name: 'Teste Acesso Canonico',
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
      await service!.from('leads').delete().eq('representative_id', representativeId);
      await service!.from('lead_submission_attempts').delete().like('ip_hash', 'lead-canonical-access-%');
      await service!.from('product_activations').delete().eq('representative_id', representativeId);
      await service!.from('subscriptions').delete().eq('representative_id', representativeId);
      await service!.from('representatives').delete().eq('id', representativeId);
    }
    if (userId) await service!.auth.admin.deleteUser(userId);
  });

  it('accepts a lead for a fully accessible page (happy path)', async () => {
    const ipHash = freshIpHash('happy-path');
    const result = await submitLead(ipHash);
    assert.equal(result, true);

    const { data: lead } = await service!
      .from('leads')
      .select('id')
      .eq('representative_id', representativeId)
      .limit(1)
      .maybeSingle();
    assert.ok(lead?.id, 'a successful call must have actually persisted the lead');
  });

  it('rejects a lead once the Subscription is suspended, reproducing the issue scenario exactly', async () => {
    await service!.from('subscriptions').update({ status: 'suspended' }).eq('representative_id', representativeId);
    const result = await submitLead(freshIpHash('subscription-suspended'));
    assert.equal(result, false);
    await service!.from('subscriptions').update({ status: 'active' }).eq('representative_id', representativeId);
  });

  it('rejects a lead once the representative is suspended', async () => {
    await service!.from('representatives').update({ status: 'suspended' }).eq('id', representativeId);
    const result = await submitLead(freshIpHash('representative-suspended'));
    assert.equal(result, false);
    await service!.from('representatives').update({ status: 'active' }).eq('id', representativeId);
  });

  it('rejects a lead once the display name no longer meets the canonical onboarding shape', async () => {
    await service!.from('representatives').update({ display_name: 'Mononym' }).eq('id', representativeId);
    const result = await submitLead(freshIpHash('invalid-display-name'));
    assert.equal(result, false);
    await service!
      .from('representatives')
      .update({ display_name: 'Teste Acesso Canonico' })
      .eq('id', representativeId);
  });

  for (const status of ['draft', 'unpublished'] as const) {
    it(`rejects a lead while the activation is ${status}`, async () => {
      await service!.from('product_activations').update({ status }).eq('id', activationId);
      const result = await submitLead(freshIpHash(`activation-${status}`));
      assert.equal(result, false);
      await service!.from('product_activations').update({ status: 'published' }).eq('id', activationId);
    });
  }

  it('a direct privileged RPC call cannot bypass the rule either — same rejection as the application path', async () => {
    await service!.from('subscriptions').update({ status: 'suspended' }).eq('representative_id', representativeId);
    const { data, error } = await service!.rpc('submit_lead', {
      p_representative_id: representativeId,
      p_product_id: productId,
      p_telefone_e164: '+5511988887777',
      p_nome: 'Tentativa Direta',
      p_cidade: null,
      p_email: null,
      p_origem: null,
      p_referrer: null,
      p_ip_hash: freshIpHash('direct-bypass-attempt'),
    });
    assert.equal(error, null);
    assert.equal(data, false);
    await service!.from('subscriptions').update({ status: 'active' }).eq('representative_id', representativeId);
  });
});
