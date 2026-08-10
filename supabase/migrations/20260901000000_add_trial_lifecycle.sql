-- SET-67: trial gratuito de 30 dias como estado explícito do lifecycle de
-- assinatura, sobre as duas decisões fechadas por Pedro no SET-66
-- (2026-08-10): (1) `trial_start` = conclusão do onboarding
-- (`register_representative()`), nunca a criação da conta isolada nem a
-- primeira publicação; (2) iniciar o trial nunca consome vaga fundadora —
-- só a conversão real para pago consome (`BILLING_DECISIONS_PLAN.md` §4.4,
-- "30 primeiros clientes PAGANTES").
--
-- `subscriptions.representative_id` é `unique` — uma linha só por
-- representante, reaproveitada por UPDATE em toda transição (ADR-072,
-- DOMAIN_MODEL.md §14.3). O trial e a eventual assinatura paga são a MESMA
-- linha; não nasce uma segunda linha na conversão.
--
-- Novo status `trialing` (nunca reaproveitar `past_due`/`suspended` para
-- isso — SET-66 já registrou essa restrição de desenho). Novo `provider =
-- 'trial'`, dedicado — não reaproveita `'manual'`, que já significa "linha
-- criada à mão/fixture", para não sobrecarregar um valor com dois
-- significados. Nenhuma coluna nova: `current_period_end` (já usado para a
-- graça pós-cancelamento) também guarda o fim do trial — `is_subscription_active()`
-- já reavalia essa data ao vivo em toda leitura, sem job (mesmo mecanismo,
-- zero infraestrutura nova).

-- ============================================================================
-- 1. subscriptions.status aceita 'trialing'
-- ============================================================================

alter table public.subscriptions drop constraint subscriptions_status_check;
alter table public.subscriptions
  add constraint subscriptions_status_check
  check (status in ('active', 'trialing', 'past_due', 'suspended', 'canceled'));

-- ============================================================================
-- 2. is_subscription_active() concede entitlement durante o trial ativo
-- ============================================================================

