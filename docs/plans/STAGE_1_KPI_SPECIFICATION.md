Status: Approved — decisões D1–D7 registradas por Pedro em 2026-08-14 (D3/D5/D7 deliberadamente deferred para depois do Stage 1; nenhuma decisão continua em aberto — ver §11)
Authority: Non-normative (ver `docs/plans/README.md`)
Code baseline: `0ecc74a`, branch `main`, 2026-08-14
Last reviewed: 2026-08-14
Superseded by: —

# STAGE_1_KPI_SPECIFICATION.md

> Especificação operacional dos KPIs oficiais do Stage 1. Constrói sobre
> `docs/plans/MVP_ANALYTICS_AUDIT.md` (auditoria técnica de instrumentação)
> — não a repete, referencia. Onde este documento e a auditoria divergem em
> algum detalhe, a auditoria é a investigação primária e este documento é a
> formalização; nenhuma migration, view, RPC, dashboard ou Metabase foi
> criado ou configurado para produzir este documento.

---

## 1. Purpose

Esta especificação existe para que "Pagantes", "Representante ativo",
"Resultado" e as demais métricas do Stage 1 tenham **uma única definição
canônica**, citável por nome, em vez de serem reinventadas — com
divergências silenciosas — cada vez que alguém (humano ou IA) escreve uma
query nova. `docs/plans/MVP_ANALYTICS_AUDIT.md` já mostrou que essa
divergência é um risco real e não hipotético neste projeto: `provider`
não filtrado em `subscriptions`, "ativo" com múltiplas leituras possíveis,
`whatsapp_click`/`lead` facilmente mal-lidos como um funil sequencial. Este
documento fecha essas ambiguidades onde há uma resposta técnica clara, e
as declara explicitamente como decisões abertas do Product Owner onde não
há.

O critério de sucesso deste documento: uma segunda IA, recebendo só este
arquivo (sem o histórico desta conversa), deve conseguir escrever a query
certa para qualquer um dos 15 KPIs sem inventar significado.

---

## 2. Stage 1 North Star Question

> **Os representantes estão recebendo valor comercial suficiente através
> do SETNAR para justificar continuar pagando pelo produto?**

Todo KPI declarado aqui existe para responder, parcial ou totalmente, a
essa pergunta. Métricas que não contribuem diretamente para ela (login,
tempo de sessão, contagem bruta de eventos) são explicitamente excluídas
como KPIs principais — ver §"Non-Primary Metrics".

---

## 3. KPI Taxonomy

```
Acquisition        → KPI 1
Activation          → KPI 2, KPI 3, KPI 4
Distribution         → KPI 5, KPI 6
Commercial Result     → KPI 7, KPI 8, KPI 9
Monetization           → KPI 10, KPI 11, MRR (secundário)
Retention               → KPI 12, KPI 13
Feedback                 → KPI 14, KPI 15
```

Esta taxonomia é a leitura oficial do funil de valor do Stage 1 — ver
§"Official Funnel / Value Model" para a representação visual completa.

---

## 4. Official KPI Definitions

Convenção: todo campo é preenchido; onde não se aplica, o texto é
`Not applicable`, nunca omitido.

---

### KPI 1 — Registered Representatives

```
Name: Registered Representatives
Business question: Quantos representantes concluíram o cadastro necessário para existir como representante no SETNAR?
Definition: Uma linha em `representatives` — criada exclusivamente por `register_representative()` (supabase/migrations/20260901000000_add_trial_lifecycle.sql:68-187), nunca pelo signup (`handle_new_user()`) sozinho. `register_representative()` é atômico com a criação da linha de trial em `subscriptions` — "cadastrado" e "com trial iniciado" acontecem na mesma transação (ver KPI 11).
Formula: count(*) from representatives [com os filtros abaixo]
Numerator: Not applicable (é uma contagem, não uma taxa)
Denominator: Not applicable
Source tables: representatives (contagem primária); profiles, auth.users (para "cadastro incompleto", ver Dimensions)
Filters: Nenhum filtro é tecnicamente necessário para a contagem bruta. Duas exclusões candidatas, ambas sem uma coluna que as suporte hoje — ver Known limitations: (a) fixtures de teste; (b) representantes com `status='suspended'` que na verdade foram eliminados via pedido LGPD (redação de PII), não meramente suspensos por inadimplência.
Time semantics: Lifetime metric (contagem total) e Period metric (novos representantes por período, ver abaixo) — não confundir os dois usos.
Dimensions: `created_at` (para corte temporal); `status` (`active`/`suspended`, mas não distingue os dois significados de `suspended` — ver Known limitations); company_id (hoje sempre 'igreen', sem valor discriminante).
Known limitations:
  - Um `profile` (conta criada, signup completo) sem `representative` correspondente NÃO conta aqui — é "cadastro incompleto", uma métrica derivada separada (`profiles LEFT JOIN representatives ... WHERE representatives.id IS NULL`), não parte do numerador de KPI 1.
  - `representatives.status='suspended'` mistura suspensão temporária por inadimplência e eliminação permanente por LGPD (`docs/runbooks/LGPD_RIGHTS.md` §7: "eliminação" real é `status='suspended'` + redação de PII com sentinelas como `REDACTED_PHONE_SENTINEL`) — sem coluna dedicada, não há forma confiável de separar os dois casos por query. **Decisão do Product Owner (D3, 2026-08-14): DEFERRED.** Um valor de status dedicado para eliminação LGPD não será adicionado ao schema durante o Stage 1 — esta limitação permanece aceita, conscientemente, pelo tempo do piloto. Reavaliar apenas se o volume de pedidos de eliminação crescer o suficiente para distorcer KPI 1/9 de forma material.
  - Fixtures de teste já contaminaram a contagem no projeto de teste (`docs/plans/AUDIT_MVP_LAUNCH.md` Achado 1: 18 linhas órfãs encontradas em 2026-08-14) — sem convenção de nome/flag para excluí-las por query.
Do not interpret as: "Representantes ativos" ou "representantes usando o produto" — esta é só a contagem de quem concluiu o cadastro, sem nenhuma implicação de uso (ver KPI 2).
```

**Novos representantes no período** (variante period metric do mesmo KPI):

```
Formula: count(*) from representatives where created_at >= :period_start and created_at < :period_end
Time semantics: Period metric.
```

---

### KPI 2 — Activated Representative / Activation Rate

```
Name: Activated Representative
Business question: Quantos representantes têm (ou tiveram) pelo menos uma página publicada?
Definition: **OFICIAL (D1, decidido 2026-08-14): Lifetime — "já publicou pelo
menos uma vez".** Duas leituras eram tecnicamente possíveis no código; o
Product Owner fechou por (B):

  (A) SNAPSHOT, não-oficial — "possui página publicada agora": pelo menos
  uma linha em `product_activations` com `status = 'published'` NESTE
  MOMENTO. Continua válida como leitura operacional complementar (é
  literalmente KPI 3), só não é mais uma interpretação candidata de KPI 2.

  (B) LIFETIME, **oficial**: pelo menos uma linha em `product_activations`
  com `status IN ('published', 'unpublished')`. Isso já é literalmente como
  o código resolve a mesma pergunta em outro lugar:
  `hasPublishedAtLeastOnce()` (`src/modules/feedback/domain/first-publication-eligibility.ts:11-15`)
  usa exatamente essa condição, com o comentário explícito de que
  `'unpublished'` ainda conta como "já publicou", porque `published_at`
  nunca é limpo ao despublicar (ADR-043) — despublicar não desfaz o marco
  histórico de ter publicado.

Formula (B, oficial): count(distinct representative_id) from product_activations where status in ('published', 'unpublished')
Formula (A, não-oficial, referência): count(distinct representative_id) from product_activations where status = 'published'
Numerator: representantes_ativados, por (B) — nunca mais ambíguo a partir de D1
Denominator: representantes_cadastrados (KPI 1)
Source tables: product_activations, representatives
Filters: `status` conforme a definição escolhida (A ou B).
Time semantics: (A) é snapshot; (B) é lifetime/marco histórico — nunca decresce.
Dimensions: representative_id; product_id (para adoção por produto, ver KPI 4).
Known limitations: Nenhuma técnica — a ambiguidade era de definição de negócio, não de dado faltando, e D1 já a fechou. Ambas as leituras (A e B) continuam 100% calculáveis e confiáveis; só (B) é a oficial.
Do not interpret as: login, acesso ao painel, ou qualquer ação dentro de `/app` — nenhuma dessas conta como ativação (`docs/DOMAIN_MODEL.md`'s critério e a rejeição explícita de "daily usage" em `docs/ROADMAP.md` § *Success Criteria* já estabelecem isso).
```

