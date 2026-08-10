import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * SET-32: as duas RPCs de escrita do cancelamento — `prepare_own_subscription_cancellation()`
 * (leitura, valida elegibilidade) e `confirm_own_subscription_cancellation()`
 * (escreve `status = 'canceled'`). Ambas resolvem `auth.uid()` internamente,
 * então os testes chamam via um client autenticado como o próprio
 * representante (mesmo padrão de `ownerClient` em
 * `public-accessibility.integration.test.ts`), não via service role.
 *
 * SET-63 (`supabase/migrations/20260902000000_add_cancellation_feedback_event.sql`)
 * estende `confirm_own_subscription_cancellation()` para também abrir uma
 * linha fresca em `feedback_responses` (`context = 'cancellation'`) em cada
 * transição real para `canceled` — nunca nos caminhos `already_canceled`/
 * `changed`/`not_found`. Os testes abaixo que produzem uma transição real
 * verificam essa linha também; um teste dedicado no fim do arquivo prova o
 * critério de aceite central do SET-63: um segundo evento de cancelamento
 * (reativação + novo cancelamento) abre uma SEGUNDA linha, independente da
 * primeira já ter sido respondida.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(url && publicKey && serviceKey);
const service = canRun ? createClient(url!, serviceKey!, { auth: { persistSession: false } }) : null;
const anon = canRun ? createClient(url!, publicKey!, { auth: { persistSession: false } }) : null;

let userId = '';
let representativeId = '';
let subscriptionId = '';
let ownerClient: SupabaseClient | null = null;

let noSubscriptionUserId = '';
let noSubscriptionRepresentativeId = '';
let noSubscriptionClient: SupabaseClient | null = null;

