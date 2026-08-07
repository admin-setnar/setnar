### ADR-069 — Infraestrutura mínima compartilhada de microfeedback qualitativo

**Status:** Accepted
**Date:** 2026-08-07
**Related:** Estende o padrão RPC-only do ADR-047; primeiro consumidor é SET-61
(`first_publication`); reservado para SET-62 (`value_perception`), SET-63
(`cancellation`) e SET-64 (`pmf`)

#### Contexto e problema

SET-59 define uma camada de microfeedback qualitativo com quatro contextos de
disparo distintos (primeira publicação, percepção de valor, cancelamento,
PMF), cada um com seu próprio trigger e vocabulário de resposta. Sem uma
decisão explícita, cada issue (SET-61 a SET-64) tende a implementar sua
própria tabela, seu próprio componente de UI e sua própria forma de
distinguir "visto e ignorado" de "visto e dispensado" de "respondido" — a
mesma pergunta ("este contexto já foi resolvido para este representante?")
resolvida de quatro formas divergentes, com o risco real de virar um motor de
survey genérico (schema dinâmico, CMS de perguntas, dashboard de
experimentação) que este projeto explicitamente não precisa hoje.

#### Alternativas consideradas

1. Uma tabela por contexto (`first_publication_feedback`,
   `value_perception_feedback`, ...). Rejeitada: a estrutura de estado
   (mostrado/respondido/dispensado) é idêntica nos quatro casos; duplicar a
   tabela duplicaria também as RPCs, os testes de RLS e o componente de UI,
   sem nenhum ganho de isolamento — nenhum dos contextos precisa de colunas
   próprias.
2. Um motor de survey genérico com schema de perguntas dinâmico, permitindo
   qualquer pergunta/opções por configuração. Rejeitada: nenhuma issue atual
   pede perguntas configuráveis em runtime; a pergunta e as opções de cada
   contexto já são fixas no código (`FeedbackPrompt` recebe `question` e
   `options` como props do chamador). Construir um motor configurável agora
   seria complexidade especulativa para um requisito que não existe.
3. Uma única tabela `feedback_responses` com uma coluna `context` (CHECK
   fechado, estendido forward-only a cada issue que a implementa de fato) e
   duas RPCs (`record_feedback_shown`, `resolve_feedback`) compartilhadas por
   todos os contextos. Escolhida: acomoda os quatro contextos sem repetir
   schema, RPC ou componente, e sem introduzir configuração dinâmica alguma —
   a única variação real entre contextos é o vocabulário de `response`
   (`easy`/`reasonable`/`difficult` para `first_publication`;
   `yes`/`partly`/`no` para `value_perception`; quatro códigos de
   disappointment para `pmf`), validado dentro de `resolve_feedback` conforme
   `p_context` — não em `response`, que é `text` livre, exatamente porque uma
   CHECK de coluna não enxerga `context` (ver Decisão).
4. Um único status (`enum('shown','answered','dismissed')`). Rejeitada: um
   status único não distingue "mostrado e nunca resolvido" (usuário navegou
   para longe sem interagir) de um estado terminal — perderia exatamente o
   sinal que SET-60 exige explicitamente para evitar viés de análise
   (representante que ignorou vs. que dispensou vs. que respondeu).

#### Decisão

Uma única tabela, `feedback_responses`, com três timestamps independentes
(`shown_at`, `answered_at`, `dismissed_at`) em vez de uma máquina de estados
com coluna única. `shown_at` registra apenas um fato técnico: o prompt foi
apresentado/renderizado ao cliente para (representante, contexto) — **não**
é prova de que o representante leu ou percebeu a pergunta, e nenhum código ou
documentação deste projeto deve lê-lo como tal. `answered_at`/`dismissed_at`
registram um desfecho terminal sobre essa apresentação: `shown_at` sozinho
significa apresentado e ainda não resolvido; `+ dismissed_at` significa
apresentado e explicitamente dispensado; `+ answered_at` significa
apresentado e respondido.

