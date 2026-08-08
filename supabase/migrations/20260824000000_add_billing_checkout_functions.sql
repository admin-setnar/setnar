-- SET-28: funções que sustentam o checkout automatizado do plano único.
--
-- ============================================================================
-- Revisão de arquitetura (mesmo dia, antes de qualquer merge): Checkout
-- Asaas hospedado, não cartão inline
-- ============================================================================
--
-- A versão original deste arquivo enviava os dados do cartão direto para a
-- API do Asaas a partir do nosso servidor (`POST /v3/subscriptions` com
-- `creditCard`/`creditCardHolderInfo` inline). A documentação do próprio
-- Asaas (docs.asaas.com/docs/pci-dss-1) diz explicitamente que eles não
-- oferecem tokenização client-side e recomendam a aplicação certificada em
-- SAQ-D — o nível mais alto do PCI-DSS — para esse caminho. Isso nunca foi
-- escalado como decisão de produto, só anotado como "follow-up
-- operacional" em comentário, o que subestimava o risco real.
--
-- Encontrado durante a revisão (confirmado por Pedro, 2026-08-08): usar o
-- **Asaas Checkout** — página de pagamento hospedada pelo próprio Asaas. O
-- cartão nunca toca nosso servidor; o cliente é redirecionado para o
-- domínio do Asaas, paga lá, e só depois somos notificados por webhook. Ao
-- ser concluído, um `chargeTypes: ['RECURRENT']` cria uma assinatura normal
-- no Asaas, que dali em diante se comporta exatamente como qualquer outra —
-- os mesmos eventos `PAYMENT_*` de sempre, sem nenhuma mudança em SET-29/30.
--
-- Consequência para o schema desta migration: `reserve_billing_checkout_slot()`
-- agora devolve também o `id` da linha reservada — é esse id que vira
-- `externalReference` na criação do checkout no Asaas, para que o webhook
-- (SET-29/30) consiga casar o evento `CHECKOUT_PAID` de volta à linha
-- certa. `record_billing_external_ids()`, que existia nesta migration para
-- ser chamada autenticada logo após `createSubscription` responder, **não
-- existe mais** — nesse fluxo os ids externos só existem depois que o
-- cliente paga na página do Asaas, então quem grava eles é o webhook
-- (SET-29/30), nunca uma chamada autenticada síncrona ao checkout.
--
-- ============================================================================
-- reserve_billing_checkout_slot() — reserva a vaga ANTES de criar o checkout
-- ============================================================================
--
-- Mesma razão de sempre: reservar antes evita que duas requisições
-- concorrentes criem checkouts além das 30 vagas de lançamento
-- (`BILLING_DECISIONS_PLAN.md` §4.4). `pg_advisory_xact_lock` serializa a
-- contagem sem precisar de uma tabela de controle dedicada.
--
-- `v_founding_price_cents`/`v_founding_slots` continuam hardcoded aqui de
-- propósito — decisão aprovada em SET-22, nunca editada depois de aplicada,
-- só substituída por uma migration nova quando o preço padrão pós-lançamento
-- for decidido.

create or replace function public.reserve_billing_checkout_slot()
returns table (id uuid, status text, amount_cents integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_representative_id    uuid;
  v_existing_id            uuid;
  v_existing_status       text;
  v_existing_amount       integer;
  v_automated_count        integer;
  v_founding_price_cents  constant integer := 2790;
  v_founding_slots        constant integer := 30;
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

  select s.id, s.status, s.amount_cents into v_existing_id, v_existing_status, v_existing_amount
  from public.subscriptions s
  where s.representative_id = v_representative_id;

  if found then
    if public.is_subscription_active(v_representative_id) then
      return query select null::uuid, 'already_active'::text, null::integer;
      return;
    end if;

    -- Já existe uma linha (tentativa anterior, checkout expirado/cancelado,
    -- etc.) — é uma nova tentativa, não um novo cliente. Reusa o preço já
    -- travado e o mesmo id, não consome uma segunda vaga.
    return query select v_existing_id, 'reserved'::text, v_existing_amount;
    return;
  end if;

  select count(*) into v_automated_count
  from public.subscriptions
  where provider <> 'manual';

  if v_automated_count >= v_founding_slots then
    return query select null::uuid, 'sold_out'::text, null::integer;
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

revoke execute on function public.reserve_billing_checkout_slot() from public;
revoke execute on function public.reserve_billing_checkout_slot() from anon;
grant execute on function public.reserve_billing_checkout_slot() to authenticated;

-- ============================================================================
-- get_own_subscription_view() — leitura, para a UI de checkout/conta (SET-28/31)
-- ============================================================================
--
-- Sem mudança de desenho: `subscriptions` continua com zero policies, esta
-- função é o único caminho de leitura autenticada da própria linha. Zero
-- linhas devolvidas significa "nunca iniciou checkout" (SPRINT_E_PLAN.md
-- §3.1, Opção B).

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
