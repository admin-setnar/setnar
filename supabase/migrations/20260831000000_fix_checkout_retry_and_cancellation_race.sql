-- SET-32 follow-up: dois achados de code review antes de SET-34 (testar
-- cenários críticos de billing) começar a escrever os próprios testes em
-- cima de um comportamento sabidamente quebrado.
--
-- 1. Retentativa de checkout após pagamento falhar nunca cancelava a
--    assinatura antiga no Asaas. `reserve_billing_checkout_slot()`
--    (20260825000000) já zera `external_subscription_id`/`external_customer_id`
--    ao reaproveitar a linha — correto para a LEITURA local
--    (`getSubscriptionViewState` parar de relatar `payment_failed` para
--    quem só está reiniciando) — mas nunca avisa o Asaas para parar de
--    tentar cobrar a assinatura abandonada. Um representante que corrige o
--    cartão e assina de novo podia acabar com DUAS assinaturas ativas no
--    Asaas cobrando em paralelo. Corrigido devolvendo o id externo antigo
--    (`stale_external_subscription_id`) na própria reserva, para a camada
--    de aplicação (`start-checkout.ts`) cancelar no Asaas antes de criar o
--    novo checkout — mesma divisão de responsabilidade que já vale para o
--    cancelamento (ADR-076): Postgres não fala HTTP com o Asaas.
--
-- 2. `confirm_own_subscription_cancellation()` gravava `status = 'canceled'`
--    sem reconferir que `external_subscription_id` ainda é o mesmo id que
--    `prepare_own_subscription_cancellation()` leu e que o Server Action
--    acabou de cancelar no Asaas. Na janela entre os dois passos, um
--    webhook atrasado (inclusive um da PRÓPRIA assinatura abandonada do
--    item 1, ainda em trânsito) pode reescrever esse campo via o fallback
--    de `external_reference` em `apply_billing_event()` — confirmar "às
--    cegas" arriscava cancelar localmente uma linha cujo id externo real já
--    não é mais o que acabou de ser cancelado no Asaas. Corrigido exigindo
--    o id lido no `prepare` como parâmetro; a escrita só acontece se ele
--    ainda bater com o valor atual da linha (`is not distinct from`, cobre
--    os dois `null` de uma linha `manual`). Se não bater, `'changed'` —
--    mesmo princípio de "falha externa não mostra sucesso falso" já
--    aplicado a este fluxo, agora também para "estado mudou por baixo".
--
-- Assinatura de `confirm_own_subscription_cancellation()` muda (ganha um
-- parâmetro obrigatório) e a de `reserve_billing_checkout_slot()` também
-- (nova coluna de saída) — Postgres não deixa `create or replace` mudar o
-- tipo de retorno de uma função existente (`42P13`), então ambas levam
-- `drop function` antes do `create`, mesmo padrão já usado em 20260814000000
-- para renomear parâmetro de RPC.

-- ============================================================================
-- 1. reserve_billing_checkout_slot() devolve o id externo abandonado
-- ============================================================================

drop function if exists public.reserve_billing_checkout_slot();