**Decisão do Product Owner (D1, 2026-08-14): APPROVED — (B), Lifetime, é a
definição oficial.** "Representante ativado" significa **já publicou pelo
menos uma página uma vez** — não "tem uma página publicada agora". (A)
permanece válida como leitura operacional complementar ("quantas páginas
estão no ar hoje", que é literalmente KPI 3), mas não é mais uma
interpretação candidata de KPI 2 — daqui para a frente, `representantes_ativados`
sem qualificação, em qualquer query/dashboard, significa (B). Isso é
consistente com o que o próprio código já fazia para uma decisão de
produto real (elegibilidade de microfeedback, SET-61,
`hasPublishedAtLeastOnce()`) e com a linguagem do `DOMAIN_MODEL.md` §14.1
("o modelo trata 'nunca publicado' e 'despublicado' como o mesmo estado
externamente invisível, distinguidos só pelo histórico").

**Activation Rate:**

```
Formula: representantes_ativados / representantes_cadastrados
Numerator: representantes_ativados (KPI 2, definição A ou B conforme decisão do PO)
Denominator: representantes_cadastrados (KPI 1)
Time semantics: Snapshot (calculado no momento da consulta, sobre o estado atual de ambos os lados).
```

**Distinto de — 7-Day Activation (métrica já aprovada, com thresholds, não redefinida aqui):**
`docs/plans/PILOT_SUCCESS_THRESHOLDS_PLAN.md` §2 já define e aprovou uma
variante *cohort metric*, mais estreita, específica do piloto:
"representantes com página publicada em até 7 dias do cadastro / total
cadastrado", implementada em `docs/runbooks/PILOT_METRICS.md` §1. Essa
métrica já tem thresholds 🟢/🟡/🔴 aprovados pelo Pedro (2026-08-12) e
**não é redefinida aqui** — é citada, não substituída. A diferença
importante: Activation Rate (este KPI) mede o estado atual/histórico sem
prazo; 7-Day Activation mede especificamente a velocidade de ativação após
o cadastro, e é a métrica oficial do relatório de threshold do piloto.

---

### KPI 3 — Published Pages

```
Name: Published Pages
Business question: Quantas páginas estão efetivamente publicadas agora?
Definition: Uma linha em `product_activations` com `status = 'published'`. Não existe tabela `commercial_pages` separada — uma "página" É o par (representative_id, product_id) com essa ativação publicada (ADR-029).
Formula: count(*) from product_activations where status = 'published'
Numerator: Not applicable
Denominator: Not applicable
Source tables: product_activations
Filters: status = 'published'
Time semantics: Snapshot.
Dimensions: product_id (produto/template — ver KPI 4); representative_id (para "páginas ativas por representante", incluindo distribuição — média, quantos representantes têm 0/1/2+).
Known limitations: Nenhuma. `published_at` existe e é confiável (só é escrito por `set_activation_status()`, nunca por um caminho paralelo).
Do not interpret as: "Páginas visitadas" ou qualquer medida de tráfego — isto é só contagem de estado de publicação, sem relação com KPI 5.
```

---

### KPI 4 — Product/Template Adoption

```
Name: Product Adoption (Representatives Using Product X) e Product Publication (Published Pages of Product X)
Business question: Quais produtos/páginas os representantes mais publicam?
Definition: Duas métricas distintas por design, NÃO misturadas com tráfego:
  - Representantes usando produto X: representantes que ATIVARAM o produto, em qualquer status (draft/published/unpublished) — mede intenção de oferecer, não necessariamente publicação.
  - Páginas publicadas do produto X: subconjunto de KPI 3, filtrado por product_id — mede o que está efetivamente no ar.
Formula (adoção): count(distinct representative_id) from product_activations where product_id = :product_id
Formula (publicação): count(*) from product_activations where product_id = :product_id and status = 'published'
Numerator: Not applicable (contagens, não taxas)
Denominator: Not applicable
Source tables: product_activations, products (para o nome/slug do produto)
Filters: product_id
Time semantics: Snapshot.
Dimensions: products.slug é a dimensão oficial — catálogo fixo de 7 produtos seedados (`supabase/migrations/20260803000000_seed_igreen_catalog.sql`), sem status de ciclo de vida modelado hoje.
Known limitations: Nenhuma.
Do not interpret as: popularidade de tráfego — um produto pode ter muitas páginas publicadas e poucas visualizações, ou o oposto. Adoção (este KPI) e tráfego (KPI 5) são perguntas diferentes.
```

---

### KPI 5 — Page Views

```
Name: Page Views
Business question: Quantas visualizações as páginas públicas receberam?
Definition: Uma linha em `analytics_events` com `event_type = 'visit'`, gravada por `record_page_visit()` a partir de `src/app/[productSlug]/page.tsx:87-100` (dentro de `after()`, best-effort, nunca bloqueia a resposta ao visitante real).
Formula: count(*) from analytics_events where event_type = 'visit' [+ filtros de escopo/janela]
Numerator: Not applicable
Denominator: Not applicable (é a base de outras taxas — ver KPI 7/8)
Source tables: analytics_events
Filters: representative_id, product_id, created_at (janela)
Time semantics: Period metric — sempre relativa a uma janela (7/30 dias no read path atual do produto, `AnalyticsPeriodDays = 7 | 30`); uma contagem "lifetime" é calculável via SQL direto mas não é o que o produto expõe hoje.
Dimensions: representative_id, product_id, referrer (não usado em breakdown hoje — Stage 2).
Known limitations:
  - Reload conta como nova visualização — sem `visit_id`/sessão, cada carregamento de página é uma linha nova.
  - Não representa visitante único — o mesmo visitante voltando à página gera múltiplas linhas, indistinguíveis de visitantes diferentes.
  - Pode conter autovisita do representante — a rota pública não verifica sessão/identidade; o representante acessando sua própria página publicada (fora da prévia privada) gera o mesmo evento que um visitante real. Confirmado no código: `src/app/[productSlug]/page.tsx` não tem nenhum branch de auth.
  - Bots não são 100% filtrados — `is_bot_user_agent()` é uma denylist de substring (`bot`, `crawler`, `spider`, `facebookexternalhit`, `whatsapp`, `curl`, `python-requests`, `headlesschrome`), documentada no próprio código como "redução de ruído", não controle de segurança.
  - **A prévia privada (`/pre-visualizacao/[productSlug]/page.tsx`) NÃO contamina este KPI** — confirmado: essa rota não importa `getAnalyticsGateway`/não chama `record_page_visit` em nenhum ponto do arquivo. Isso permanece verdadeiro no código lido nesta especificação.
Do not interpret as: "Unique Visitors" — nome deliberadamente evitado; ver §"Analytical Anti-Patterns".
```

---

### KPI 6 — Representatives With Traffic

```
Name: Representatives With Traffic
Business question: Quantos representantes receberam pelo menos uma visualização em uma página publicada dentro da janela?
Definition: has_traffic = existe ≥1 evento `analytics_events` com `event_type='visit'` para o representante, dentro da janela.
Formula: count(distinct representative_id) from analytics_events where event_type = 'visit' and created_at >= :window_start
Numerator: Not applicable (contagem)
Denominator: Not applicable — mas ver uso como denominador secundário em KPI 9.
Source tables: analytics_events
Filters: event_type = 'visit', created_at (janela)
Time semantics: Period metric (a janela precisa ser declarada explicitamente — 7d/30d, alinhado ao mesmo padrão de KPI 5/7/8; sem janela padrão implícita).
Dimensions: representative_id.
Known limitations: Herda todas as limitações de KPI 5 (autovisita, sem visitante único) — "recebeu tráfego" pode incluir só a própria autovisita do representante, sem nenhum visitante real.
Do not interpret as: "representante ativado" (KPI 2) — tráfego não implica publicação nem vice-versa (embora na prática só páginas publicadas gerem `visit`, pela regra de resolução de `record_page_visit`).
```

---

### KPI 7 — WhatsApp Clicks / WhatsApp Conversion Rate

```
Name: WhatsApp Clicks
Business question: Quantas ações de intenção comercial via WhatsApp ocorreram?
Definition: Uma linha em `analytics_events` com `event_type = 'whatsapp_click'`, gravada por `record_whatsapp_click()` via `POST /api/track-click`, acionada pelo `onClick` de `whatsapp-cta.tsx:86` ou `floating-whatsapp.tsx:32`.
Formula: count(*) from analytics_events where event_type = 'whatsapp_click' [+ filtros de escopo/janela]
Numerator: Not applicable
Denominator: Not applicable (é numerador de WhatsApp Conversion Rate abaixo)
Source tables: analytics_events
Filters: representative_id, product_id, created_at (janela)
Time semantics: Period metric (mesma janela de KPI 5).
Dimensions: representative_id, product_id.
Known limitations:
  - Best-effort: `fetch(..., { keepalive: true })` sem `preventDefault` — se a aba fechar antes do beacon completar, o clique pode não ser contado. Perda sistemática de uma fração desconhecida de cliques reais.
  - Sem visitante único — mesma ausência de sessão de KPI 5.
  - Pode conter autovisita/clique do próprio representante testando o botão (mesma ausência de exclusão por identidade de KPI 5, embora em volume tipicamente muito menor).
  - Rate limit de 5 tentativas/3600s por `ip_hash` — reduz spam, mas pode também suprimir cliques legítimos repetidos de um mesmo IP (ex.: rede compartilhada/CGNAT) em volume raro.
Do not interpret as: "Lead" — um clique no WhatsApp NÃO cria uma linha em `leads` (ver KPI 9 e §"Analytical Anti-Patterns"). São eventos paralelos.

WhatsApp Conversion Rate =
Formula: whatsapp_clicks / visits
Numerator: WhatsApp Clicks (KPI 7), mesma janela/escopo do denominador
Denominator: Page Views (KPI 5), mesma janela/escopo do numerador
Time semantics: Period metric — numerador e denominador DEVEM usar a mesma janela e o mesmo escopo (representante/produto), nunca janelas diferentes.
```

---

### KPI 8 — Leads / Lead Conversion Rate

```
Name: Leads
Business question: Quantas submissões de lead foram geradas pelas páginas?
Definition: Uma linha em `leads`, gravada por `submit_lead()` via `POST /api/leads`, a partir do `CommercialLeadForm` (`commercial-lead-form.tsx`) — um formulário próprio de nome/telefone/cidade/e-mail, separado do botão de WhatsApp.
Formula: count(*) from leads [+ filtros de escopo/janela]
Numerator: Not applicable
Denominator: Not applicable (é numerador de Lead Conversion Rate abaixo)
Source tables: leads
Filters: representative_id, product_id, created_at (janela)
Time semantics: Period metric (mesma janela de KPI 5).
Dimensions: representative_id, product_id (nullable no schema, mas sempre preenchido por toda superfície de captura hoje).
Known limitations:
  - "Lead" aqui = submissão, não pessoa única — sem deduplicação por telefone/e-mail; um duplo clique ou retry manual cria uma segunda linha completa.
  - `origem`/`referrer` existem na linha mas não são um breakdown padronizado hoje.
Do not interpret as: um estágio posterior a "WhatsApp Click" — é um evento paralelo e independente, produzido por uma superfície de UI diferente (ver §"Analytical Anti-Patterns").

Lead Conversion Rate =
Formula: leads / visits
Numerator: Leads (KPI 8), mesma janela/escopo do denominador
Denominator: Page Views (KPI 5), mesma janela/escopo do numerador
Time semantics: Period metric — mesma regra de KPI 7 (numerador e denominador com janela/escopo idênticos).
```

---

### KPI 9 — Representative With Result / Result Rate

```
Name: Representative With Result
Business question: Quantos representantes estão recebendo algum sinal de intenção comercial (WhatsApp ou lead)?
Definition: has_result = (whatsapp_clicks >= 1) OR (leads >= 1), na janela analisada. Decisão de produto intencional (§4.2 do escopo desta tarefa): `whatsapp_click` e `leads` são sinais comerciais PARALELOS, não estágios sequenciais — a definição usa OR, nunca uma composição sequencial. Esta é a mesma leitura já usada, sem nomear o KPI, em `docs/plans/PILOT_SUCCESS_THRESHOLDS_PLAN.md` §2 ("Resultado... ≥1 lead OU ≥1 clique WhatsApp") e implementada literalmente em `docs/runbooks/PILOT_METRICS.md` §2.
Formula: count(distinct representative_id) from (
  select representative_id from analytics_events where event_type = 'whatsapp_click' and created_at >= :window_start
  union
  select representative_id from leads where created_at >= :window_start
) as with_result
Numerator: representantes_com_resultado (fórmula acima)
Denominator: representantes_ativados (KPI 2) — ESTE é o denominador oficial primário, ver abaixo.
Source tables: analytics_events, leads
Filters: created_at (janela); event_type = 'whatsapp_click' para o lado de cliques.
Time semantics: **Decisão do Product Owner (D2, 2026-08-14): o Stage 1 deve preferir uma janela relativa à primeira publicação (cohort), não uma janela corrida fixa.** Isto fecha a escolha a favor do formato já usado por `docs/runbooks/PILOT_METRICS.md` §2 — "≤30 dias desde a publicação" (`published_at` como âncora, para cada representante individualmente, não uma data de corte global) — como o padrão oficial de KPI 9 no Stage 1. Outras janelas (7d/30d corridos, desde o cadastro) continuam calculáveis e podem aparecer em leituras complementares, mas qualquer relatório headline de Result Rate deve usar a janela ancorada em `published_at`, declarada explicitamente junto do número.
Dimensions: representative_id.
Known limitations: Herda as limitações de KPI 7 (best-effort, autovisita) e KPI 8 (sem dedup) — um representante pode aparecer como "com resultado" só por causa da própria autovisita seguida de auto-clique de teste no botão.
Do not interpret as: representante "convertendo" visitantes num funil — é um sinal binário de presença de intenção comercial, não uma taxa de conversão de um evento específico.

Result Rate (oficial) =
Formula: representantes_com_resultado / representantes_ativados
Numerator: Representative With Result (KPI 9)
Denominator: Activated Representative (KPI 2) — responde "dos representantes que têm uma presença publicada, quantos estão vendo algum resultado?"
Time semantics: Period/cohort metric, mesma janela do numerador.

Traffic-to-Result Rate (diagnóstica, NUNCA headline — D2, decidido 2026-08-14) =
Formula: representantes_com_resultado / representantes_com_trafego (KPI 6)
**Decisão do Product Owner (D2): esta variante é explicitamente diagnóstica, não um KPI headline.** Ela isola a pergunta "dado que alguém viu a página, ela converteu intenção?" — útil para diagnosticar qualidade de conversão quando o Result Rate oficial (sobre `representantes_ativados`) estiver baixo, para separar "problema de distribuição/tráfego" de "problema de conversão da própria página". Mas nunca substitui, nem é reportada ao lado como se fosse igualmente prioritária, do Result Rate oficial — que continua sendo `representantes_com_resultado / representantes_ativados`, porque esse denominador é o que responde a pergunta central do Stage 1 sem excluir representantes que ainda não têm tráfego (excluí-los do denominador esconderia exatamente o problema de distribuição que o Stage 1 também precisa enxergar).
```

---

### KPI 10 — Paid Customer

```
Name: Paid Customer
Business question: Quantos representantes estão realmente pagando pelo SETNAR?
Definition: subscriptions.status = 'active' AND subscriptions.provider = 'asaas'. Investigação de código confirma que `provider` tem exatamente três valores em uso: 'trial' (nasce em `register_representative()`, nunca cobrado), 'manual' (valor padrão original da coluna; linhas ativadas à mão/fixture, sem cobrança real registrada — `20260823000000_add_billing_lifecycle_columns.sql:30-32`: "linhas manuais existentes... não têm um valor cobrado real para preencher retroativamente"), e 'asaas' (única via que passa por `apply_billing_event()`, com prova de pagamento confirmado pelo gateway). `status='active'` só é escrito por `apply_billing_event()` a partir de um evento `CHECKOUT_PAID`/`PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED` real do Asaas — nunca por `reserve_billing_checkout_slot()` (que só grava `'suspended'` como reserva provisória) nem por `register_representative()` (que grava `'trialing'`). Não há caminho de código que produza `status='active' AND provider='trial'`.
Formula: count(*) from subscriptions where status = 'active' and provider = 'asaas'
Numerator: Not applicable
Denominator: Not applicable
Source tables: subscriptions
Filters: status = 'active', provider = 'asaas' (AMBOS obrigatórios — ver Known limitations e §"Analytical Anti-Patterns")
Time semantics: Snapshot (estado atual de pagamento, não cumulativo — um representante que pagou e depois cancelou não conta mais aqui).
Dimensions: amount_cents (para MRR); external_subscription_id (presença confirma que passou pelo gateway pelo menos uma vez).
Known limitations:
  - `status='trialing'` inclui trials genuinamente em andamento E trials expirados nunca convertidos — `is_subscription_active()` reavalia `current_period_end` ao vivo para conceder entitlement, mas o valor armazenado em `status` permanece `'trialing'` para sempre até uma conversão real, mesmo após expirar. Se alguém quiser contar "trials ativos agora" (não parte deste KPI, mas relacionado), precisa filtrar `status='trialing' AND current_period_end > now()`.
  - `provider='manual'` estruturalmente não carrega `amount_cents` confiável (nullable, documentadamente sem cobrança real associada) — mesmo que uma linha `manual` tenha `status='active'`, ela é EXCLUÍDA da definição de Paid Customer por esta especificação, porque não há prova de pagamento real por trás dela.
  - Se o negócio algum dia processar um pagamento manual/fora do Asaas de forma legítima (ex.: boleto tratado à mão), a coluna `amount_cents` de uma linha `provider='manual'` PODERIA estar preenchida com um valor real — o schema não distingue esse caso de um fixture de teste. Não há ocorrência confirmada disso no código lido; é um caso extremo teórico, registrado por completude.
Do not interpret as: qualquer coisa vinda só de `status='active'` sem o filtro de `provider` — ver §"Analytical Anti-Patterns".
```

**Estados completos de `subscriptions` (tabela de referência):**

| status | provider típico | Significado | Conta como Paid Customer? |
|---|---|---|---|
| `trialing` (current_period_end futuro) | `trial` | Trial em andamento | Não |
| `trialing` (current_period_end passado) | `trial` | Trial expirado, nunca convertido — status nunca muda sozinho | Não |
| `active` | `asaas` | Pagamento confirmado pelo gateway | **Sim** |
| `active` | `manual` | Ativação manual sem cobrança real comprovada (fixture/teste/legado) | Não |
| `past_due` | — | Valor legal no CHECK, nunca escrito na prática (política SET-25 pula direto para `suspended`) | Não |
| `suspended` (com `external_subscription_id`) | `asaas` | Cobrança falhou, gateway esgotou tentativas de retry | Não |
| `suspended` (sem `external_subscription_id`) | `asaas` | Reserva de checkout iniciada e nunca concluída/abandonada | Não |
| `canceled` (current_period_end futuro) | qualquer | Cancelado pelo cliente, ainda em período de graça | Não (mas ainda tem acesso — ver `is_subscription_active()`) |
| `canceled` (current_period_end passado) | qualquer | Cancelado, graça encerrada | Não |

---

### KPI 11 — Paid Conversion Rate

```
Name: Paid Conversion Rate
Business question: Qual porcentagem dos representantes se torna cliente pagante?
Definition: pagantes (KPI 10) / representantes_cadastrados (KPI 1).
Formula: paid_customers / registered_representatives
Numerator: Paid Customer (KPI 10)
Denominator: Registered Representatives (KPI 1)
Source tables: subscriptions, representatives
Filters: os mesmos de KPI 10 e KPI 1.
Time semantics: Snapshot.
Dimensions: Not applicable (métrica agregada única, sem quebra por produto/dimensão adicional hoje).
Known limitations:
  - **`representantes_cadastrados` e `representantes_que_iniciaram_trial` são, hoje, o MESMO conjunto** — `register_representative()` cria a linha de trial (`status='trialing'`) atomicamente, na mesma transação que cria o representante (`20260901000000_add_trial_lifecycle.sql:178-183`). Não existe caminho de cadastro sem trial automático. Portanto os dois denominadores candidatos citados no escopo desta tarefa (`pagantes/cadastrados` e `pagantes/que_iniciaram_trial`) não divergem no código atual — apresentá-los como duas fórmulas diferentes seria inventar uma distinção que os dados não sustentam hoje. Se um futuro fluxo de cadastro sem trial automático for introduzido, este ponto precisa ser revisitado.
  - Sem coluna de "data de conversão para pago" — só `subscriptions.updated_at`, sobrescrito a cada transição de status (mesma limitação documentada em `docs/runbooks/PILOT_METRICS.md` §5 para retenção). Isso não impede calcular a taxa atual, mas impede uma análise de coorte por data de conversão com precisão (ex.: "conversão da coorte de agosto") sem uma nova coluna. **Decisão do Product Owner (D5, 2026-08-14): DEFERRED.** Nenhuma coluna nova é implementada durante o Stage 1. Quando essa coluna for de fato adicionada, o nome já decidido é **`first_paid_at`** — não `activated_at` (nome que este documento havia sugerido especulativamente numa versão anterior; `first_paid_at` é o nome oficial preferido a partir de agora, ainda que a coluna não exista hoje).
Do not interpret as: a métrica headline do piloto — ver "Founding Cohort Conversion" abaixo (D6), que é a métrica headline oficial, distinta desta e já decidida.
```

**Distinto de — Founding Cohort Conversion (métrica já aprovada, com
thresholds, não redefinida aqui):** `docs/plans/PILOT_SUCCESS_THRESHOLDS_PLAN.md`
§2 já define e aprovou "Conversão paga = Assinaturas pagas ativas (das 30
vagas) / 30", implementada em `docs/runbooks/PILOT_METRICS.md` §3, com
thresholds 🟢≥10/30 🟡5-9/30 🔴<5/30 aprovados pelo Pedro (2026-08-12). O
denominador fixo de 30 (não `representantes_cadastrados`) é a mesma
contagem de vagas fundadoras que `reserve_billing_checkout_slot()` usa
(`provider not in ('manual', 'trial')`, `20260901000000:251-259`).

**Decisão do Product Owner (D6, 2026-08-14): APPROVED — Founding Cohort
Conversion é a métrica HEADLINE de conversão paga durante o Stage 1.**
Paid Conversion Rate geral (este KPI, `pagantes/cadastrados`) permanece
secundária — continua calculável e útil para leitura de longo
prazo/steady-state, mas não é a que deve liderar um relatório resumido do
piloto. Sempre que um resumo/dashboard precisar de UM número de
"conversão paga" em destaque, esse número é Founding Cohort Conversion,
não este KPI.

---

### KPI 12 — Cancellations

```
Name: Cancellations
Business question: Quantos clientes cancelaram dentro do período?
Definition: subscriptions com status = 'canceled', cuja transição foi feita via `confirm_own_subscription_cancellation()` (`20260902000000_add_cancellation_feedback_event.sql:43-102`), chamada por `/app/conta` (SET-32).
Formula: count(*) from subscriptions where status = 'canceled' and updated_at >= :period_start and updated_at < :period_end
Numerator: Not applicable
Denominator: Not applicable
Source tables: subscriptions; feedback_responses (para timestamp mais preciso — ver Time semantics)
Filters: status = 'canceled'. NUNCA `status = 'suspended'` — ver Do not interpret as.
Time semantics: Period metric, com uma ressalva de precisão: `subscriptions.updated_at` é sobrescrito a cada transição (não existe `canceled_at` dedicado), então filtrar por `updated_at` dentro do período é impreciso se a linha sofrer qualquer transição posterior (ex.: reativação). **Proxy mais preciso disponível:** `feedback_responses.created_at` onde `context = 'cancellation'` — essa linha nasce na MESMA transação que grava `status='canceled'` (`confirm_own_subscription_cancellation()` insere as duas coisas juntas), então seu `created_at` é o timestamp real do evento de cancelamento, não sujeito a sobrescrita por transições futuras.
Dimensions: representative_id.
Known limitations:
  - **Cobre só cancelamentos feitos pelo fluxo do app.** `apply_billing_event()` só reconhece `CHECKOUT_PAID`/`PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED`/`PAYMENT_OVERDUE` — não há tratamento de um evento de cancelamento vindo diretamente do Asaas. Um cliente que cancela no painel do gateway, fora de `/app/conta`, não produz `status='canceled'` — a linha pode ficar `'active'` indefinidamente, ou eventualmente virar `'suspended'` via `PAYMENT_OVERDUE` se a cobrança falhar (o que é um evento diferente, com significado diferente — ver Do not interpret as). **Decisão do Product Owner (D4, 2026-08-14): APPROVED AS P1 FOLLOW-UP.** Não bloqueia o primeiro cliente pagante do piloto, mas precisa ser resolvido (reconhecer o evento de cancelamento nativo do Asaas em `apply_billing_event()`) antes de KPI 12/13/15 (churn e billing) serem tratados como completamente confiáveis — não é mais uma limitação aceita indefinidamente, é um item de trabalho futuro já priorizado.
Do not interpret as: `status = 'suspended'` NÃO é cancelamento — é enforcement de inadimplência (retry do gateway esgotado), uma ação involuntária do sistema, não uma decisão do cliente. Confundir os dois é o anti-pattern mais citado nesta especificação — ver §"Analytical Anti-Patterns".
```

---

### KPI 13 — Churn

```
Name: Churn (operacional, Stage 1)
Business question: Qual é a taxa de churn/retenção dos clientes pagantes?
Definition: Sem `first_paid_at`/`canceled_at` dedicados (nomes decididos em D5, colunas ainda não implementadas — deferred), uma coorte precisa ("% que cancelou dentro de N dias da conversão") não é calculável com exatidão hoje — mesma limitação já registrada em `docs/runbooks/PILOT_METRICS.md` §5. **Decisão do Product Owner (D7, 2026-08-14): usar (1) Retention Snapshot D30/D60 durante todo o Stage 1; (2) Period Churn Rate fica DEFERRED, implementada só quando houver necessidade analítica real.**

  (1) RETENTION SNAPSHOT — **oficial para o Stage 1** (D7), já implementada e em uso, `docs/runbooks/PILOT_METRICS.md` §5 (D30/D60):
  Numerator: count(*) filter (where status = 'active' and updated_at <= now() - interval 'N days')
  Denominator: count(*) filter (where status <> 'trialing' and updated_at <= now() - interval 'N days')
  Janela: D30, D60 (dias desde a última transição de status que tirou a linha de `trialing`)
  Limitação: `updated_at` é a data da ÚLTIMA transição, não da conversão original — para uma assinatura sem idas e vindas depois de sair de `trialing` (caso comum no piloto), as duas coincidem; para uma com histórico de suspensão/reativação, o número fica CONSERVADOR (mede "estável há N dias", nunca otimista) — limitação já documentada e aceita no próprio runbook.
  Churn (D30/D60) = 100% − Retenção (D30/D60), pela mesma fórmula.

  (2) PERIOD CHURN RATE — fórmula clássica de SaaS, DEFERRED (D7) e, hoje, NÃO precisamente calculável:
  Numerator: subscriptions canceladas no período
  Denominator: subscriptions pagantes no início do período
  Janela: mensal ou a janela escolhida.
  Por que não é precisa hoje: o denominador ("quem estava pagando no início do período") exigiria um snapshot histórico de status por data, que não existe — `subscriptions` só guarda o estado atual, e `billing_events` (que tem histórico real, via log append-only) NÃO registra cancelamentos (`confirm_own_subscription_cancellation()` não escreve em `billing_events`, só em `subscriptions` + `feedback_responses`). Reconstituir "quem pagava em 1º de agosto" exigiria inferir de `updated_at`/histórico indireto, com a mesma imprecisão de (1).
Formula: Ver (1) acima — é a definição operacional oficial do Stage 1 (D7), pelo volume atual e por já estar implementada/aprovada.
Numerator: Ver (1).
Denominator: Ver (1).
Source tables: subscriptions (para (1)); billing_events, feedback_responses (para contexto, não para o cálculo em si)
Filters: status, updated_at.
Time semantics: Cohort metric (D30/D60 — desde a saída de `trialing`, não desde uma data corrida fixa).
Dimensions: Not applicable hoje (sem breakdown por produto/coorte de cadastro).
Known limitations: Já listadas acima, ambas herdadas de `PILOT_METRICS.md` §5.
Do not interpret as: uma métrica de "tempo até cancelar" por representante individual — isso exigiria a coluna `first_paid_at` (D5, deferred) que não existe hoje.
```

---

### KPI 14 — Feedback Distribution by Context

```
Name: Feedback Distribution by Context
Business question: Como os representantes estão avaliando o produto?
Definition: Distribuição de `feedback_responses.response` agrupada por `context`, para linhas com `answered_at is not null`.
Formula: select context, response, count(*) from feedback_responses where answered_at is not null group by context, response
Numerator: Not applicable (é uma distribuição, não uma taxa única)
Denominator: Not applicable — mas ver "taxa de resposta" abaixo.
Source tables: feedback_responses
Filters: answered_at is not null (para distribuição de respostas reais); shown_at is not null (para taxa de resposta, com a ressalva abaixo).
Time semantics: Lifetime/cumulative por padrão; pode ser recortado por `created_at`/`answered_at` para period metric.
Dimensions: context — quatro valores reais no CHECK do banco: `first_publication`, `value_perception`, `cancellation`, `pmf`. Vocabulário de `response` por context (validado dentro de `resolve_feedback()`, não numa CHECK de coluna — `context` determina quais valores são legais):
  - `first_publication`: `easy` | `reasonable` | `difficult`
  - `value_perception`: `yes` | `partly` | `no`
  - `cancellation`: `not_generating_results` | `not_using_enough` | `price` | `missing_feature` | `hard_to_configure` | `no_longer_need` | `technical_problem` | `expected_something_else` | `other`
  - `pmf`: `very_disappointed` | `somewhat_disappointed` | `not_disappointed` | `no_longer_use` (vocabulário reservado — nenhum gatilho de apresentação foi encontrado em `presentation/` na auditoria; a validação de resposta existe no banco, mas não a elegibilidade/exibição no app)
Known limitations:
  - `shown_at` NÃO é prova de leitura — documentado explicitamente no comentário original da migration (`20260822000000_add_feedback_responses.sql`): "records a technical delivery fact only... is NOT proof the representative read or noticed it." Qualquer "taxa de resposta" (`answered_at` / `shown_at`) mede entrega técnica no denominador, não atenção confirmada.
  - `cancellation` é o único context não-"uma vez na vida" — uma linha nova por evento de cancelamento (representante pode cancelar, responder, reativar, cancelar de novo, e responder de novo), diferente de `first_publication`/`value_perception`/`pmf`, que são resolvidos permanentemente (resposta OU dispensa conta como final).
Do not interpret as: `shown_at` como "usuário leu a pergunta" — ver §"Analytical Anti-Patterns".
```

**Taxa de resposta (derivada, por context):**

```
Formula: count(*) filter (where answered_at is not null or dismissed_at is not null) / count(*) filter (where shown_at is not null)
Numerator: respostas resolvidas (respondidas OU dispensadas)
Denominator: prompts entregues (shown_at not null) — NÃO "prompts lidos", ver Known limitations acima.
```

---

### KPI 15 — Cancellation Reasons

```
Name: Cancellation Reasons
Business question: Por que os representantes estão cancelando?
Definition: Distribuição de `feedback_responses.response` para `context = 'cancellation'` e `answered_at is not null`, usando o vocabulário de 9 categorias listado em KPI 14.
Formula: select response, count(*) from feedback_responses where context = 'cancellation' and answered_at is not null group by response order by count(*) desc
Numerator: Not applicable
Denominator: Not applicable
Source tables: feedback_responses
Filters: context = 'cancellation', answered_at is not null
Time semantics: Lifetime/cumulative por padrão, recortável por `created_at`.
Dimensions: response (9 valores do vocabulário de cancelamento).
Known limitations: **Cobre apenas cancelamentos feitos pelo fluxo do app** — a linha de feedback só nasce dentro de `confirm_own_subscription_cancellation()` (mesma limitação de KPI 12/11, D4). Um cancelamento feito diretamente no gateway nunca gera esta pergunta, então nunca aparece nesta distribuição. Mesmo status de D4: não bloqueia o piloto, é follow-up P1 aprovado.
Do not interpret as: a totalidade dos motivos de todo cancelamento real — só dos cancelamentos capturados pelo fluxo instrumentado.
```

---

## 5. Official Funnel / Value Model

```
Representante cadastrado (KPI 1)
        │
        ▼
Representante ativado (KPI 2)
        │
        ▼
Página recebe tráfego (KPI 5/6)
        │
        ▼
┌───────────────────────────────┐
│      Resultado comercial       │
│         (KPI 9)                │
├────────────────┬───────────────┤
│ WhatsApp Click  │     Lead      │
│    (KPI 7)      │   (KPI 8)     │
│                 │               │
│   PARALELOS — não sequenciais, │
│   sem chave de correlação      │
│   individual entre os dois     │
└────────────────┴───────────────┘
        │
        ▼
Pagante (KPI 10)
        │
        ▼
Retido (KPI 13) / não-cancelado (KPI 12)
        │
        ▼
Feedback (KPI 14/15)
```

**Regra explícita, repetida da auditoria por ser o achado mais importante:**
WhatsApp Click e Lead **nunca** devem ser desenhados como
`Visita → WhatsApp → Lead`. A forma correta é a bifurcação acima —
qualquer material visual (incluindo um dashboard futuro) que desenhe uma
seta de "WhatsApp Click" para "Lead" está representando uma relação que
não existe no código.

---

## 6. Core Validation Analysis

A análise mais valiosa do Stage 1 — o eixo central desta especificação —
não é nenhum KPI isolado, é a comparação entre eles:

```
Recebeu resultado? (KPI 9)
      ↓
Virou pagante? (KPI 10/11)
      ↓
Continuou pagando? (KPI 12/13)
      ↓
Como avaliou o produto? (KPI 14/15)
```

O join que sustenta essa análise é estrutural e confiável:
`representative_id` é a chave compartilhada por `analytics_events`,
`leads`, `subscriptions` e `feedback_responses` — nenhuma FK impede montar
essa cadeia (confirmado em `docs/plans/MVP_ANALYTICS_AUDIT.md` §2/§6). O
que a análise herda são as ressalvas já documentadas de cada KPI que a
compõe (autovisita em resultado, ausência de `first_paid_at`/`canceled_at`
em pagamento/retenção — D5, deferred).

**Comparações conceituais que este eixo permite** (não implementadas, não
reduzidas a uma query complexa aqui — só estabelecidas como o formato
certo de pergunta):

```
Paid conversion among representatives with result
vs.
Paid conversion among representatives without result
```

— responde se o resultado comercial (KPI 9) realmente precede/acompanha a
decisão de pagar, ou se representantes pagam independente de estarem
recebendo sinal comercial.

```
Retention among representatives with result
vs.
Retention among representatives without result
```

— responde se representantes que recebem resultado comercial continuado
cancelam menos — a validação mais direta possível da hipótese central do
Stage 1 (§2).

Ambas as comparações são, estruturalmente, um `GROUP BY has_result` sobre
uma população de representantes já classificada por KPI 9, cruzada com
KPI 11/13 — nenhuma infraestrutura nova é necessária para calculá-las
quando o piloto tiver volume suficiente para o resultado ser
estatisticamente informativo (hoje, com poucos pagantes reais, qualquer
corte assim teria N pequeno demais para ser confiável — um limite de
amostra, não de instrumentação).

---

## 7. Time Windows

| Semântica | Uso | Exemplos neste documento |
|---|---|---|
| **Snapshot** | Estado agora, recalculado a cada consulta, sem acumular histórico | KPI 2(A), KPI 3, KPI 10, KPI 11 |
| **Period metric** | Contagem/taxa dentro de uma janela corrida declarada explicitamente (7d, 30d, mês) | KPI 1 (novos no período), KPI 5, KPI 6, KPI 7, KPI 8, KPI 12 |
| **Cohort metric** | Agrupado por um evento de origem (cadastro, publicação, saída de trial), medido N dias depois desse evento — nunca uma data corrida fixa | 7-Day Activation (`PILOT_METRICS.md` §1), "Resultado em 30 dias" (`PILOT_METRICS.md` §2 — ancorado em `published_at`), Retenção D30/D60 (KPI 13), Founding Cohort Conversion |
| **Lifetime metric** | Acumulado desde sempre, nunca decresce | KPI 1 (total), KPI 2(B), KPI 14/15 (distribuição cumulativa por padrão) |

**Janelas já padronizadas no produto/documentos existentes, reutilizadas
aqui sem reinvenção:**

- `7` e `30` dias — o único par aceito pelo read port real do produto
  (`AnalyticsPeriodDays = 7 | 30`, `src/modules/analytics/domain/analytics-metrics-repository.ts:14`),
  usado por KPI 5/6/7/8/9 quando exibidos em `/app/paginas`.
- `≤7 dias desde o cadastro` — 7-Day Activation (`PILOT_SUCCESS_THRESHOLDS_PLAN.md`).
- `≤30 dias desde a publicação` — "Resultado" (`PILOT_METRICS.md` §2), a
  base do KPI 9 no formato já aprovado pelo piloto.
- `D30`/`D60` — Retenção (KPI 13), desde a saída de `trialing`.

**Regra explícita:** nunca comparar um número snapshot com um period
metric como se fossem a mesma coisa — ex.: "Páginas publicadas agora"
(snapshot, KPI 3) não deve ser somado ou dividido diretamente por
"WhatsApp clicks nos últimos 30 dias" (period metric, KPI 7) sem que a
mistura de semânticas temporais seja explícita no rótulo do número
resultante.

---

## 8. Metric Caveats (consolidado)

| Ressalva | KPIs afetados | Fonte |
|---|---|---|
| Autovisita do representante não é excluída em `visit`/`whatsapp_click` | 5, 6, 7, 9, 13 | `MVP_ANALYTICS_AUDIT.md` §7 |
| Reload conta como nova visualização (sem sessão/visitante único) | 5, 6 | `MVP_ANALYTICS_AUDIT.md` §4/§7 |
| Filtro de bot é denylist incompleta por design | 5, 7 | `20260811000000_add_analytics_write_functions.sql` |
| `leads` sem deduplicação por pessoa | 8, 9 | `MVP_ANALYTICS_AUDIT.md` §7 |
| `provider='manual'` pode inflar "pagantes"/MRR se não filtrado | 10, 11, MRR | `MVP_ANALYTICS_AUDIT.md` §6 P1-3 |
| `shown_at` não prova leitura | 14 | comentário original de `20260822000000_add_feedback_responses.sql` |
| Sem timestamp dedicado de conversão/cancelamento (`updated_at` sobrescrito a cada transição) | 11, 12, 13 | `PILOT_METRICS.md` §5, `MVP_ANALYTICS_AUDIT.md` §6 P1-5 |
| Cancelamento fora do fluxo do app não é reconhecido por `apply_billing_event()` | 12, 13, 15 | `MVP_ANALYTICS_AUDIT.md` §6 P1-6 |
| Fixtures de teste já contaminaram contagens no projeto de teste | 1, 2, 3, 7 (via `whatsapp_click`), 8, 10 | `AUDIT_MVP_LAUNCH.md` Achado 1 |

---

## 9. Analytical Anti-Patterns

### Proibido: `leads / whatsapp_clicks` como "CTA → Lead Conversion"

**Motivo:** `whatsapp_click` e `lead` são superfícies independentes
(botão de WhatsApp vs. formulário de contato), sem chave individual de
correlação (nenhum `session_id`/`visit_id` compartilhado). Esta razão
não mede conversão de estágio nenhum — só compara dois totais
independentes. Ver KPI 8/9 e §5.

### Proibido: chamar `count(analytics_events where event_type='visit')` de "Unique Visitors"

**Motivo:** sem sessão/cookie/identificador persistente de visitante,
cada linha é um carregamento de página, não uma pessoa. O nome correto é
"Page Views" (KPI 5).

### Proibido: usar `subscriptions.status='active'` como "pagantes" sem considerar `provider`

**Motivo:** `provider='manual'` representa ativações sem cobrança real
comprovada (fixtures, ativações legadas manuais) — confirmado no código
(`amount_cents` nullable, documentadamente sem valor real para essas
linhas). Ver KPI 10.

### Proibido: interpretar `feedback_responses.shown_at` como "usuário leu a pergunta"

**Motivo:** o próprio comentário da migration original declara
explicitamente que `shown_at` é só entrega técnica, nunca prova de
leitura/atenção. Ver KPI 14.

### Proibido: tratar `status = 'suspended'` como cancelamento

**Motivo:** `suspended` é enforcement automático de inadimplência (ou
reserva de checkout abandonada), uma ação do sistema — `canceled` é uma
decisão explícita do cliente via `/app/conta`. Confundir os dois
superestima cancelamento voluntário e esconde falha de cobrança
involuntária, que pedem ações de produto completamente diferentes. Ver
KPI 12.

### Proibido: contar `status='trialing'` como "trials ativos agora" sem checar `current_period_end`

**Motivo:** uma linha `trialing` cujo `current_period_end` já passou
permanece `'trialing'` para sempre no schema (nenhuma transição
automática para um estado "expirado") — o valor sozinho mistura trials em
andamento com trials abandonados há meses. Ver KPI 10.

### Proibido: somar `whatsapp_clicks + leads` como um único "total de intenção comercial"

**Motivo:** mesma razão do primeiro item desta lista — são ações de
natureza diferente, de superfícies diferentes; somar não produz um número
com significado de negócio único. Use KPI 9 (`has_result`, OR lógico
sobre representantes) quando a pergunta for "quantos representantes
tiveram algum sinal", não uma soma de eventos.

### Proibido: tratar `representatives.status='suspended'` uniformemente como "não é mais representante"

**Motivo:** o mesmo valor cobre tanto suspensão temporária por
inadimplência quanto eliminação permanente por pedido LGPD (PII
redigido). Sem uma coluna que distinga os dois casos, qualquer leitura
binária ("suspenso = fora da base") está potencialmente escondendo, ou
incluindo incorretamente, pedidos de eliminação. Ver KPI 1.

### Proibido: usar `subscriptions.updated_at` como se fosse "data de conversão" ou "data de cancelamento" estável

**Motivo:** é sobrescrito a cada transição de status — uma linha com
histórico de idas e vindas (suspensão → reativação, por exemplo) perde
qualquer relação entre `updated_at` e o evento original de conversão ou
cancelamento. Ver KPI 11/12/13.

### Proibido: tratar crescimento de Page Views (KPI 5) sem quebra por representante como evidência de validação do produto

**Motivo:** o número agregado pode estar concentrado em 1-2 representantes
(ou em autovisitas de um só) e esconder que a maioria da base não tem
tráfego nenhum — a mesma razão que KPI 6 (Representatives With Traffic)
existe como um KPI separado do total bruto.

### Proibido: tratar MRR isoladamente como o sinal principal de validação do Stage 1

**Motivo:** com uma base pequena (piloto de até 30 vagas fundadoras), MRR
sozinho tem baixo poder informativo sobre se o mecanismo de valor do
produto está funcionando — um único representante pagante já move o
número de forma desproporcional. Ver §"MRR" abaixo.

### Proibido: usar login/DAU/MAU como proxy de retenção ou validação

**Motivo:** `docs/ROADMAP.md` § *Success Criteria* já rejeita
explicitamente "daily usage" como critério do Stage 1 — o produto é
desenhado para funcionar sem o representante logar (a página trabalha
sozinha). Adotar frequência de login como sinal de saúde contradiz a
própria tese do produto documentada no roadmap.

---

## 10. Metabase Readiness

Sem configurar Metabase — só classificando quais KPIs já podem virar um
card hoje, e quais precisam de uma ressalva escrita junto (nunca omitida).

| KPI | Status |
|---|---|
| 1. Registered Representatives | `READY_WITH_CAVEAT` — fixtures/suspended (D3, deferred) seguem sem tratamento por query própria |
| 2. Activated Representative / Activation Rate | `READY` — D1 fechou a definição (Lifetime); só a ressalva de fixtures (KPI 1) permanece |
| 3. Published Pages | `READY` |
| 4. Product/Template Adoption | `READY` |
| 5. Page Views | `READY_WITH_CAVEAT` — rótulo do card deve deixar claro que não é "visitantes únicos" |
| 6. Representatives With Traffic | `READY_WITH_CAVEAT` — janela precisa ser declarada explicitamente no card |
| 7. WhatsApp Clicks / WhatsApp Conversion Rate | `READY_WITH_CAVEAT` — ressalva de best-effort/autovisita |
| 8. Leads / Lead Conversion Rate | `READY_WITH_CAVEAT` — ressalva de deduplicação |
| 9. Representative With Result / Result Rate | `READY` — D2 fechou a fórmula, o denominador e a janela (ancorada em `published_at`); Traffic-to-Result Rate é diagnóstica, `READY_WITH_CAVEAT` para esse uso específico |
| 10. Paid Customer | `READY_WITH_CAVEAT` — filtro `provider='asaas'` é fácil de esquecer; recomenda-se um card/view nomeado explicitamente "Paid Customer (asaas only)" para não ser reescrito sem o filtro no futuro |
| 11. Paid Conversion Rate (geral) | `READY_WITH_CAVEAT` — secundária por decisão (D6); sem coorte por data de conversão precisa (D5, deferred) |
| 11b. Founding Cohort Conversion | `READY` — headline oficial do Stage 1 (D6); thresholds já existem em `PILOT_SUCCESS_THRESHOLDS_PLAN.md` |
| 12. Cancellations | `READY_WITH_CAVEAT` — cobertura só do fluxo do app (D4, follow-up P1 aprovado) |
| 13. Churn (Retention Snapshot D30/D60) | `READY_WITH_CAVEAT` — oficial do Stage 1 (D7); já implementada no runbook, com a ressalva de `updated_at` |
| 13b. Period Churn Rate | `NOT_READY` — deferred por decisão (D7), e sem histórico de status por data, não calculável com precisão hoje mesmo se fosse priorizada |
| 14. Feedback Distribution by Context | `READY` |
| 15. Cancellation Reasons | `READY_WITH_CAVEAT` — cobertura só do fluxo do app (D4, follow-up P1 aprovado) |
| MRR | `READY_WITH_CAVEAT` tecnicamente calculável (com filtro `provider='asaas'`), mas ver §"MRR" — não deve headline nenhum dashboard de validação sozinho |

---

## MRR

MRR é especificado aqui como métrica financeira **secundária**, nunca
como KPI principal de validação nesta fase — com uma base pequena (até 30
vagas fundadoras no piloto), MRR isolado diz pouco sobre se o mecanismo
de valor do produto está funcionando (um único representante pagante
move o número desproporcionalmente); é a razão explícita já registrada no
`docs/ROADMAP.md` § *Success Criteria* para não fixar metas numéricas
prematuras.

```
Formula: sum(amount_cents) / 100.0 from subscriptions where status = 'active' and provider = 'asaas'
Numerator: Not applicable
Denominator: Not applicable
Source tables: subscriptions
Filters: status = 'active', provider = 'asaas' — OBRIGATÓRIOS os dois, pela mesma razão de KPI 10: uma linha `provider='manual'` com `amount_cents` acidentalmente preenchido infla o número sem cobrança real por trás.
Time semantics: Snapshot.
Dimensions: Not applicable hoje (moeda única BRL, meio de pagamento único credit_card).
Known limitations: Herdadas de KPI 10 — a mesma ressalva de `provider='manual'`.
Do not interpret as: sinal isolado suficiente para decidir se o Stage 1 validou sua hipótese — sempre reportar junto de Paid Conversion Rate (KPI 11) e Result Rate (KPI 9), nunca sozinho.
```

---

## Non-Primary Metrics

Registrado explicitamente, por instrução desta tarefa — estes dados podem
existir ou ser úteis operacionalmente, mas **não devem ser tratados como
KPIs principais do Stage 1**, nem dominar a leitura da pergunta central
(§2):

- Logins e frequência de login (`login_attempts` existe só para rate
  limit de segurança, não é uma fonte de métrica de produto).
- Sessões/tempo dentro do painel `/app` — não instrumentado, e mesmo se
  fosse, contradiria a rejeição explícita de "daily usage" do
  `docs/ROADMAP.md` § *Success Criteria*.
- Quantidade bruta de eventos em `analytics_events` sem quebra por
  representante (ver anti-pattern correspondente em §9).
- Cliques administrativos (dentro de `/app`, não na página pública).
- Páginas abertas pelo próprio representante (a prévia privada não gera
  evento nenhum, por design — mas mesmo que gerasse, não seria um sinal
  de valor comercial).
- MRR isolado, sem os KPIs de resultado/conversão ao lado — ver §"MRR".
- Total de page views sem distribuição por representante — um agregado
  único pode esconder concentração extrema em poucos representantes.
- **`Daily Active Users`/`Monthly Active Users`**, citados como parte do
  catálogo genérico de "Product KPIs" em `docs/ROADMAP.md` (linha
  841-843) — esse catálogo é explicitamente rotulado no próprio documento
  como aspiracional ("Listing one here does not mean it is measured
  today"), e DAU/MAU especificamente contradiz a rejeição de "daily
  usage" já registrada na mesma página para o Stage 1.

---

## 11. Product Owner Decisions

Todas as sete decisões levantadas na versão anterior deste documento foram
resolvidas por Pedro em 2026-08-14 (D1–D7 abaixo). **Nenhuma decisão
permanece genuinamente aberta.** Quatro foram aprovadas para valer já
(D1, D2, D4, D6); três foram deliberadamente adiadas para depois do
Stage 1 (D3, D5, D7) — "deferred" aqui significa uma escolha consciente de
não gastar esse custo agora, não uma pendência esquecida. As limitações
técnicas que cada decisão toca continuam registradas como Known
limitations no KPI correspondente; esta seção só registra a decisão em
si, com a data.

### D1 — Activated Representative (KPI 2)

**APPROVED (2026-08-14).** Lifetime: já publicou pelo menos uma página uma
vez. Ver KPI 2 para a fórmula oficial e o raciocínio (consistente com
`hasPublishedAtLeastOnce()`, já usado pelo próprio código para SET-61).

### D2 — Result Rate (KPI 9)

**APPROVED (2026-08-14).**
`representantes_com_resultado / representantes_ativados` é a fórmula
oficial. Resultado = `>=1 WhatsApp click OR >=1 Lead`. O Stage 1 deve
preferir uma janela relativa à primeira publicação (cohort, ancorada em
`published_at`), não uma janela corrida fixa. Traffic-to-Result Rate
(sobre `representantes_com_trafego`) é diagnóstica, nunca headline.

### D3 — Status dedicado para eliminação LGPD (KPI 1)

**DEFERRED.** Não alterar `representatives.status`/schema durante o
Stage 1. `status='suspended'` continua cobrindo os dois casos
(suspensão por inadimplência e eliminação LGPD) pelo tempo do piloto —
ver Known limitations de KPI 1.

### D4 — Cancelamento nativo do Asaas (KPI 12/13/15)

**APPROVED AS P1 FOLLOW-UP.** Não bloqueia o primeiro cliente pagante do
piloto, mas `apply_billing_event()` reconhecer um evento de cancelamento
vindo diretamente do Asaas deve ser resolvido antes de KPI 12/13/15
(churn/billing) serem considerados completamente confiáveis — já
priorizado como trabalho futuro, não uma limitação aceita indefinidamente.

### D5 — Timestamp dedicado de conversão para pago (KPI 10/11/13)

**DEFERRED.** Nenhuma coluna nova implementada durante o Stage 1. Nome
oficial preferido para quando essa coluna for adicionada:
**`first_paid_at`** — substitui qualquer referência anterior a
`activated_at` neste documento.

### D6 — Métrica headline de conversão paga (KPI 11)

**APPROVED (2026-08-14).** Founding Cohort Conversion
(`docs/plans/PILOT_SUCCESS_THRESHOLDS_PLAN.md` §2, já com thresholds
aprovados) é a métrica headline durante o Stage 1. Paid Conversion Rate
geral (`pagantes/cadastrados`, KPI 11) permanece secundária — útil para
leitura de longo prazo, nunca "o" número num relatório resumido do
piloto.

### D7 — Period Churn Rate (KPI 13)

**DEFERRED.** Usar Retention Snapshot D30/D60
(`docs/runbooks/PILOT_METRICS.md` §5) como definição oficial de
churn/retenção durante todo o Stage 1. Period Churn Rate (fórmula
clássica de SaaS, numerador/denominador por período) só é implementada
quando houver necessidade analítica real — o volume atual do piloto não
justifica o investimento, e a limitação técnica (sem histórico de status
por data) permanece registrada em KPI 13.

---

## Resumo para o terminal/chat

```
VERDICT: KPI_SPEC_APPROVED (D3/D5/D7 deliberadamente deferred — ver §11)

OFFICIAL STAGE 1 KPIs:
1. Registered Representatives
2. Activated Representative / Activation Rate
3. Published Pages
4. Product/Template Adoption
5. Page Views
6. Representatives With Traffic
7. WhatsApp Clicks / WhatsApp Conversion Rate
8. Leads / Lead Conversion Rate
9. Representative With Result / Result Rate
10. Paid Customer
11. Paid Conversion Rate (+ Founding Cohort Conversion, já aprovada)
12. Cancellations
13. Churn (Retention Snapshot D30/D60)
14. Feedback Distribution by Context
15. Cancellation Reasons
(secundária: MRR)

KEY DEFINITIONS:
Activated Representative = pelo menos uma product_activations.status IN
  ('published','unpublished') [D1 — Lifetime, OFICIAL]
Representative With Result = >=1 whatsapp_click OR >=1 lead na janela
  ancorada em published_at [D2 — OFICIAL, OR lógico, nunca sequencial]
Paid Customer = subscriptions.status='active' AND subscriptions.provider='asaas'
  (provider é o filtro obrigatório que faltava nas queries existentes)
Paid Conversion headline = Founding Cohort Conversion, pagantes/30 vagas
  [D6 — OFICIAL]; Paid Conversion Rate geral permanece secundária
Churn/retenção oficial do Stage 1 = Retention Snapshot D30/D60 [D7]

DECISIONS LOG (D1–D7, todas fechadas por Pedro em 2026-08-14):
D1 APPROVED — Activated Representative = Lifetime
D2 APPROVED — Result Rate = com_resultado/ativados; janela ancorada em
   published_at; Traffic-to-Result é diagnóstica, nunca headline
D3 DEFERRED — sem status dedicado para eliminação LGPD durante o Stage 1
D4 APPROVED AS P1 FOLLOW-UP — cancelamento nativo do Asaas, não bloqueia
   o primeiro cliente, mas precisa fechar antes de churn ser 100% confiável
D5 DEFERRED — sem coluna de timestamp de conversão agora; nome futuro
   preferido: first_paid_at
D6 APPROVED — Founding Cohort Conversion é a métrica headline de
   conversão paga do Stage 1
D7 DEFERRED — usar D30/D60 no Stage 1; Period Churn Rate só quando houver
   necessidade analítica real

ANALYTICAL ANTI-PATTERNS:
leads/whatsapp_clicks como funil; visits como "Unique Visitors";
status='active' sem filtrar provider; shown_at como leitura confirmada;
status='suspended' como cancelamento; status='trialing' sem checar
current_period_end; somar whatsapp_clicks+leads; suspended tratado
uniformemente como "fora da base"; updated_at como data de conversão/
cancelamento estável; page views sem quebra por representante; MRR isolado
como sinal principal; login/DAU/MAU como proxy de retenção.

DOCUMENT CREATED:
docs/plans/STAGE_1_KPI_SPECIFICATION.md
```
