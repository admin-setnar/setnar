Status: Proposed — investigativo, aguardando leitura do Product Owner
Authority: Non-normative (ver `docs/plans/README.md`)
Code baseline: `0ecc74a`, branch `main`, working tree com `.agents/`, `.claude/skills/`, `skills-lock.json` não rastreados (nenhum deles toca schema/instrumentação — irrelevantes para esta auditoria)
Last reviewed: 2026-08-14
Superseded by: —

# MVP_ANALYTICS_AUDIT.md

> Auditoria de instrumentação e KPIs da fase de validação do MVP (Stage 1,
> `ROADMAP.md`). **Documento exclusivamente investigativo** — nenhuma
> migration, componente, evento, tabela, view ou configuração foi criado,
> alterado ou proposto como código nesta auditoria. Onde uma lacuna é
> real, ela é documentada e uma correção futura é esboçada em prosa — nunca
> implementada aqui.
>
> **Pergunta central que este documento tenta responder:** hoje conseguimos
> confiar nos dados para saber se os representantes estão recebendo valor
> comercial suficiente do SETNAR para justificar continuar pagando?
>
> **Método:** leitura direta do código-fonte (`src/modules/analytics`,
> `leads`, `feedback`, `billing`, `representatives`), das migrations em
> `supabase/migrations/` (schema, RLS, funções `SECURITY DEFINER`), e dos
> documentos normativos/planos já existentes (`docs/DOMAIN_MODEL.md`,
> `docs/plans/QR_ANALYTICS_PLAN.md`, `docs/plans/PILOT_SUCCESS_THRESHOLDS_PLAN.md`,
> `docs/runbooks/PILOT_METRICS.md`, `docs/plans/DATA_RETENTION_DECISIONS_PLAN.md`,
> `docs/plans/BILLING_DECISIONS_PLAN.md`, `docs/adr/ADR-082`, `docs/adr/ADR-087`,
> `docs/runbooks/LGPD_RIGHTS.md`, `docs/plans/AUDIT_MVP_LAUNCH.md`). Nenhuma query
> foi executada contra um banco Supabase real nesta auditoria — as
> referências a dados reais (contagens, achados de ensaio) vêm de ensaios já
> registrados nesses documentos, com suas próprias datas, citadas como tal.
>
> **Achado mais importante, adiantado aqui porque molda a leitura do resto
> do documento:** este produto já tem, para o estágio em que está, uma base
> de instrumentação incomumente disciplinada — RLS consistente, salts
> segregados por domínio, funções `SECURITY DEFINER` com grants auditados
> (ADR-048), e uma trilha de decisões escrita (`QR_ANALYTICS_PLAN.md`,
> `PILOT_SUCCESS_THRESHOLDS_PLAN.md`, `PILOT_METRICS.md`) que já resolveu boa
> parte do que esta auditoria foi pedida para verificar. O trabalho real
> desta auditoria não foi descobrir que nada existe — foi verificar se o que
> a documentação alega bate com o código, e caçar as lacunas que nenhum
> desses documentos já registrou. A mais séria dessas lacunas está na §7.

---

## 1. Executive Summary

**Veredito: `PARTIALLY_READY_FOR_MVP_ANALYTICS`**

Os dados brutos para os 15 KPIs pedidos existem no schema e são, no nível
de linha, corretos e isolados (RLS por representante, hashes de IP
segregados por domínio de uso, deduplicação de webhook, `feedback_responses`
com timestamps de três estados). As contagens simples — representantes,
páginas ativas, leads, pagantes, respostas de feedback — são calculáveis
hoje, com ressalvas pontuais e conhecidas (fixtures de teste, `provider =
'manual'`, o significado sobrecarregado de `representatives.status =
'suspended'`).

O que impede o veredito `READY` é estrutural, não um bug isolado:

1. **"Clique no WhatsApp" e "Lead" não são um funil — são dois eventos
   paralelos e não correlacionáveis**, produzidos por duas superfícies
   diferentes da mesma página (§7). O modelo mental que `DOMAIN_MODEL.md`
   §15.2 descreve (visita → clique → lead) não corresponde a como o código
   realmente captura esses dois eventos. Qualquer KPI de "conversão CTA →
   lead" (KPI 8) calculado como `leads / whatsapp_clicks` está comparando
   dois numeradores de fontes diferentes de intenção comercial, não dois
   estágios do mesmo funil.
2. **Visualizações de página não distinguem tráfego real de
   autovisita do próprio representante** — a página pública não verifica
   sessão nem exclui o dono da página (§7). A prévia privada
   (`/pre-visualizacao`) está corretamente isolada e não contamina; o
   problema é o representante acessando sua própria URL pública.
3. **Não existe uma coluna de "data de conversão para pago"** —
   `subscriptions.updated_at` é sobrescrito a cada transição de status, o
   que o próprio `docs/runbooks/PILOT_METRICS.md` §5 já documenta como uma
   limitação conhecida da consulta de retenção D30/D60. Isso não impede
   calcular retenção hoje, mas torna qualquer coorte por data de conversão
   real (KPI 10) uma aproximação, não um número exato.

