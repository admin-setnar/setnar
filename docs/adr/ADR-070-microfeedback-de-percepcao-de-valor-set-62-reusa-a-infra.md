### ADR-070 — Microfeedback de percepção de valor (SET-62) reusa a infraestrutura do ADR-069 sem nova migration

**Status:** Accepted
**Date:** 2026-08-07
**Related:** Extends ADR-069 (segundo consumidor real do que aquele ADR já
reservava); segunda promoção documentada de um componente de
`modules/*/presentation/` para `shared/ui/`

#### Contexto e problema

SET-62 pede o segundo dos quatro contextos de microfeedback qualitativo que
SET-59/ADR-069 desenharam: "A SETNAR está ajudando você a divulgar seu
trabalho?", exibido depois de pelo menos 14 dias corridos desde a primeira
publicação e pelo menos uma visita pública real registrada. Duas perguntas
de arquitetura, ambas antecipadas pelo ADR-069 mas não decididas até este
ponto:

1. O gate de elegibilidade do SET-62 precisa de dois fatos que nenhum port
   existente expõe: `MIN(product_activations.published_at)` do
   representante e "existe pelo menos um `analytics_events` de
   `event_type = 'visit'`". De onde vêm essas duas leituras?
2. `FeedbackPrompt` (`modules/feedback/presentation/`) tem hoje
   `optionWithDetail?: string` — uma única opção pode revelar o campo
   complementar. SET-61 só precisava de uma ("difficult"). SET-62 precisa de
   duas ("Em parte" e "Não"). A API do componente compartilhado precisa
   mudar.

#### Alternativas consideradas

1. **Adicionar as duas leituras a `FeedbackGateway`.** Rejeitada: ADR-069
   já fixou `FeedbackGateway` como genérico por `context`, reusado
   verbatim por SET-62/63/64 — colocar ali uma leitura que só
   `value_perception` usa (product_activations + analytics_events, nunca
   feedback_responses) quebraria exatamente essa generalidade, sem
   nenhum ganho de coesão.
2. **Estender `RepresentativeCatalogEntry` com `publishedAt` e adicionar
   `product_activations` a `/app/conta`.** Rejeitada: exigiria que
   `/app/conta` passasse a buscar o catálogo inteiro (produtos + ativações)
   só para extrair um único timestamp, e ainda não resolveria a leitura de
   `analytics_events`, que não é dado de Catalog nenhum.
3. **Um port novo, estreito, dono das duas leituras (`ValuePerceptionSignalsGateway`).**
   Escolhida: mesma régua "naturezas diferentes merecem portas diferentes"
   já usada em ADR-031/041/042/044. As duas queries (`product_activations`
   ordenado por `published_at asc limit 1`, `analytics_events` filtrado por
   `event_type = 'visit' limit 1`) rodam com o client de sessão do próprio
   request, sem receber `representative_id` como parâmetro — a RLS
   (`product_activations_select_own`, `analytics_events_select_own`) já
   escopa por `auth.uid()`, mesma convenção que `SupabaseFeedbackGateway.isResolved`
   já usa para dispensar esse parâmetro.
4. **Deixar `optionWithDetail` como está e criar um segundo componente
   (`FeedbackPromptMultiDetail` ou similar) só para SET-62.** Rejeitada:
   generalizar `string` → `readonly string[]` é uma mudança sem custo de
   compatibilidade (SET-61 passa a mandar `['difficult']`, um array de um
   elemento) e evita duplicar um componente de ~165 linhas por causa de uma
   prop.

#### Decisão

Nenhuma migration SQL nova. `resolve_feedback`
(`supabase/migrations/20260822000000_add_feedback_responses.sql:198`) já
valida `yes`/`partly`/`no` para `context = 'value_perception'` desde o
ADR-069/SET-60 — construído deliberadamente à frente do SET-62 para este
exato momento. Todo o trabalho do SET-62 é camada de aplicação.