create or replace function public.is_subscription_active(p_representative_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  return exists (
    select 1
    from public.subscriptions s
    where s.representative_id = p_representative_id
      and (
        s.status = 'active'
        or (
          s.status in ('canceled', 'trialing')
          and s.current_period_end is not null
          and s.current_period_end > now()
        )
      )
  );
end;
$$;

-- ============================================================================
-- 3. register_representative() nasce a linha de trial na conclusão do
--    onboarding — corpo idêntico ao de 20260818000000, só com o insert em
--    subscriptions adicionado depois do insert em representatives já ter
--    sucedido (v_new_id garantido não-nulo neste ponto: todo branch de
--    validação/exceção acima já retornou antes de chegar aqui).
-- ============================================================================

create or replace function public.register_representative(
  p_slug              text,
  p_display_name      text,
  p_authorization_id  text,
  p_phone             text,
  p_city              text
)
returns table (status text, representative_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id       uuid;
  v_display_name     text;
  v_authorization_id text;
  v_phone            text;
  v_city             text;
  v_new_id           uuid;
  v_constraint       text;
begin
  v_phone := nullif(trim(p_phone), '');
  v_city := nullif(trim(p_city), '');

  if p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    return query select 'slug_invalid'::text, null::uuid;
    return;
  end if;

  if p_slug = any (array[
    'www', 'app', 'api', 'auth', 'admin',
    'entrar', 'criar-conta', 'esqueci-senha', 'redefinir-senha',
    'termos', 'privacidade', 'setnar', 'igreen'
  ]) then
    return query select 'slug_invalid'::text, null::uuid;
    return;
  end if;

  v_display_name := trim(p_display_name);
  if v_display_name is null
    or length(v_display_name) = 0
    or length(v_display_name) > 80
    or array_length(regexp_split_to_array(v_display_name, '\s+'), 1) < 2
  then
    return query select 'display_name_invalid'::text, null::uuid;
    return;
  end if;

  v_authorization_id := trim(p_authorization_id);
  if v_authorization_id is null or length(v_authorization_id) = 0 or length(v_authorization_id) > 100 then
    return query select 'authorization_id_invalid'::text, null::uuid;
    return;
  end if;

  if v_phone is null then
    return query select 'phone_required'::text, null::uuid;
    return;
  end if;

  if v_phone !~ '^\+[1-9]\d{6,14}$' then
    return query select 'phone_invalid'::text, null::uuid;
    return;
  end if;

  if v_city is not null and length(v_city) > 500 then
    return query select 'city_invalid'::text, null::uuid;
    return;
  end if;

  select id into v_company_id from public.companies where slug = 'igreen';
  if v_company_id is null then
    return query select 'company_not_found'::text, null::uuid;
    return;
  end if;

  if exists (select 1 from public.companies where slug = p_slug) then
    return query select 'slug_invalid'::text, null::uuid;
    return;
  end if;

  if exists (select 1 from public.representatives where profile_id = auth.uid()) then
    return query select 'already_registered'::text, null::uuid;
    return;
  end if;

  if exists (select 1 from public.representatives where slug = p_slug) then
    return query select 'slug_taken'::text, null::uuid;
    return;
  end if;

  begin
    insert into public.representatives (
      profile_id, company_id, slug, display_name, authorization_id, phone, city
    )
    values (auth.uid(), v_company_id, p_slug, v_display_name, v_authorization_id, v_phone, v_city)
    returning id into v_new_id;
  exception
    when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'representatives_profile_id_key' then
        return query select 'already_registered'::text, null::uuid;
        return;
      elsif v_constraint = 'representatives_slug_key' then
        return query select 'slug_taken'::text, null::uuid;
        return;
      else
        raise;
      end if;
  end;

  -- SET-67: trial de 30 dias corridos, sem cobrança, sem consumir vaga
  -- fundadora (provider = 'trial', excluído da contagem em
  -- reserve_billing_checkout_slot() abaixo). payment_method/amount_cents
  -- ficam null — nenhuma cobrança nem meio de pagamento escolhido ainda.
  insert into public.subscriptions (representative_id, status, provider, current_period_end)
  values (v_new_id, 'trialing', 'trial', now() + interval '30 days');

  return query select 'created'::text, v_new_id;
end;
$$;

-- ============================================================================
-- 4. reserve_billing_checkout_slot() — permite converter durante o trial
--    sem nunca derrubar o entitlement no meio do redirect pro Asaas, e
--    exclui provider = 'trial' da contagem das 30 vagas fundadoras.
--    Assinatura/`returns table` inalterados — `create or replace` direto,
--    sem `drop function`.
-- ============================================================================

create or replace function public.reserve_billing_checkout_slot()
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
  v_existing_status       text;
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

  select s.id, s.amount_cents, s.external_subscription_id, s.status
    into v_existing_id, v_existing_amount, v_existing_external_id, v_existing_status
  from public.subscriptions s
  where s.representative_id = v_representative_id;

  -- SET-67: só uma linha em trial fura este bloqueio — ela tem entitlement
  -- (is_subscription_active() = true) mas nunca teve um checkout de
  -- verdade, e queremos permitir converter a qualquer momento durante o
  -- trial. Toda outra combinação (inclusive `canceled` com graça) mantém o
  -- comportamento já existente, sem mudança de escopo.
  if public.is_subscription_active(v_representative_id) and coalesce(v_existing_status, '') <> 'trialing' then
    return query select null::uuid, 'already_active'::text, null::integer, null::text;
    return;
  end if;

  -- Reconfere o limite em TODA tentativa de reserva — nunca pula esta
  -- checagem só porque já existe uma linha. `sub.id is distinct from
  -- v_existing_id` exclui a própria linha do chamador da contagem (e não
  -- exclui nada quando `v_existing_id` é nulo, cliente realmente novo).
  -- `provider not in ('manual', 'trial')`: linhas manuais/fixture e linhas
  -- de trial ainda não convertidas nunca contam contra as 30 vagas — só
  -- quem de fato iniciou (ou já concluiu) um checkout automatizado real
  -- conta (SET-67, decisão SET-66 #2). Reservas abandonadas (`suspended`,
  -- sem `external_subscription_id`, mais velhas que `v_reservation_ttl`)
  -- também não contam.
  select count(*) into v_automated_count
  from public.subscriptions sub
  where sub.id is distinct from v_existing_id
    and sub.provider not in ('manual', 'trial')
    and not (
      sub.status = 'suspended'
      and sub.external_subscription_id is null
      and sub.updated_at < now() - v_reservation_ttl
    );

  if v_automated_count >= v_founding_slots then
    return query select null::uuid, 'sold_out'::text, null::integer, null::text;
    return;
  end if;

  -- SET-67: conversão antecipada durante o trial. Nunca toca `status`/
  -- `current_period_end` — o entitlement continua vindo do trial até
  -- apply_billing_event() confirmar o pagamento de verdade e escrever
  -- `status = 'active'`. Se o pagamento nunca se completa, a linha
  -- simplesmente permanece em trial até a data expirar sozinha; não há
  -- nenhum instante em que o representante perde acesso por ter tentado
  -- converter.
  if v_existing_status = 'trialing' then
    update public.subscriptions
    set provider = 'asaas',
        payment_method = coalesce(payment_method, 'credit_card'),
        amount_cents = coalesce(subscriptions.amount_cents, v_founding_price_cents)
    where subscriptions.id = v_existing_id;

    return query select
      v_existing_id,
      'reserved'::text,
      coalesce(v_existing_amount, v_founding_price_cents),
      null::text; -- linha de trial nunca teve external_subscription_id a cancelar
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
