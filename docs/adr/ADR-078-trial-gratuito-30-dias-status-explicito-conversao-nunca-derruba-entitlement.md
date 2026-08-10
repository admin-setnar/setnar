### ADR-078 — Trial gratuito de 30 dias: status explícito, conversão antecipada nunca derruba entitlement (SET-67)

**Status:** Accepted
**Date:** 2026-08-10
**Related:** Implementa as duas decisões fechadas no SET-66 (planejamento, sem
código) e confirmadas por Pedro em 2026-08-10: `trial_start` = conclusão do
onboarding, e o trial nunca consome vaga fundadora. Estende
`is_subscription_active()` (ADR-063, redefinida em `20260823000000`) e
`reserve_billing_checkout_slot()` (ADR-074, corrigida em ADR-076's
follow-up de `20260831000000`) sem alterar suas assinaturas. Consistente
com a graça pós-cancelamento já modelada em ADR-072.

#### Contexto e problema

SET-66 decidiu que todo novo representante ganha 30 dias grátis, com
entitlement equivalente ao plano pago, a partir da conclusão do onboarding
— e que iniciar o trial nunca consome uma das 30 vagas fundadoras
(`BILLING_DECISIONS_PLAN.md` §4.4, que conta só clientes que efetivamente
pagam). Faltava a implementação: schema e as três funções que precisam
saber sobre o trial (`register_representative()`, `is_subscription_active()`,
`reserve_billing_checkout_slot()`).

O problema que só apareceu durante o desenho, não durante o planejamento
(SET-66 explicitamente não fazia schema/código): `reserve_billing_checkout_slot()`
já bloqueia uma nova reserva quando `is_subscription_active()` é `true`
(`already_active`) — proteção deliberada contra derrubar o entitlement de
quem já tem acesso de verdade. Se um trial simplesmente contornasse esse
bloqueio para permitir conversão antecipada, cairia direto no branch de
reuso existente, que **zera** `status`/`current_period_end` da linha antes
de qualquer contato com o Asaas — o representante perderia acesso no
instante em que clicasse "assinar agora", antes mesmo do pagamento ser
tentado, só para recuperá-lo (se tudo desse certo) quando o webhook
confirmasse. Nenhuma das duas opções óbvias (deixar bloqueado até o trial
expirar, ou contornar sem proteção) era aceitável.

#### Alternativas consideradas

1. **Bloquear conversão durante o trial, só permitir checkout depois que
   `trial_ends_at` passar.** Rejeitada: contradiz a expectativa comum de
   SaaS (converter a qualquer momento durante o trial) e não tem base em
   nenhum critério do SET-66; artificialmente atrasaria receita sem
   nenhum ganho de segurança.
2. **Contornar o gate de `already_active` para `trialing` sem mudar o
   branch de reuso.** Rejeitada pelo motivo acima: gera um gap de acesso
   real durante a janela de redirect para o Asaas, violando o mesmo
   princípio de "falha externa não mostra sucesso falso" já aplicado ao
   checkout (`start-checkout.ts`) e ao cancelamento (ADR-076) — aqui na
   direção oposta ("sucesso incerto não deve mostrar falha falsa").
3. **Um branch de reserva dedicado para `status = 'trialing'`, que nunca
   toca `status`/`current_period_end`, só prepara `provider`/`payment_method`/
   `amount_cents`.** Escolhida. O entitlement continua vindo do trial até
   `apply_billing_event()` confirmar o pagamento de verdade (função já
   existente, sem guarda de status prévio para `CHECKOUT_PAID`/
   `PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED` — nenhuma mudança necessária
   nela). Se o pagamento nunca se completa, a linha simplesmente continua
   em trial até a data expirar sozinha; não há nenhum instante em que a
   tentativa de converter piora a situação do representante.
4. **Reaproveitar `provider = 'manual'` para as linhas de trial**, já que a
   contagem de vagas já exclui esse valor. Rejeitada: `'manual'` já
   significa "linha criada à mão/fixture" — sobrecarregar um valor
   existente com um segundo significado era exatamente o tipo de atalho
   que o próprio SET-66 rejeitou ao decidir um status `trialing` novo em
   vez de reaproveitar `past_due`/`suspended`. Escolhido `provider = 'trial'`,
   dedicado, com a contagem de vagas atualizada para excluir os dois
   (`not in ('manual', 'trial')`).
