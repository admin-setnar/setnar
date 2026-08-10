import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, describe, it } from 'node:test';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * SET-67, sobre as duas decisões fechadas no SET-66 (confirmadas por Pedro
 * em 2026-08-10): `trial_start` = conclusão do onboarding
 * (`register_representative()`), e iniciar o trial nunca consome vaga
 * fundadora — só a conversão real para pago consome. O achado central do
 * desenho, provado abaixo: iniciar o checkout DURANTE o trial não pode
 * derrubar o entitlement no meio do redirect para o Asaas — `status`/
 * `current_period_end` só mudam quando `apply_billing_event()` confirma o
 * pagamento de verdade (ver a migration `20260901000000_add_trial_lifecycle.sql`).
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(url && publicKey && serviceKey);
const service = canRun ? createClient(url!, serviceKey!, { auth: { persistSession: false } }) : null;

interface Fixture {
  readonly userId: string;
  readonly representativeId: string;
  readonly owner: SupabaseClient;
}

const createdUserIds: string[] = [];
const createdEventIds: string[] = [];

async function registerFreshRepresentative(displayName: string): Promise<Fixture> {
  const email = `trial-lifecycle-${randomUUID()}@example.invalid`;
  const password = `T3st-${randomUUID()}-Aa`;
  const { data: userData, error: userError } = await service!.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  assert.equal(userError, null);
  const userId = userData.user!.id;
  createdUserIds.push(userId);

  const owner = createClient(url!, publicKey!, { auth: { persistSession: false } });
  const { error: signInError } = await owner.auth.signInWithPassword({ email, password });
  assert.equal(signInError, null);

  const { data: registered, error: registerError } = await owner.rpc('register_representative', {
    p_slug: `trial-lifecycle-${randomUUID()}`,
    p_display_name: displayName,
    p_authorization_id: `trial-${randomUUID()}`,
    p_phone: '+5511988887777',
    p_city: null,
  });
  assert.equal(registerError, null);
  assert.equal(registered?.[0]?.status, 'created');
  const representativeId = registered![0]!.representative_id as string;

  return { userId, representativeId, owner };
}

async function subscriptionRow(representativeId: string) {
  const { data } = await service!
    .from('subscriptions')
    .select('status, provider, payment_method, amount_cents, current_period_end, external_subscription_id')
    .eq('representative_id', representativeId)
    .single();
  return data;
}