async function signedInClient(emailPrefix: string): Promise<{ client: SupabaseClient; userId: string }> {
  const email = `${emailPrefix}-${randomUUID()}@example.invalid`;
  const password = `T3st-${randomUUID()}-Aa`;
  const { data, error } = await service!.auth.admin.createUser({ email, password, email_confirm: true });
  assert.equal(error, null);
  const client = createClient(url!, publicKey!, { auth: { persistSession: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  assert.equal(signInError, null);
  return { client, userId: data.user!.id };
}

async function subscriptionRow() {
  const { data } = await service!
    .from('subscriptions')
    .select('status, external_subscription_id, current_period_end')
    .eq('id', subscriptionId)
    .single();
  return data;
}

async function cancellationFeedbackRows() {
  const { data } = await service!
    .from('feedback_responses')
    .select('id, shown_at, answered_at, dismissed_at, created_at')
    .eq('representative_id', representativeId)
    .eq('context', 'cancellation')
    .order('created_at', { ascending: true });
  return data ?? [];
}

describe('subscription cancellation RPCs (Postgres, integration)', { skip: !canRun }, () => {
  before(async () => {
    const owner = await signedInClient('cancel-owner');
    userId = owner.userId;
    ownerClient = owner.client;

    const noSub = await signedInClient('cancel-no-sub');
    noSubscriptionUserId = noSub.userId;
    noSubscriptionClient = noSub.client;

    const { data: company, error: companyError } = await service!.from('companies').select('id').limit(1).single();
    assert.equal(companyError, null);

    const { data: representative, error: representativeError } = await service!
      .from('representatives')
      .insert({
        profile_id: userId,
        company_id: company!.id,
        slug: `cancel-owner-${randomUUID()}`,
        display_name: 'Teste Cancelamento',
        authorization_id: `test-${randomUUID()}`,
        phone: '+5511988887777',
        status: 'active',
      })
      .select('id')
      .single();
    assert.equal(representativeError, null);
    representativeId = representative!.id;

    const { data: noSubRepresentative, error: noSubRepresentativeError } = await service!
      .from('representatives')
      .insert({
        profile_id: noSubscriptionUserId,
        company_id: company!.id,
        slug: `cancel-no-sub-${randomUUID()}`,
        display_name: 'Teste Sem Assinatura',
        authorization_id: `test-${randomUUID()}`,
        phone: '+5511988887778',
        status: 'active',
      })
      .select('id')
      .single();
    assert.equal(noSubRepresentativeError, null);
    noSubscriptionRepresentativeId = noSubRepresentative!.id;
  });

  after(async () => {
    if (representativeId) {
      await service!.from('feedback_responses').delete().eq('representative_id', representativeId);
      await service!.from('subscriptions').delete().eq('representative_id', representativeId);
      await service!.from('representatives').delete().eq('id', representativeId);
    }
    if (noSubscriptionRepresentativeId) {
      await service!.from('representatives').delete().eq('id', noSubscriptionRepresentativeId);
    }
    if (userId) await service!.auth.admin.deleteUser(userId);
    if (noSubscriptionUserId) await service!.auth.admin.deleteUser(noSubscriptionUserId);
  });

  it('reports "not_found" when the signed-in user has no subscription row at all', async () => {
    const { data: prepared, error: prepareError } = await noSubscriptionClient!.rpc(
      'prepare_own_subscription_cancellation',
    );
    assert.equal(prepareError, null);
    assert.deepEqual(prepared?.[0], { status: 'not_found', external_subscription_id: null });

    const { data: confirmed, error: confirmError } = await noSubscriptionClient!.rpc(
      'confirm_own_subscription_cancellation',
      { p_external_subscription_id: null },
    );
    assert.equal(confirmError, null);
    assert.deepEqual(confirmed?.[0], { status: 'not_found' });
  });

  it('is unavailable to anon — no session means no representative to resolve', async () => {
    const { error } = await anon!.rpc('prepare_own_subscription_cancellation');
    assert.ok(error);
  });

  it('reports "cancelable" with the external id for an active subscription, and confirms it without touching current_period_end', async () => {
    const currentPeriodEnd = new Date(Date.now() + 20 * 86_400_000).toISOString();
    const { data: subscription, error: subscriptionError } = await service!
      .from('subscriptions')
      .insert({
        representative_id: representativeId,
        status: 'active',
        provider: 'asaas',
        external_subscription_id: 'sub_test_cancel_1',
        current_period_end: currentPeriodEnd,
      })
      .select('id')
      .single();
    assert.equal(subscriptionError, null);
    subscriptionId = subscription!.id;

    const { data: prepared, error: prepareError } = await ownerClient!.rpc('prepare_own_subscription_cancellation');
    assert.equal(prepareError, null);
    assert.deepEqual(prepared?.[0], { status: 'cancelable', external_subscription_id: 'sub_test_cancel_1' });

    const { data: confirmed, error: confirmError } = await ownerClient!.rpc('confirm_own_subscription_cancellation', {
      p_external_subscription_id: prepared?.[0]?.external_subscription_id ?? null,
    });
    assert.equal(confirmError, null);
    assert.deepEqual(confirmed?.[0], { status: 'canceled' });

    const row = await subscriptionRow();
    assert.equal(row?.status, 'canceled');
    // A graça já concedida por is_subscription_active() depende deste valor
    // não regredir — cancelar nunca pode reescrever a data. Compara por
    // instante, não por string: Postgres devolve timestamptz como
    // `+00:00`, não `Z` — mesmo valor, representação textual diferente.
    assert.equal(new Date(row!.current_period_end!).getTime(), new Date(currentPeriodEnd).getTime());
    assert.equal(row?.external_subscription_id, 'sub_test_cancel_1');

    // SET-63: a transição real para 'canceled' abre uma linha fresca e não
    // resolvida em feedback_responses — 'shown_at' fica null até o prompt
    // realmente montar no navegador (record_feedback_shown), não no
    // momento em que o servidor só concluiu o cancelamento internamente.
    const feedbackRows = await cancellationFeedbackRows();
    assert.equal(feedbackRows.length, 1);
    assert.equal(feedbackRows[0]?.shown_at, null);
    assert.equal(feedbackRows[0]?.answered_at, null);
    assert.equal(feedbackRows[0]?.dismissed_at, null);
  });

  it('is idempotent — confirming an already-canceled subscription again reports "already_canceled", not an error', async () => {
    const { data: prepared, error: prepareError } = await ownerClient!.rpc('prepare_own_subscription_cancellation');
    assert.equal(prepareError, null);
    assert.deepEqual(prepared?.[0], { status: 'already_canceled', external_subscription_id: null });

    const rowsBefore = await cancellationFeedbackRows();

    const { data: confirmed, error: confirmError } = await ownerClient!.rpc('confirm_own_subscription_cancellation', {
      p_external_subscription_id: null,
    });
    assert.equal(confirmError, null);
    assert.deepEqual(confirmed?.[0], { status: 'already_canceled' });

    const row = await subscriptionRow();
    assert.equal(row?.status, 'canceled');

    // No new event actually happened — no second feedback row either.
    assert.deepEqual(await cancellationFeedbackRows(), rowsBefore);
  });

  it('SET-63: a second cancellation event opens a fresh, unresolved feedback row — even though the first one was already answered', async () => {
    // Simulates the representative having answered the first cancellation's
    // prompt (the exact scenario the "reuse the latest row" default RPC
    // behavior would otherwise break — see this file's own header).
    const [firstRow] = await cancellationFeedbackRows();
    assert.ok(firstRow, 'the previous test must have already opened the first cancellation event\'s row');
    const { data: resolvedFirst, error: resolveFirstError } = await ownerClient!.rpc('resolve_feedback', {
      p_context: 'cancellation',
      p_outcome: 'answered',
      p_response: 'price',
      p_response_detail: null,
    });
    assert.equal(resolveFirstError, null);
    assert.equal(resolvedFirst?.[0]?.status, 'updated');

    // Reactivates (as if the representative subscribed again), then
    // suspends — same "also allows canceling from suspended" scenario as
    // before, now doubling as the second, independent cancellation event.
    const { error: updateError } = await service!
      .from('subscriptions')
      .update({ status: 'suspended', external_subscription_id: 'sub_test_cancel_2' })
      .eq('id', subscriptionId);
    assert.equal(updateError, null);

    const { data: prepared, error: prepareError } = await ownerClient!.rpc('prepare_own_subscription_cancellation');
    assert.equal(prepareError, null);
    assert.deepEqual(prepared?.[0], { status: 'cancelable', external_subscription_id: 'sub_test_cancel_2' });

    const { data: confirmed, error: confirmError } = await ownerClient!.rpc('confirm_own_subscription_cancellation', {
      p_external_subscription_id: prepared?.[0]?.external_subscription_id ?? null,
    });
    assert.equal(confirmError, null);
    assert.deepEqual(confirmed?.[0], { status: 'canceled' });
    assert.equal((await subscriptionRow())?.status, 'canceled');

    const rows = await cancellationFeedbackRows();
    assert.equal(rows.length, 2, 'the second cancellation must open a second row, never reuse the first (already-resolved) one');
    assert.equal(rows[0]?.id, firstRow!.id);
    assert.ok(rows[0]?.answered_at, 'the first event\'s row stays exactly as answered — never touched by the second event');
    const secondRow = rows[1]!;
    assert.notEqual(secondRow.id, firstRow!.id);
    assert.equal(secondRow.shown_at, null);
    assert.equal(secondRow.answered_at, null);
    assert.equal(secondRow.dismissed_at, null);

    // record_feedback_shown must reuse this second row (not the resolved
    // first one) and set shown_at on it, once the prompt actually mounts.
    const { data: shown, error: shownError } = await ownerClient!.rpc('record_feedback_shown', { p_context: 'cancellation' });
    assert.equal(shownError, null);
    assert.equal(shown?.[0]?.id, secondRow.id);

    const { data: secondRowAfterShown } = await service!
      .from('feedback_responses')
      .select('shown_at')
      .eq('id', secondRow.id)
      .single();
    assert.ok(secondRowAfterShown?.shown_at);
  });

  it('reports "cancelable" with a null external id for a manual/fixture row, and confirms it the same way', async () => {
    const { error: updateError } = await service!
      .from('subscriptions')
      .update({ status: 'active', external_subscription_id: null, provider: 'manual' })
      .eq('id', subscriptionId);
    assert.equal(updateError, null);

    const rowsBefore = await cancellationFeedbackRows();

    const { data: prepared, error: prepareError } = await ownerClient!.rpc('prepare_own_subscription_cancellation');
    assert.equal(prepareError, null);
    assert.deepEqual(prepared?.[0], { status: 'cancelable', external_subscription_id: null });

    const { data: confirmed, error: confirmError } = await ownerClient!.rpc('confirm_own_subscription_cancellation', {
      p_external_subscription_id: null,
    });
    assert.equal(confirmError, null);
    assert.deepEqual(confirmed?.[0], { status: 'canceled' });

    // A third real transition — a third fresh row.
    const rowsAfter = await cancellationFeedbackRows();
    assert.equal(rowsAfter.length, rowsBefore.length + 1);
  });

  it('reports "changed" and does not cancel when the external id no longer matches what prepare read (webhook race)', async () => {
    const { error: updateError } = await service!
      .from('subscriptions')
      .update({ status: 'active', external_subscription_id: 'sub_test_cancel_3', provider: 'asaas' })
      .eq('id', subscriptionId);
    assert.equal(updateError, null);

    const { data: prepared, error: prepareError } = await ownerClient!.rpc('prepare_own_subscription_cancellation');
    assert.equal(prepareError, null);
    assert.deepEqual(prepared?.[0], { status: 'cancelable', external_subscription_id: 'sub_test_cancel_3' });

    // Simulates a late webhook rewriting external_subscription_id between
    // prepare and confirm (e.g. the stale-subscription race a checkout
    // retry can produce, see 20260831000000).
    const { error: raceError } = await service!
      .from('subscriptions')
      .update({ external_subscription_id: 'sub_test_cancel_race' })
      .eq('id', subscriptionId);
    assert.equal(raceError, null);

    const rowsBefore = await cancellationFeedbackRows();

    const { data: confirmed, error: confirmError } = await ownerClient!.rpc('confirm_own_subscription_cancellation', {
      p_external_subscription_id: prepared?.[0]?.external_subscription_id ?? null,
    });
    assert.equal(confirmError, null);
    assert.deepEqual(confirmed?.[0], { status: 'changed' });

    const row = await subscriptionRow();
    assert.equal(row?.status, 'active', 'no cancellation is confirmed when the row moved out from under it');
    assert.equal(row?.external_subscription_id, 'sub_test_cancel_race');

    // No real cancellation happened — no feedback event either.
    assert.deepEqual(await cancellationFeedbackRows(), rowsBefore);
  });
});
