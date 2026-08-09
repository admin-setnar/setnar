### ADR-076 — Cancelamento da assinatura: duas RPCs em volta da chamada ao Asaas, graça preservada por omissão (SET-32)

**Status:** Accepted
**Date:** 2026-08-09
**Related:** Implementa a política de `docs/plans/BILLING_DECISIONS_PLAN.md`
§5.3 (SET-25, confirmada por Pedro em 2026-08-08); consome a graça
pós-cancelamento que o ADR-072 já implementou em `is_subscription_active()`;
fecha a transição `Active/Suspended→Canceled` que `DOMAIN_MODEL.md` §14.3 já
documentava como modelada mas não escrita por nenhum código.

#### Contexto e problema

SET-31 (verificado no mesmo dia, sem código necessário) confirmou que toda a
leitura/entitlement do cancelamento já existia: `is_subscription_active()`
concede graça enquanto `status = 'canceled' AND current_period_end > now()`,
e `subscription-view-state.ts` já renderizava o estado `active_until` com a
data exata. O que nunca existiu era o **caminho de escrita** — nenhum código
levava uma assinatura de `active`/`suspended` a `canceled`.

Duas dificuldades específicas do cancelamento (diferentes do checkout, que
só escreve depois de um redirect + webhook):

1. A política exige remover a assinatura no Asaas **imediatamente** (para
   nenhuma cobrança futura ser gerada) — mas o acesso local só deve mudar
   **depois** dessa confirmação, nunca antes (mesmo princípio de "falha
   externa não mostra sucesso falso" já aplicado ao checkout).
2. A chamada ao Asaas é HTTP, feita em Node pela camada de aplicação —
   Postgres não fala com o Asaas. Uma função Postgres só não pode, sozinha,
   nem ler o id a cancelar nem confirmar a escrita depois.

#### Alternativas consideradas

1. **Uma única RPC que já cancela local e devolve o id externo para o
   caller cancelar no Asaas depois.** Rejeitada: escreveria `status =
   'canceled'` ANTES de confirmar que o Asaas realmente parou de cobrar —
   se a chamada ao Asaas falhar depois, o representante veria acesso
   correto mas a próxima cobrança ainda poderia disparar, uma divergência
   silenciosa entre o estado local e o real.
2. **Um job/fila que reconcilia depois.** Rejeitada pela mesma razão de
   sempre neste projeto (`SPRINT_E_PLAN.md` §2.4): nenhuma infraestrutura de
   job existe, e não é necessária aqui — o Server Action já é síncrono do
   início ao fim de uma ação iniciada pelo usuário.
3. **Duas RPCs, `prepare_own_subscription_cancellation()` (lê, valida
   elegibilidade) e `confirm_own_subscription_cancellation()` (só escreve
   depois que o Asaas confirma).** Escolhida — mesmo padrão de duas pernas
   que o próprio checkout já usa (reservar → criar customer/checkout no
   Asaas), só que na direção oposta.
4. **Cancelar só a partir de `active`.** Rejeitada: `suspended` (pagamento
   já falhou, acesso já perdido) é um estado legítimo para o representante
   querer formalizar que não vai mais tentar regularizar — `DOMAIN_MODEL.md`
   §14.3 já documentava `Active/Suspended→Canceled`, não só `Active→`.
   Ambos elegíveis; qualquer outro `status` (`canceled` já, ou inexistente)
   devolve `already_canceled`/`not_found`, nunca tenta escrever.
5. **Reescrever `current_period_end` no cancelamento (zerar, ou fixar em
   "agora").** Rejeitada: a graça inteira depende desse valor já gravado
   pelo webhook (`greatest()`, ADR-075) continuar intacto —
   `confirm_own_subscription_cancellation()` só toca `status`, nunca essa
   coluna. Cancelar uma linha sem `current_period_end` (nunca ativou de
   verdade) simplesmente não concede graça nenhuma, comportamento seguro já
   coberto pela cláusula existente de `is_subscription_active()`.

#### Decisão

Migration `20260829000000_add_subscription_cancellation.sql`, aditiva,
`security definer`, `grant` só a `authenticated` (nunca `anon`):

- `prepare_own_subscription_cancellation()` — resolve o representante do
  `auth.uid()`, devolve `cancelable` + `external_subscription_id` (pode ser
  `null` para linhas `provider = 'manual'`), `already_canceled`, ou
  `not_found`. Nunca escreve.
- `confirm_own_subscription_cancellation()` — mesma resolução, só grava
  `status = 'canceled'` quando o `status` atual é `active` ou `suspended`;
  idempotente (`already_canceled` numa segunda chamada, nunca erro).

`src/modules/billing/application/cancel-subscription.ts` orquestra os três
passos (preparar → cancelar no Asaas se houver id externo → confirmar
local), pulando a chamada ao Asaas quando não há `external_subscription_id`
(linha nunca automatizada) e nunca chamando `confirmCancellation()` se o
gateway devolver `'error'`. Um `'not_found'` do gateway (assinatura já
removida no Asaas por fora) segue para a confirmação normalmente — já não
há mais cobrança de qualquer forma.

UI: `subscription-view-state.ts` ganha `canCancel`, decidido dentro do
mesmo switch exaustivo que já decide banner/formulário (nunca uma segunda
condição escrita à mão) — verdadeiro só para `active`/`payment_failed`.
`CancelSubscriptionPanel` (`Modal` já existente do design system) exige
confirmação explícita antes de chamar a Server Action; sem estado de
sucesso local, `revalidatePath` refaz o Server Component com o novo
`canCancel: false` no próximo ciclo.

#### Verificação

`tests/subscription-cancellation.integration.test.ts`: `not_found` sem
representante/sem assinatura; `cancelable` com id externo a partir de
`active`; idempotência (`already_canceled` numa segunda confirmação);
`suspended` também elegível; linha `manual` (id externo nulo) também
completa o fluxo; `current_period_end` preservado byte a byte (por
instante, não string — Postgres devolve `timestamptz` como `+00:00`);
RPC indisponível a `anon`. `tests/cancel-subscription.test.ts` (unitário,
gateways falsos): a orquestração pula o Asaas sem id externo, nunca
confirma localmente se o Asaas falhar, trata `not_found` do Asaas como
sucesso. `tests/map-subscription-gateway-result.test.ts` e
`tests/subscription-view-state.test.ts` cobrem os mapeadores puros e
`canCancel` por estado, exaustivamente. `npm run verify` completo (491
testes, build) limpo.

Chamada real ao Asaas (`DELETE /v3/subscriptions/:id`) **não foi exercida
por teste automatizado** — mesma limitação já registrada nos ADRs
anteriores de billing; só verificável com conta Asaas real configurada.

#### Consequências

- Fecha o único gap real que restava do fluxo de cancelamento — leitura e
  graça já existiam desde o ADR-072, só a escrita faltava.
- `DOMAIN_MODEL.md` §14.3 perde a ressalva "not shipped yet" da transição
  `Active/Suspended→Canceled`.
- SET-63 (microfeedback de motivo de cancelamento) pode agora ser
  construída em cima de um fluxo de cancelamento real — não fazia sentido
  antes.
- Risco aceito: nenhum teste automatizado cobre a chamada HTTP real ao
  Asaas; um erro de mapeamento de resposta do Asaas só apareceria em uso
  real — mesmo risco já aceito para checkout/webhook.

#### Rollback conceitual

Reversão é aditiva-inversa: remover as duas funções da migration, o botão/
modal de `CancelSubscriptionPanel` de `/app/conta`, e os arquivos de
domínio/aplicação/infra novos. Nenhuma linha de `subscriptions` precisa
reverter — uma linha já `canceled` continua correta (a graça de
`is_subscription_active()` já existia antes desta ADR e independe dela).