describe('trial lifecycle, end to end (SET-67, Postgres integration)', { skip: !canRun }, () => {
  after(async () => {
    if (createdEventIds.length > 0) {
      await service!.from('billing_events').delete().in('asaas_event_id', createdEventIds);
    }
    if (createdUserIds.length > 0) {
      const { data: reps } = await service!
        .from('representatives')
        .select('id')
        .in('profile_id', createdUserIds);
      const repIds = (reps ?? []).map((r) => r.id as string);
      if (repIds.length > 0) {
        await service!.from('product_activations').delete().in('representative_id', repIds);
        await service!.from('subscriptions').delete().in('representative_id', repIds);
        await service!.from('representatives').delete().in('id', repIds);
      }
      for (const userId of createdUserIds) {
        await service!.auth.admin.deleteUser(userId);
      }
    }
  });

  it('register_representative() cria a linha de trial: trialing, provider=trial, ~30 dias de current_period_end', async () => {
    const { representativeId } = await registerFreshRepresentative('Teste Trial Nasce');
    const row = await subscriptionRow(representativeId);

    assert.equal(row?.status, 'trialing');
    assert.equal(row?.provider, 'trial');
    assert.equal(row?.payment_method, null);
    assert.equal(row?.amount_cents, null);
    assert.ok(row?.current_period_end);

    const daysAhead = (new Date(row!.current_period_end!).getTime() - Date.now()) / 86_400_000;
    assert.ok(daysAhead > 29 && daysAhead < 31, `esperava ~30 dias à frente, recebeu ${daysAhead}`);
  });

  it('is_subscription_active() é true imediatamente após o registro, sem nenhum checkout', async () => {
    const { representativeId } = await registerFreshRepresentative('Teste Trial Entitlement');
    const { data: active, error } = await service!.rpc('is_subscription_active', {
      p_representative_id: representativeId,
    });
    assert.equal(error, null);
    assert.equal(active, true);
  });

  it('publicação é permitida durante o trial, sem nenhum checkout — mesmo gate que a assinatura paga usa', async () => {
    const { owner } = await registerFreshRepresentative('Teste Trial Publicação');
    const { data: product } = await service!.from('products').select('id').limit(1).single();

    const { data: activated, error: activateError } = await owner.rpc('activate_product', {
      p_product_id: product!.id,
    });
    assert.equal(activateError, null);
    assert.equal(activated?.[0]?.status, 'activated');

    const { data: published, error: publishError } = await owner.rpc('set_activation_status', {
      p_product_id: product!.id,
      p_status: 'published',
    });
    assert.equal(publishError, null);
    assert.equal(published?.[0]?.status, 'updated', 'trial sozinho já deve satisfazer o gate de subscription_not_active');
  });

  it('reserve_billing_checkout_slot() durante o trial nunca derruba o entitlement — status/current_period_end continuam do trial até o pagamento confirmar', async () => {
    const { representativeId, owner } = await registerFreshRepresentative('Teste Conversão Antecipada');
    const beforeRow = await subscriptionRow(representativeId);
    assert.equal(beforeRow?.status, 'trialing');

    const { data: reserved, error: reserveError } = await owner.rpc('reserve_billing_checkout_slot');
    assert.equal(reserveError, null);
    assert.equal(reserved?.[0]?.status, 'reserved');
    assert.equal(reserved?.[0]?.amount_cents, 2790);
    assert.equal(reserved?.[0]?.stale_external_subscription_id, null, 'trial nunca teve external_subscription_id a cancelar');

    const afterReserve = await subscriptionRow(representativeId);
    assert.equal(afterReserve?.status, 'trialing', 'o gap entre reservar e o webhook confirmar nunca pode derrubar o acesso');
    assert.equal(afterReserve?.current_period_end, beforeRow?.current_period_end, 'a data do trial não é tocada pela reserva');
    assert.equal(afterReserve?.provider, 'asaas', 'provider já reflete a tentativa de conversão real');
    assert.equal(afterReserve?.amount_cents, 2790);

    const { data: stillActive } = await service!.rpc('is_subscription_active', {
      p_representative_id: representativeId,
    });
    assert.equal(stillActive, true, 'entitlement continua válido durante a janela de checkout');

    // Fecha o ciclo: o mesmo caminho de produção que qualquer outro pagamento usa.
    const eventId = `evt-trial-conversion-${randomUUID()}`;
    createdEventIds.push(eventId);
    const { data: applied, error: applyError } = await service!.rpc('apply_billing_event', {
      p_event_id: eventId,
      p_event_type: 'CHECKOUT_PAID',
      p_asaas_subscription_id: null,
      p_asaas_customer_id: 'cus_trial_conversion',
      p_external_reference: reserved![0]!.id as string,
      p_next_due_date: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
      p_payload: { synthetic: true },
    });
    assert.equal(applyError, null);
    assert.equal(applied?.[0]?.outcome, 'applied');

    const afterPayment = await subscriptionRow(representativeId);
    assert.equal(afterPayment?.status, 'active');
  });

  it('linhas de trial nunca contam para as 30 vagas fundadoras', async () => {
    const countAutomated = async () => {
      const { count } = await service!
        .from('subscriptions')
        .select('id', { count: 'exact', head: true })
        .not('provider', 'in', '(manual,trial)');
      return count ?? 0;
    };

    const before_ = await countAutomated();

    const trialFixtures = await Promise.all([
      registerFreshRepresentative('Teste Vaga Trial A'),
      registerFreshRepresentative('Teste Vaga Trial B'),
      registerFreshRepresentative('Teste Vaga Trial C'),
    ]);
    assert.equal(trialFixtures.length, 3);

    const after_ = await countAutomated();
    assert.equal(after_, before_, 'três novos trials não podem mudar a contagem de vagas automatizadas');
  });

  it('register_representative() chamado de novo pelo mesmo usuário não concede um segundo trial nem estende o atual', async () => {
    const { representativeId, owner } = await registerFreshRepresentative('Teste Sem Trial Duplicado');
    const originalRow = await subscriptionRow(representativeId);

    const { data: secondAttempt, error } = await owner.rpc('register_representative', {
      p_slug: `trial-lifecycle-second-${randomUUID()}`,
      p_display_name: 'Tentativa Duplicada',
      p_authorization_id: `trial-second-${randomUUID()}`,
      p_phone: '+5511988887777',
      p_city: null,
    });
    assert.equal(error, null);
    assert.equal(secondAttempt?.[0]?.status, 'already_registered');

    const rowAfter = await subscriptionRow(representativeId);
    assert.deepEqual(rowAfter, originalRow, 'nenhum campo do trial original muda numa segunda tentativa de registro');

    const { count } = await service!
      .from('subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('representative_id', representativeId);
    assert.equal(count, 1, 'nunca uma segunda linha de subscriptions para o mesmo representante');
  });
});