create function public.reserve_billing_checkout_slot()
returns table (id uuid, status text, amount_cents integer, stale_external_subscription_id text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_representative_id    uuid;
  v_existing_id           uuid;
  v_existing_amount       integer;
  v_existing_external_id  text;
  v_automated_count       integer;
  v_founding_price_cents  constant integer := 2790;
  v_founding_slots        constant integer := 30;
  v_reservation_ttl       constant interval := interval '24 hours';
  v_new_id                uuid;
begin
  select r.id into v_representative_id
  from public.representatives r
  where r.profile_id = auth.uid();

  if v_representative_id is null then
    return query select null::uuid, 'representative_not_found'::text, null::integer, null::text;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtext('billing_founding_cohort_reservation'));

  select s.id, s.amount_cents, s.external_subscription_id
    into v_existing_id, v_existing_amount, v_existing_external_id
  from public.subscriptions s
  where s.representative_id = v_representative_id;

  if public.is_subscription_active(v_representative_id) then
    return query select null::uuid, 'already_active'::text, null::integer, null::text;
    return;
  end if;

  -- Reconfere o limite em TODA tentativa de reserva — nunca pula esta
  -- checagem só porque já existe uma linha. `sub.id is distinct from
  -- v_existing_id` exclui a própria linha do chamador da contagem (e não
  -- exclui nada quando `v_existing_id` é nulo, cliente realmente novo).
  -- Reservas abandonadas (`suspended`, sem `external_subscription_id`, mais
  -- velhas que `v_reservation_ttl`) não contam contra o limite.
  select count(*) into v_automated_count
  from public.subscriptions sub
  where sub.id is distinct from v_existing_id
    and sub.provider <> 'manual'
    and not (
      sub.status = 'suspended'
      and sub.external_subscription_id is null
      and sub.updated_at < now() - v_reservation_ttl
    );

  if v_automated_count >= v_founding_slots then
    return query select null::uuid, 'sold_out'::text, null::integer, null::text;
    return;
  end if;

  if v_existing_id is not null then
    -- `subscriptions.amount_cents` qualificado no lado direito do coalesce
    -- de propósito: `returns table (..., amount_cents integer)` declara uma
    -- variável PL/pgSQL de mesmo nome, que colide com a coluna se
    -- referenciada sem qualificação (`42702 column reference "amount_cents"
    -- is ambiguous`, confirmado contra banco real).
    update public.subscriptions
    set provider = 'asaas',
        payment_method = coalesce(payment_method, 'credit_card'),
        amount_cents = coalesce(subscriptions.amount_cents, v_founding_price_cents),
        status = 'suspended',
        current_period_end = null,
        external_subscription_id = null,
        external_customer_id = null
    where subscriptions.id = v_existing_id;

    return query select
      v_existing_id,
      'reserved'::text,
      coalesce(v_existing_amount, v_founding_price_cents),
      v_existing_external_id;
    return;
  end if;

  insert into public.subscriptions (
    representative_id, status, provider, payment_method, amount_cents, currency
  )
  values (
    v_representative_id, 'suspended', 'asaas', 'credit_card', v_founding_price_cents, 'BRL'
  )
  returning subscriptions.id into v_new_id;

  return query select v_new_id, 'reserved'::text, v_founding_price_cents, null::text;
end;
$$;

revoke execute on function public.reserve_billing_checkout_slot() from public;
revoke execute on function public.reserve_billing_checkout_slot() from anon;
grant execute on function public.reserve_billing_checkout_slot() to authenticated;

-- ============================================================================
-- 2. confirm_own_subscription_cancellation() reconfere o id antes de escrever
-- ============================================================================
--
-- Continua só gravando `status = 'canceled'` — nunca `current_period_end`
-- (mesmo raciocínio do ADR-076/ADR-075) — agora condicionado a
-- `external_subscription_id is not distinct from p_external_subscription_id`
-- no próprio UPDATE: se a linha mudou de id externo por baixo entre o
-- `prepare` e este `confirm` (ex.: webhook atrasado), `found` fica falso e
-- devolve `'changed'` em vez de confirmar um cancelamento que já não
-- corresponde ao id de verdade cancelado no Asaas.

drop function if exists public.confirm_own_subscription_cancellation();

create function public.confirm_own_subscription_cancellation(p_external_subscription_id text)
returns table (status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_representative_id uuid;
  v_current_status     text;
begin
  select r.id into v_representative_id
  from public.representatives r
  where r.profile_id = auth.uid();

  if v_representative_id is null then
    return query select 'not_found'::text;
    return;
  end if;

  select s.status into v_current_status
  from public.subscriptions s
  where s.representative_id = v_representative_id;

  if not found then
    return query select 'not_found'::text;
    return;
  end if;

  if v_current_status = 'canceled' then
    return query select 'already_canceled'::text;
    return;
  end if;

  if v_current_status not in ('active', 'suspended') then
    return query select 'not_found'::text;
    return;
  end if;

  update public.subscriptions
  set status = 'canceled'
  where representative_id = v_representative_id
    and external_subscription_id is not distinct from p_external_subscription_id;

  if not found then
    return query select 'changed'::text;
    return;
  end if;

  return query select 'canceled'::text;
end;
$$;

revoke execute on function public.confirm_own_subscription_cancellation(text) from public;
revoke execute on function public.confirm_own_subscription_cancellation(text) from anon;
grant execute on function public.confirm_own_subscription_cancellation(text) to authenticated;
