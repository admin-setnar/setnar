-- SET-33: reconciliação e operação administrativa auditável de billing.
--
-- Nenhuma RPC nova para "aplicar" a reconciliação — `apply_billing_event()`
-- (SET-29/30) já é exatamente o pipe idempotente certo: reconciliar é só
-- perguntar ao Asaas qual é o pagamento mais recente de verdade
-- (`PaymentGateway.getLatestPayment()`) e alimentar essa mesma função com um
-- evento sintético cujo `asaas_event_id` é o `id` real do pagamento no
-- Asaas — se um webhook atrasado chegar depois com o mesmo id, a dedup de
-- sempre (`unique (asaas_event_id)`) cuida disso sozinha. "Repetição é
-- segura" (critério de aceite) nasce de graça, sem código novo de
-- idempotência.
--
-- O que falta, e é o único propósito desta migration, é a trilha auditável
-- da OPERAÇÃO em si — quem rodou, por quê, contra qual representante, com
-- que resultado — distinta de `billing_events` (que audita o evento
-- financeiro, não a ação do operador que o disparou manualmente).
--
-- Sem painel administrativo (fora de escopo do SET-33): o "comando/script
-- protegido" é `scripts/reconcile-billing-subscription.mjs`, rodado por um
-- operador que já possui `SUPABASE_SERVICE_ROLE_KEY`+`ASAAS_API_KEY` — a
-- posse dessas credenciais server-only, nunca expostas à aplicação nem a
-- usuário nenhum, é a própria "autorização" (mesmo raciocínio de
-- `docs/plans/SPRINT_E_PLAN.md` §2.4: este projeto não tem sistema de
-- roles/admin, e não é este passo que deveria introduzir um). `--reason`
-- e `--actor` são exigidos pelo script antes de qualquer escrita, nunca
-- opcionais.

create table public.billing_reconciliation_log (
  id                     bigint generated always as identity primary key,
  actor                  text not null,
  reason                 text not null,
  representative_id      uuid references public.representatives (id),
  subscription_id        uuid references public.subscriptions (id),
  gateway_payment_id     text,
  gateway_payment_status text,
  -- Espelha os outcomes de apply_billing_event() (SET-29/30) mais três
  -- próprios do script, para o mesmo campo nunca precisar de dois
  -- vocabulários: 'no_subscription' (representante sem Subscription ou sem
  -- external_subscription_id — nada a reconciliar no Asaas), 'no_payment_found'
  -- (Asaas não tem nenhum pagamento para essa assinatura) e 'gateway_error'
  -- (a consulta ao Asaas falhou; nenhuma escrita local acontece, mesmo
  -- princípio de "falha externa não mostra sucesso falso" já aplicado ao
  -- checkout/cancelamento).
  outcome                text not null
                           check (outcome in (
                             'applied', 'duplicate', 'ignored', 'unmatched',
                             'no_subscription', 'no_payment_found', 'gateway_error'
                           )),
  -- Só campos já estruturados/extraídos (nunca o payload cru do Asaas, que
  -- pode carregar e-mail/telefone do customer) — "trilha auditável sem
  -- dados sensíveis", critério de aceite explícito.
  detail                 jsonb,
  created_at             timestamptz not null default now()
);

alter table public.billing_reconciliation_log enable row level security;
-- Deliberadamente zero policies — mesmo padrão de billing_events/
-- analytics_events: só alcançável pelo service_role que o script já usa
-- para tudo (RLS não se aplica a esse role; anon/authenticated nunca leem
-- nem escrevem aqui).

comment on table public.billing_reconciliation_log is
  'Trilha auditável de execuções do script de reconciliação (SET-33) — quem rodou, por quê, e o resultado. Distinto de billing_events, que audita o evento financeiro em si.';
