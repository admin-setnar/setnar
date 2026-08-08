-- SET-26: modela o lifecycle financeiro de subscriptions o suficiente para
-- sustentar checkout automatizado (SET-28), webhook (SET-29/30) e
-- cancelamento (SET-32), sem tocar na migration original
-- (20260731000000_create_representative_domain.sql).
--
-- ============================================================================
-- Por que nenhuma alteração na CHECK de status
-- ============================================================================
--
-- `subscriptions.status` já aceita 'active', 'past_due', 'suspended',
-- 'canceled' desde a migration original (20260731000000:277-278) — ninguém
-- nunca usou 'past_due'/'canceled' de fato, mas o valor sempre foi legal.
-- Este passo não precisa de `drop constraint` + `add constraint`; só passa a
-- escrever 'canceled' de verdade (via SET-32, migration futura) e a lê-lo
-- aqui embaixo.
--
-- ============================================================================
-- payment_method, amount_cents, currency, external_customer_id
-- ============================================================================
--
-- Decisão registrada em docs/plans/BILLING_DECISIONS_PLAN.md §6: nenhum
-- desses quatro campos pode nascer como constante fixa no código, mesmo que
-- hoje só exista um valor legal para meio de pagamento e moeda — ampliar
-- depois (Pix Automático, outra moeda) é `drop`/`add constraint`, nunca uma
-- coluna nova. `amount_cents` é o Value Object "Money" que DOMAIN_MODEL.md
-- §9 já reserva como placeholder para Billing — nomeado agora, não inventado.
-- `external_customer_id` acompanha `external_subscription_id` (já existe):
-- o Asaas exige um recurso "customer" antes de criar a assinatura.
--
-- `amount_cents` fica nullable: linhas manuais existentes (passo 17 do
-- supabase/README.md, `provider = 'manual'`) não têm um valor cobrado real
-- para preencher retroativamente, e inventar um seria pior que deixar nulo.
-- Toda escrita nova do fluxo automatizado sempre grava um valor.

alter table public.subscriptions
  add column payment_method text not null default 'credit_card'
    check (payment_method in ('credit_card')),
  add column amount_cents integer,
  add column currency text not null default 'BRL'
    check (currency = 'BRL'),
  add column external_customer_id text;

comment on column public.subscriptions.payment_method is
  'Meio de pagamento desta Subscription. Único valor legal hoje é credit_card (SET-24); ampliar exige nova migration alterando a CHECK, nunca uma coluna nova.';
comment on column public.subscriptions.amount_cents is
  'Valor cobrado, em centavos, gravado por linha no momento em que a Subscription nasce ou é reativada (BILLING_DECISIONS_PLAN.md §4.4/§6.2). Nulo para linhas ativadas manualmente antes deste passo.';
comment on column public.subscriptions.currency is
  'Moeda do valor em amount_cents. Único valor legal hoje é BRL.';
comment on column public.subscriptions.external_customer_id is
  'Id do "customer" no Asaas, distinto de external_subscription_id (a assinatura em si) — o Asaas modela os dois como recursos separados.';

-- ============================================================================
-- is_subscription_active(uuid) — passa a reconhecer graça pós-cancelamento
-- ============================================================================
--
-- Decisão SET-25 §5.3, confirmada pelo Pedro: cancelamento é efetivo no fim
-- do ciclo já pago, não imediato. `current_period_end` já existe na tabela
-- desde a migration original e nunca foi usado por esta função — reaproveitá-lo
-- aqui resolve a graça sem nenhum job/cron, que este projeto conscientemente
-- não tem (docs/plans/SPRINT_E_PLAN.md §2.4): a checagem é ao vivo, a cada
-- leitura, não um processo periódico "notando" que o período acabou.
--
-- `status = 'active'` continua suficiente sozinho (nenhuma mudança de
-- comportamento para o caminho hoje em produção). A cláusula nova só se
-- aplica quando `status = 'canceled'` — e só enquanto `current_period_end`
-- ainda não passou. Sem essa data (nunca populada, ou uma linha cancelada
-- antes deste passo existir) o `and` resolve para falso, que é o
-- comportamento seguro por padrão.
--
-- `past_due` deliberadamente NÃO participa desta função: a política
-- aprovada em SET-25 mantém `active` durante toda a janela de retry do
-- próprio Asaas (~2 dias, 5 tentativas) e só escreve `suspended` quando ele
-- esgota — nenhum estado intermediário é exposto à leitura pública. O valor
-- fica reservado no CHECK, sem uso real neste plano.

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
          s.status = 'canceled'
          and s.current_period_end is not null
          and s.current_period_end > now()
        )
      )
  );
end;
$$;

-- `create or replace` preserva os grants existentes, mas a revogação
-- explícita mantém o contrato de ADR-048 verificável nesta migration, mesmo
-- padrão de 20260816000000_add_subscription_publication_gate.sql.
revoke execute on function public.is_subscription_active(uuid) from public;
grant execute on function public.is_subscription_active(uuid) to anon, authenticated;
