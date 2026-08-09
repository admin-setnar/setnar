-- SET-28 follow-up, encontrado em code review: `payment_method` foi
-- adicionada `not null default 'credit_card'` em 20260823000000, o que
-- rotula retroativamente toda Subscription ativada manualmente
-- (`provider = 'manual'`, inserida via SQL Editor — `supabase/README.md`
-- passo 17 — nunca cobrada de verdade) como paga por cartão de crédito.
--
-- A própria migration original já reconhecia esse risco para `amount_cents`
-- ("Nulo para linhas ativadas manualmente... inventar um seria pior que
-- deixar nulo") mas não aplicou a mesma regra a `payment_method`. Qualquer
-- reconciliação, relatório administrativo ou o webhook (SET-29/30)
-- confiando em `payment_method = 'credit_card'` como "como isso foi pago de
-- fato" ficaria corrompido para representantes ativados manualmente.
--
-- Corrigido: a coluna passa a aceitar `null`, sem default. Nenhum caminho de
-- escrita real depende do default — `reserve_billing_checkout_slot()`
-- (20260824000000/20260825000000) já grava `'credit_card'` explicitamente
-- em todo INSERT/UPDATE do fluxo automatizado — então removê-lo não muda
-- nenhum comportamento, só para de inventar dado para linhas manuais. As
-- linhas `provider = 'manual'` existentes têm o valor mislabeled limpo.

alter table public.subscriptions
  alter column payment_method drop not null,
  alter column payment_method drop default;

update public.subscriptions
set payment_method = null
where provider = 'manual';

comment on column public.subscriptions.payment_method is
  'Meio de pagamento desta Subscription. Único valor legal hoje é credit_card (SET-24); ampliar exige nova migration alterando a CHECK, nunca uma coluna nova. Nulo para linhas ativadas manualmente (mesma regra de amount_cents, 20260823000000) — nunca houve cobrança real para rotular.';