**Elegibilidade** — `modules/feedback/domain/value-perception-eligibility.ts`,
função pura `isValuePerceptionFeedbackEligible(signals, alreadyResolved, now)`:
14 dias corridos desde `firstPublishedAt` (nunca cadastro/assinatura) **e**
`hasVisitEvent` **e** `!alreadyResolved`. `hasVisitEvent: false` é
permanente, não um adiamento — a função não tem "tente de novo em N dias"
porque o evento que mudaria a resposta (uma visita real acontecer) é
recalculado a cada render, nunca cacheado como uma decisão "ainda não" que
precisaria expirar.

**Sinais** — `ValuePerceptionSignalsGateway` (novo port,
`modules/feedback/domain/`), adaptador Supabase em
`modules/feedback/infrastructure/`, fábrica `getValuePerceptionSignalsGateway()`.
Duas queries paralelas (`Promise.all`), nenhum novo evento em
`analytics_events`, nenhuma nova coluna — mesma disciplina "eligible nunca é
uma coluna" do ADR-069.

**Reuso partilhado entre as duas telas do trigger** —
`resolveValuePerceptionFeedbackEligibility()`
(`modules/feedback/presentation/`) compõe `ValuePerceptionSignalsGateway` +
`FeedbackGateway.isResolved('value_perception')` + a função de domínio, e é
chamada por `/app/paginas` **e** `/app/conta` — as duas únicas telas onde o
SET-62 permite o prompt aparecer. Extraída (diferente do SET-61, que embute
sua própria checagem só em `/app/paginas`) porque desde o início tem dois
chamadores reais, não um.

**`FeedbackPrompt` promovido para `shared/ui/`** — segundo consumidor real
(SET-62), exatamente o gatilho que o próprio comentário do componente já
anunciava desde o ADR-069. `optionWithDetail?: string` generalizado para
`optionsWithDetail?: readonly string[]`: SET-61 passa a enviar `['difficult']`,
SET-62 envia `['partly', 'no']`. Nenhuma outra mudança de API. Adicionada
uma linha em `shared/ui/README.md`.

**Exclusão mútua com SET-61** — em `/app/paginas`,
`showValuePerceptionFeedback` só é calculado (e a leitura de sinais só roda)
quando `showFirstPublicationFeedback` é `false` — os dois contextos nunca
aparecem juntos, e o caso comum (SET-61 elegível) nem paga o custo das
queries do SET-62.

**Tela de cancelamento** — não excluída explicitamente porque não existe
ainda: `/app/conta` não tem nenhum fluxo de cancelamento (SET-32 não foi
construído). Registrado aqui, não escondido: quando SET-32/63 criarem essa
tela, aquele trabalho é responsável por excluir este prompt dela — este ADR
não inventa uma exclusão para uma rota que ainda não existe.

#### Consequências

- Zero migration nova; toda a superfície de escrita já auditada pelo
  ADR-069 (RPCs `SECURITY DEFINER`, sem policy de INSERT/UPDATE) permanece
  inalterada.
- `FeedbackPrompt` agora vive em `shared/ui/feedback-prompt.tsx`; qualquer
  import futuro por `modules/feedback/presentation/feedback-prompt` deve ser
  atualizado para `@/shared/ui/feedback-prompt` (o arquivo antigo foi
  removido, não deixado como re-export).
- SET-63/64 herdam tanto o padrão de port dedicado para sinais
  específicos de contexto (se precisarem de um) quanto a generalização de
  `optionsWithDetail`, sem reabrir nenhuma das duas decisões.
- O risco aceito e já documentado no SET-62 permanece: se o volume de
  visitas do piloto for baixo, poucos representantes atingem a condição 3
  e a amostra de respondentes fica pequena — aceitável, é dado qualitativo.

#### Rollback conceitual

Migrations são forward-only e nenhuma foi criada aqui. Uma reversão seria
puramente de aplicação: remover o wiring de `/app/paginas`/`/app/conta` e
`showValuePerceptionFeedback`; `feedback_responses` continuaria aceitando
`value_perception` (decisão do ADR-069, não deste ADR) sem nenhum
consumidor ativo, o mesmo estado em que SET-63/64 já deixam os próprios
contextos reservados hoje.
