# Runbook — Métricas Operacionais do Piloto

**SET-50.** Documentação operacional, não normativa — não decide os
thresholds em si (isso é `docs/plans/PILOT_SUCCESS_THRESHOLDS_PLAN.md`,
SET-49), só como lê-los. Mesmo contrato de `BILLING_OPERATIONS.md` (SET-35):
consultas para colar no SQL Editor do Supabase, sem dashboard, sem script,
sem job — coerente com "sem sistema de roles/admin"
(`docs/plans/SPRINT_E_PLAN.md` §2.4) e com o escopo do SET-50 ("sem cohorts,
funis configuráveis, BI ou exportação sofisticada").

> **SET-116 (2026-09-01) — coletor canônico substitui o processo ad hoc.**
> `docs/plans/AUDIT_STAGE_1_KPI_HISTORICAL_INTEGRITY_2026-09-01.md` (R2/R9)
> apontou que nenhum snapshot histórico de KPI produzido pelo processo
> abaixo tinha query/versão/timestamp de execução registrados — o snapshot
> era a única prova, e não era reproduzível de forma independente.
> `npm run kpis:collect` (`scripts/collect-stage-1-kpis.ts`) é agora a forma
> canônica de coletar os KPIs oficiais do Stage 1 (`STAGE_1_KPI_SPECIFICATION.md`):
> read-only por construção (GET puro contra a REST API, nunca escreve),
> grava um JSON (e opcionalmente um Markdown) versionado com
> `collected_at`/`spec_version` (SHA do `STAGE_1_KPI_SPECIFICATION.md`)/
> `collector_version` (SHA do HEAD)/`environment` junto de cada número.
> **As consultas manuais abaixo permanecem como referência histórica e
> como roteiro para os KPIs que o coletor ainda não cobre** (nenhuma foi
> apagada) — mas a coleta oficial, a partir de agora, é `npm run
> kpis:collect`, não mais copiar/colar SQL no SQL Editor.

**Pré-requisito:** acesso ao SQL Editor do projeto Supabase (mesmo requisito
de `BILLING_OPERATIONS.md`). Todas as consultas abaixo leem `subscriptions`,
`billing_events`-adjacentes e tabelas com RLS restrito a `service_role`
(`BILLING_OPERATIONS.md` §1) — não rodam como `anon`/`authenticated`.

---

## 1. Ativação

**Fórmula:** representantes com página publicada em até 7 dias do cadastro / total cadastrado.
**Fonte:** `representatives.created_at`, `product_activations.published_at`.

```sql
select
  count(distinct r.id) filter (
    where exists (
      select 1 from product_activations pa
      where pa.representative_id = r.id
        and pa.published_at is not null
        and pa.published_at <= r.created_at + interval '7 days'
    )
  ) as ativados_em_7_dias,
  count(distinct r.id) as total_cadastrado,
  round(
    100.0 * count(distinct r.id) filter (
      where exists (
        select 1 from product_activations pa
        where pa.representative_id = r.id
          and pa.published_at is not null
          and pa.published_at <= r.created_at + interval '7 days'
      )
    ) / nullif(count(distinct r.id), 0),
    1
  ) as pct_ativacao
from representatives r;
```

**Limitação de atribuição:** um representante pode ter mais de uma linha em
`product_activations` (hoje só há um produto — iGreen — então isso não ocorre
na prática, mas a query já usa `exists`/`distinct` para não contar em dobro
se um segundo produto existir no futuro).

---

## 2. Resultado em 30 dias

**Fórmula:** dos ativados, quantos geraram ≥1 lead OU ≥1 clique de WhatsApp em até 30 dias da publicação.
**Fonte:** `product_activations.published_at`, `leads.created_at`, `analytics_events` (`event_type = 'whatsapp_click'`).

```sql
with ativados as (
  select distinct r.id as representative_id, pa.published_at
  from representatives r
  join product_activations pa on pa.representative_id = r.id
  where pa.published_at is not null
)
select
  count(*) as total_ativados,
  count(*) filter (
    where exists (
      select 1 from leads l
      where l.representative_id = a.representative_id
        and l.created_at between a.published_at and a.published_at + interval '30 days'
    )
    or exists (
      select 1 from analytics_events e
      where e.representative_id = a.representative_id
        and e.event_type = 'whatsapp_click'
        and e.created_at between a.published_at and a.published_at + interval '30 days'
    )
  ) as com_resultado,
  round(
    100.0 * count(*) filter (
      where exists (
        select 1 from leads l
        where l.representative_id = a.representative_id
          and l.created_at between a.published_at and a.published_at + interval '30 days'
      )
      or exists (
        select 1 from analytics_events e
        where e.representative_id = a.representative_id
          and e.event_type = 'whatsapp_click'
          and e.created_at between a.published_at and a.published_at + interval '30 days'
      )
    ) / nullif(count(*), 0),
    1
  ) as pct_resultado
from ativados a;
```

**Limitação de atribuição:** visitas (`event_type = 'visit'`) não contam como
"resultado" de propósito — só lead ou clique de WhatsApp, que são a evidência
de intenção real do visitante, coerente com a distinção que `ROADMAP.md`
Stage 1 já faz entre atividade e resultado.

---

## 3. Conversão paga

**Fórmula:** assinaturas com `status = 'active'` sobre as 30 vagas do preço de lançamento.
**Fonte:** `subscriptions.status` (`BILLING_DECISIONS_PLAN.md` §4.4 para as 30 vagas).

```sql
select
  count(*) filter (where status = 'active') as pagantes_ativos,
  30 as vagas_totais,
  round(100.0 * count(*) filter (where status = 'active') / 30.0, 1) as pct_conversao
from subscriptions;
```

**Limitação de atribuição:** `trialing` não conta como conversão — é
exatamente a distinção que este número existe para capturar (quem converteu
de fato, não quem só começou o trial). Ver `BILLING_OPERATIONS.md` §2 para o
funil trial → pago completo, por representante.

---

## 4. MRR

**Fórmula:** soma das mensalidades de assinaturas `active`.
**Fonte:** `subscriptions.amount_cents`, `subscriptions.status`.

```sql
select
  count(*) filter (where status = 'active') as assinantes_ativos,
  coalesce(sum(amount_cents) filter (where status = 'active'), 0) / 100.0 as mrr_reais
from subscriptions;
```

---

## 5. Retenção D30 e D60

**Fórmula:** dos assinantes que converteram (saíram de `trialing`) há pelo
menos N dias, qual fração segue `active` hoje.
**Fonte:** `subscriptions.status`, `subscriptions.updated_at`.

**Limitação de atribuição — leia antes de usar:** não existe coluna dedicada
de "data da primeira cobrança"; `updated_at` é a data da **última** mudança
de status, mesma limitação que `BILLING_OPERATIONS.md` §2 já documenta para
o funil trial→pago. Para uma assinatura que nunca teve um segundo evento
depois de sair de `trialing`, `updated_at` = data da conversão (o caso comum
neste piloto). Para uma que teve idas e vindas (ex.: `suspended` e depois
reativada), `updated_at` reflete o evento mais recente, não a conversão
original — o número fica conservador (mede "estável há N dias", não
"convertida há N dias"), nunca otimista.

```sql
-- D30
select
  count(*) filter (where status <> 'trialing' and updated_at <= now() - interval '30 days') as elegiveis_d30,
  count(*) filter (where status = 'active' and updated_at <= now() - interval '30 days') as retidos_d30,
  round(
    100.0 * count(*) filter (where status = 'active' and updated_at <= now() - interval '30 days')
    / nullif(count(*) filter (where status <> 'trialing' and updated_at <= now() - interval '30 days'), 0),
    1
  ) as pct_retencao_d30
from subscriptions;

-- D60 (mesma lógica, janela de 60 dias)
select
  count(*) filter (where status <> 'trialing' and updated_at <= now() - interval '60 days') as elegiveis_d60,
  count(*) filter (where status = 'active' and updated_at <= now() - interval '60 days') as retidos_d60,
  round(
    100.0 * count(*) filter (where status = 'active' and updated_at <= now() - interval '60 days')
    / nullif(count(*) filter (where status <> 'trialing' and updated_at <= now() - interval '60 days'), 0),
    1
  ) as pct_retencao_d60
from subscriptions;
```

---

## 6. Feedback positivo (SET-62)

**Fórmula:** respostas `'yes'` sobre o total de respostas de `value_perception`.
**Fonte:** `feedback_responses.context = 'value_perception'`, `feedback_responses.response`.

```sql
select
  count(*) filter (where response = 'yes') as positivas,
  count(*) filter (where answered_at is not null) as total_respondidas,
  round(
    100.0 * count(*) filter (where response = 'yes')
    / nullif(count(*) filter (where answered_at is not null), 0),
    1
  ) as pct_positivo
from feedback_responses
where context = 'value_perception';
```

**Limitação de atribuição:** `'partly'` (Em parte) não conta como positivo —
só `'yes'` (Sim) resolve a pergunta sem abrir o campo de detalhe opcional
(`value-perception-feedback-options.ts`), o que já sinaliza que é a única
resposta inequivocamente positiva.

---

## 7. Duplicação por retry/webhook — por que não é um risco aqui

Nenhuma das consultas acima soma eventos brutos de um jeito que um retry
duplicaria:

- **Ativação/Resultado/Retenção** contam **representantes/assinaturas
  distintos** (`count(distinct ...)`, `exists`), não linhas de evento — um
  clique de WhatsApp duplicado por um duplo-clique do visitante não muda o
  `exists`.
- **Conversão/MRR** leem `subscriptions.status`/`amount_cents` diretamente —
  estado atual, não uma soma de eventos. A deduplicação de `billing_events`
  por `asaas_event_id` (ADR-075) já garante que o estado de `subscriptions`
  em si não duplica.
- **Feedback** conta linhas de `feedback_responses`, uma por prompt
  respondido (`resolve_feedback` não insere duas vezes para o mesmo prompt,
  mesma lógica de `isValuePerceptionFeedbackEligible`/SET-62).

---

## 8. Ensaio manual registrado

| Data | Consulta | Onde | Resultado |
|---|---|---|---|
| 2026-08-12 | §1 Ativação — consulta completa contra dado real | Banco conectado (40 representantes, 1 `product_activations` publicado) | `ativados_em_7_dias = 1`, `total_cadastrado = 40`, `pct_ativacao = 2.5` — rodou sem erro; número baixo é esperado (piloto não iniciado, só o representante de fixture das próprias suítes de integração está publicado). |
| 2026-08-12 | §2 Resultado — caso positivo: lead descartável inserido dentro da janela de 30 dias do único `published_at` real, depois removido | Banco conectado, fixture descartável (criada e removida na mesma rodada) | Com o lead dentro da janela, o `exists` do representante retornou `true`, como esperado. Consulta completa: `total_ativados = 1`, `com_resultado = 1`. |
| 2026-08-12 | §2 Resultado — caso negativo (**não validado, achado registrado abaixo**) | Banco conectado | Ao isolar só um lead **fora** da janela de 30 dias, o `exists` retornou `true` mesmo assim — não é bug da query: o único representante com `product_activations.status = 'published'` neste projeto é o **fixture reutilizado pelas próprias suítes de integração** (`lead-submission-integration-test`/`-concurrency-test`, `tests/`), que grava leads reais com `created_at` de hoje toda vez que `npm run test` roda. Não há hoje um representante publicado "limpo" para isolar o caso negativo. A lógica do `exists`/janela foi revisada manualmente e está correta; o caso negativo fica como risco aceito até existir um representante publicado dedicado a este ensaio (ou até o piloto real gerar um representante ativado sem lead nenhum). |
| 2026-08-12 | §3–§6 Conversão/MRR/Retenção D30/D60/Feedback positivo | Banco conectado, dado real (2 `subscriptions` em `trialing`, 0 `feedback_responses` de `value_perception` no momento do ensaio) | Todas rodaram sem erro: `pct_conversao = 0.0` (0/30, nenhuma assinatura saiu de `trialing` ainda), `mrr_reais = 0.00`, `elegiveis_d30 = elegiveis_d60 = 0` (nenhuma assinatura fora de `trialing` ainda, então nada é elegível), `positivas = total_respondidas = 0`. Números baixos são esperados — piloto ainda não iniciado; o ensaio valida que a SQL roda e agrega corretamente, não o resultado de negócio. |

**Achado incidental deste ensaio:** o representante retornado por qualquer
consulta que filtre `product_activations.status = 'published'` hoje é
sempre o fixture das suítes de integração, não um representante real do
piloto — mesma situação que `retention-purge.integration.test.ts` já
depende via `findPublishedActivation`. Isso não afeta a correção das
consultas acima (que operam sobre todo o conjunto, não sobre esse
representante especificamente), só limita quão isolado um ensaio manual
consegue ser enquanto o piloto real não tem representantes publicados.

Repita este ensaio (com fixtures novas e descartáveis) sempre que uma das
consultas acima mudar.