5. **Coluna nova `trial_ends_at`.** Rejeitada: `current_period_end` já
   guarda exatamente essa semântica ("data até a qual o acesso é
   garantido independente do status de pagamento ao vivo") para a graça
   pós-cancelamento — estendê-la para cobrir `trialing` evita uma coluna
   redundante e mantém `is_subscription_active()` como único lugar que
   decide entitlement por data, sem um segundo campo para manter em
   sincronia.
6. **Job/cron para expirar trials.** Rejeitada pelo motivo de sempre neste
   projeto (`SPRINT_E_PLAN.md` §2.4, sem infraestrutura de job): a mesma
   avaliação ao vivo que já resolve a graça pós-cancelamento resolve a
   expiração do trial — a linha nunca muda de `status` sozinha, só o
   resultado de `is_subscription_active()` muda quando a data passa.
7. **Funil de conversão como tabela/evento de analytics novo.** Rejeitada
   por escopo: nenhuma infraestrutura de analytics existe para billing
   hoje, e `QR_ANALYTICS_PLAN.md` (AN6/AN7) mantém até hoje o dashboard de
   analytics como não implementado de propósito. Escolhida uma query
   documentada (`docs/runbooks/BILLING_OPERATIONS.md`) sobre timestamps já
   existentes (`representatives.created_at`, `subscriptions.updated_at`).

#### Decisão

Migration `20260901000000_add_trial_lifecycle.sql`, aditiva:

- `subscriptions_status_check` ganha `'trialing'`.
- `is_subscription_active(p_representative_id uuid)` (mesma assinatura,
  `create or replace`): entitlement válido para `status = 'active'` OU
  (`status in ('canceled', 'trialing')` AND `current_period_end > now()`).
- `register_representative(...)` (mesma assinatura): depois do `insert` em
  `representatives` já ter sucedido, insere a linha de trial —
  `status = 'trialing'`, `provider = 'trial'`, `current_period_end = now() +
  interval '30 days'`, `payment_method`/`amount_cents` nulos. Só acontece
  uma vez por representante: a mesma checagem `already_registered` que já
  protegia a criação de `representatives` protege a criação do trial —
  nenhuma lógica de elegibilidade nova.
- `reserve_billing_checkout_slot()` (mesma assinatura, mesmo `returns
  table`): passa a capturar o `status` atual da linha; o gate de
  `already_active` ganha `and coalesce(v_existing_status, '') <> 'trialing'`
  (só o trial fura o bloqueio; `canceled` com graça e todo o resto mantêm
  o comportamento já existente, fora de escopo aqui); a contagem de vagas
  passa a excluir `provider not in ('manual', 'trial')`; um novo branch,
  antes do branch de reuso genérico, trata `status = 'trialing'` sem
  jamais escrever `status`/`current_period_end` — só `provider`,
  `payment_method`, `amount_cents`.

`src/modules/billing/domain/subscription.ts` (`SubscriptionStatus` ganha
`'trialing'`) e `src/modules/billing/presentation/subscription-view-state.ts`
(`kind: 'trialing'`/`'trial_expired'`, banner + formulário de checkout
visível durante o trial para permitir conversão antecipada, `canCancel:
false` — nada agendado no Asaas para cancelar).

#### Verificação

`tests/trial-lifecycle.integration.test.ts` (banco de dev conectado, real):
`register_representative()` cria a linha de trial com `current_period_end`
~30 dias à frente; `is_subscription_active()` já é `true` imediatamente,
sem checkout; `set_activation_status` publica durante o trial sem nenhum
pagamento; `reserve_billing_checkout_slot()` durante o trial devolve
`reserved` e **prova a garantia central**: `subscriptions.status` continua
`trialing` e `is_subscription_active()` continua `true` depois da reserva
— nenhum gap de acesso — até `apply_billing_event(CHECKOUT_PAID)` fechar o
ciclo normalmente; três representantes em trial não mudam a contagem de
vagas automatizadas; uma segunda chamada a `register_representative()`
pelo mesmo usuário não altera nenhum campo do trial original. Regressão:
`tests/reserve-billing-checkout-slot.integration.test.ts`,
`tests/subscription-cancellation.integration.test.ts`,
`tests/apply-billing-event.integration.test.ts`,
`tests/publication-follows-entitlement.integration.test.ts` e
`tests/checkout-redirect-does-not-grant-entitlement.integration.test.ts`
continuam verdes sem alteração. `tests/subscription-view-state.test.ts`
ganha casos para `trialing`/`trial_expired`. `npm run verify` completo
(533 testes, build) limpo.

#### Consequências

- Todo novo representante tem acesso completo por 30 dias sem fricção de
  pagamento, sem intervenção manual e sem infraestrutura nova (job, fila,
  coluna extra).
- Converter durante o trial nunca é mais arriscado, para o representante,
  do que esperar o trial expirar — a pior consequência de uma tentativa de
  pagamento que falha é continuar exatamente onde estava.
- As 30 vagas fundadoras continuam contando só clientes pagantes de
  verdade, por construção da query de contagem — nenhuma auditoria manual
  necessária para essa garantia.
- `docs/DOMAIN_MODEL.md` §14.3 perde a lacuna "nenhum trial modelado";
  `docs/runbooks/BILLING_OPERATIONS.md` ganha a query do funil.
- Risco aceito: o funil de conversão é medido por query ad hoc, não por um
  dashboard — aceitável enquanto `QR_ANALYTICS_PLAN.md` mantiver o mesmo
  risco aceito para o resto do produto.
- Risco aceito, mesma categoria dos ADRs anteriores de billing: nenhum
  teste automatizado exercita o Asaas Sandbox real para a conversão
  durante o trial especificamente (a chamada HTTP real de checkout já é
  testada nos ADRs 073/074; este ADR só prova o comportamento do lado
  Postgres).

#### Rollback conceitual

Reversão é aditiva-inversa: reverter `is_subscription_active()`,
`register_representative()` e `reserve_billing_checkout_slot()` para as
versões anteriores a esta migration (uma migration nova com `create or
replace`, nunca editando a aplicada), e remover `'trialing'` do CHECK de
`subscriptions_status_check` — só depois de confirmar que nenhuma linha
`trialing` restante existe (`select count(*) from subscriptions where
status = 'trialing'`), já que remover o valor do CHECK com linhas
existentes nesse status quebraria a constraint. Nenhuma linha `active`/
`canceled`/`suspended` já convertida precisa reverter — o mesmo princípio
dos ADRs anteriores: uma conversão já aplicada continua correta
independente deste código existir ou não.