Se uma linha resolvida (respondida ou dispensada) significa "nunca mais
mostrar este contexto" é uma decisão de produto de cada contexto, tomada na
sua própria função de elegibilidade de domínio — não uma verdade universal
do modelo. SET-61 (`isFirstPublicationFeedbackEligible`,
`modules/feedback/domain/first-publication-eligibility.ts`) decide que
responder e dispensar são igualmente permanentes ("não incomodar
novamente"); um contexto futuro pode decidir diferente sem alterar o schema
ou as RPCs. O que a RPC `resolve_feedback` garante de forma universal — e
isso sim é um invariante de integridade, não uma política de produto — é que
a mesma linha não pode ser resolvida duas vezes (`already_resolved`), evitando
uma corrida em que dois cliques resolvem o mesmo evento com desfechos
diferentes.

`eligible` (o representante pode ver o prompt agora?) não é uma coluna: é
sempre derivado por uma função de domínio pura por contexto a partir de
dados que já existem (`product_activations`) mais a ausência de uma linha
resolvida — nenhum evento novo em `analytics_events` é criado para isso.

Toda escrita passa por duas RPCs `SECURITY DEFINER`
(`record_feedback_shown`, `resolve_feedback`); não existe policy de
INSERT/UPDATE. Mesma razão do ADR-047: uma policy de escrita decide quem
escreve, nunca valida o quê — pertencimento ao vocabulário de `context`,
limite de 140 caracteres em `response_detail` e o invariante "só resolve o
que já foi mostrado" precisam de validação procedural, não de uma CHECK
isolada por coluna. O vocabulário de `response` segue a mesma lógica, um
degrau adiante: como ele varia por `context` (`easy`/`reasonable`/`difficult`
não é o vocabulário de `value_perception` nem de `pmf`), uma CHECK de coluna
não serve nem como policy — não enxerga `context` — então `response` é
`text` livre no schema e `resolve_feedback` valida o par (`context`,
`response`) contra um allow-list por contexto antes de gravar. `cancellation`
não tem allow-list ainda porque o SET-63 não aprovou uma taxonomia; qualquer
`answered` para esse contexto é hoje rejeitado (`invalid_response`), em vez
de adivinhado.

`FeedbackPrompt` (`src/modules/feedback/presentation/`) é o único componente
de UI da camada: recebe `context`, `question`, `options` e, opcionalmente,
`optionWithDetail`/`detailLabel` como props — a pergunta e as opções
continuam fixas no código de cada chamador (não em configuração), então o
componente é reutilizável sem virar um motor de formulário dinâmico. Vive em
`modules/feedback/`, não em `shared/ui/`, até ter um segundo consumidor real
(SET-62), seguindo a mesma régua de promoção que o resto do Design System já
usa.

Nenhuma constraint de unicidade em `(representative_id, context)`: a exceção
já documentada em SET-63 (`cancellation`, potencialmente mais de uma linha
por representante ao longo do tempo, uma por evento de cancelamento) precisa
dessa liberdade; os contextos de disparo único (`first_publication`,
`value_perception`, `pmf`) mantêm "no máximo uma linha não resolvida" por
construção da própria RPC (`record_feedback_shown` reaproveita a linha mais
recente em vez de inserir uma nova sempre que uma já existe).

#### Consequências

- SET-62/63/64 reutilizam a mesma tabela, as mesmas RPCs e o mesmo
  componente — cada issue futura estende a CHECK de `context` (schema) e o
  allow-list de `response` dentro de `resolve_feedback` (função), ambos
  forward-only, e passa suas próprias `question`/`options` para
  `FeedbackPrompt`, sem nova infraestrutura;
- a distinção entre apresentado-e-ignorado, apresentado-e-dispensado e
  apresentado-e-respondido fica disponível para qualquer análise futura sem
  exigir uma reconstrução de eventos brutos de `analytics_events` — e sem
  que isso seja confundido com prova de leitura;
- a política de reexposição (o que "resolvido" implica para a UI) permanece
  decidida por contexto, na função de elegibilidade de domínio de cada um,
  nunca pela tabela ou pelas RPCs — SET-62/63/64 podem divergir da escolha
  de SET-61 sem qualquer alteração de schema;
- nenhuma issue nova precisa reabrir a decisão RPC-vs-policy — o precedente
  do ADR-047 se estende automaticamente a qualquer escrita futura nesta
  tabela, response incluído;
- esta camada continua sendo opinião declarada, complementar aos eventos
  comportamentais já coletados (`analytics_events`) — nenhuma elegibilidade,
  gate ou decisão de produto documentada em SET-59/62/64 usa uma resposta
  declarada isoladamente como prova; o comportamento observado (visita,
  publicação, retenção, uso) continua tendo prioridade sobre a opinião
  declarada nesta tabela;
- o risco aceito é que, se um contexto futuro precisar de fato de uma
  pergunta configurável em runtime (não apenas fixa no código), esta decisão
  precisará ser revisitada — não é o caso de nenhuma das quatro issues
  aprovadas hoje.

#### Rollback conceitual

Migrations são forward-only. Uma reversão seria uma nova migration
revogando `EXECUTE` das duas RPCs e, se necessário, arquivando a tabela —
não há dado de negócio pré-existente reescrito por esta migration para
desfazer.
