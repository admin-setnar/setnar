### ADR-079 — Microfeedback de motivo de cancelamento (SET-63): elegibilidade por evento, não por representante

**Status:** Accepted
**Date:** 2026-08-10
**Related:** Extends ADR-069/070 (terceiro consumidor de `FeedbackPrompt`/
`FeedbackGateway`); consome o caminho de escrita do cancelamento que o
ADR-076 já implementou (`confirm_own_subscription_cancellation()`); consome
o estado `active_until` que o ADR-072 já expõe em
`subscription-view-state.ts`.

#### Contexto e problema

SET-60/ADR-069 já reservava `cancellation` como um dos quatro contextos de
microfeedback e já documentava, no próprio schema
(`20260822000000_add_feedback_responses.sql`), uma exceção estrutural para
ele: "não há uniqueness constraint em (representative_id, context):
`cancellation` é por evento de cancelamento, não por representante para a
vida toda". SET-63 pede exatamente esse contexto: uma pergunta única de
motivo, mostrada na tela de confirmação já efetivada do cancelamento
(`/app/conta`), reexibível a cada novo evento de cancelamento — não "uma vez
na vida do representante".

O problema: nenhuma peça da infraestrutura do SET-60 sabia fazer isso.

1. `FeedbackGateway.isResolved(context)` sempre lê a linha mais recente para
   `(representative_id, context)`. Para `first_publication`/`value_perception`
   isso está correto por definição — são one-shot de verdade, e a
   elegibilidade de cada um já impede o componente de montar de novo depois
   de resolvido, então a pergunta "existe uma linha mais recente NÃO
   resolvida para este evento específico" nunca precisou ser feita. Para
   `cancellation`, se o representante cancelar, responder, reativar e
   cancelar de novo, a linha "mais recente" continuaria sendo a do PRIMEIRO
   cancelamento — já resolvida — e `isResolved` reportaria `true` para
   sempre, mesmo havendo um evento novo e genuinamente não perguntado.
2. `record_feedback_shown()` reusa a linha mais recente para o par,
   resolvida ou não — desenhado assim de propósito para as duas contexts
   one-shot (idempotência entre remontagens antes da resposta). Só roda
   quando o componente já montou no navegador — tarde demais para corrigir
   o problema 1: a decisão servidor de nem montar o componente já teria
   acontecido antes, lendo a linha antiga.
3. `FeedbackPrompt.optionsWithDetail` (generalizado de `string` para
   `readonly string[]` no ADR-070) revela o campo complementar para uma
   lista de opções, mas usa um único `detailLabel` para todas elas. SET-62
   só precisava de um rótulo para duas opções ("O que está faltando?").
   SET-63 precisa de dois rótulos diferentes: "Qual funcionalidade estava
   faltando?" (só para `missing_feature`) e "Conte brevemente o que
   aconteceu." (para `technical_problem`/`expected_something_else`/`other`).

#### Alternativas consideradas

1. **Guardar um "evento de cancelamento atual" em `subscriptions`** (ex.:
   `canceled_at`) e correlacionar `feedback_responses` a ele por timestamp.
   Rejeitada: exigiria uma coluna nova só para esta correlação, e ainda
   deixaria `isResolved`/`record_feedback_shown` genéricos com uma exceção
   ad-hoc por fora — a mesma classe de "segunda fonte de verdade divergente"
   que `ARCHITECTURE.md` já rejeita em outros lugares deste projeto.
