-- SET-32: cancelamento da assinatura, iniciado pelo próprio representante.
--
-- Política aprovada (BILLING_DECISIONS_PLAN.md §5.3, confirmada por Pedro em
-- 2026-08-08): cancelamento remove a assinatura no Asaas imediatamente (sem
-- nova cobrança futura), mas o acesso local continua até `current_period_end`
-- — a mesma graça que `is_subscription_active()` já implementa desde o
-- ADR-072 (`20260823000000`). Esta migration só adiciona o CAMINHO DE
-- ESCRITA que faltava; a leitura/graça não muda nada aqui.
--
-- Duas funções, não uma, porque a chamada ao Asaas (rede, feita pelo
-- Server Action em Node) precisa acontecer ENTRE a leitura do
-- `external_subscription_id` e a escrita de `status = 'canceled'` — nenhuma
-- das duas pode ser uma função Postgres só (Postgres não fala HTTP com o
-- Asaas):
--
--   1. `prepare_own_subscription_cancellation()` — lê o id externo a cancelar
--      no Asaas (se houver) e valida que a linha é cancelável.
--   2. (fora do banco) o Server Action chama `PaymentGateway.cancelSubscription()`.
--   3. `confirm_own_subscription_cancellation()` — só é chamada depois que o
--      passo 2 confirma sucesso (`'canceled'` ou `'not_found'`, ambos
--      significam "não há mais cobrança futura no Asaas"). Uma falha no
--      passo 2 nunca chega aqui — nenhuma escrita local acontece sem a
--      confirmação externa, mesmo princípio de "falha externa não mostra
--      sucesso falso" que `BILLING_DECISIONS_PLAN.md` já estabelece para o
--      checkout.
--
-- Idempotência (`status = 'active'`/`'suspended'` são os únicos elegíveis;
-- `'canceled'` já bate `already_canceled` sem tocar a linha de novo):
-- clicar "cancelar" duas vezes, ou uma segunda aba, nunca produz um segundo
-- `DELETE` no Asaas nem regride nenhum dado.
--
-- Cancelamento também é permitido a partir de `suspended` (pagamento já
-- falhou, acesso já perdido) — formaliza que o representante não quer mais
-- tentar regularizar, coerente com o diagrama já registrado em
-- `DOMAIN_MODEL.md` §14.3 ("Active/Suspended→Canceled").

-- ============================================================================
-- prepare_own_subscription_cancellation()
-- ============================================================================

create or replace function public.prepare_own_subscription_cancellation()
returns table (status text, external_subscription_id text)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_representative_id uuid;
  v_status             text;
  v_external_id        text;
begin
  select r.id into v_representative_id
  from public.representatives r
  where r.profile_id = auth.uid();

  if v_representative_id is null then
    return query select 'not_found'::text, null::text;
    return;
  end if;

  select s.status, s.external_subscription_id into v_status, v_external_id
  from public.subscriptions s
  where s.representative_id = v_representative_id;

  if not found then
    return query select 'not_found'::text, null::text;
    return;
  end if;

  if v_status = 'canceled' then
    return query select 'already_canceled'::text, null::text;
    return;
  end if;

  if v_status not in ('active', 'suspended') then
    return query select 'not_found'::text, null::text;
    return;
  end if;

  return query select 'cancelable'::text, v_external_id;
end;
$$;

revoke execute on function public.prepare_own_subscription_cancellation() from public;
revoke execute on function public.prepare_own_subscription_cancellation() from anon;
grant execute on function public.prepare_own_subscription_cancellation() to authenticated;

-- ============================================================================
-- confirm_own_subscription_cancellation()
-- ============================================================================
--
-- Só grava `status = 'canceled'` — nunca toca `current_period_end`: a graça
-- já vigente (o valor que a linha já tinha) é exatamente o que
-- `is_subscription_active()` precisa para continuar concedendo acesso até o
-- fim do ciclo já pago. Reescrever essa data aqui seria o mesmo erro que o
-- `greatest()` do webhook (ADR-075) existe para evitar do lado oposto.

create or replace function public.confirm_own_subscription_cancellation()
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
  where representative_id = v_representative_id;

  return query select 'canceled'::text;
end;
$$;

revoke execute on function public.confirm_own_subscription_cancellation() from public;
revoke execute on function public.confirm_own_subscription_cancellation() from anon;
grant execute on function public.confirm_own_subscription_cancellation() to authenticated;