Nenhum desses três pontos é P0 no sentido de "impede medir a hipótese
central" — cada KPI individual (leads, pagantes, feedback) continua
calculável e majoritariamente confiável isoladamente. O que fica
comprometido é a **leitura combinada** ("visualização → intenção →
pagamento") que o roteiro de KPIs pede explicitamente nas seções 3, 4, 8 e
13. Por isso o veredito é `PARTIALLY_READY`, não `NOT_READY`: a pergunta
central ("representantes pagantes estão recebendo resultado comercial?")
já é respondível hoje via leads e via cliques de WhatsApp *separadamente*;
não é respondível via um único funil consolidado sem que alguém leia esta
ressalva antes de montar o dashboard.

---

## 2. Data Model Encontrado

Verificado direto no schema (`supabase/migrations/`) e nos módulos de
aplicação, não inferido do `DOMAIN_MODEL.md` — onde os dois divergem, o
código é a fonte usada aqui.

```
auth.users (Supabase Auth)
   │  trigger handle_new_user() — 20260728000000
   ▼
profiles (1:1 com auth.users; sempre criado no signup)
   │  register_representative() — chamada explícita e SEPARADA do signup;
   │  um profile pode existir SEM nunca virar representative
   ▼
representatives (profile_id UNIQUE; company_id fixo = 'igreen' hoje;
                  status: 'active' | 'suspended' — só dois valores)
   │
   ├── product_activations (representative_id, product_id; UNIQUE no par;
   │     status: 'draft' | 'published' | 'unpublished')
   │        │
   │        ├── analytics_events (representative_id NOT NULL, product_id
   │        │     NOT NULL, event_type: 'visit' | 'whatsapp_click';
   │        │     FK composta contra (representative_id, product_id) de
   │        │     product_activations — 20260817000000)
   │        │
   │        └── leads (representative_id NOT NULL, product_id NULLABLE;
   │              telefone_e164, campos jsonb — SEM relação com
   │              analytics_events; ver §7)
   │
   ├── subscriptions (representative_id UNIQUE — uma linha reaproveitada
   │     por toda a vida da assinatura, inclusive trial; status: 'trialing'
   │     | 'active' | 'past_due' (não usado) | 'suspended' | 'canceled';
   │     provider: 'trial' | 'manual' | 'asaas')
   │        │
   │        └── billing_events (log append-only, dedup por
   │              asaas_event_id; alcançável só por apply_billing_event())
   │
   └── feedback_responses (representative_id NOT NULL; context:
         'first_publication' | 'value_perception' | 'cancellation' | 'pmf';
         shown_at / answered_at / dismissed_at)

companies (1 linha: iGreen Energy, slug 'igreen')
   └── products (7 linhas seedadas: conexao-green, conexao-club,
         conexao-livre, conexao-placas, conexao-solar, green-seguros,
         telecom — catálogo fixo, sem status de ciclo de vida modelado)
```

Diferenças relevantes em relação ao diagrama do `DOMAIN_MODEL.md`
(`auth.users → profiles → representatives ├ pages ├ analytics ├ leads ├
subscriptions └ feedback`), todas confirmadas no código:

- **Não existe uma tabela `commercial_pages`.** Uma Commercial Page é o par
  `(representative, product)` já com `product_activations.status =
  'published'` — ADR-029. `analytics_events`/`leads` referenciam
  `representative_id` + `product_id` diretamente, nunca um id de página.
- **`profile → representative` não é automático.** `handle_new_user()`
  cria o `profile` na hora do signup; `representatives` só nasce quando
  `register_representative()` roda (uma ação separada, pós-onboarding).
  Um usuário pode ter conta (`auth.users` + `profiles`) e nunca virar
  representante — ver KPI 1 na matriz abaixo.
- **`leads` não tem relação nenhuma com `analytics_events`.** Não há coluna
  compartilhada (nem `session_id`, nem `visit_id`, nem qualquer chave que
  ligue um evento `whatsapp_click` a uma linha de `leads`) — ver §7.
- **`subscriptions` não tem uma FK para `analytics_events`/`leads`.** A
  única ligação possível entre "resultado comercial" e "assinatura" é via
  `representative_id`, compartilhado pelas três tabelas — suficiente para
  join, mas cada join precisa ser feito por quem escreve a query, não existe
  view nem RPC que já materialize essa junção.

---

## 3. KPI Readiness Matrix

| KPI | Calculável hoje? | Confiabilidade | Fonte | Problemas |
|---|---|---|---|---|
| 1. Representantes cadastrados | **Sim** | Alta, com ressalva | `representatives`, `profiles`, `auth.users` | `representatives.status IN ('active','suspended')` conflate suspensão temporária e eliminação LGPD (redação de PII, `LGPD_RIGHTS.md` §7). Fixtures de teste já contaminaram a contagem no projeto de teste (`AUDIT_MVP_LAUNCH.md` Achado 1: 18 linhas órfãs encontradas em 2026-08-14) — sem convenção de nome/flag para filtrá-las. |
| 2. Representantes ativos no produto | **Parcial** | Média | `product_activations`, `analytics_events`, `leads` | Não existe UMA definição de "ativo" no schema — só sinais que podem compor definições diferentes (tem página publicada / recebeu visita / recebeu clique / recebeu lead). Ver §5 e §9. |
| 3. Páginas ativas por representante | **Sim** | Alta | `product_activations.status = 'published'` | Nenhum — `published_at` existe, `unique(representative_id, product_id)` garante que "página ativa" e "ativação publicada" são a mesma coisa hoje (sem tabela `commercial_pages` separada, ADR-029). |
| 4. Templates/páginas mais usados | **Sim** | Alta | `product_activations.product_id` → `products.slug` | Nenhum — `product_id`/`products.slug` é a dimensão natural e única candidata; catálogo fixo de 7 produtos. |
| 5. Visualizações das páginas | **Sim, com contaminação conhecida** | Média | `analytics_events` (`event_type='visit'`) | Sem exclusão de autovisita do representante (§7); reload conta como nova visita; sem visitante único; filtro de bot é denylist de substring, deliberadamente incompleto. |
| 6. Cliques comerciais / CTA | **Sim, com contaminação menor** | Média-Alta | `analytics_events` (`event_type='whatsapp_click'`) | Mesma ausência de exclusão de autovisita (menos provável de ocorrer em volume que visitas); best-effort (`keepalive`, sem `preventDefault` — clique pode não ser contado se a aba fechar antes do beacon). |
| 7. Leads gerados | **Sim** | Alta | `leads` | Sem deduplicação por telefone/pessoa — reenvio duplo do formulário cria duas linhas (§7). `product_id` nullable no schema mas sempre preenchido na prática (nenhuma superfície de captura hoje permite nulo). |
| 8. Conversão página → CTA / página → lead | **Parcial** | Baixa para "funil", Alta para as duas taxas isoladas | `analytics_events`, `leads` | `whatsapp_click` e `leads` são eventos paralelos, não sequenciais (§7) — "CTA → lead" não é uma conversão real, é uma correlação não comprovável. `leads/page_views` e `whatsapp_clicks/page_views` são calculáveis e válidas isoladamente. |
| 9. Clientes pagantes | **Sim, com ressalva** | Média-Alta | `subscriptions.status`, `provider` | `status = 'active'` sozinho não distingue pagamento real de linha `provider = 'manual'` (fixture/ativação manual sem cobrança real) — a query já existente em `PILOT_METRICS.md` §3 não filtra por `provider`. `status = 'trialing'` inclui trials expirados nunca convertidos (sem estado "trial_expired" — `is_subscription_active()` reavalia `current_period_end` ao vivo, mas o valor armazenado em `status` não muda sozinho). |
| 10. Conversão para pagante | **Sim, aproximado** | Média | `subscriptions.status`, `representatives.created_at` | Sem coluna de "data da primeira cobrança"/"data de conversão" — só `updated_at`, sobrescrito a cada transição (`PILOT_METRICS.md` §5 já documenta isso para retenção; a mesma limitação vale para coorte de conversão). |
| 11. Cancelamentos e churn | **Sim, com ressalva de cobertura** | Média-Alta | `subscriptions.status = 'canceled'`, `current_period_end` | Cancelamento só é registrado se passar por `confirm_own_subscription_cancellation()` (fluxo do app); um cancelamento feito diretamente no Asaas não tem evento tratado por `apply_billing_event()` (só `CHECKOUT_PAID`/`PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED`/`PAYMENT_OVERDUE` são reconhecidos) — pode ficar invisível até uma falha de pagamento gerar `PAYMENT_OVERDUE`, ou nunca. Sem `canceled_at` dedicado (mesma limitação de KPI 10). |
| 12. Resultado comercial por representante (7/30d/desde cadastro) | **Parcial** | Alta para 7/30d, calculável mas não exposta para "desde o cadastro" | `analytics_events`, `leads` | O único read port do produto (`AnalyticsMetricsRepository.listOwnSummaryByProduct`) só aceita `7 \| 30` dias (tipo `AnalyticsPeriodDays`) — "desde o cadastro" não tem UI nem port, mas é uma query SQL direta trivial (ver §8). Purga de retenção (12 meses `analytics_events`, 24 meses `leads`, `DATA_RETENTION_DECISIONS_PLAN.md`) eventualmente apaga o dado que uma janela "desde o cadastro" precisaria, para representantes com mais de 12/24 meses de conta — não um problema agora (piloto novo), mas uma bomba-relógio conhecida. |
| 13. Resultado comercial × retenção | **Sim, estruturalmente** | Alta para o join, herda as ressalvas de 5/6/8/10/11 | `representative_id` compartilhado por `analytics_events`, `leads`, `subscriptions`, `feedback_responses` | Nenhuma FK impede o join; `representative_id` é a chave em todas as quatro tabelas. O join em si é confiável — a interpretação do resultado herda todas as ressalvas já listadas para os KPIs que o compõem. |
| 14. Microfeedback | **Sim** | Alta | `feedback_responses` | Vocabulário de resposta é validado só dentro de `resolve_feedback()` (não há CHECK de coluna, por design — `context` determina o vocabulário válido); `shown_at` documentadamente NÃO prova leitura, só entrega técnica (comentário na própria migration). |
| 15. Motivos de cancelamento | **Sim** | Alta | `feedback_responses` (`context = 'cancellation'`) | Só existe para cancelamentos feitos pelo fluxo do app (mesma ressalva do KPI 11) — um cancelamento fora desse fluxo nunca gera a linha de feedback correspondente. |

---

## 4. Event Inventory

### `visit`

- **Onde nasce:** `record_page_visit()` (`supabase/migrations/20260811000000_add_analytics_write_functions.sql`, reescrita em `20260817000000_secure_analytics_and_public_access.sql`).
- **Chamado de:** `src/app/[productSlug]/page.tsx:87-100`, dentro de `after()` (roda depois da resposta já ter sido enviada ao visitante — nunca bloqueia/atrasa a renderização real).
- **Quando dispara:** todo carregamento (SSR) da página pública `<slug>.setnar.com/<produto>`, incluindo `generateMetadata` sendo chamado separadamente (mas cacheado via `cache()` em `resolve-commercial-page-activation.ts`, então não duplica a resolução — só a chamada de `after()` do corpo da página conta como visita).
- **Payload:** `representative_id`, `product_id` (resolvidos server-side por slug, nunca aceitos do cliente), `event_type='visit'`, `referrer` (truncado a 2048 chars, nunca rejeitado), `ip_hash` (`sha256(ANALYTICS_IP_SALT:ip)`, salt próprio — nunca reaproveita o salt de login/lead), `created_at`.
- **`representative_id`:** presente, `NOT NULL`, resolvido a partir do `Host` header (subdomínio) — nunca confiável a partir de input do cliente.
- **Identificador de página/template:** `product_id` (`NOT NULL`) — a Commercial Page é o par `(representative_id, product_id)`.
- **Timestamp:** `created_at`, `default now()`.
- **Duplicação:** cada reload gera uma nova linha (sem `visit_id`/sessão). Rate limit de 60 tentativas/60s por `ip_hash` reduz spam de script, não deduplica navegação legítima repetida.
- **Observações:** filtro de bot é uma denylist de substring no User-Agent (`bot`, `crawler`, `spider`, `facebookexternalhit`, `whatsapp`, `curl`, `python-requests`, `headlesschrome`), deliberadamente incompleto (documentado como "redução de ruído", não controle de segurança). **Sem exclusão de autovisita do representante** — a rota pública não verifica sessão/autenticação; se o próprio representante abrir sua página publicada num navegador comum (fora da prévia privada), o evento é indistinguível de um visitante real. Preview (`/pre-visualizacao/[productSlug]/page.tsx`) **não** chama esta função — corretamente isolada.

### `whatsapp_click`

- **Onde nasce:** `record_whatsapp_click()`, mesma migration/reescrita de `record_page_visit`.
- **Chamado de:** `POST /api/track-click` (`src/app/api/track-click/route.ts`), acionado por `onClick` em `whatsapp-cta.tsx:86` e `floating-whatsapp.tsx:32` — `fetch(..., { keepalive: true })`, sem `preventDefault`.
- **Quando dispara:** clique num dos dois CTAs de WhatsApp da página pública. A rota re-resolve a ativação pelo `Host` da requisição — se o `Host` não corresponder a um subdomínio de representante válido (caso da prévia privada, que roda em path no domínio principal), a resolução falha e nada é gravado.
- **Payload:** igual ao de `visit`, com `event_type='whatsapp_click'`.
- **`representative_id`:** presente, resolvido pelo mesmo mecanismo de `Host`.
- **Identificador de página/template:** `product_id`, resolvido do corpo da requisição (`productSlug`) + `Host`, nunca confiado como id direto.
- **Timestamp:** `created_at`.
- **Duplicação:** rate limit de 5/3600s por `ip_hash` (mesmo par usado por `submit_lead`). Best-effort: se a aba fechar antes do `fetch` completar, o clique não é contado — imprecisão aceita, documentada no próprio código.
- **Observações:** **não cria uma linha em `leads`** — ver §7, este é o achado mais importante desta auditoria.

### Lead capture (`leads`, via `submit_lead`)

- **Onde nasce:** `submit_lead()` (`20260731000000` → `20260801000000` → `20260802000000` → `20260820000000` → `20260821000000`, última forma consolidada).
- **Chamado de:** `POST /api/leads` (`src/app/api/leads/route.ts`), acionado pelo `CommercialLeadForm` (`commercial-lead-form.tsx`) — um formulário próprio (nome, telefone, cidade, e-mail), visualmente separado do botão de WhatsApp na mesma página.
- **Quando dispara:** submissão do formulário de contato pelo visitante. Tem honeypot (`LEAD_HONEYPOT_FIELD`) — se preenchido, a rota responde como se tivesse sucedido, sem nunca chamar `submit_lead`.
- **Payload:** `representative_id`, `product_id` (resolvidos por `Host`+slug), `telefone_e164`, `campos` (jsonb: nome/cidade/email), `origem`, `referrer`, `created_at`. `ip_hash` usado só para rate limit, não persistido na linha de `leads`.
- **`representative_id`:** presente, `NOT NULL`.
- **Identificador de página/template:** `product_id`, nullable no schema mas sempre preenchido na prática — nenhuma superfície de captura hoje envia nulo.
- **Timestamp:** `created_at`. Sem `updated_at` — linha imutável desde o insert (confirmado no comentário da migration de retenção, `20260904000000`).
- **Duplicação:** **sem deduplicação** por telefone/pessoa — reenvio (double-click, erro de rede seguido de retry manual) cria uma segunda linha completa. Rate limit de 5 tentativas/3600s por IP reduz spam, não impede um humano genuíno de enviar duas vezes.
- **Observações:** desabilitado explicitamente na prévia privada (`leadFormDisabled` prop, `dispatch-commercial-page.tsx` → `commercial-lead-form.tsx`'s `disabled`) — mesmo que não estivesse, a resolução por `Host` falharia lá de qualquer forma (mesmo mecanismo do `whatsapp_click`).

### Microfeedback (`feedback_responses`)

- **Onde nasce:** `record_feedback_shown()` / `resolve_feedback()` (`20260822000000_add_feedback_responses.sql`, estendida por `20260902000000_add_cancellation_feedback_event.sql`).
- **Chamado de:** `src/modules/feedback/presentation/actions.ts` + componentes que decidem elegibilidade (`resolve-first-publication-eligibility.ts`, `resolve-value-perception-eligibility.ts`, `resolve-cancellation-feedback-eligibility.ts`).
- **Quando dispara — quatro contexts, três gatilhos distintos:**
  - `first_publication`: elegível assim que houver ≥1 ativação `published`/`unpublished` (já publicou uma vez) e a linha ainda não estiver resolvida.
  - `value_perception`: elegível 14 dias corridos após a primeira publicação **E** pelo menos um evento `visit` real já ter acontecido (`ValuePerceptionSignals.hasVisitEvent`) — sem visita, fica inelegível indefinidamente (decisão de produto explícita, não um adiamento).
  - `cancellation`: a linha nasce **na mesma transação** que `confirm_own_subscription_cancellation()` grava `status='canceled'` — não depende do componente montar no navegador para existir; `shown_at` só é preenchido quando o prompt realmente aparece.
  - `pmf`: contexto reservado (vocabulário de resposta já existe em `resolve_feedback`), sem elegibilidade implementada nos arquivos de `presentation/` lidos — não encontrado gatilho de apresentação no código, só a validação de resposta no banco.
- **Payload:** `representative_id`, `context`, `response` (vocabulário por context, validado dentro de `resolve_feedback`), `response_detail` (até 140 chars), `shown_at`/`answered_at`/`dismissed_at`.
- **Timestamp:** três timestamps independentes, não um status único — ver comentário original da migration para a semântica exata de cada um.
- **Duplicação:** `record_feedback_shown` reusa a linha mais recente para `(representative_id, context)` em vez de duplicar — exceto `cancellation`, que é por evento (uma linha nova a cada cancelamento real, nunca reusada entre eventos).
- **Observações:** `shown_at` não é prova de leitura, só de entrega técnica — documentado explicitamente no comentário da migration original; relevante para qualquer leitura de "taxa de resposta" que use `shown_at` como denominador.

### Billing webhook events (`billing_events`, interno)

- **Onde nasce:** `apply_billing_event()` (`20260827000000_add_billing_webhook_events.sql`).
- **Chamado de:** rota de webhook do Asaas (fora do escopo direto dos 15 KPIs, mas é a fonte de verdade por trás de KPI 9/10/11).
- **Quando dispara:** evento recebido do gateway de pagamento (`CHECKOUT_PAID`, `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE` são os únicos que produzem uma transição de `subscriptions`; qualquer outro tipo reconhecido é gravado com `outcome='ignored'`).
- **Payload:** `asaas_event_id` (chave de deduplicação, `UNIQUE`), `event_type`, `subscription_id`, `outcome` (`applied`/`duplicate`/`ignored`/`unmatched`), `payload` jsonb (evento cru, minimizado conforme ADR-085/SET-71).
- **Duplicação:** ativamente prevenida — `asaas_event_id UNIQUE`, tentativa de insert duplicado retorna `outcome='duplicate'` sem tocar `subscriptions` de novo.
- **Observações:** não cobre cancelamento feito diretamente no gateway (fora do fluxo `confirm_own_subscription_cancellation`) — ver KPI 11.

---

## 5. Funnel Readiness

```
Representante cadastrado
        │  RELIABLE — register_representative() é atômico com a criação
        │  da linha de subscriptions (trialing); representative_id é a
        │  chave presente em toda tabela downstream.
        ▼
Página ativa
        │  RELIABLE — product_activations.status='published' é a única
        │  definição de "página ativa" no schema, sem tabela paralela
        │  para divergir. set_activation_status() usa o mesmo bloqueador
        │  (private.page_publication_blocker) que a leitura pública usa.
        ▼
Página recebe visualização
        │  PARTIAL — o evento existe e referencia representative_id/
        │  product_id corretamente, mas não distingue autovisita do
        │  representante de tráfego real (§7), e reload=nova visita.
        ▼
Visitante executa CTA (clique WhatsApp)
        │  PARTIAL — evento existe, mesma ausência de exclusão de
        │  autovisita; best-effort (pode subcontar cliques reais).
        ▼
Lead
        │  NOT_INSTRUMENTED como transição — não existe elo entre um
        │  evento whatsapp_click e uma linha de leads. São duas
        │  superfícies paralelas e independentes na mesma página (§7).
        │  "Lead Attribution Service" do DOMAIN_MODEL.md §12 está
        │  explicitamente listado como não-existente ("does not exist").
        ▼
Representante se torna pagante
        │  PARTIAL — calculável via subscriptions.status, mas sem
        │  timestamp dedicado de conversão (só updated_at, sobrescrito
        │  a cada transição — mesma limitação que PILOT_METRICS.md §5
        │  já documenta para retenção).
        ▼
Representante permanece pagante
        │  PARTIAL — is_subscription_active() já resolve a semântica de
        │  graça/trial ao vivo, correta e testada; o que falta é cobertura
        │  de cancelamento fora do fluxo do app (Asaas direto) — ver KPI 11.
```

---

## 6. Gaps Encontrados

### P0 — impede medir hipótese central do MVP

**Nenhum.** Cada elo do funil tem pelo menos uma leitura confiável isolada
(§3); o que está comprometido é a leitura combinada, não a capacidade de
responder "representantes estão gerando/recebendo resultado?" usando leads
e cliques de WhatsApp como sinais independentes (que é, de fato, como
`docs/plans/PILOT_SUCCESS_THRESHOLDS_PLAN.md` §2 já define "Resultado": "≥1
lead OU ≥1 clique WhatsApp" — a métrica de sucesso já aprovada pelo Pedro
trata os dois como sinais alternativos, não como estágios de um funil. Isso
é coerente com o achado da §7, não contraditório a ele).

### P1 — não impede validação, mas compromete fortemente a qualidade dos dados

1. **`whatsapp_click` e `leads` são eventos paralelos, sem chave de junção**
   (§7). Qualquer dashboard que apresente "conversão CTA → lead" como um
   funil sequencial estará mostrando um número sem base real. **Impacto:**
   KPI 8. **Correção possível:** documentar explicitamente (não
   implementar) que as duas métricas são alternativas, nunca sequenciais —
   ou, se o produto decidir que quer um funil de verdade, instrumentar um
   identificador de sessão/visita compartilhado entre os três eventos
   (visita, clique, lead), o que é uma mudança de schema real, não trivial.
2. **Sem exclusão de autovisita do representante em `visit`/`whatsapp_click`**
   na página pública (§7). **Impacto:** KPI 5, KPI 6, e por extensão KPI 8/12/13.
   **Correção possível:** nenhuma hoje é barata — a página pública é
   deliberadamente anônima/sem sessão (é assim que um visitante real a vê).
   Uma abordagem seria o representante acessar sua própria página só pela
   prévia privada por convenção de produto (não impõe no código), ou around
   isso, uma exclusão por cookie/flag quando o representante estiver
   autenticado no mesmo navegador — ambas são mudanças de produto, não
   documentadas nem decididas hoje.
3. **`subscriptions.status = 'active'` não distingue pagamento real de
   `provider = 'manual'`** (linhas ativadas manualmente/fixtures — o
   comentário da migration `20260823000000` confirma que essas linhas já
   existem: "linhas manuais existentes (passo 17 do supabase/README.md)").
   `docs/runbooks/PILOT_METRICS.md` §3/§4 (conversão paga, MRR) não filtram
   por `provider` — se qualquer linha `manual` estiver com `status='active'`
   hoje, ela infla "pagantes" e "MRR" sem representar uma cobrança real.
   **Impacto:** KPI 9, KPI 10. **Correção possível:** adicionar `and
   provider = 'asaas'` às duas queries do runbook — é uma correção de
   consulta, não de schema.
4. **`representatives.status = 'suspended'` sobrecarrega dois significados
   opostos**: suspensão temporária (assinatura inadimplente,
   `Subscription Enforcement`) e eliminação permanente por pedido LGPD
   (`LGPD_RIGHTS.md` §7 — a "eliminação" real é `status='suspended'` + PII
   redigido com sentinelas como `REDACTED_PHONE_SENTINEL`). **Impacto:**
   KPI 1 (total de representantes), KPI 9 (representante eliminado nunca
   deveria contar como "cadastrado" para taxas futuras). **Correção
   possível:** a única forma de diferenciar hoje é inspecionar se
   `phone`/`display_name` contém os sentinelas de redação conhecidos — uma
   heurística frágil, não uma coluna. Um valor de status dedicado
   (`'suspended'` vs. `'eliminated'`) resolveria isso, mas é uma mudança de
   schema, fora do escopo desta auditoria.
5. **Sem coluna de "data de conversão para pago" nem "data de
   cancelamento"** — apenas `subscriptions.updated_at`, sobrescrito em toda
   transição de status. `PILOT_METRICS.md` §5 já documenta essa limitação
   para retenção D30/D60 ("mede 'estável há N dias', não 'convertida há N
   dias'"); a mesma limitação se aplica a qualquer coorte de conversão
   (KPI 10) ou a uma análise de "tempo até cancelar" (KPI 11) que não seja
   feita via a linha de `feedback_responses(context='cancellation')`
   (que tem seu próprio `created_at`, coincidente com o cancelamento real,
   mas só existe para cancelamentos feitos pelo fluxo do app — ver #6).
6. **Cancelamento só é capturado de forma confiável se passar pelo fluxo do
   app.** `apply_billing_event()` só reconhece
   `CHECKOUT_PAID`/`PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED`/`PAYMENT_OVERDUE`
   — não há tratamento de um evento de cancelamento vindo do Asaas
   diretamente. Se um cliente cancelar direto no gateway (fora de
   `/app/conta`), a linha em `subscriptions` não transiciona para
   `'canceled'` automaticamente; ela ficaria `'active'` indefinidamente até
   uma eventual falha de cobrança gerar `PAYMENT_OVERDUE` (→ `'suspended'`,
   não `'canceled'`) — ou nunca, se o Asaas simplesmente parar de cobrar.
   **Impacto:** KPI 11 (churn pode estar subcontado), KPI 15 (motivo de
   cancelamento nunca é perguntado nesse caminho, porque
   `confirm_own_subscription_cancellation()` nunca roda).
7. **Contaminação por fixtures de teste é um risco operacional real, não
   hipotético.** `docs/plans/AUDIT_MVP_LAUNCH.md` (Achado 1, 2026-08-14) já
   registrou 18 representantes órfãos de fixture encontrados no projeto de
   teste; `docs/runbooks/PILOT_METRICS.md` §8 registra que "o representante
   retornado por qualquer consulta que filtre `product_activations.status =
   'published'` hoje é sempre o fixture das suítes de integração." Nenhuma
   convenção de nome/flag existe para filtrar fixtures de dados reais em
   produção. **Impacto:** todo KPI de contagem (1, 2, 3, 7, 9), se as
   mesmas suítes de teste algum dia rodarem contra o projeto de produção
   por engano (risco já mitigado operacionalmente, não estruturalmente —
   nada no schema impede tecnicamente).

### P2 — melhoria desejável, não necessária para o piloto

8. **Purga de retenção (`analytics_events` 12 meses, `leads` 24 meses,**
   `20260904000000_add_retention_purge_job.sql`) eventualmente torna
   "resultado desde o cadastro" (KPI 12) incompleto para representantes com
   mais de 12/24 meses de conta. Não afeta o piloto atual (poucos meses de
   idade), mas é uma limitação estrutural conhecida para qualquer análise
   de longo prazo futura.
9. **Nenhum read port do produto aceita janela "desde o cadastro"** — só
   `AnalyticsPeriodDays = 7 | 30` (`analytics-metrics-repository.ts:14`).
   Calculável via SQL direta (§8), mas não exposto hoje em nenhuma tela.
10. **`profiles` sem `representative` associado (onboarding incompleto)**
    não tem uma view/query pronta — calculável via `profiles LEFT JOIN
    representatives ... WHERE representatives.id IS NULL`, mas ninguém
    documentou essa consulta antes desta auditoria.
11. **`pmf` context não tem gatilho de elegibilidade encontrado** nos
    arquivos de `presentation/` lidos (só a validação de resposta existe no
    banco) — se o produto pretende usá-lo, falta a peça de apresentação; se
    não pretende (reservado para o futuro), não é um gap, é esperado.

---

## 7. Dados potencialmente enganosos

Esta é a seção mais importante para quem for montar um dashboard a partir
deste documento — cada item aqui é um número que **parece** pronto para
uso, mas exige uma ressalva antes de virar uma decisão.

### "Clique no WhatsApp" e "Lead" não são estágios do mesmo funil

A leitura mais natural de `docs/DOMAIN_MODEL.md` §15.2 ("Visitor → Lead →
Conversion", `WhatsAppClickRecorded` "Triggers Lead Attribution Service")
sugere que um clique em WhatsApp *se torna* um Lead. **Isso não acontece no
código.** São duas superfícies de UI diferentes na mesma Commercial Page:

- O botão/CTA de WhatsApp (`whatsapp-cta.tsx`, `floating-whatsapp.tsx`) abre
  `wa.me` diretamente e dispara `record_whatsapp_click` — grava em
  `analytics_events`, evento agregado, sem nome/telefone/e-mail do
  visitante.
- O formulário de contato (`commercial-lead-form.tsx`) captura
  nome/telefone/cidade/e-mail e grava em `leads` via `submit_lead` — uma
  ação completamente separada, que o mesmo visitante pode nunca realizar
  mesmo depois de clicar no WhatsApp (e vice-versa).

Não existe nenhuma chave compartilhada entre um evento
`whatsapp_click` e uma linha de `leads` — nem `session_id`, nem `visit_id`,
nem qualquer correlação temporal confiável (dois visitantes diferentes
podem clicar/preencher em qualquer ordem, no mesmo minuto, na mesma
página). **Consequência:** somar `whatsapp_clicks + leads` como "total de
intenção comercial" conta ações de naturezas diferentes como se fossem
comparáveis; calcular "`leads / whatsapp_clicks`" como taxa de conversão
não mede uma conversão real — só a razão entre dois totais independentes.
As duas métricas continuam válidas **cada uma isoladamente** (KPI 6 e KPI 7
são calculáveis e confiáveis); é a leitura combinada como funil (KPI 8) que
está errada se apresentada sem esta ressalva.

### Page views incluem a autovisita do próprio representante

A rota pública (`src/app/[productSlug]/page.tsx`) não verifica sessão nem
identidade do visitante — por design, é assim que qualquer visitante real a
vê. Isso significa que **nada distingue um representante checando sua
própria página publicada (fora da prévia privada) de um cliente em
potencial real.** A prévia privada (`/pre-visualizacao`) está corretamente
isolada (roda em outro path, não dispara `record_page_visit`, e mesmo o
clique de WhatsApp lá falha ao resolver `Host` — não contamina nada). O
problema é especificamente o representante acessando a URL pública de
verdade. **Consequência:** "visualizações" (KPI 5) pode estar inflado por
autovisitas, principalmente logo após a publicação (quando é mais provável
que o representante confira a própria página do jeito que um visitante
veria) ou ao compartilhar o link para conferir como ficou.

### `status = 'active'` em `subscriptions` mistura pagamento real e ativação manual

Já registrado como gap P1 (#3) — repetido aqui porque é exatamente o tipo
de número que parece pronto (`count(*) where status='active'`) mas pode
estar contando linhas `provider='manual'` sem cobrança real por trás.

### `status = 'trialing'` inclui trials expirados nunca convertidos

`is_subscription_active()` reavalia `current_period_end` ao vivo — uma
linha `trialing` com `current_period_end` no passado **não** concede
entitlement, mas o valor armazenado em `status` continua literalmente
`'trialing'` para sempre até uma conversão real escrever `'active'`
(comentário em `subscription.ts:12-14`: "a linha permanece `trialing` para
sempre após a expiração"). **Consequência:** `count(*) where
status='trialing'` mistura trials genuinamente em andamento com trials já
expirados e abandonados — não é "quantos estão em trial agora", é "quantos
nunca converteram desde que o produto existe".

### `leads` conta submissões, não pessoas únicas

Sem deduplicação por telefone/e-mail — um duplo clique no botão de envio,
ou um retry manual depois de um erro de rede, cria uma segunda linha
completa em `leads`. **Consequência:** "leads totais" (KPI 7) é uma
contagem de eventos de submissão, não de prospects únicos — relevante se
alguém comparar esse número com, por exemplo, uma contagem de conversas de
WhatsApp reais.

### `shown_at` em `feedback_responses` não prova leitura

Já documentado explicitamente no comentário da própria migration
(`20260822000000`): "`shown_at` records a technical delivery fact only ...
it is NOT proof the representative read or noticed it." Relevante para
qualquer leitura de "taxa de resposta" (respostas / prompts mostrados) —
o denominador mede entrega técnica, não atenção real.

---

## 8. Queries conceituais

Sem criar migration, view ou arquivo SQL — apenas demonstrando viabilidade.
As de KPI 1/9/10/11/14 já existem, prontas, em
`docs/runbooks/PILOT_METRICS.md` (§1 Ativação, §3 Conversão paga, §4 MRR,
§5 Retenção D30/D60, §6 Feedback positivo) — não duplicadas aqui. As
seguintes cobrem KPIs não presentes nesse runbook.

### KPI 1 — Novos representantes por período

```sql
-- Conceitual apenas
select date_trunc('week', created_at) as semana, count(*) as novos_representantes
from representatives
group by 1
order by 1;
```

### KPI 1 — Onboarding incompleto (profile sem representative)

```sql
-- Conceitual apenas
select count(*) as profiles_sem_representative
from profiles p
left join representatives r on r.profile_id = p.id
where r.id is null;
```

### KPI 3 — Páginas ativas por representante (distribuição)

```sql
-- Conceitual apenas
select
  r.id as representative_id,
  count(*) filter (where pa.status = 'published') as paginas_ativas
from representatives r
left join product_activations pa on pa.representative_id = r.id
group by r.id;
-- representantes_sem_pagina_ativa: filtrar paginas_ativas = 0 no resultado acima.
```

### KPI 4 — Produtos/templates mais usados (adoção, não tráfego)

```sql
-- Conceitual apenas
select
  p.slug,
  count(distinct pa.representative_id) as representantes_usando,
  count(*) filter (where pa.status = 'published') as paginas_ativas
from product_activations pa
join products p on p.id = pa.product_id
group by p.slug
order by representantes_usando desc;
```

### KPI 6/8 — Cliques de WhatsApp e visualizações, por produto/período (isolados, não como funil)

```sql
-- Conceitual apenas — event_type='visit' e event_type='whatsapp_click' são
-- contados separadamente, nunca implicitamente ligados um ao outro.
select
  product_id,
  count(*) filter (where event_type = 'visit') as visualizacoes,
  count(*) filter (where event_type = 'whatsapp_click') as cliques_whatsapp
from analytics_events
where representative_id = :representative_id
  and created_at >= now() - interval '30 days'
group by product_id;
```

### KPI 7 — % de representantes com pelo menos 1 lead (desde o cadastro)

```sql
-- Conceitual apenas
select
  count(*) filter (where existe_lead) as com_pelo_menos_1_lead,
  count(*) as total_representantes,
  round(100.0 * count(*) filter (where existe_lead) / nullif(count(*), 0), 1) as pct
from (
  select r.id, exists (select 1 from leads l where l.representative_id = r.id) as existe_lead
  from representatives r
) t;
```

### KPI 12 — Resultado desde o cadastro (não exposto no produto, calculável direto)

```sql
-- Conceitual apenas — mesma forma de PILOT_METRICS.md §2, sem o corte de
-- 30 dias, usando o cadastro como início da janela em vez da publicação.
select
  count(*) filter (
    where exists (
      select 1 from leads l
      where l.representative_id = r.id and l.created_at >= r.created_at
    )
    or exists (
      select 1 from analytics_events e
      where e.representative_id = r.id and e.event_type = 'whatsapp_click' and e.created_at >= r.created_at
    )
  ) as com_resultado_desde_cadastro,
  count(*) as total
from representatives r;
```

### KPI 14 — Distribuição de respostas por context

```sql
-- Conceitual apenas
select context, response, count(*)
from feedback_responses
where answered_at is not null
group by context, response
order by context, count(*) desc;
```

### KPI 15 — Motivos de cancelamento

```sql
-- Conceitual apenas — vocabulário real de resolve_feedback() para
-- context='cancellation': not_generating_results, not_using_enough, price,
-- missing_feature, hard_to_configure, no_longer_need, technical_problem,
-- expected_something_else, other.
select response, count(*)
from feedback_responses
where context = 'cancellation' and answered_at is not null
group by response
order by count(*) desc;
```

---

## 9. Recomendações

Cada recomendação abaixo é uma proposta futura — nada foi implementado.

1. **Filtrar `provider = 'manual'` nas queries de pagantes/MRR já existentes**
   em `PILOT_METRICS.md` §3/§4. Problema: KPI 9/10 podem estar inflados.
   Impacto: baixo esforço, alta confiança recuperada. Urgência: antes do
   primeiro relatório real de conversão paga do piloto.
2. **Documentar (não implementar) que `whatsapp_click` e `leads` são sinais
   paralelos, não um funil**, em qualquer material que apresente KPI 8 —
   já é assim que `PILOT_SUCCESS_THRESHOLDS_PLAN.md` §2 define "Resultado"
   (OR, não sequência), mas nenhum documento afirma isso explicitamente
   como uma limitação de instrumentação. Urgência: antes de qualquer
   dashboard visual que desenhe um funil literal.
3. **Decidir, como decisão de produto (não implementar sem essa decisão),
   qual definição de "representante ativo" (KPI 2) o piloto vai usar** —
   este documento levanta as opções (página publicada / recebeu visita /
   recebeu clique / recebeu lead), mas não decide por não ser uma
   consequência técnica automática. Urgência: antes de reportar KPI 2 pela
   primeira vez.
4. **Adicionar uma coluna dedicada (ex.: `activated_at`) a `subscriptions`,
   gravada uma única vez na primeira transição para `'active'`** —
   resolveria KPI 10 e a limitação já documentada em `PILOT_METRICS.md` §5
   para KPI 11, sem sobrescrever a cada transição subsequente. Mudança de
   schema real; não decidida nem implementada aqui.
5. **Avaliar se `apply_billing_event()` precisa reconhecer um evento de
   cancelamento nativo do Asaas** (hoje só `CHECKOUT_PAID`/
   `PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED`/`PAYMENT_OVERDUE`), para que
   cancelamento fora do fluxo `/app/conta` não fique invisível. Impacto:
   KPI 11/15 podem estar subcontando churn. Urgência: média — depende de
   quão comum é o cliente cancelar direto no gateway em vez de usar o app.
6. **Diferenciar suspensão temporária de eliminação LGPD** em
   `representatives.status` (hoje ambas são `'suspended'`) — mudança de
   schema (novo valor de CHECK), não decidida aqui. Impacto: KPI 1/9
   ficam mais limpos. Urgência: baixa hoje (poucos pedidos de eliminação
   esperados no piloto), mas cresce com a base.
7. **Registrar, como convenção operacional (não código), como identificar e
   excluir fixtures de teste de qualquer consulta rodada contra produção** —
   já é um risco documentado (`AUDIT_MVP_LAUNCH.md` Achado 1), mas só no
   projeto de teste até agora. Urgência: antes de qualquer script/rotina
   que agregue KPIs 1/2/3/7/9 rodar contra o projeto de produção pela
   primeira vez.
8. **Quando o volume justificar (ver ADR-082, já registrado como gatilho
   futuro), considerar mover a agregação de analytics de leitura em JS
   para uma função `SECURITY DEFINER` com `group by` no Postgres** — não
   necessário hoje (`AnalyticsMetricsRepository` já é suficiente no volume
   atual), mas é a mudança natural se o piloto crescer.

---

## 10. Minimum Analytics Readiness

> Se começássemos o piloto com clientes reais hoje, quais KPIs
> conseguiríamos confiar?

**CONFIÁVEIS AGORA** (com as ressalvas pontuais já listadas em §3, nenhuma
delas bloqueante):

- KPI 1 — Representantes cadastrados (ressalva: fixtures de teste, status
  `suspended` sobrecarregado)
- KPI 3 — Páginas ativas por representante
- KPI 4 — Templates/páginas mais usados
- KPI 7 — Leads gerados, totais/por representante/por página/por período
  (ressalva: sem deduplicação de pessoa)
- KPI 9 — Clientes pagantes (ressalva: filtrar `provider != 'manual'`
  antes de reportar)
- KPI 14 — Microfeedback (ressalva: `shown_at` ≠ leitura confirmada)
- KPI 15 — Motivos de cancelamento (ressalva: só cobre cancelamentos feitos
  pelo fluxo do app)

**UTILIZÁVEIS COM RESSALVAS** (o número existe e é real, mas exige a
ressalva junto sempre que apresentado):

- KPI 2 — Representantes ativos (depende de qual definição de "ativo" for
  escolhida — nenhuma é a única certa)
- KPI 5 — Visualizações (contaminação por autovisita do representante)
- KPI 6 — Cliques comerciais (mesma contaminação, em menor grau; best-effort)
- KPI 8 — Conversão página → CTA / página → lead (as duas taxas isoladas
  são confiáveis; "CTA → lead" como funil sequencial não é)
- KPI 10 — Conversão para pagante (sem data de conversão dedicada, mas
  contável via status atual)
- KPI 11 — Cancelamentos/churn (contável para cancelamentos feitos no app;
  cancelamento direto no gateway pode não aparecer)
- KPI 12 — Resultado por representante em 7/30 dias (exposto no produto,
  confiável); "desde o cadastro" (calculável via SQL direto, não exposto,
  e sujeito à purga de retenção em horizontes longos)
- KPI 13 — Resultado × retenção (o join por `representative_id` é sólido;
  a interpretação herda todas as ressalvas de 5/6/8/10/11 acima)

**NÃO CONFIÁVEIS / NÃO MENSURÁVEIS:**

- Nenhum dos 15 KPIs pedidos está totalmente não mensurável hoje — todos
  têm pelo menos uma leitura utilizável, mesmo que precise de ressalva.

---

## Resumo para o terminal/chat

```
VERDICT: PARTIALLY_READY

P0 GAPS:
Nenhum.

P1 GAPS:
1. whatsapp_click e leads são eventos paralelos sem chave de junção — não
   formam um funil real (afeta KPI 8).
2. Sem exclusão de autovisita do representante em visit/whatsapp_click na
   página pública (afeta KPI 5/6/8/12/13).
3. subscriptions.status='active' não filtra provider='manual' nas queries
   já existentes de PILOT_METRICS.md (afeta KPI 9/10).
4. representatives.status='suspended' sobrecarrega suspensão temporária e
   eliminação LGPD (afeta KPI 1/9).
5. Sem coluna de data de conversão/cancelamento dedicada — só updated_at,
   sobrescrito a cada transição (afeta KPI 10/11).
6. Cancelamento fora do fluxo do app (direto no Asaas) não é reconhecido
   por apply_billing_event() (afeta KPI 11/15).
7. Contaminação por fixtures de teste já documentada como risco real em
   AUDIT_MVP_LAUNCH.md (afeta KPI 1/2/3/7/9 se ocorrer em produção).

KPIs CONFIÁVEIS HOJE:
1 (cadastrados), 3 (páginas ativas), 4 (templates), 7 (leads), 9 (pagantes,
com filtro de provider), 14 (microfeedback), 15 (motivos de cancelamento).

KPIs UTILIZÁVEIS COM RESSALVA:
2 (ativos — definição em aberto), 5 (visualizações — autovisita), 6
(cliques — autovisita menor), 8 (conversão — não é funil real), 10
(conversão paga — sem data dedicada), 11 (churn — cobertura parcial), 12
(resultado — janela do produto é só 7/30d), 13 (resultado × retenção —
herda as ressalvas acima).

DOCUMENTO CRIADO:
docs/plans/MVP_ANALYTICS_AUDIT.md
```
