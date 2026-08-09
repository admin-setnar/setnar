-- SET-29/30 follow-up: trata SUBSCRIPTION_CREATED para gravar o
-- `external_subscription_id` de verdade.
--
-- Achado testando o webhook contra pagamento real no Sandbox (primeira
-- ativação real, ADR-075): o payload de `CHECKOUT_PAID` traz
-- `checkout.subscription` SEM nenhum campo `id` — só `cycle`/`endDate`/
-- `nextDueDate`. O id real da assinatura recorrente (`sub_...`) nunca
-- aparece em nenhum campo de `CHECKOUT_PAID`. Sem ele, `external_subscription_id`
-- fica `null` para sempre, e a cobrança do próximo ciclo (`PAYMENT_CONFIRMED`/
-- `PAYMENT_RECEIVED`, que só carregam `payment.subscription`, não
-- `externalReference`) não teria como casar de volta a esta linha.
--
-- `SUBSCRIPTION_CREATED` (categoria "eventos de assinatura", não assinada
-- até agora) resolve isso: carrega `subscription.id` e
-- `subscription.externalReference` — o mesmo `externalReference` que o
-- Checkout usou. Uma só coluna gravada, sem tocar `status`/`current_period_end`
-- (este evento não é confirmação de pagamento nenhuma, só registro do id).

create or replace function public.apply_billing_event(
  p_event_id              text,
  p_event_type            text,
  p_asaas_subscription_id text,
  p_asaas_customer_id     text,
  p_external_reference    text,
  p_next_due_date         date,
  p_payload               jsonb
)
returns table (outcome text, subscription_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subscription_id uuid;
  v_outcome          text;
begin
  begin
    insert into public.billing_events (asaas_event_id, event_type, outcome, payload)
    values (p_event_id, p_event_type, 'unmatched', p_payload);
  exception
    when unique_violation then
      return query select 'duplicate'::text, null::uuid;
      return;
  end;

  if p_event_type not in (
    'CHECKOUT_PAID', 'PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED', 'PAYMENT_OVERDUE', 'SUBSCRIPTION_CREATED'
  ) then
    update public.billing_events set outcome = 'ignored' where asaas_event_id = p_event_id;
    return query select 'ignored'::text, null::uuid;
    return;
  end if;

  if p_asaas_subscription_id is not null then
    select s.id into v_subscription_id
    from public.subscriptions s
    where s.external_subscription_id = p_asaas_subscription_id;
  end if;

  if v_subscription_id is null and p_external_reference is not null then
    begin
      select s.id into v_subscription_id
      from public.subscriptions s
      where s.id = p_external_reference::uuid;
    exception
      when invalid_text_representation then
        v_subscription_id := null;
    end;
  end if;

  if v_subscription_id is null then
    update public.billing_events
    set outcome = 'unmatched'
    where asaas_event_id = p_event_id;

    return query select 'unmatched'::text, null::uuid;
    return;
  end if;

  if p_event_type in ('CHECKOUT_PAID', 'PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED') then
    update public.subscriptions
    set status = 'active',
        external_subscription_id = coalesce(external_subscription_id, p_asaas_subscription_id),
        external_customer_id = coalesce(external_customer_id, p_asaas_customer_id),
        current_period_end = greatest(coalesce(current_period_end, p_next_due_date), coalesce(p_next_due_date, current_period_end))
    where subscriptions.id = v_subscription_id;

    v_outcome := 'applied';
  elsif p_event_type = 'SUBSCRIPTION_CREATED' then
    -- Só grava o id real da assinatura, na primeira vez (`coalesce`) — não é
    -- confirmação de pagamento, não mexe em status/current_period_end.
    update public.subscriptions
    set external_subscription_id = coalesce(external_subscription_id, p_asaas_subscription_id),
        external_customer_id = coalesce(external_customer_id, p_asaas_customer_id)
    where subscriptions.id = v_subscription_id;

    v_outcome := 'applied';
  else
    -- PAYMENT_OVERDUE. `and status = 'active'` na WHERE é a guarda
    -- anti-regressão: se a linha já não está mais `active` (evento atrasado
    -- chegando depois de uma reativação, ou já suspensa/cancelada), a linha
    -- não casa e `found` fica falso — `outcome` reflete corretamente que
    -- nada mudou, em vez de alegar uma aplicação que não aconteceu.
    update public.subscriptions
    set status = 'suspended'
    where subscriptions.id = v_subscription_id
      and status = 'active';

    v_outcome := case when found then 'applied' else 'ignored' end;
  end if;

  update public.billing_events
  set outcome = v_outcome, subscription_id = v_subscription_id
  where asaas_event_id = p_event_id;

  return query select v_outcome, v_subscription_id;
end;
$$;

revoke execute on function public.apply_billing_event(text, text, text, text, text, date, jsonb) from public;
revoke execute on function public.apply_billing_event(text, text, text, text, text, date, jsonb) from anon;
revoke execute on function public.apply_billing_event(text, text, text, text, text, date, jsonb) from authenticated;
grant execute on function public.apply_billing_event(text, text, text, text, text, date, jsonb) to service_role;