2. **`FeedbackGateway` ganha um método `isResolvedForLatestEvent` só para
   `cancellation`.** Rejeitada: quebraria a generalidade que o ADR-069
   deliberadamente fixou ("um port genérico por `context`, reusado
   verbatim") introduzindo uma exceção de contrato que só um consumidor usa.
3. **Abrir a linha fresca de `feedback_responses` no momento exato em que o
   evento de cancelamento se torna real — dentro de
   `confirm_own_subscription_cancellation()`, na mesma transação que já
   escreve `status = 'canceled'`.** Escolhida. Nenhuma mudança de contrato
   em `FeedbackGateway`/`isResolved()`: a função continua lendo só "a linha
   mais recente", e essa leitura automaticamente aponta para o evento certo
   porque só existe uma linha mais recente por vez — a do último
   cancelamento real. `record_feedback_shown()` ganha apenas um ajuste
   estritamente aditivo (abaixo), não uma ramificação por `context`.

#### Decisão

**Uma migration** (`20260902000000_add_cancellation_feedback_event.sql`),
redefinindo três funções já existentes (nenhuma tabela nova — o SET-60 já
previa este contexto):

1. **`confirm_own_subscription_cancellation()`** — depois de confirmar a
   transição real para `status = 'canceled'` (nunca nos ramos
   `already_canceled`/`changed`/`not_found`, que não representam um evento
   novo), insere uma linha nova em `feedback_responses` para
   `context = 'cancellation'`, com `shown_at` deixado `null`. É a única
   escrita desta migration condicionada a um evento real acontecer — e por
   isso é também a única peça que sabe, com certeza, quando um evento novo
   começou.
2. **`record_feedback_shown()`** — ao reusar uma linha existente (mesma
   lógica de antes: a mais recente para o par), agora também grava
   `shown_at = coalesce(shown_at, now())` em vez de deixar o valor como
   estava. Comportamento idêntico para `first_publication`/`value_perception`/
   `pmf` (a única forma de uma linha existir para elas é esta própria
   função já ter inserido com `shown_at = now()`, então o `coalesce` nunca
   tem efeito prático ali) — só `cancellation` agora pode chegar aqui com
   uma linha pré-existente e `shown_at` ainda `null`, e é exatamente esse
   caso que passa a ser corrigido corretamente: `shown_at` continua
   significando "apresentado ao navegador", nunca "o evento aconteceu no
   servidor".
3. **`resolve_feedback()`** — ganha o branch de vocabulário de
   `cancellation`: as 9 categorias do brief de produto
   (`not_generating_results`, `not_using_enough`, `price`,
   `missing_feature`, `hard_to_configure`, `no_longer_need`,
   `technical_problem`, `expected_something_else`, `other`). Mesmo padrão
   que `first_publication`/`value_perception`/`pmf` já seguem — um `CHECK`
   de coluna não vê `p_context`, então a validação por vocabulário mora
   aqui, não no schema.

**Elegibilidade** —
`modules/feedback/domain/cancellation-eligibility.ts`,
`isCancellationFeedbackEligible(hasGraceCancellation, alreadyResolved)`: verdadeiro
sse `hasGraceCancellation` (o chamador já leu
`SubscriptionViewState.kind === 'active_until'` — o estado cujo banner já
lê "Assinatura cancelada... até DD/MM", a tela de confirmação/sucesso que o
SET-63 exige) e `!alreadyResolved`. Ao contrário de
`isValuePerceptionFeedbackEligible`, `alreadyResolved` aqui NÃO é permanente
por design — ele simplesmente reflete o que `FeedbackGateway.isResolved()`
leu, e essa leitura já aponta para o evento certo por construção (decisão 3
acima). Nenhuma lógica de "por evento" precisou ser escrita nesta função:
ela é, deliberadamente, tão simples quanto as outras duas — toda a
complexidade real vive na RPC que abre a linha nova.

**`FeedbackPromptOption` ganha `detailLabel?: string` por opção**
(`shared/ui/feedback-prompt.tsx`), com fallback para o `detailLabel` de
nível de prompt já existente — SET-61/62 continuam funcionando sem
alteração (nunca usam o campo novo). Mesma régua "generalizar sem custo de
compatibilidade" que o ADR-070 já usou para `optionWithDetail` →
`optionsWithDetail`.

**Exclusão mútua** — `/app/conta` (`src/app/app/conta/page.tsx`) passa a
calcular `subscriptionState` ANTES do bloco de elegibilidade (antes vinha
depois), e resolve as três elegibilidades num único `Promise.all`.
Prioridade: `first_publication` (nunca renderizado aqui, só consultado) >
`cancellation` > `value_perception` — um representante na tela de
confirmação de cancelamento já decidiu sair; perguntar "a SETNAR está
ajudando você a divulgar seu trabalho?" no mesmo instante seria ruído
contraditório, não um momento coerente para nenhuma das duas perguntas.
`cancellation` some do banner mútuo-exclusivo com `value_perception` do
mesmo jeito que o ADR-070 já fazia entre `first_publication` e
`value_perception` — a mesma regra, agora com um terceiro membro.

**Posicionamento** — o `FeedbackPrompt` de cancelamento é renderizado
imediatamente depois do banner de assinatura (`subscriptionPanel.banner`),
dentro da própria seção "Assinatura" — nunca no topo da página como
`value_perception`. Ordem de DOM = ordem de leitura de leitor de tela: o
banner ("Assinatura cancelada... até DD/MM") é sempre anunciado antes da
pergunta opcional, satisfazendo o requisito de acessibilidade do SET-63 sem
nenhum `aria-live`/gerenciamento de foco adicional — a ordem natural do
documento já garante isso.

#### Consequências

- Zero tabela nova; a exceção estrutural que o SET-60/ADR-069 já reservava
  para `cancellation` finalmente tem uma implementação real.
- `record_feedback_shown()`/`resolve_feedback()` continuam genéricas por
  `context` — a mudança em `record_feedback_shown` é estritamente aditiva
  (preenche um campo que antes ficava sem preencher em um caso que nunca
  acontecia antes desta ADR) e não introduz nenhum `if p_context = ...`
  nela.
- `confirm_own_subscription_cancellation()` ganha um efeito colateral
  (abrir uma linha de feedback) que não é óbvio só pela assinatura da
  função — mitigado por um comentário explícito na própria função e por
  este ADR; aceito porque é o único ponto do sistema que sabe, com certeza
  e no momento certo, que um evento novo aconteceu.
- SET-64 (PMF), se e quando for implementado, permanece one-shot de
  verdade (nenhuma mudança de comportamento para ele) — herda a
  generalização de `optionsWithDetail`/`detailLabel` por opção sem reabrir
  esta decisão.
- Testado em `tests/cancellation-eligibility.test.ts` (regra pura),
  `tests/feedback-responses.integration.test.ts` (vocabulário de
  `resolve_feedback`) e `tests/subscription-cancellation.integration.test.ts`
  (o cenário central: um segundo cancelamento, depois de reativação, abre
  uma segunda linha independente da primeira já respondida).

#### Rollback conceitual

Migrations são forward-only. Uma reversão seria de aplicação (remover o
wiring de `/app/conta`) mais uma nova migration redefinindo as três funções
de volta ao comportamento anterior — `feedback_responses` continuaria
aceitando `cancellation` (decisão do ADR-069, não desta), só sem nenhum
consumidor real, mesmo estado em que SET-64 já deixa `pmf` hoje.
