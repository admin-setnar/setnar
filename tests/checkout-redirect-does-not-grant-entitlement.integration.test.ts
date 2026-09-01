import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { getSubscriptionViewState } from '@/modules/billing/presentation/subscription-view-state';

import { createIntegrationServiceRoleClient } from './support/service-role-client';

/**
 * SET-34, critério "redirect sem webhook não ativa entitlement" — prova na
 * fronteira real que `/app/conta` consome, não com fixtures fabricadas:
 * `reserve_billing_checkout_slot()` reserva a vaga (o que acontece ao
 * clicar "Assinar", antes de ir para o Asaas) e, sem NENHUMA chamada a
 * `apply_billing_event()` — o único caminho de escrita capaz de gravar
 * `status = 'active'`, `service_role`-only (`apply-billing-event.integration.test.ts`,
 * "keeps the RPC unavailable to anon/authenticated") — tanto
 * `get_own_subscription_view()` (o RPC que a UI lê) quanto
 * `is_subscription_active()` (o gate real de entitlement/publicação)
 * continuam reportando a assinatura como não paga. `getSubscriptionViewState`
 * entra no mesmo teste para fechar a cadeia até a decisão de UI: a linha
 * real do banco mapeia para `checkout_incomplete`, nunca `active`.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(url && publicKey && serviceKey);
const service = canRun ? createIntegrationServiceRoleClient() : null;

let userId = '';
let representativeId = '';
let owner: SupabaseClient | null = null;

describe('checkout redirect without a webhook (Postgres, integration)', { skip: !canRun }, () => {
  before(async () => {
    const email = `checkout-redirect-${randomUUID()}@example.invalid`;
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

    const { data: representative, error: representativeError } = await service!
      .from('representatives')
      .insert({
        profile_id: userId,
        company_id: company!.id,
        slug: `checkout-redirect-${randomUUID()}`,
        display_name: 'Teste Redirect Sem Webhook',
        authorization_id: `test-${randomUUID()}`,
        phone: '+5511988887777',
        status: 'active',
      })
      .select('id')
      .single();
    assert.equal(representativeError, null);
    representativeId = representative!.id;
  });

  after(async () => {
    if (representativeId) {
      await service!.from('subscriptions').delete().eq('representative_id', representativeId);
      await service!.from('representatives').delete().eq('id', representativeId);
    }
    if (userId) await service!.auth.admin.deleteUser(userId);
  });

  it('keeps entitlement closed after reserving a checkout slot, simulating a return to ?checkout=success with no webhook ever delivered', async () => {
    const { data: reserved, error: reserveError } = await owner!.rpc('reserve_billing_checkout_slot');
    assert.equal(reserveError, null);
    assert.equal(reserved?.[0]?.status, 'reserved');

    // No apply_billing_event() call anywhere in this test — that omission
    // IS the simulation of "the Asaas webhook never fired".

    const { data: view, error: viewError } = await owner!.rpc('get_own_subscription_view');
    assert.equal(viewError, null);
    assert.equal(view?.[0]?.status, 'suspended', 'the row the UI reads never shows anything but the pre-payment state');
    assert.equal(view?.[0]?.has_external_subscription, false);

    const { data: active, error: activeError } = await service!.rpc('is_subscription_active', {
      p_representative_id: representativeId,
    });
    assert.equal(activeError, null);
    assert.equal(active, false, 'the real entitlement gate used by publication never opens from a redirect alone');

    const viewState = getSubscriptionViewState({
      status: view![0]!.status,
      amountCents: view![0]!.amount_cents,
      currency: view![0]!.currency,
      currentPeriodEnd: view![0]!.current_period_end,
      hasExternalSubscription: view![0]!.has_external_subscription,
    });
    assert.deepEqual(
      viewState,
      { kind: 'checkout_incomplete' },
      'the UI never has enough signal to render anything but "waiting for payment"',
    );
  });
});
