import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { createIntegrationServiceRoleClient } from './support/service-role-client';

/**
 * SET-34, critério "publicação acompanha entitlement". O contrato SQL de
 * `set_activation_status()` já é verificado estaticamente por
 * `subscription-publication-gate.test.ts` (regex sobre o texto da
 * migration, nunca roda contra o banco); este teste roda o fluxo real:
 * publicar enquanto a reserva de checkout ainda não foi paga é bloqueado
 * (`subscription_not_active`), o webhook (`apply_billing_event`, mesmo
 * caminho da produção) ativa a Subscription, e só então a MESMA chamada de
 * publicação que falhou antes passa a suceder — sem nenhuma consulta ao
 * Asaas por request, só o entitlement já sincronizado localmente
 * (ADR-048/ADR-072).
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(url && publicKey && serviceKey);
const service = canRun ? createIntegrationServiceRoleClient() : null;

let userId = '';
let representativeId = '';
let productId = '';
let activationId = '';
let owner: SupabaseClient | null = null;
// evt-* ids never get a subscription_id back when unmatched, but this one
// always matches — tracked anyway to mirror apply-billing-event.integration's
// convention and never leak a billing_events row across `npm run test` runs.
const createdEventIds: string[] = [];

describe('publication follows entitlement, end to end (Postgres, integration)', { skip: !canRun }, () => {
  before(async () => {
    const email = `publish-entitlement-${randomUUID()}@example.invalid`;
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
        slug: `publish-entitlement-${randomUUID()}`,
        display_name: 'Teste Publicação e Entitlement',
        authorization_id: `test-${randomUUID()}`,
        phone: '+5511988887777',
        status: 'active',
      })
      .select('id')
      .single();
    assert.equal(representativeError, null);
    representativeId = representative!.id;

    // Criação de draft é permitida sem Subscription ativa (fora do gate E2,
    // ver comentário de 20260816000000) — inserida direto, nunca via
    // set_activation_status.
    const { data: activation, error: activationError } = await service!
      .from('product_activations')
      .insert({ representative_id: representativeId, product_id: productId, status: 'draft' })
      .select('id')
      .single();
    assert.equal(activationError, null);
    activationId = activation!.id;
  });

  after(async () => {
    if (createdEventIds.length > 0) {
      await service!.from('billing_events').delete().in('asaas_event_id', createdEventIds);
    }
    if (representativeId) {
      await service!.from('product_activations').delete().eq('representative_id', representativeId);
      await service!.from('subscriptions').delete().eq('representative_id', representativeId);
      await service!.from('representatives').delete().eq('id', representativeId);
    }
    if (userId) await service!.auth.admin.deleteUser(userId);
  });

  it('blocks publication while the checkout reservation is unpaid, then unblocks the exact same call once the webhook applies', async () => {
    const { data: reserved, error: reserveError } = await owner!.rpc('reserve_billing_checkout_slot');
    assert.equal(reserveError, null);
    assert.equal(reserved?.[0]?.status, 'reserved');
    const subscriptionId = reserved![0]!.id as string;

    const { data: blocked, error: blockedError } = await owner!.rpc('set_activation_status', {
      p_product_id: productId,
      p_status: 'published',
    });
    assert.equal(blockedError, null);
    assert.equal(
      blocked?.[0]?.status,
      'subscription_not_active',
      'an unpaid checkout reservation must never be enough to publish',
    );

    const { data: stillDraft } = await service!
      .from('product_activations')
      .select('status')
      .eq('id', activationId)
      .single();
    assert.equal(stillDraft?.status, 'draft');

    const eventId = `evt-publish-entitlement-${randomUUID()}`;
    createdEventIds.push(eventId);
    const { data: applied, error: applyError } = await service!.rpc('apply_billing_event', {
      p_event_id: eventId,
      p_event_type: 'CHECKOUT_PAID',
      p_asaas_subscription_id: null,
      p_asaas_customer_id: null,
      p_external_reference: subscriptionId,
      p_next_due_date: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
      p_payload: { synthetic: true },
    });
    assert.equal(applyError, null);
    assert.equal(applied?.[0]?.outcome, 'applied');

    const { data: active, error: activeError } = await service!.rpc('is_subscription_active', {
      p_representative_id: representativeId,
    });
    assert.equal(activeError, null);
    assert.equal(active, true, 'the same webhook path production uses must flip entitlement open');

    const { data: unblocked, error: unblockedError } = await owner!.rpc('set_activation_status', {
      p_product_id: productId,
      p_status: 'published',
    });
    assert.equal(unblockedError, null);
    assert.equal(unblocked?.[0]?.status, 'updated');
    assert.ok(unblocked?.[0]?.published_at, 'a real published_at is stamped once entitlement actually opens');

    const { data: published } = await service!
      .from('product_activations')
      .select('status, published_at')
      .eq('id', activationId)
      .single();
    assert.equal(published?.status, 'published');
    assert.ok(published?.published_at);
  });
});
