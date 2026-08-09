-- SET-29 + SET-30: webhook autenticado/idempotente do Asaas e materialização
-- do entitlement a partir dos eventos financeiros.
--
-- Duas Issues do Linear, uma única função: este projeto deliberadamente não
-- tem infraestrutura de job/fila (`docs/plans/SPRINT_E_PLAN.md` §2.4) — não
-- existe outro lugar para "processar" um evento persistido além da própria
-- requisição HTTP do webhook, síncrono. `apply_billing_event()` recebe,
-- deduplica e já aplica a transição de estado na mesma transação.
--
-- ============================================================================
-- billing_events — log append-only para idempotência e auditoria
-- ============================================================================
--
-- Mesmo padrão de `analytics_events`/`lead_submission_attempts`
-- (20260810000000/20260801000000): RLS habilitado, zero policies — só
-- alcançável via função `security definer`, nunca por leitura direta de
-- `anon`/`authenticated`. Diferente delas, tem uma `unique constraint` real:
-- `asaas_event_id` é o mecanismo de deduplicação em si (a doc do Asaas
-- recomenda exatamente isso — inserir com o `id` do evento como chave única e
-- tratar a violação como "já processado", já que a entrega é "at least once").
--
-- `payload jsonb not null` guarda o evento cru inteiro: o desenho exato de
-- alguns campos (`checkout.subscription`, `payment.customer`) não está 100%
-- confirmado na documentação pública do Asaas — nada se perde para
-- reconciliação futura (SET-33) se a extração de campo abaixo estiver
-- incompleta.

create table public.billing_events (
  id             bigint generated always as identity primary key,
  asaas_event_id text not null unique,
  event_type     text not null,
  subscription_id uuid references public.subscriptions (id),
  outcome        text not null
                   check (outcome in ('applied', 'duplicate', 'ignored', 'unmatched')),
  payload        jsonb not null,
  created_at     timestamptz not null default now()
);

alter table public.billing_events enable row level security;
-- Deliberadamente zero policies — mesmo padrão de `subscriptions` e
-- `analytics_events`: só alcançável via `apply_billing_event()`.

comment on table public.billing_events is
  'Log append-only de eventos do webhook Asaas (SET-29/30). asaas_event_id é o mecanismo de deduplicação; payload guarda o evento cru para auditoria/reconciliação.';

-- ============================================================================
-- apply_billing_event() — recebe, deduplica, casa e aplica a transição
-- ============================================================================
--
-- Casamento evento → linha, nesta ordem:
-- 1. `external_subscription_id = p_asaas_subscription_id` — cobre todo
--    evento depois do primeiro pagamento.
-- 2. Se não achar e `p_external_reference` existir: `subscriptions.id =
--    p_external_reference::uuid` — só o primeiro CHECKOUT_PAID precisa disso;
--    `externalReference` já é o `id` local gravado em
--    `reserve_billing_checkout_slot()` (20260824000000/20260825000000).
--
-- Transições:
-- - CHECKOUT_PAID / PAYMENT_CONFIRMED / PAYMENT_RECEIVED: status = 'active',
--   external_subscription_id/external_customer_id gravados na primeira vez
--   (coalesce, nunca sobrescreve um valor já real por um evento posterior sem
--   o dado), current_period_end = greatest(atual, novo) — o `greatest` é a
--   guarda contra regressão por evento atrasado/fora de ordem sem precisar
--   rastrear timestamp de evento por linha.
-- - PAYMENT_OVERDUE: status = 'suspended', SÓ a partir de status = 'active'
--   (nunca rebaixa uma linha já cancelada, já suspensa, ou já reativada por
--   um evento mais novo que chegou antes por fora de ordem). Alinhado à
--   política SET-25: o Asaas só emite este evento depois de esgotar as 5
--   tentativas próprias (~2 dias) — não há uma tolerância extra própria.
-- - Qualquer outro evento reconhecido mas fora do lifecycle do MVP
--   (PAYMENT_CREATED, CHECKOUT_CREATED, CHECKOUT_EXPIRED, PAYMENT_DELETED,
--   chargeback, etc.): outcome = 'ignored', registrado, nenhuma escrita em
--   subscriptions — não é erro, é o "fora de escopo" do próprio SET-29.
-- - Sem casamento: outcome = 'unmatched', registrado, sem escrita.
--
-- Deduplicação: tenta inserir em billing_events primeiro; `unique_violation`
-- (mesmo asaas_event_id já visto) é capturado e devolve 'duplicate' de
-- imediato, sem tocar subscriptions de novo.

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

  -- Tipos de evento fora do lifecycle do MVP são 'ignored' direto, sem
  -- tentar casar uma linha — evita rotular como 'unmatched' um evento que
  -- nunca teria ação nenhuma de qualquer forma (ex.: CHECKOUT_CREATED,
  -- CHECKOUT_EXPIRED, PAYMENT_DELETED, chargeback).
  if p_event_type not in ('CHECKOUT_PAID', 'PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED', 'PAYMENT_OVERDUE') then
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
