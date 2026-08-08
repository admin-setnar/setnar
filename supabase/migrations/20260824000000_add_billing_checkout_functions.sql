-- SET-28: funções que sustentam o checkout automatizado do plano único.
-- Duas responsabilidades, duas funções — mesma separação que
-- `set_activation_status`/`activate_product` já usam para escritas com
-- naturezas diferentes.
--
-- ============================================================================
-- reserve_billing_checkout_slot() — reserva a vaga ANTES de chamar o Asaas
-- ============================================================================
--
-- Por que reservar antes, não depois: se a contagem das 30 vagas de
-- lançamento (BILLING_DECISIONS_PLAN.md §4.4) só acontecesse depois de criar
-- a assinatura no Asaas, duas requisições concorrentes poderiam ambas
-- cobrar o cartão do cliente e só uma das duas conseguir gravar localmente —
-- dinheiro real cobrado sem uma vaga correspondente. Reservando primeiro,
-- uma falha de gateway depois só deixa uma linha `suspended` sem ids
-- externos, que o próprio representante pode tentar de novo (mesma linha,
-- nenhuma vaga nova consumida — ver o ramo "já existe uma linha" abaixo).
--
-- `pg_advisory_xact_lock` serializa a leitura-e-decisão da contagem sem
-- precisar de uma tabela de controle dedicada só para isso — o lock é
-- liberado automaticamente no fim da transação (commit ou rollback).
--
-- `v_founding_price_cents`/`v_founding_slots` ficam hardcoded aqui de
-- propósito: são a decisão aprovada em SET-22
-- (docs/plans/BILLING_DECISIONS_PLAN.md §4.4), não um parâmetro de
-- configuração. Se o Pedro decidir o preço padrão pós-lançamento, isso é
-- uma NOVA migration alterando esta função (`create or replace`) — esta
-- nunca é editada depois de aplicada, mesmo princípio de todas as outras.
--
-- Retorna 'representative_not_found' | 'already_active' | 'sold_out' | 'reserved'.
-- 'reserved' também devolve o `amount_cents` que a aplicação deve cobrar no
-- Asaas — nunca decidido no lado TypeScript, sempre lido daqui.

create or replace function public.reserve_billing_checkout_slot()
returns table (status text, amount_cents integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_representative_id    uuid;
  v_existing_status       text;
  v_existing_amount       integer;
  v_automated_count        integer;
  v_founding_price_cents  constant integer := 2790;
  v_founding_slots        constant integer := 30;
begin
  select r.id into v_representative_id
  from public.representatives r
  where r.profile_id = auth.uid();

  if v_representative_id is null then
    return query select 'representative_not_found'::text, null::integer;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtext('billing_founding_cohort_reservation'));

  select s.status, s.amount_cents into v_existing_status, v_existing_amount
  from public.subscriptions s
  where s.representative_id = v_representative_id;

  if found then
    if public.is_subscription_active(v_representative_id) then
      return query select 'already_active'::text, null::integer;
      return;
    end if;

    -- Já existe uma linha (tentativa anterior, cartão recusado, etc.) — é
    -- uma nova tentativa, não um novo cliente. Reusa o preço já travado,
    -- não consome uma segunda vaga.
    return query select 'reserved'::text, v_existing_amount;
    return;
  end if;

  select count(*) into v_automated_count
  from public.subscriptions
  where provider <> 'manual';

  if v_automated_count >= v_founding_slots then
    return query select 'sold_out'::text, null::integer;
    return;
  end if;

  insert into public.subscriptions (
    representative_id, status, provider, payment_method, amount_cents, currency
  )
  values (
    v_representative_id, 'suspended', 'asaas', 'credit_card', v_founding_price_cents, 'BRL'
  );

  return query select 'reserved'::text, v_founding_price_cents;
end;
$$;

revoke execute on function public.reserve_billing_checkout_slot() from public;
revoke execute on function public.reserve_billing_checkout_slot() from anon;
grant execute on function public.reserve_billing_checkout_slot() to authenticated;

-- ============================================================================
-- record_billing_external_ids(text, text) — grava os ids do Asaas após
-- sucesso na criação da assinatura
-- ============================================================================
--
-- Passo separado da reserva: a reserva acontece ANTES da chamada ao Asaas
-- (não pode falhar por causa do gateway), esta função grava o resultado
-- DEPOIS que o Asaas já confirmou a criação. Entre os dois passos a linha
-- fica `suspended` com ids externos nulos — visível e coerente com o estado
-- "assinatura pendente" que a UI (SET-31) precisa mostrar.
--
-- Não altera `status`: só o webhook (SET-29/30), reagindo ao pagamento de
-- verdade, decide quando a linha vira `active`.

create or replace function public.record_billing_external_ids(
  p_external_customer_id     text,
  p_external_subscription_id text
)
returns table (status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_representative_id uuid;
  v_updated_id         uuid;
begin
  select r.id into v_representative_id
  from public.representatives r
  where r.profile_id = auth.uid();

  if v_representative_id is null then
    return query select 'representative_not_found'::text;
    return;
  end if;

  update public.subscriptions
  set external_customer_id = p_external_customer_id,
      external_subscription_id = p_external_subscription_id
  where representative_id = v_representative_id
  returning id into v_updated_id;

  if v_updated_id is null then
    return query select 'not_found'::text;
    return;
  end if;

  return query select 'updated'::text;
end;
$$;

revoke execute on function public.record_billing_external_ids(text, text) from public;
revoke execute on function public.record_billing_external_ids(text, text) from anon;
grant execute on function public.record_billing_external_ids(text, text) to authenticated;

-- ============================================================================
-- get_own_subscription_view() — leitura, para a UI de checkout/conta (SET-28/31)
-- ============================================================================
--
-- `subscriptions` continua com zero policies (nota de design original,
-- 20260731000000) — esta função é o único caminho de leitura autenticada da
-- própria linha, mesmo padrão de toda outra leitura "own row" deste projeto
-- que passa por função em vez de policy quando a tabela não tem RLS aberta.
-- Zero linhas devolvidas significa "nunca iniciou checkout", coerente com a
-- semântica já estabelecida (SPRINT_E_PLAN.md §3.1, Opção B): ausência de
-- linha é o próprio sinal de "nunca assinou".

create or replace function public.get_own_subscription_view()
returns table (
  status                    text,
  amount_cents              integer,
  currency                  text,
  current_period_end        timestamptz,
  has_external_subscription boolean
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_representative_id uuid;
begin
  select r.id into v_representative_id
  from public.representatives r
  where r.profile_id = auth.uid();

  if v_representative_id is null then
    return;
  end if;

  return query
    select s.status, s.amount_cents, s.currency, s.current_period_end,
           (s.external_subscription_id is not null)
    from public.subscriptions s
    where s.representative_id = v_representative_id;
end;
$$;

revoke execute on function public.get_own_subscription_view() from public;
revoke execute on function public.get_own_subscription_view() from anon;
grant execute on function public.get_own_subscription_view() to authenticated;
