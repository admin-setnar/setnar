### ADR-082 — Leitura agregada de Analytics para o representante: duas queries escopadas por RLS, agregação em JS, sem RPC nem migration nova

**Status:** Accepted
**Date:** 2026-08-11
**Related:** Implements AN6 of `docs/plans/QR_ANALYTICS_PLAN.md` — o único
passo do plano que ainda estava vivo; lê o que ADR-050/051/052/053/054/065
já gravam, sem alterar nenhuma dessas decisões.

#### Contexto e problema

`analytics_events` grava visitas e cliques no WhatsApp desde ADR-050, com o
limite de acesso confiável fechado em ADR-065 (só `service_role` escreve;
`ip_hash` nunca é lido, nem pelo dono da linha). `leads` já tem sua própria
policy de leitura própria (`leads_select_own`,
`20260731000000_create_representative_domain.sql:314-323`). Nenhum dos dois
dados chegava a `/app/paginas` — o representante nunca via o que o produto
já registrava. Esse gap foi levantado diretamente pelo founder durante o
smoke test da SET-7 e virou a SET-37, depois de confirmado que não duplicava
nenhuma issue existente.

#### Alternativas consideradas

1. **RPC/função `SECURITY DEFINER` nova, com `group by` no Postgres.**
   Resolveria a agregação no banco, mas exigiria uma nova função e grants a
   auditar (mesmo cuidado do double-check ADR-048) para um problema que duas
   `SELECT`s já resolvem com a RLS existente. Rejeitada por agora: overhead
   de superfície sem necessidade — não há hoje volume que justifique mover a
   agregação para o banco.
2. **Contadores agregados** (colunas `visit_count`/`whatsapp_click_count` em
   `product_activations`, ou uma tabela de resumo por período). Precisaria
   de migration e de um mecanismo de incremento, e §3.5 do
   `QR_ANALYTICS_PLAN.md` já rejeitou essa forma para a escrita — repetir a
   pergunta aqui, para a leitura, reabriria uma decisão fechada.
3. **Duas queries de leitura, escopadas pela sessão do próprio representante
   (RLS), agregadas em JS a cada request.** Escolhida.

#### Decisão

`AnalyticsMetricsRepository.listOwnSummaryByProduct(representativeId,
periodDays)` (`src/modules/analytics/domain/analytics-metrics-repository.ts`)
é um port novo, irmão de `AnalyticsGateway` (o port de escrita) — não um
método adicionado a ele, porque a natureza é outra: leitura, chamador
autenticado, números agregados, contra o port de escrita, que é anônimo e
devolve só um booleano.

O adaptador Supabase (`supabase-analytics-metrics-repository.ts`) roda duas
`SELECT`s em paralelo com o client request-scoped do próprio representante
(`createClient()`, o mesmo usado por `SupabaseRepresentativeCatalogRepository`):
`analytics_events` (`product_id`, `event_type`, filtrado por
`representative_id` e `created_at >= cutoff`) e `leads` (`product_id`, mesmo
filtro). Isolamento entre representantes é responsabilidade das RLS policies
já existentes (`analytics_events_select_own`, `leads_select_own`) — este
adaptador não adiciona uma segunda camada de checagem, nem uma função
privilegiada nova.

A agregação (`aggregate-analytics-summary.ts`) é uma função pura — recebe as
duas listas de linhas já filtradas e devolve uma entrada por `product_id`
com `visits`/`whatsappClicks`/`leads`, testável sem client Supabase, mesmo
padrão de `merge-representative-catalog.ts`.

Período: `7` ou `30` dias, escolhido via `?periodo=` em
`/app/paginas`, allow-listado ao literal `'30'` (qualquer outro valor cai no
default de `7`) — mesmo padrão que `/esqueci-senha?error=` já usa (ADR-081):
uma query string chegada por link é tão alcançável por um atacante quanto
qualquer outro ponto de entrada, então nunca é refletida sem allow-list.

Apresentação: dentro do `ProductActivationCard` já existente, uma linha por
produto, visível para todo estado exceto `not_activated` (mesma condição já
usada para o link "Ver prévia", SET-36) — reaproveita o componente em vez de
criar uma seção nova, seguindo a inclinação já registrada em
`QR_ANALYTICS_PLAN.md` §3.7. A cópia nunca afirma mensagem enviada, venda ou
conversão financeira — mesma cautela que o texto de ADR-065 já formaliza
para o que `visit`/`whatsapp_click` significam.

#### Consequências

- o representante vê, pela primeira vez, o que o produto já vinha
  registrando — fecha o gap apontado no smoke test da SET-7;
- nenhuma migration nova, nenhuma função `SECURITY DEFINER` nova, nenhum
  grant novo a auditar — a superfície de escrita de ADR-065 permanece
  intocada;
- o custo de leitura cresce linearmente com o volume de eventos por
  representante por período; aceitável hoje (mesma razão que já justificou
  eventos crus em vez de contadores — volume baixo no Stage 1), mas se um
  representante único acumular um volume alto de eventos, mover a agregação
  para uma RPC/SQL `group by` (a alternativa 1 rejeitada acima) volta a ser
  a escolha certa — não decidido agora, só registrado como gatilho futuro;
- a métrica de leads aqui é uma contagem simples por produto/período, não um
  funil ou taxa de conversão — Advanced Analytics (device, cidade,
  conversão) continua Stage 2, fora deste ADR.

#### Rollback conceitual

Reversão é remover o módulo de leitura (`analytics-metrics-repository.ts` e
seus dois arquivos de infraestrutura) e as três props que passaram a fluir
de `/app/paginas` até `ProductActivationCard` — nenhuma migration para
desfazer, nenhum dado para reescrever, porque nada aqui grava.
