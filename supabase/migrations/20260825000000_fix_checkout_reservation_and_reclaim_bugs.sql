-- SET-28 follow-up: corrige bugs de `reserve_billing_checkout_slot()`
-- encontrados em code review, antes de SET-29 tocar este mesmo fluxo.
-- Reescrita completa da função (não um patch incremental) porque a primeira
-- versão desta própria migration introduziu um bug novo — ver item 1.
--
-- 1. Vagas fundadoras vazadas por checkout abandonado, E depois vazadas de
--    novo pela própria correção. A contagem original de `v_automated_count`
--    não distinguia uma reserva nunca paga de um cliente pagante real —
--    qualquer linha `provider <> 'manual'` contava para sempre. A primeira
--    tentativa de correção adicionou uma janela de TTL para excluir reservas
--    abandonadas da contagem, mas manteve o branch de reaproveitamento de
--    linha existente devolvendo `'reserved'` incondicionalmente, sem nunca
--    reconferir a vaga — então um representante que abandonou o checkout
--    podia ter sua vaga dada a outro cliente pela reciclagem por TTL, E
--    ainda assim recuperá-la depois via retentativa, sem checagem de limite
--    nenhuma. As 30 vagas podiam ser revendidas indefinidamente. Corrigido
--    reconferindo o limite em TODA tentativa de reserva — cliente novo,
--    retentativa de linha existente ou reprecificação de linha manual —
--    sempre excluindo a própria linha do chamador da contagem (`is distinct
--    from`, correto mesmo quando não há linha existente ainda).
--
-- 2. A janela de TTL usava `created_at`, nunca atualizado por nenhum UPDATE
--    desta função — uma linha reciclada por abandono ficava elegível para
--    reciclagem por TTL para sempre, mesmo depois de reaproveitada. Trocado
--    para `updated_at`, que a trigger `subscriptions_set_updated_at`
--    (20260731000000) já atualiza sozinha em todo UPDATE desta tabela —
--    nenhuma coluna nova, nenhuma escrita extra.
--
-- 3. Reaproveitar uma linha (retentativa, ou assinatura cancelada que volta
--    a assinar) nunca limpava `external_subscription_id`/
--    `external_customer_id` — ids de uma assinatura Asaas anterior (ou
--    ausente). `getSubscriptionViewState`
--    (`modules/billing/presentation/subscription-view-state.ts`) lê
--    `external_subscription_id is not null` como "esta cobrança já foi
--    aprovada ao menos uma vez", então uma linha `suspended` com esse id
--    obsoleto ainda presente era relatada como `payment_failed`
--    ("não conseguimos confirmar seu pagamento") para alguém que só está
--    reiniciando o checkout, nunca teve uma cobrança sequer tentada neste
--    novo ciclo. Corrigido: todo reaproveitamento de linha limpa os dois
--    campos — o webhook (SET-29/30) os grava de novo quando ESTE checkout
--    for pago.
--
-- 4. `amount_cents`/`payment_method` nulos (linhas `provider = 'manual'`,
--    nunca precificadas — ver comentário da coluna em 20260823000000) eram
--    devolvidos como se fosse uma reserva válida, e o mapeamento em
--    TypeScript (`map-subscription-gateway-result.ts`) trata
--    `amount_cents IS NULL` como erro — travando para sempre qualquer
--    representante ativado manualmente que tentasse o checkout
--    self-service. Corrigido: o único UPDATE de reaproveitamento (ver item
--    5) usa `coalesce` para precificar uma linha manual na hora, sujeita à
--    mesma checagem de vaga do item 1; se as vagas já estiverem esgotadas,
--    devolve `sold_out` como qualquer cliente novo — nenhuma política de
--    preço pós-lançamento é inventada aqui.
--
-- 5. Os dois UPDATEs de reaproveitamento (linha já precificada vs. linha
--    manual a precificar) unificados em um só: `coalesce` preenche
--    `payment_method`/`amount_cents` apenas quando ainda ausentes, e
--    `provider = 'asaas'` é um no-op para uma linha que já era `asaas`.

create or replace function public.reserve_billing_checkout_slot()
returns table (id uuid, status text, amount_cents integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_representative_id    uuid;
  v_existing_id            uuid;
  v_existing_amount       integer;
  v_automated_count        integer;
  v_founding_price_cents  constant integer := 2790;
  v_founding_slots        constant integer := 30;
  v_reservation_ttl        constant interval := interval '24 hours';
  v_new_id                 uuid;
begin
  select r.id into v_representative_id
  from public.representatives r
  where r.profile_id = auth.uid();

  if v_representative_id is null then
    return query select null::uuid, 'representative_not_found'::text, null::integer;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtext('billing_founding_cohort_reservation'));

  select s.id, s.amount_cents into v_existing_id, v_existing_amount
  from public.subscriptions s
  where s.representative_id = v_representative_id;

  if public.is_subscription_active(v_representative_id) then
    return query select null::uuid, 'already_active'::text, null::integer;
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
    return query select null::uuid, 'sold_out'::text, null::integer;
    return;
  end if;

  if v_existing_id is not null then
    -- `subscriptions.amount_cents` qualificado no lado direito do coalesce
    -- de propósito: `returns table (..., amount_cents integer)` declara uma
    -- variável PL/pgSQL de mesmo nome, que colide com a coluna se
    -- referenciada sem qualificação (`42702 column reference "amount_cents"
    -- is ambiguous`, confirmado contra banco real — mesma classe de bug do
    -- `sub.status` corrigido acima).
    update public.subscriptions
    set provider = 'asaas',
        payment_method = coalesce(payment_method, 'credit_card'),
        amount_cents = coalesce(subscriptions.amount_cents, v_founding_price_cents),
        status = 'suspended',
        current_period_end = null,
        external_subscription_id = null,
        external_customer_id = null
    where subscriptions.id = v_existing_id;

    return query select v_existing_id, 'reserved'::text, coalesce(v_existing_amount, v_founding_price_cents);
    return;
  end if;

  insert into public.subscriptions (
    representative_id, status, provider, payment_method, amount_cents, currency
  )
  values (
    v_representative_id, 'suspended', 'asaas', 'credit_card', v_founding_price_cents, 'BRL'
  )
  returning subscriptions.id into v_new_id;

  return query select v_new_id, 'reserved'::text, v_founding_price_cents;
end;
$$;

-- `create or replace` preserva os grants existentes, mas a revogação
-- explícita mantém o contrato verificável nesta migration, mesmo padrão de
-- 20260823000000/20260824000000.
revoke execute on function public.reserve_billing_checkout_slot() from public;
revoke execute on function public.reserve_billing_checkout_slot() from anon;
grant execute on function public.reserve_billing_checkout_slot() to authenticated;
