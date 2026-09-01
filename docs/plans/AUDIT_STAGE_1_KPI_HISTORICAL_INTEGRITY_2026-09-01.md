Status: Investigation complete — READ-ONLY, no remediation implemented. Uma implementação mínima (marcos lifetime + coletor canônico de KPIs) foi entregue depois desta investigação, escopo priorizado conforme R1/R3/R4/R9 — ver o addendum no final deste documento.
Authority: Non-normative (ver `docs/plans/README.md`)
Investigation date: 2026-09-01
Investigator: Claude (Claude Code), read-only production access via PostgREST + Auth Admin API
Superseded by: —

# AUDIT_STAGE_1_KPI_HISTORICAL_INTEGRITY_2026-09-01.md

> Auditoria E2E, estritamente read-only, do modelo de KPIs do Stage 1 do
> SETNAR — nascida da observação, em
> `docs/plans/AUDIT_PROFILE_REPRESENTATIVE_INTEGRITY_2026-09-01.md`, de que
> um KPI documentado como "lifetime, nunca decresce" (Ativados) foi visto em
> 6 em vez de 8 entre dois snapshots. Esta investigação **não assume** que
> houve DELETE, não assume que o snapshot antigo estava certo, e não conclui
> que a solução é event sourcing. A pergunta é mais fundamental: **as
> métricas oficiais do SETNAR têm semântica, fonte de verdade e persistência
> compatíveis com o que prometem medir?** Nenhuma correção foi implementada.

---

## 1. Executive Summary

O modelo de KPIs do Stage 1 (`STAGE_1_KPI_SPECIFICATION.md`, 15 KPIs + MRR,
aprovado por Pedro em 2026-08-14) é **semanticamente bem especificado, mas
estruturalmente inseguro para reprodução histórica** — não por um bug
isolado, mas por uma característica de desenho compartilhada por quase
todo o modelo: **todo KPI "lifetime" ou "cadastrado" é uma AGREGAÇÃO SOBRE
ESTADO ATUAL MUTÁVEL** (`representatives`, `product_activations`,
`subscriptions`), recalculada do zero a cada consulta, nunca a leitura de
um fato histórico persistido de forma imutável. Isso não é um erro de
implementação isolado — é a arquitetura de leitura inteira do produto,
deliberada e documentada (`docs/plans/QR_ANALYTICS_PLAN.md` §3.5: "raw
events over counters... aggregation happens at read time"). A única
exceção genuína no schema inteiro é `billing_events` (append-only, nunca
UPDATE/DELETE em nenhum código) — um exemplo funcionando do padrão que
falta em todo o resto.

Um segundo achado, independente do primeiro mas igualmente importante: **não
existe, em lugar nenhum deste repositório, um script, view, RPC ou
dashboard que calcule e PERSISTA um snapshot de KPI.** Todo número
histórico de KPI que já existiu (incluindo os dois citados nesta
investigação, 27/08 e 01/09) foi produzido por uma consulta SQL ad hoc
colada no SQL Editor do Supabase (`docs/runbooks/PILOT_METRICS.md`'s
própria descrição do processo: "sem dashboard, sem script, sem job") —
sem versão de query registrada, sem timestamp de execução persistido, sem
metadado de qual definição (das múltiplas leituras documentadas em alguns
KPIs) foi de fato usada. **O snapshot é hoje a única prova histórica de
qualquer KPI lifetime, e o snapshot em si não é reproduzível nem
auditável.**

Não foi encontrada evidência de que a definição de nenhum KPI mudou
semanticamente ENTRE duas versões já commitadas do código — os dois
documentos-fonte (`MVP_ANALYTICS_AUDIT.md`, `STAGE_1_KPI_SPECIFICATION.md`)
nasceram juntos, num único commit, em 2026-08-14, já com as ambiguidades
resolvidas dentro do próprio texto. O risco de "versionamento de definição"
não é um fato já ocorrido — é uma exposição estrutural (nenhum mecanismo
impede que aconteça sem ninguém notar), o que é diferente e, para efeito de
severidade, menos urgente.

O incidente original (representative de Luiz Carlos removido) continua sem
causa raiz provada — ver o audit anterior. Esta investigação trata isso
como **um sintoma confirmado de um problema arquitetural mais amplo**, não
como a causa do problema arquitetural.

---

## 2. Scope

Esta investigação cobre exclusivamente os 15 KPIs oficiais + MRR definidos
em `STAGE_1_KPI_SPECIFICATION.md`, sua fonte de dado real, sua mutabilidade,
e a reprodutibilidade histórica de dois snapshots já citados (27/08 e
01/09/2026). Não cobre: a causa do incidente Luiz Carlos/Wesley (já coberta
pelo audit anterior), a correção de nenhum KPI, a implementação de nenhuma
arquitetura nova, e não reabre nenhuma decisão de produto já fechada por
Pedro (D1–D7 em `STAGE_1_KPI_SPECIFICATION.md`, D1–D6 em
`ANALYTICS_DATA_LAYER_METABASE_READINESS.md`, a decisão de retenção em
`DATA_RETENTION_DECISIONS_PLAN.md`).

---

## 3. Sources inspected

**Documentos:** `STAGE_1_KPI_SPECIFICATION.md` (leitura integral, 974
linhas), `MVP_ANALYTICS_AUDIT.md`, `PILOT_METRICS.md`, 
`PILOT_SUCCESS_THRESHOLDS_PLAN.md`, `ANALYTICS_DATA_LAYER_METABASE_READINESS.md`,
`DATA_RETENTION_DECISIONS_PLAN.md`, `docs/plans/README.md`,
`AUDIT_PROFILE_REPRESENTATIVE_INTEGRITY_2026-09-01.md` (audit anterior).

**Migrations lidas:** `20260728000000` (profiles), `20260731000000`
(representatives/subscriptions/product_activations/leads/companies),
`20260806000000`/`20260813000000`/`20260901000000` (register_representative,
trial atômico), `20260807000000` (product_activations write path),
`20260810000000`/`20260811000000`/`20260817000000` (analytics_events),
`20260822000000` (feedback_responses), `20260823000000`–`20260831000000`
(billing lifecycle/checkout/reconciliation), `20260827000000`/`20260828000000`
(billing_events, apply_billing_event), `20260901000000` (trial lifecycle),
`20260904000000` (purge de retenção), `20260907000000`/`20260907000001`
(lgpd_request_log), `20260908000000`–`20260908000003` (origin), `20260909000000`/
`20260909000001` (audit log de DELETE, hardening já entregue).

**Código:** `src/modules/analytics/domain/analytics-metrics-repository.ts`,
`src/modules/analytics/infrastructure/aggregate-analytics-summary.ts`,
`src/modules/feedback/domain/first-publication-eligibility.ts`,
`scripts/reconcile-billing-subscription.ts`, `scripts/execute-lgpd-request.ts`.

**Git:** histórico completo (`--follow`) de `MVP_ANALYTICS_AUDIT.md`,
`STAGE_1_KPI_SPECIFICATION.md`, `PILOT_METRICS.md`,
`PILOT_SUCCESS_THRESHOLDS_PLAN.md`.

**Produção (read-only, GET-only via PostgREST + Auth Admin API, mesmo
método/disciplina de privacidade do audit anterior):** contagens e
agregações atuais de `representatives`, `product_activations`,
`analytics_events`, `leads`, `subscriptions`, `feedback_responses`,
`billing_events`, `profiles` — usadas exclusivamente para tentar reproduzir
o snapshot de 01/09 e avaliar mutabilidade/janela de dados real. **Nenhuma
escrita foi executada.**

**Snapshot de 27/08:** não existe nenhum artefato no repositório (nenhum
arquivo, nenhuma tabela, nenhum log) contendo esses números — foram
buscados por `grep` em `docs/` e por `glob` de qualquer arquivo
`*snapshot*`/`*kpi*`; nenhum encontrado além dos dois audits desta série,
que apenas citam os números recebidos como contexto da tarefa. Tratado como
evidência puramente documental, conforme instruído em §17.

---

## 4. Canonical KPI matrix

Reconstruída a partir da leitura literal de `STAGE_1_KPI_SPECIFICATION.md`
(nunca assumindo que a implementação corresponde à documentação — cada
linha abaixo foi cruzada contra a migration/código real).

| KPI | Objetivo de negócio | Definição documental | Tipo temporal | Fonte atual | Entidade raiz | Pode diminuir legitimamente? | Deveria ser monotônico? | Pode mudar retroativamente? | Retenção influencia? | DELETE influencia? | UPDATE influencia? | Historicamente reproduzível? | Confiança | Problema |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1. Registered Representatives | Quantos concluíram o cadastro de representante | `count(*) from representatives` | Lifetime (contagem) / Period (novos no período) | `representatives` | representative | Não (deveria só crescer) | **Sim** | **Sim** | Não | **Sim** | Não | Parcial — ver §15 | Média | `DELETE_SENSITIVITY`, `SNAPSHOT_ONLY` |
| 2. Activated Representative (B, oficial) | Quantos já publicaram ao menos 1x | `count(distinct representative_id) from product_activations where status in ('published','unpublished')` | **Lifetime** | `product_activations` | representative | Não | **Sim** | **Sim** | Não | **Sim** | Sim (status pode voltar) | Parcial — ver §15 | Média | `CURRENT_STATE_USED_AS_HISTORY`, `DELETE_SENSITIVITY` |
| 2A. Activated (A, não-oficial) | Quantos têm página publicada agora | `... where status = 'published'` | Snapshot | `product_activations` | representative | Sim | Não | Não é retroativo (é o presente) | Não | Sim | Sim | Sim (é o presente) | Alta | Nenhum — é o KPI 3 |
| 3. Published Pages | Quantas páginas estão no ar agora | `count(*) where status='published'` | Snapshot | `product_activations` | activation | Sim | Não | Não | Não | Sim | Sim | Sim | Alta | Nenhum |
| 4. Product/Template Adoption | Quais produtos são mais ativados/publicados | `count distinct/count por product_id` | Snapshot | `product_activations` | activation | Sim | Não | Não | Não | Sim | Sim | Sim | Alta | Nenhum |
| 5. Page Views | Tráfego às páginas | `count(*) analytics_events where event_type='visit'` | **Period** (7/30d no produto; lifetime calculável) | `analytics_events` | event | Sim (é janela) | Não | Sim (se janela tocar dado purgado) | **Sim (12 meses)** | **Sim** | Não | Sim hoje (dado recente); **não** após 12 meses | Alta hoje / Baixa a longo prazo | `RETENTION_LOSS` (futuro) |
| 6. Representatives With Traffic | Quantos representantes tiveram ≥1 visita na janela | `count distinct representative_id` com `event_type='visit'` na janela | Period | `analytics_events` | representative (derivado de event) | Sim | Não | Sim (janela+purge) | Sim (12 meses) | Sim | Não | Sim hoje | Alta hoje | `RETENTION_LOSS` (futuro) |
| 7. WhatsApp Clicks | Intenção comercial via WhatsApp | `count(*) event_type='whatsapp_click'` | Period | `analytics_events` | event | Sim | Não | Sim (janela+purge) | Sim (12 meses) | Sim | Não | Sim hoje | Alta hoje | `RETENTION_LOSS` (futuro) |
| 8. Leads | Submissões de lead | `count(*) leads` | Period | `leads` | event | Sim | Não | Sim (janela+purge) | **Sim (24 meses)** | Sim | Não | Sim hoje | Alta hoje | `RETENTION_LOSS` (futuro) |
| 9. Representative With Result | Sinal comercial (click OU lead) | `has_result` por representative, janela ancorada em `published_at` | **Cohort** (âncora em evento, não data corrida) | `analytics_events`+`leads`+`product_activations.published_at` | representative | Sim | Não (é uma taxa por coorte) | Sim (herda 5/7/8 + `published_at` é mutável) | Sim (herda 5/7/8) | Sim | Sim (`published_at` pode ser reescrito por unpublish/republish) | Parcial — ver §9 | Média | `WINDOW_DEFINITION`, `MUTABLE_SOURCE` |
| 10. Paid Customer | Quem realmente paga | `subscriptions.status='active' AND provider='asaas'` | Snapshot | `subscriptions` | subscription | Sim | Não | Não é retroativo (é o presente) | Não | Não (subscriptions não é purgada) | **Sim — é a própria fonte** | Sim (é o presente) | Alta | `CURRENT_STATE_USED_AS_HISTORY` se usado para responder "quando" |
| 11. Paid Conversion Rate | % que virou pagante | `pagantes/cadastrados` | Snapshot | `subscriptions`+`representatives` | representative | Sim | Não | Não | Não | Não | Sim | Sim | Alta | `VERSIONING_GAP` (sem `first_paid_at`, D5 deferred) |
| 11b. Founding Cohort Conversion | Conversão paga da coorte fundadora | `pagantes(asaas,active)/30` | Snapshot | `subscriptions` | subscription | Sim | Não | Não | Não | Não | Sim | Sim | Alta | Nenhum |
| 12. Cancellations | Quantos cancelaram no período | `subscriptions.status='canceled'` no período, proxy `feedback_responses.created_at` | Period | `subscriptions`+`feedback_responses` | subscription | N/A (é uma contagem de evento) | N/A | **Sim** (`updated_at` sobrescrito a cada transição) | Não | Não | **Sim — a própria fonte principal é mutável** | Parcial — proxy melhor existe (`feedback_responses`) mas não é o oficial | Média | `MUTABLE_SOURCE` |
| 13. Churn (D30/D60) | Retenção de pagantes | `status<>'trialing' AND updated_at<=agora-N` vs `status='active'` | Cohort (aproximado por `updated_at`) | `subscriptions` | subscription | N/A | N/A | **Sim** (mesma razão de KPI 12) | Não | Não | **Sim — a própria fonte é mutável, sem timestamp de conversão dedicado** | Não, precisamente — só aproximado | Baixa-Média (já documentado como aproximado) | `MUTABLE_SOURCE`, `VERSIONING_GAP` |
| 14. Feedback Distribution | Como avaliam o produto | `feedback_responses` agrupado | Lifetime/cumulative | `feedback_responses` | feedback row | Não | Sim (mas sujeito a delete se conta apagada) | Não | Não (retenção = ciclo da conta, sem purge automático hoje) | Sim (se a conta for eliminada) | Não | Sim | Alta | Nenhum |
| 15. Cancellation Reasons | Por que cancelam | `feedback_responses where context='cancellation'` | Lifetime/cumulative | `feedback_responses` | feedback row | Não | Sim | Não | Não | Sim | Não | Sim | Alta | `ATTRIBUTION_GAP` (só cobre cancelamento via app) |
| MRR | Receita recorrente | `sum(amount_cents) where active+asaas` | Snapshot | `subscriptions` | subscription | Sim | Não | Não | Não | Não | Sim | Sim | Alta | Nenhum (secundário por desenho, nunca headline) |

---

## 5. Temporal classification

| Categoria | KPIs |
|---|---|
| **A — Current State** | 2A (não-oficial), 3, 4, 10, 11, 11b, MRR |
| **B — Lifetime Event** | 1, 2 (oficial), 14, 15 |
| **C — Time Window** | 5, 6, 7, 8 |
| **D — Cohort** | 9 (âncora `published_at`), 13 (âncora saída de `trialing`, aproximada) |
| **E — Funnel Conversion** | 11 (cadastro→pago), 11b (fundadora→pago), implicitamente 2/9 (cadastro→ativação→resultado) |

**Achado central desta classificação:** todo KPI na Categoria B (Lifetime
Event, "deveria ser monotônico") é hoje **implementado como uma agregação
sobre a Categoria A** (estado atual mutável) — não existe, em nenhum lugar
do schema, uma tabela de fatos append-only que registre "este representante
ativou em `X`" como um evento imutável e independente da linha operacional
de `product_activations`/`representatives` ainda existir. Isso é
precisamente a lacuna que tornou o "8→6 ativados" possível sem que nenhuma
regra de negócio tenha sido violada no nível do schema — o schema nunca
prometeu monotonicidade, só a documentação prometeu.

---

## 6. Cadastro semantics

### Q1 — Qual é a definição oficial atual de "Cadastrado"?

**KPI 1, `STAGE_1_KPI_SPECIFICATION.md`: uma linha em `representatives`**,
criada exclusivamente por `register_representative()` — explicitamente
**não** o signup (`handle_new_user()`) sozinho. Esta é a única definição
com autoridade normativa-de-fato (aprovada por Pedro, D-series de
2026-08-14).

### Q2 — Essa definição está consistente em documentação, relatórios, queries e logs históricos?

**Não totalmente.** `STAGE_1_KPI_SPECIFICATION.md` é explícita e correta.
Mas:
- `PILOT_METRICS.md` §1 e `PILOT_SUCCESS_THRESHOLDS_PLAN.md` §2 usam
  "cadastrado" como o DENOMINADOR da métrica de **Ativação em 7 dias**
  (`total_cadastrado` = `count(distinct r.id) from representatives`) — isso
  bate com KPI 1, mas nenhum dos dois documentos cita `representatives`
  explicitamente no texto corrido, só na query SQL — alguém lendo só a
  prosa poderia inferir "cadastro de conta" (signup) em vez de "linha de
  representative".
- O brief da investigação anterior (e desta) usa "cadastrados"/"ativados"
  em prosa livre, sem citar a tabela — consistente com KPI 1 nos números
  reproduzidos (6 `representatives` = "6 cadastrados" implícito no
  snapshot de 01/09), mas **não há como provar retroativamente** que quem
  relatou o número de 27/08 usou a mesma definição (ver §17).
- Não foi encontrada nenhuma ocorrência, em código ou documentação, que
  defina "cadastrado" como `auth.users` ou `profiles` diretamente — a
  ambiguidade é teórica/potencial (por existirem três tabelas candidatas
  com contagens diferentes hoje: 8 `auth.users`, 8 `profiles`, 6
  `representatives`), não uma inconsistência já observada em um documento
  específico.

### Q3 — `profile` sem `representative` conta ou não?

**Não conta para KPI 1**, e isso já está escrito explicitamente em KPI 1's
"Known limitations" desde 2026-08-14: *"Um `profile` (conta criada, signup
completo) sem `representative` correspondente NÃO conta aqui — é 'cadastro
incompleto', uma métrica derivada separada."* Esta definição predata o
incidente Luiz Carlos/Wesley — não foi criada em resposta a ele.

### Q4 — Se não conta, como chamamos esse estado?

**"Cadastro incompleto"** — nome já usado em `STAGE_1_KPI_SPECIFICATION.md`
KPI 1 e, independentemente, em `MVP_ANALYTICS_AUDIT.md` §6 item 10 ("`profiles`
sem `representative` associado (onboarding incompleto)"), escrito também em
2026-08-14. **Nenhuma query/view oficial existe para esse estado** — os
dois documentos descrevem a mesma fórmula conceitual
(`profiles LEFT JOIN representatives ... WHERE representatives.id IS NULL`)
mas nenhum a implementou como artefato reutilizável antes desta série de
audits.

### Q5 — O KPI mede criação de conta ou onboarding concluído?

**Onboarding concluído** — de propósito. KPI 1 mede exatamente o passo que
`register_representative()` representa (slug, nome público, ID de
autorização, telefone — todos os campos que tornam a página pública
possível), não a criação da conta isolada (`auth.users`/`profiles`, que
`handle_new_user()` cria atomicamente com zero desses campos).

### Q6 — Estamos misturando aquisição e ativação no mesmo indicador?

**Não, os dois estão separados por desenho**: KPI 1 (Registered
Representatives = onboarding concluído) e KPI 2 (Activated = primeira
publicação) são dois KPIs distintos na taxonomia oficial
(Acquisition → KPI 1; Activation → KPI 2/3/4). O funil oficial
(`STAGE_1_KPI_SPECIFICATION.md` §5) já desenha
`Representante cadastrado → Representante ativado` como duas etapas
sequenciais separadas, nunca fundidas.

**Nenhuma inconsistência de implementação foi encontrada para "Cadastrado"**
— a única fragilidade real é a ausência de uma query/view canônica
versionada (ver §15).

---

## 7. Activation semantics

Reconstrução técnica de KPI 2 (oficial, B):

- **Evento exato:** uma linha em `product_activations` com
  `status IN ('published', 'unpublished')`.
- **Tabela/coluna:** `product_activations.status` (`check` constraint,
  `20260731000000`), mais `published_at` (nunca limpo ao despublicar —
  ADR-043, confirmado no código: `unpublished` preserva o histórico).
- **Timestamp:** `published_at` — mas note: é o timestamp da
  **publicação mais recente/atual**, não necessariamente da primeira. Nada
  no schema distingue "primeira publicação" de "última publicação" — se um
  representante publicar, despublicar e republicar, `published_at` é
  sobrescrito para a data da segunda publicação (confirma-se ao ler
  `20260807000000_add_product_activation_write_path.sql`: `set_activation_status()`
  grava `published_at = now()` a cada transição para `published`, sem
  `coalesce` contra um valor já existente).
- **Basta publicar uma vez?** Sim, por desenho D1 — `status IN ('published','unpublished')`
  cobre ambos porque `unpublished` só é alcançável tendo passado por
  `published` primeiro (`20260817000000`'s máquina de estados: `draft →
  published → unpublished`, nunca `draft → unpublished` direto).
- **`unpublished` continua contando como lifetime?** Sim — essa é
  literalmente a razão de a definição B existir em vez de A.
- **Apagar a `product_activation` remove historicamente a ativação?**
  **Sim.** Não existe nenhum outro registro do evento de primeira
  publicação fora dessa linha — se ela for `DELETE`ada (fisicamente
  possível hoje, sem policy de DELETE para `anon`/`authenticated`, mas
  alcançável por `service_role`/SQL Editor, mesma superfície já mapeada
  para `representatives` no audit anterior), o marco histórico desaparece
  junto, silenciosamente, sem nenhum log — não há proteção equivalente ao
  `representative_delete_audit_log` (Hardening B) para esta tabela.
- **Representative suspenso continua ativado lifetime?** Sim, tecnicamente
  — `representatives.status='suspended'` não afeta a query de KPI 2, que
  lê `product_activations`, não `representatives.status`. Mas isso nunca
  foi testado contra um representative real suspenso neste piloto (todos
  os 6 atuais têm `status='active'`).
- **Usuário excluído deve continuar contando historicamente?** A
  documentação (KPI 1's nota sobre LGPD, D3) sugere que sim, mas **não há
  como verificar isso hoje**: eliminação LGPD real (via
  `execute-lgpd-request.ts`) nunca apaga `product_activations` (só redige
  `representatives`/`profiles`), então o marco de ativação sobreviveria a
  uma eliminação LGPD legítima. Mas sobrevive a um `DELETE` direto de
  `representatives` (que, por FK `NO ACTION`, é fisicamente impossível
  enquanto `product_activations` existir — a ordem de deleção teria que
  apagar `product_activations` primeiro, apagando o marco histórico ANTES
  de o representative em si sumir).

### Q7 — Existe hoje um registro permanente do primeiro evento de ativação?

**Não.** `published_at` é sobrescrito a cada nova publicação (não é
"primeira publicação", é "publicação mais recente"), e a própria linha que
o guarda pode ser fisicamente apagada sem deixar rastro.

### Q8 — Ou o KPI é inferido a partir de linhas operacionais mutáveis?

**Inferido a partir de linhas operacionais mutáveis** — confirmado. `status`
e `published_at` de `product_activations` são ambos escritos e
reescritos pelo fluxo normal do produto (`activate_product`/
`set_activation_status`), a mesma tabela que a página pública lê ao vivo.

### Q9 — Se uma página for removida (despublicada), o marco histórico desaparece?

**Não** — `status = 'unpublished'` continua contando para KPI 2(B), por
desenho (D1). Despublicar não é o risco; **apagar a linha** é.

### Q10 — Se todas as `product_activations` forem fisicamente apagadas, o sistema ainda sabe que aquela pessoa já ativou?

**Não.** Nenhum outro lugar do schema guarda esse fato. Isso é
estruturalmente idêntico ao achado do audit anterior para `representatives`
— aqui aplicado a `product_activations`, que **não tem nenhuma auditoria de
DELETE** (Hardening B cobriu só `representatives`, por escopo explícito
daquela tarefa).

---

## 8. Result semantics

KPI 9 oficial: `has_result = (whatsapp_clicks >= 1) OR (leads >= 1)`, janela
`published_at` até `published_at + 30 dias`, por representante ativado.

- **Como `first publication` é calculada?** Não é "first" — é lida
  diretamente de `product_activations.published_at`, que (§7) é a
  publicação **mais recente**, não a primeira. Para os 6 representantes
  atuais isso não importa na prática (nenhum jamais despublicou/republicou
  — `product_activations_status_breakdown` em produção hoje: `published:
  32, draft: 3`, **zero linhas `unpublished`**), mas a definição, se um
  representante algum dia republicar, silenciosamente moveria a âncora da
  janela para uma data mais tarde, encolhendo ou deslocando o "resultado em
  30 dias" sem que isso seja uma mudança de regra de negócio intencional.
- **Esse timestamp é persistido ou inferido?** Persistido, mas na mesma
  linha mutável — não há coluna `first_published_at` separada e imutável.
- **Como a janela é reconstruída?** Via `between published_at and
  published_at + interval '30 days'` contra `leads.created_at`/
  `analytics_events.created_at` — reproduzida em `PILOT_METRICS.md` §2 e
  confirmada nesta investigação com uma query equivalente contra produção
  (ver §15): **5 de 6** representantes ativados têm resultado dentro de 30
  dias da publicação (Result Rate oficial ≈ 83% hoje — número não citado em
  nenhum snapshot anterior, calculado aqui pela primeira vez como parte
  desta auditoria).
- **Quais eventos contam?** Só `whatsapp_click` e `leads` — nunca `visit`
  (`STAGE_1_KPI_SPECIFICATION.md` já proíbe isso explicitamente).
- **Eventos podem ser purgados?** Sim — `analytics_events` (12 meses) e
  `leads` (24 meses). Para os dados atuais (analytics de 14/08 a 31/08,
  leads de 14/08 e 22/08 — todos com menos de 1 mês de idade), a purga
  ainda não afetou nada. Passa a afetar KPI 9 assim que um representante
  ativado há mais de 12 meses tiver seu resultado original fora da janela
  de retenção.
- **Exclusão do representative altera o histórico?** Sim, indiretamente —
  se `representatives`/`product_activations` forem apagados (§7, Q10), a
  linha desaparece do numerador E do denominador ao mesmo tempo (o
  representante simplesmente deixa de existir para a query), o que é
  DIFERENTE de "ele teve resultado e perdeu" — é "ele nunca existiu para
  este cálculo", uma forma sutil e silenciosa de viés de sobrevivência.
- **Evento sem `origin` influencia?** Não — `origin` (SET-84) é uma
  dimensão de atribuição, não um filtro de KPI 9; um evento sem `origin`
  (`null`, o caso de todo evento anterior a 27-28/08) ainda conta
  normalmente para "resultado".
- **Clocks/timezones importam?** Todos os timestamps são `timestamptz`
  (Postgres, UTC internamente) — não foi encontrado nenhum ponto do código
  que compare datas em timezone local de forma inconsistente para este
  cálculo especificamente.
- **Múltiplas páginas contam uma ou várias vezes?** Uma vez — KPI 9 é
  `count(distinct representative_id)`, não por página/produto (hoje
  irrelevante, catálogo de 1 produto ativo por representante na prática).

**Reprodutibilidade de KPI 9 após 30 dias / 12 meses / purge de analytics /
exclusão de representative / exclusão de activation:**
- Após 30 dias corridos (sem purge): **reproduzível** — a janela em si já
  passou, o resultado não muda mais (os eventos que a compõem já
  aconteceram e não serão sobrescritos).
- Após 12 meses (com purge de `analytics_events`): **não reproduzível**
  para o componente de `whatsapp_click` — o evento original terá sido
  fisicamente apagado. `leads` sobrevive até 24 meses.
- Após exclusão de `representative`/`product_activations`: **não
  reproduzível** — o representante desaparece do denominador inteiro.

---

## 9. Traffic/lead semantics

Já cobertos em detalhe nas tabelas §4/§5. Achados adicionais, verificados
contra produção nesta investigação (read-only):

- **Retenção atual:** `analytics_events` tem `created_at` entre
  2026-08-14T11:03 e 2026-08-31T21:10 — 100% dentro da janela de 12 meses;
  a purga (`purge_expired_retention_data()`, agendada via `pg_cron` às
  03:00 diariamente, confirmada no audit anterior) **ainda não removeu
  nenhuma linha real do piloto** até o momento desta investigação.
- **Deduplicação:** nenhuma — cada `visit`/`whatsapp_click` é uma linha
  nova por carregamento/clique (já documentado como limitação conhecida,
  não um bug).
- **Idempotência:** não aplicável no mesmo sentido de `billing_events` —
  não há `unique constraint` de negócio em `analytics_events` (um retry de
  rede real produziria uma segunda linha).
- **Bot filtering:** denylist de substring (`is_bot_user_agent`), já
  documentada como redução de ruído, não controle rígido.
- **Timezone:** `timestamptz`, sem problema identificado.
- **Origem/representative_id/product_id:** todos presentes e não-nulos em
  `analytics_events` (FK `not null`); `leads.product_id` é nullable no
  schema mas sempre preenchido na prática hoje.

### "120 visitas nos últimos 30 dias" pode ser reproduzido em 2027?

**Não, não com o mesmo resultado.** Em 2027, `analytics_events` de
agosto/2026 estará dentro da janela de purga de 12 meses só até
agosto/2027 — pedir "visitas entre 01/08/2026 e 31/08/2026" depois dessa
data devolveria **zero**, não o mesmo número, porque as linhas terão sido
fisicamente `DELETE`adas pelo job, não porque a pergunta ficou
tecnicamente impossível de formular. Isto é o próprio comportamento
DESEJADO da política de retenção (LGPD, minimização) — registrado aqui não
como bug, mas como uma propriedade que precisa ser explícita para qualquer
pessoa que planeje usar KPI 5–8 para análise de longo prazo.

---

## 10. Retention semantics (D30/D60)

- **Evento inicial da coorte:** saída de `trialing` (qualquer `status <>
  'trialing'`), aproximado por `subscriptions.updated_at` — não pela data
  real da primeira cobrança (não existe `first_paid_at`, D5 deferred).
- **Evento de retorno:** `status = 'active'` no momento da consulta (é
  literalmente "ainda está pagando agora", não um evento de "renovou").
- **Janela:** D30/D60 desde a última transição de status (`updated_at`),
  não desde a conversão original.
- **O que acontece com usuários removidos?** `subscriptions` não tem
  purga automática (retenção = "enquanto a conta existir",
  `DATA_RETENTION_DECISIONS_PLAN.md`) — mas, como toda `subscriptions`
  depende de `representative_id` (FK `not null`, `NO ACTION`), se o
  `representative` for apagado, `subscriptions` bloqueia o DELETE (mesma
  proteção por FK já mapeada no audit anterior) — então **hoje, D30/D60 não
  pode silenciosamente perder uma linha por exclusão em cascata**, porque a
  exclusão em si é fisicamente bloqueada enquanto a subscription existir.
- **O que acontece quando analytics antigos são purgados?** Nada — D30/D60
  não depende de `analytics_events`, só de `subscriptions`.
- **Cálculo ainda é possível depois do purge?** Sim, sempre — `subscriptions`
  não está sujeita a nenhuma purga automática hoje.

**Estado atual verificado em produção:** `retention_d30_eligible = 0`,
`retention_d60_eligible = 0` — nenhuma subscription saiu de `trialing`
ainda (as 6 atuais são todas `trialing`; uma tem `provider='asaas'` porque
o checkout foi iniciado antecipadamente durante o trial —
`reserve_billing_checkout_slot()`, comportamento documentado e confirmado
ao vivo — mas isso não move `status`, só `provider`/`payment_method`). A
arquitetura **permite** calcular D30/D60 corretamente quando houver volume,
mas o cálculo é estruturalmente **aproximado** (mede "estável há N dias",
nunca "convertida há N dias exatos") — limitação já conhecida e aceita
(D7, deferred) desde 2026-08-14, não um achado novo desta investigação.

---

## 11. Monetization semantics

- **`subscriptions` como estado atual:** usada por KPI 10, 11, 11b, MRR,
  D30/D60 — todos leem o valor de `status`/`provider`/`amount_cents` NO
  MOMENTO da consulta.
- **`billing_events` como histórico:** genuinamente append-only (confirmado
  lendo `20260827000000` linha por linha — nenhum UPDATE/DELETE em nenhum
  código deste repositório toca essa tabela), mas **não é usada por
  nenhum KPI oficial hoje** — é auditoria/idempotência do webhook, não uma
  fonte de leitura de KPI.
- **Estado verificado em produção:** `billing_events` tem **0 linhas**.
  Nenhum webhook real do Asaas jamais chegou a este ambiente de produção
  até o momento desta investigação — todas as 6 `subscriptions` são
  `trialing`; a única com `provider='asaas'` chegou lá via
  `reserve_billing_checkout_slot()` (checkout iniciado), não via
  `apply_billing_event()` (pagamento confirmado). **KPI 10 (Paid Customer)
  = 0, MRR = R$0,00, Founding Cohort Conversion = 0/30 hoje.**
- **`trial → paying → canceled` continua corretamente representado
  historicamente?** **Não pode ser testado hoje** — nenhuma subscription
  do piloto real passou por essa sequência completa ainda (0 pagantes, logo
  0 cancelamentos de pagante). Pela leitura do código: `status` é
  sobrescrito em cada transição, sem histórico de estados anteriores em
  `subscriptions` — só `billing_events` teria o histórico bruto do lado do
  Asaas, e ele não alimenta nenhum KPI de churn/cancelamento hoje. Se isso
  ocorrer, KPI 12/13 já documentam (D4, D7) que a leitura será aproximada,
  não incorreta — a limitação é conhecida, não descoberta agora.
- **Métrica inferindo eventos passados só do estado atual?** Sim — KPI 12
  (Cancellations) e KPI 13 (Churn) são os dois exemplos mais claros: ambos
  leem `subscriptions.updated_at`/`status`, que representam a **última**
  transição, não o evento original que o KPI pretende medir.

---

## 12. Data retention impact

| Tabela | Retenção | Pode ser apagada automaticamente? | KPI afetado |
|---|---:|---|---|
| `analytics_events` | 12 meses desde `created_at` | **Sim** — `purge_expired_retention_data()`, `pg_cron` diário 03:00 (confirmado agendado em produção no audit anterior) | 5, 6, 7, 9 (componente click) |
| `leads` | 24 meses desde `created_at`/última atualização | **Sim** — mesmo job | 8, 9 (componente lead) |
| `feedback_responses` | Enquanto a conta existir | Não automaticamente — só via eliminação LGPD manual (`execute-lgpd-request.ts`, que efetivamente apaga `feedback_responses` de um representative eliminado) | 14, 15 |
| `billing_events` | **Sem prazo definido** | Não | Nenhum hoje (não alimenta KPI) |
| `billing_reconciliation_log` | Sem prazo definido | Não | Nenhum (é auditoria operacional, não KPI) |
| `representatives` | Enquanto a conta existir (`on delete cascade` de `auth.users`, só nessa direção) | **Sim, manualmente** — sem purga automática, mas fisicamente possível (audit anterior) | 1, 2, 3, 4, 9, 10, 11, 11b |
| `profiles` | Enquanto a conta existir | Sim, via `auth.users` cascade | 1 (denominador de "cadastro incompleto") |
| `product_activations` | **Sem prazo definido, sem decisão registrada** | Sim, manualmente (mesma superfície de `representatives`, sem auditoria de DELETE — ver §7 Q10) | 2, 3, 4, 9 |
| `subscriptions` | Enquanto a conta existir | Não automaticamente (bloqueada por FK enquanto existir) | 10, 11, 11b, 12, 13, MRR |

### Q11 — Algum KPI definido como lifetime depende de uma tabela sujeita a purge?

**Não diretamente** — KPI 1 (`representatives`) e KPI 2
(`product_activations`) não estão sujeitos a NENHUMA purga automática
decidida (nem em `DATA_RETENTION_DECISIONS_PLAN.md`, que cobre só
`leads`/`analytics_events`). O risco de retenção para os KPIs lifetime é
zero **hoje**, precisamente porque ninguém decidiu purgar essas tabelas —
o risco real para eles é o mesmo do audit anterior (DELETE manual/fora de
código), não retenção automática.

KPI 9 (Resultado), apesar de ancorado num evento lifetime
(`published_at`), **depende** de `analytics_events`/`leads` para o
componente de resultado — esses SIM estão sob purga automática, então a
resposta correta é: **o marco de ativação (KPI 2) sobrevive à purga; a
capacidade de provar QUE ELE TEVE RESULTADO não sobrevive além de 12/24
meses.**

### Q12 — Alguma métrica histórica se torna impossível de recalcular depois da retenção?

**Sim, confirmado tecnicamente** (não hipotético): qualquer recálculo de
KPI 5/6/7/9(click) para uma janela cujo início é anterior a "agora menos 12
meses" retorna um número menor ou zero, mesmo que o valor "verdadeiro"
histórico fosse maior — porque as linhas fisicamente não existem mais. Para
KPI 8/9(lead), o mesmo vale com o horizonte de 24 meses. Isso não afeta o
piloto atual (dado mais antigo tem ~18 dias), mas é uma propriedade
estrutural real, não uma hipótese.

---

## 13. Mutability analysis

| Tabela | INSERT | UPDATE | DELETE | Purge | Redaction | Suspension |
|---|---|---|---|---|---|---|
| `profiles` | `handle_new_user()` (trigger, atômico com signup) | Nenhuma UPDATE de app (`profiles` não tem policy de UPDATE — só `execute-lgpd-request.ts` via service_role, `correcao`/`eliminacao`) | Só via `auth.users` cascade (não isolado) | Não | Sim (`execute-lgpd-request.ts`, LGPD) | N/A |
| `representatives` | `register_representative()` | `update_representative_profile()` (self-service phone/city/authorization_id), `execute-lgpd-request.ts` (correcao/eliminacao), `set_activation_status()` indiretamente não (não toca representatives) | Manual/fora de código (audit anterior); agora auditado (Hardening B) | Não | Sim (LGPD, `status='suspended'`+redação) | Sim (`status='suspended'`, LGPD ou inadimplência — mesmo valor, D3 deferred) |
| `product_activations` | `activate_product()` | `set_activation_status()` (draft↔published↔unpublished) | Manual/fora de código, **sem auditoria hoje** | Não | N/A | N/A |
| `analytics_events` | `record_page_visit()`/`record_whatsapp_click()` (`service_role` only) | Nenhuma | `purge_expired_retention_data()` (12 meses) | **Sim** | N/A | N/A |
| `leads` | `submit_lead()` | Sim — `execute-lgpd-request.ts --right=correcao` (nome/cidade/e-mail/telefone) | `purge_expired_retention_data()` (24 meses); `execute-lgpd-request.ts --right=eliminacao` (DELETE real e imediato, sem exceção de retenção) | **Sim** | Via correcao acima | N/A |
| `feedback_responses` | `resolve_feedback()`/`record_feedback_shown()` | Sim (a mesma linha evolui `shown_at → answered_at`/`dismissed_at`) | `execute-lgpd-request.ts --right=eliminacao` de um representative (apaga todas as linhas dele) | Não automaticamente | N/A | N/A |
| `subscriptions` | `register_representative()` (trial), `reserve_billing_checkout_slot()` | `apply_billing_event()`, `reserve_billing_checkout_slot()`, `confirm_own_subscription_cancellation()` — **status é reescrito repetidamente na mesma linha** | Não (nenhum código faz DELETE) | Não | N/A | N/A |
| `billing_events` | `apply_billing_event()` | **Nenhuma** | **Nenhuma** | Não | N/A | N/A |
| `billing_reconciliation_log` | `reconcile-billing-subscription.ts` | Nenhuma | Nenhuma | Não | N/A | N/A |

**Cenário `HISTORICAL_DRIFT` — já possível hoje, sem nenhuma mudança de
código:**

```
KPI 2 (Ativados) calculado em 01/09 = 6
mesma query executada em 01/12, para representar "quantos já ativaram até 01/09"
→ pode retornar menos que 6, se qualquer product_activations for apagada entre 01/09 e 01/12
→ marcado como HISTORICAL_DRIFT
```

Isso não é hipotético isolado — é exatamente a classe de evento que gerou
o incidente original (representative de Luiz Carlos). A investigação atual
confirma que **o mesmo padrão se aplica igualmente a `product_activations`**,
sem a mesma auditoria que `representatives` ganhou.

---

## 14. Historical reproducibility

Consolidado de §4, por classificação binária/parcial:

**Historicamente reproduzíveis (dado atual, sem depender de retenção nem
de estado que possa ter sido apagado):** KPI 3, 4, 10, 11, 11b, MRR, 14, 15
— todos leem estado presente para responder uma pergunta sobre o presente,
sem prometer reconstruir o passado.

**Parcialmente reproduzíveis:** KPI 1, 2 (prometem lifetime, mas dependem
de linhas que podem ter sido apagadas sem auditoria — 2 — ou com auditoria
recente mas não retroativa — 1); KPI 5, 6, 7, 8, 9 (reproduzíveis dentro da
janela de retenção, não reproduzíveis fora dela); KPI 12, 13 (aproximados
por desenho, nunca exatos, mesmo sem qualquer purga/delete).

**Não historicamente reproduzíveis, sob condições já identificadas:**
qualquer KPI lifetime (1, 2) para uma data específica no passado, **depois**
de uma linha relevante ter sido apagada — o sistema não tem como saber que
ela existiu, exceto por um snapshot documental externo (exatamente o caso
de Luiz Carlos).

---

## 15. Snapshot 27/08 vs 01/09

Reprodução tentada nesta investigação, **sem nenhuma escrita**, contra o
estado de produção em 2026-09-01 (mesmo dia dos dois snapshots citados,
via GET-only/PostgREST):

| KPI | 27/08 (snapshot citado) | 01/09 (snapshot citado) | 01/09 recalculado agora | Classificação 27/08 | Classificação 01/09 |
|---|---|---|---|---|---|
| Cadastrados (KPI 1) | 8 | 6 | **6** (confere) | `NOT_REPRODUCIBLE` — só evidência documental, sem query/artefato | `REPRODUCIBLE` |
| Ativados (KPI 2) | 8 | 6 | **6** (confere) | `NOT_REPRODUCIBLE` | `REPRODUCIBLE` |
| Com página no ar (KPI 3) | — (não informado) | 6 | 6 representantes / 32 páginas (`published`) | `NOT_PROVABLE_READ_ONLY` (não informado) | `REPRODUCIBLE` |
| Páginas publicadas | — | 32 | **32** (confere) | `NOT_PROVABLE_READ_ONLY` | `REPRODUCIBLE` |
| Visitas | — | 120 | **120** (confere, all-time — o snapshot original não especifica janela) | `NOT_PROVABLE_READ_ONLY` | `REPRODUCIBLE`, com ressalva de janela não declarada |
| Cliques WhatsApp | — | 29 | **29** (confere) | `NOT_PROVABLE_READ_ONLY` | `REPRODUCIBLE` |
| Leads | — | 2 | **2** (confere) | `NOT_PROVABLE_READ_ONLY` | `REPRODUCIBLE` |
| Resultado (KPI 9, oficial) | — | — (não informado) | **5/6 (≈83%)** — calculado pela primeira vez nesta investigação | N/A | Calculado agora, não comparável a um valor anterior |
| Pagantes (KPI 10) | — | — (não informado) | **0** | N/A | Calculado agora |

**Interpretação:** todo número do snapshot de 01/09 é reproduzível
byte-a-byte porque esta investigação rodou no mesmo dia, contra o mesmo
estado de produção — isso prova que a QUERY é reconstituível hoje, não que
o snapshot original tinha metadado suficiente para alguém reconstituí-lo
independentemente amanhã. Nenhum artefato encontrado registra a query
exata, timestamp de execução, ou definição usada para produzir os números
de 27/08 ou 01/09 — ambos são, estruturalmente, **igualmente
não-auditáveis** olhando só para o repositório; 01/09 só parece
"reproduzível" porque o estado do banco ainda não mudou desde então.

**27/08 especificamente:** tratado, conforme instruído, como evidência
documental — não como um estado de banco verificável hoje. Não foi possível
nem tentado reconstituir 27/08 via nenhuma forma de "viagem no tempo" (este
projeto não tem backups point-in-time confirmados nem log de query
acessível — mesma lacuna já registrada no audit anterior §16).

---

## 16. KPI definition/version timeline

Busca no Git (`--follow`) dos quatro documentos-fonte de definição de KPI:

| Data | Commit | Evento |
|---|---|---|
| 2026-08-12 | `3b2087b` | `PILOT_METRICS.md` + `PILOT_SUCCESS_THRESHOLDS_PLAN.md` criados juntos, já com as fórmulas de Ativação (7 dias)/Resultado (30 dias)/Conversão/MRR/Retenção D30-D60/Feedback — **antes** de `STAGE_1_KPI_SPECIFICATION.md` existir. |
| 2026-08-14 | `1a590e2` | `MVP_ANALYTICS_AUDIT.md` (752 linhas) e `STAGE_1_KPI_SPECIFICATION.md` (973 linhas) **criados no mesmo commit**, já com D1–D7 resolvidas dentro do próprio texto — não há uma versão anterior commitada com uma definição diferente de KPI 2/9 para comparar. |

**Nenhuma mudança de definição semântica já ocorrida foi encontrada entre
duas versões commitadas do código** — os dois momentos de ambiguidade
documentados (KPI 2's leitura A vs B; se "Ativação"/"Resultado" do
`PILOT_METRICS.md` — 7 dias/janela de cadastro — é a mesma coisa que KPI
2/9 do `STAGE_1_KPI_SPECIFICATION.md` — lifetime/janela de publicação) foram
resolvidos **dentro** de um único documento, na criação, não como uma
revisão que invalidasse um número já publicado.

**Achado de nomenclatura, não de fórmula:** `PILOT_METRICS.md`/
`PILOT_SUCCESS_THRESHOLDS_PLAN.md` chamam de "Ativação"/"ativado" a métrica
de **7 dias desde o cadastro**; `STAGE_1_KPI_SPECIFICATION.md` chama de
"Activated Representative"/"Ativados" a métrica **lifetime**. As duas
fórmulas não competem tecnicamente (a segunda cita e distingue
explicitamente a primeira, "7-Day Activation... não redefinida aqui") — mas
o mesmo substantivo em português, "ativado", nomeia dois KPIs diferentes em
dois documentos diferentes. Nenhuma ocorrência encontrada de alguém
efetivamente confundindo os dois em um relatório real, mas a superfície de
confusão existe e é exatamente o tipo de ambiguidade que Q15 (§17) pergunta
sobre.

---

## 17. Cross-source funnel map

Funil de referência conceitual (§22 da tarefa), classificado por fonte de
verdade real — sem inventar rastreamento que não existe:

| Etapa | Classificação | Evidência |
|---|---|---|
| Abordagem | Fora do produto | Nenhuma tabela/código relacionado encontrado |
| Resposta | Fora do produto (planilha de prospecção, presumivelmente) | Idem |
| Interesse | Fora do produto | Idem |
| Material enviado (ao PROSPECT, pré-cadastro) | Fora do produto | Distinto de `marketing-materials` (SET-65), que serve o representante JÁ cadastrado divulgando sua própria página — não o time comercial do SETNAR prospectando |
| Cadastro | **Banco SETNAR** | `auth.users`/`profiles` (conta) → `representatives` (cadastro completo, KPI 1) |
| Onboarding | **Banco SETNAR** | `register_representative()`, atômico com `subscriptions` (trial) desde `20260901000000` |
| Primeira publicação | **Banco SETNAR, evento derivável (não persistido de forma imutável)** | `product_activations.published_at` — ver §7/§8 sobre por que "primeira" é na verdade "mais recente" |
| Divulgação | **Parcialmente banco SETNAR** | `origin`/`?src=` (SET-84) marca a ATRIBUIÇÃO de visitas/leads subsequentes; não existe um evento persistido de "link de divulgação gerado/compartilhado" em si — a divulgação em si não é rastreada, só seu efeito (visita com origin preenchido) |
| Visita | **Banco SETNAR, evento** | `analytics_events` (`event_type='visit'`), sujeito a purga de 12 meses |
| Clique/Lead | **Banco SETNAR, evento** | `analytics_events` (`whatsapp_click`, purga 12m) / `leads` (purga 24m) |
| Retorno | **Banco SETNAR, inferido de estado atual mutável** | `subscriptions.status`/`updated_at` — não um evento "retornou" persistido |
| Pagamento | **Banco SETNAR, evento (o único genuinamente append-only)** | `billing_events` — mas hoje vazio (0 linhas) em produção, nunca exercitado |

### §23 — Cross-source boundary

A validação de negócio ponta-a-ponta do SETNAR **depende de pelo menos
duas fontes de verdade não integradas**: uma planilha/processo de
prospecção (fora deste repositório, não inspecionável por esta
investigação) para tudo antes do cadastro, e o banco SETNAR para tudo a
partir do cadastro. Esta investigação **não tenta resolver** essa fronteira
— só a documenta, conforme instruído, como uma dependência que qualquer
funil "ponta a ponta" (abordagem → pagamento) vai precisar declarar
explicitamente, sob risco de o SETNAR achar que está medindo o funil
inteiro quando só mede a metade de baixo dele.

---

## 18. Risks and severities

| # | Achado | Severidade | Root cause |
|---|---|---|---|
| R1 | KPIs lifetime (1, 2) são agregações sobre estado mutável, sem tabela de fatos imutável — o schema nunca garantiu a monotonicidade que a documentação promete | **P1** | `CURRENT_STATE_USED_AS_HISTORY` |
| R2 | Nenhum snapshot histórico de KPI (incluindo 27/08 e 01/09) tem query/versão/timestamp de execução registrados em lugar nenhum do repositório — o snapshot é a única prova e não é auditável | **P1** | `SNAPSHOT_ONLY`, `VERSIONING_GAP` |
| R3 | `product_activations` pode ser fisicamente apagada sem nenhuma auditoria (ao contrário de `representatives`, já protegida pelo Hardening B) | **P1** | `DELETE_SENSITIVITY` |
| R4 | KPI 9 ancora em `published_at`, que é "publicação mais recente", não "primeira publicação" — republicar desloca silenciosamente a janela de 30 dias | **P2** | `MUTABLE_SOURCE` |
| R5 | KPI 5–9 (componentes de tráfego/lead) deixam de ser reproduzíveis fora da janela de retenção (12/24 meses) — ainda não manifestado (dado tem <1 mês), mas certo de ocorrer | **P2** | `RETENTION_LOSS` |
| R6 | KPI 12/13 (cancelamento/churn) dependem de `subscriptions.updated_at`, sobrescrito a cada transição — já documentado e aceito (D4/D7 deferred), não escondido | **P2** | `MUTABLE_SOURCE`, já com decisão registrada |
| R7 | `representatives.status='suspended'` conflacio suspensão temporária e eliminação LGPD permanente — já documentado e deliberadamente deferred (D3) | **P2** | `SEMANTIC_AMBIGUITY`, já com decisão registrada |
| R8 | "Ativação"/"ativado" nomeia dois KPIs diferentes em dois documentos diferentes (7 dias vs lifetime) — sem confusão real observada, mas superfície existe | **P3** | `SEMANTIC_AMBIGUITY` |
| R9 | Nenhum KPI agregado do PO (cadastrados/ativados/etc.) é calculado por código versionado — só consultas manuais coladas no SQL Editor | **P1** | `SNAPSHOT_ONLY` (é a causa raiz de R2) |
| R10 | Fronteira entre planilha de prospecção e banco SETNAR nunca formalizada — risco de "funil completo" ser reportado usando só a metade rastreada | **P2** | `ATTRIBUTION_GAP` |

Nenhum item foi classificado `P0` — nada bloqueia a validação do Stage 1
hoje: o volume real de pagantes é zero, o que significa que os KPIs mais
frágeis (12, 13, MRR, D30/D60) ainda não têm nenhum dado real para estarem
errados sobre. O risco é estrutural e prospectivo, não uma decisão já
tomada com base em um número já comprovadamente errado (o próprio 8→6 não
teve causa provada — audit anterior).

---

## 19. Architectural options

Comparadas, não escolhidas — decisão é do Product Owner.

**Opção A — estado atual + snapshots periódicos.** Simples de implementar
(um job que insere uma linha por dia numa tabela `kpi_snapshots`).
Auditável para "o que sabíamos numa data" SE o job rodar antes de qualquer
DELETE relevante — mas não impede `HISTORICAL_DRIFT` entre dois snapshots
já persistidos se a fonte mudar retroativamente (não resolve R1/R3, só
R2/R9 parcialmente). Custo baixo. Não corrige a causa (estado mutável),
só documenta o sintoma regularmente.

**Opção B — marcos lifecycle específicos, append-only.** Ex.:
`representative_registered`, `first_page_published`, `first_result`,
`trial_started`, `became_paying`, `canceled` — uma linha por evento, nunca
atualizada. Resolve diretamente R1, R3, R4 (uma vez persistido,
"primeira publicação" para de ser reescrita) e não exige nenhuma
infraestrutura nova — é literalmente o mesmo padrão já em produção e
funcionando (`billing_events`, `representative_delete_audit_log`). Custo
médio: um trigger/RPC por marco, não um framework.

**Opção C — fact table de validation events, genérica.** Um passo além de
B: uma única tabela `validation_events(event_type, entity_id, occurred_at,
payload)` para qualquer marco futuro, sem precisar de uma tabela nova por
tipo de evento. Mais flexível, mais barato de estender, mas também mais
fácil de virar um dump genérico sem disciplina de schema — risco maior de
virar "event sourcing por acidente" se não for tratado com o mesmo rigor de
`billing_events` (tipos fechados, nunca UPDATE/DELETE).

**Opção D — derivação a partir de eventos operacionais existentes.**
Tentar resolver tudo só com `analytics_events`+`billing_events`+timestamps
já existentes, sem tabela nova. Insuficiente sozinha: não cobre R1
(`representatives`/`product_activations` não são eventos, são estado), e
`analytics_events` está sob purga — não pode ser a fonte de um marco que
precisa ser permanente.

**Opção E — combinação mínima (marcos lifetime + eventos existentes +
snapshot periódico).** B para os poucos marcos que precisam ser
permanentes e nunca purgados; eventos existentes (`analytics_events`/
`leads`/`billing_events`) continuam servindo os KPIs de janela, sem
mudança; um snapshot periódico simples (A) por cima, para "o que sabíamos
numa data" sem depender de reconstrução em tempo real. Cobre R1, R2, R3,
R4, R9 com o menor número de peças novas.

---

## 20. Recommended target model

**Menor arquitetura que resolve as causas-raiz identificadas (não a lista
completa de melhorias possíveis):** Opção E, com o escopo mínimo de marcos
igual à lista já citada no próprio brief desta tarefa —
`representative_registered`, `first_page_published`, `first_result`,
`trial_started`, `became_paying`, `canceled` — nada além disso. Cada marco:
uma tabela pequena ou uma coluna `first_*_at` imutável (o padrão
`first_paid_at` já foi até nomeado e aprovado em D5, só adiado), escrita
uma única vez, nunca sobrescrita.

**Explicitamente fora da recomendação:** Kafka, CDC, event sourcing
completo, data warehouse, lakehouse, CQRS — nenhum requisito levantado
nesta investigação justifica essa complexidade para o volume atual (6
representantes, 0 pagantes). `billing_events` já prova que o padrão
append-only simples funciona neste codebase sem nenhuma dessas peças.

**Não implementado nesta investigação — proposital.**

---

## 21. What must change now

**Nada precisa mudar no código imediatamente para continuar operando o
Stage 1** — nenhum KPI está ativamente produzindo um número errado hoje
(a auditoria sistêmica do incidente anterior confirmou zero inconsistências
na população viva atual). O que precisa de atenção IMEDIATA, mas **não é
código**, é processo: qualquer snapshot de KPI reportado ao Product Owner
a partir de agora deveria vir acompanhado da query exata usada e da data de
execução (mínimo viável de R2/R9, sem esperar por nenhuma arquitetura
nova) — decisão do Product Owner, não implementada aqui.

## 22. What can wait

R5 (retenção afetando reprodutibilidade) e R6/R7 (já com decisão registrada
D4/D7/D3) podem esperar — nenhum tem urgência antes de o piloto ter volume
real. R8 (nomenclatura) é cosmético. R10 (fronteira planilha/banco) só
importa quando alguém tentar reportar o funil completo ponta-a-ponta.

---

## 23. Open questions

1. Qual foi a query exata usada para produzir o snapshot de 27/08? Não
   determinável sem acesso a quem a executou.
2. Existe algum backup/PITR do Supabase que pudesse, em teoria, reconstruir
   o estado de 27/08? Não verificado — mesma lacuna já registrada no audit
   anterior (fora do escopo de credenciais disponíveis a esta
   investigação).
3. O Product Owner quer que "cadastrado"/"ativado" sejam citados sempre com
   a tabela-fonte explícita em relatórios futuros, ou a prosa atual é
   aceitável?
4. Existe apetite para o Product Owner decidir AGORA os marcos lifecycle
   (Opção B/E), ou isso deveria esperar o piloto ter volume real de
   pagantes (dado que hoje há 0)?

---

## 24. Final verdict

Ver a seção "Verdict" na resposta desta investigação no chat, abaixo,
conforme formato solicitado.

---

*Nenhuma correção foi implementada como parte desta investigação. Nenhum
INSERT/UPDATE/DELETE foi executado em nenhum ambiente. Aguardando decisão
explícita do Product Owner antes de qualquer implementação.*

---

## Addendum (2026-09-01) — implementação mínima entregue

Escopo restrito e explicitamente priorizado (§29 do pedido de
implementação), separado desta investigação. Migrations
`20260910000000_add_representative_lifecycle_events.sql`/
`20260910000001_fix_register_representative_lifecycle_event_ambiguity.sql`:

- **Tabela `representative_lifecycle_events`** (append-only, RLS habilitada
  sem policies, sem FK para `representatives`/`product_activations` — de
  propósito, para sobreviver a um DELETE dessas tabelas). Três marcos:
  `representative_registered`, `first_page_published`, `first_result` —
  `unique (representative_id, event_type)` garante no máximo uma linha por
  marco.
- **`first_page_published` deixa de depender de `product_activations.published_at`**
  (R4) — escrito uma única vez, na primeira transição real para
  `published`, sobrevive a unpublish→republish e a um `product_activations`
  apagado/recriado depois.
- **`first_result`** — primeira vez, na vida do representante, que um
  `whatsapp_click` OU um `lead` aconteceu; a janela de 30 dias de KPI 9
  (D2) agora se apoia em dois timestamps imutáveis
  (`first_page_published`/`first_result`), não mais em `published_at`
  mutável.
- **`trial_started`/`became_paying`/`canceled`** deliberadamente **não**
  duplicados — `DEFERRED_AS_ALREADY_COVERED`: `subscriptions.created_at` e
  `billing_events` (append-only de verdade) já respondem os dois primeiros
  com a mesma garantia de imutabilidade; `canceled` permanece uma dívida
  consciente (proxy via `feedback_responses`, já mutável/apagável — mesma
  limitação já aceita em KPI 12/D4), fora do escopo mínimo priorizado.
- **Auditoria de DELETE de `product_activations` (§13 do pedido) — decisão
  registrada, não implementada.** Antes desta entrega, um `product_activations`
  apagado levava junto o único registro do marco de primeira publicação —
  P1. Agora que `first_page_published` é um fato independente e
  sobrevivente, apagar `product_activations` continua perdendo dados de
  ESTADO ATUAL (KPI 3/4, já documentados como snapshot, nunca prometidos
  como históricos), mas não perde mais o FATO HISTÓRICO que a auditoria
  original apontava como o risco real. Severidade rebaixada de P1 para P2;
  nenhum trigger de auditoria de DELETE foi criado para `product_activations`
  nesta entrega — se o Product Owner quiser essa auditoria adicional
  (mesmo padrão de `representative_delete_audit_log`, SET-115), é uma
  decisão separada, não implícita nesta.
- **Backfill determinístico** dos três marcos para a população já
  existente no ambiente onde a migration for aplicada — classificado
  `EXACT_BACKFILL` nos três casos, com a ressalva explícita, documentada na
  própria migration, de que nenhuma linha-fonte foi apagada/recriada antes
  do backfill rodar. **Revisado no Addendum 3 abaixo:** essa classificação
  original superestimava a precisão de dois dos três marcos —
  `first_page_published` e `first_result` foram reclassificados depois de
  uma revisão mais rigorosa. Os comentários da migration em si (já
  aplicada em dev/test, nunca reescrita) continuam com o texto original;
  o Addendum 3 é a correção com autoridade.
- **Coletor canônico** `scripts/collect-stage-1-kpis.ts`
  (`npm run kpis:collect`) — read-only por construção (GET puro, nunca
  `@supabase/supabase-js`), grava `docs/metrics/snapshots/<timestamp>.json`/
  `.md` com `collected_at`/`spec_version`/`collector_version`/`environment`
  junto de cada KPI, substituindo o processo de SQL ad hoc que esta
  investigação apontou como R2/R9. `docs/runbooks/PILOT_METRICS.md` foi
  atualizado com um ponteiro para o novo processo, preservando as consultas
  manuais antigas como referência histórica.
- **Migrations testadas e aplicadas apenas no projeto de teste descartável
  (`setnar-db-test`)** — nenhuma escrita em produção.

### Addendum 2 (2026-09-01) — final review patch: semântica de `first_result` provada, provenance por conteúdo, ambiente vinculado ao project ref

Três blockers levantados numa revisão final, antes de considerar o coletor
pronto como fonte canônica. Nenhuma migration nova — os três itens abaixo
são TypeScript puro no coletor, sem mudança de schema/RPC.

- **`first_result` provado, por código/schema, como já equivalente a
  "primeiro resultado depois da primeira publicação"** —
  `record_whatsapp_click()`/`submit_lead()` só inserem depois de
  `private.is_page_publicly_accessible()` confirmar
  `product_activations.status = 'published'` no instante da chamada, e
  nenhum outro caminho de escrita alcança `analytics_events`/`leads` (RLS
  nega INSERT direto mesmo onde o GRANT existe — confirmado ao vivo, erro
  `42501`). `tests/kpi9-result-semantics.integration.test.ts` (4 casos)
  prova isso contra Postgres real: tentativa de resultado numa página em
  draft é recusada e não grava nada; resultado após publicar grava o marco
  correto; republish não move o anchor; tentativa recusada + resultado
  real mantêm KPI 9 correto. `first_result` **não foi renomeado** — a
  invariável já vale para o desenho atual.
- **Provenance por conteúdo, não só por commit** — `collect-stage-1-kpis.ts`
  agora grava `collector_content_sha256`/`spec_content_sha256` (SHA-256 dos
  bytes reais do script/spec no momento da execução) e `git_dirty`
  (`git status --porcelain` não-vazio), além de `git_sha` (mantido como
  metadado, não mais a única prova de proveniência).
- **`environment` deixa de ser um rótulo solto** — `resolveEnvironmentBinding()`
  extrai o project ref real de `NEXT_PUBLIC_SUPABASE_URL` e vincula a
  `production`/`development` contra o mesmo mapa canônico de dois refs já
  usado por `scripts/supabase-production-guard.mjs` (reaproveitado como
  dado puro, não como semântica de bloqueio — o coletor precisa
  legitimamente poder ler produção, ao contrário do guard de teste). Um
  `--environment=` declarado que não bate com o ref real, ou um project
  ref fora do mapa conhecido, aborta antes de qualquer leitura.
- Migrations `20260910000000`/`20260910000001` **não foram editadas** —
  nenhuma mudança de schema/RPC foi necessária para fechar os três
  blockers.

### Addendum 3 (2026-09-01) — correção da classificação de backfill: precisão histórica não pode superestimar o que os dados realmente provam

Revisão puramente de classificação/documentação — **nenhum código, RPC,
schema ou dado inserido foi alterado**. A migration
`20260910000000_add_representative_lifecycle_events.sql` (já aplicada em
`setnar-db-test`) **não foi reescrita** — seus comentários originais
continuam dizendo `EXACT_BACKFILL` para os três marcos; este addendum é a
correção com autoridade, não uma edição do arquivo aplicado.

**Distinção central desta revisão, válida do início ao fim:** eventos
gravados **prospectivamente** (a partir de agora, por
`register_representative()`/`set_activation_status()`/
`record_whatsapp_click()`/`submit_lead()`) são fatos exatos no momento em
que ocorrem — nada neste addendum muda isso, e nada nele reabre o Addendum
2 (a prova da invariável de `first_result` continua válida para eventos
novos). O que está sob revisão é exclusivamente a **reconstrução
histórica** feita pelo backfill sobre dados que já existiam antes da
migration rodar.

#### `representative_registered`

**Classificação: `EXACT_BACKFILL` — mantida, sem alteração.**

**Evidência:** `representatives.created_at` é `timestamptz not null default
now()` (`20260731000000`), preenchido exclusivamente no INSERT feito por
`register_representative()`. Nenhum código deste repositório — nenhuma
RPC, nenhum script administrativo (`execute-lgpd-request.ts` só escreve
`display_name`/`phone`/`city`/`status`; `update_representative_profile()`
só escreve `phone`/`city`/`authorization_id`) — jamais escreve na coluna
`created_at` depois da criação. Tanto o FATO (o representative foi
registrado) quanto o TIMESTAMP (o instante exato do INSERT) são
conhecidos com precisão total para qualquer representative que ainda
exista no momento do backfill. Nenhuma suposição sobre dados apagados é
necessária — a própria linha sendo lida É a prova.

#### `first_page_published`

**Classificação revisada: `DERIVED_BACKFILL`** (era `EXACT_BACKFILL` na
entrega original — correção).

**Evidência:** `set_activation_status()` preserva `published_at` de uma
MESMA linha de `product_activations` através de ciclos
unpublish→republish (`v_new_published_at := coalesce(v_published_at,
now())` — confirmado ao vivo em
`tests/representative-lifecycle-events.integration.test.ts` Teste 3/4 e
`tests/kpi9-result-semantics.integration.test.ts` Caso C). **Isso prova
que o timestamp é estável DENTRO da vida de uma linha — não prova que a
linha observada hoje é a ÚNICA que já existiu para aquele representante.**
`product_activations` não tem trilha de auditoria de DELETE (decisão
registrada no Addendum 1, severidade P2, deferred) — se uma linha for
apagada e uma nova ativação (do mesmo produto ou de outro) for criada
depois, a nova linha nasce com `published_at = null` e recebe um novo
timestamp na sua própria primeira publicação, estritamente posterior ao
verdadeiro primeiro evento histórico do representante, que se perde sem
deixar rastro algum.

**Backfill real:** `MIN(published_at)` entre as ativações `published`/
`unpublished` **atualmente existentes** do representante — ou seja, o
primeiro evento entre os que sobreviveram até o momento do backfill, não
necessariamente o primeiro evento que já ocorreu na vida real do
representante.

**Limitação:** o FATO ("este representante já publicou pelo menos uma
vez") é comprovado pela mera existência de uma linha
`published`/`unpublished` — isso continua tão confiável quanto o próprio
KPI 2 já era antes desta migration (é a mesma leitura que
`STAGE_1_KPI_SPECIFICATION.md` KPI 2 sempre fez). O TIMESTAMP pode ser
posterior ao verdadeiro primeiro evento histórico, numa magnitude
impossível de quantificar sem uma trilha de auditoria que não existe.

#### `first_result`

**Classificação revisada: `DERIVED_BACKFILL`**, com uma exceção
condicional documentada explicitamente — **não** `EXACT_BACKFILL` sem
qualificação, e não simplificável para uma promessa geral sobre qualquer
execução futura do backfill.

**As duas perguntas, respondidas separadamente (§4.1 do pedido):**
- **Fato** — "este representante já teve resultado alguma vez?" — SIM,
  comprovado pela existência de qualquer linha de `whatsapp_click`/`lead`
  referenciando o representante (a mesma leitura que KPI 7/8/9 sempre
  fizeram).
- **Timestamp** — "sabemos exatamente quando ocorreu o PRIMEIRO resultado
  da vida dele?" — **Depende da retenção.** `analytics_events` é purgado
  aos 12 meses, `leads` aos 24 meses
  (`20260904000000_add_retention_purge_job.sql`, `pg_cron` diário,
  confirmado agendado em produção no audit anterior). Se o primeiro
  resultado real de um representante já tiver mais de 12/24 meses no
  momento em que o backfill rodar, esse evento pode já ter sido
  fisicamente apagado — o backfill capturaria, sem saber, o primeiro
  evento SOBREVIVENTE, não o primeiro evento HISTÓRICO.

**`EXACT_BACKFILL_FOR_CURRENT_COHORT` — condição explícita para quando o
backfill for de fato executado (não uma afirmação válida hoje, para
sempre):** se, no momento em que o backfill rodar contra uma população
real, for possível confirmar que NENHUM representante daquela população
tem conta mais velha que o menor dos dois prazos de retenção relevantes
ao seu histórico (12 meses para o componente `whatsapp_click`, 24 meses
para `lead`), então nenhum evento relevante poderia ter sido purgado
ainda, e a classificação PODE ser tratada como
`EXACT_BACKFILL_FOR_CURRENT_COHORT` para aquela população específica,
naquele momento específico — nunca como uma garantia permanente. Esta
condição precisa ser reverificada a cada aplicação do backfill, não
assumida por herdar a leitura desta investigação.

**Achado desta revisão, read-only, contra `setnar-db-test`:** consultada a
população viva de `representative_lifecycle_events` (71 representantes
com pelo menos um evento registrado, acumulados por múltiplas execuções de
suíte de teste nesta sessão) — **zero** representantes possuem
simultaneamente `first_page_published` E `first_result` no momento desta
consulta (a rotina de limpeza dos próprios testes de integração apaga os
dois marcos juntos ao final de cada execução, antes que uma comparação
pareada seja possível). Isto não é uma falha da migration — é uma
consequência esperada da suíte de teste limpar seus próprios fixtures — mas
significa que **não existe hoje, em nenhum ambiente, uma população real
inspecionável para provar ou refutar empiricamente se algum backfill já
produziu um `first_page_published` "tarde demais"**. Produção **nunca
recebeu esta migration** (confirmado nesta revisão via uma única leitura
GET contra `/rest/v1/representative_lifecycle_events`: `404 PGRST205`,
tabela não existe) — não há população de produção para inspecionar
tampouco.

#### Prospective vs. historical guarantees — resumo

| | Prospectivo (a partir de agora) | Histórico (backfill) |
|---|---|---|
| `representative_registered` | Exato (INSERT direto) | **Exato** — coluna nunca reescrita |
| `first_page_published` | Exato (marco escrito na 1ª transição real, `on conflict do nothing`) | **Derivado** — pode refletir uma linha recriada, não a linha original |
| `first_result` | Exato (provado, Addendum 2) | **Derivado**, condicionalmente exato só se a população estiver comprovadamente dentro da janela de retenção no momento do backfill |

A arquitetura prospectiva (a partir da migration em diante) garante fatos
exatos independentemente desta revisão — isso não muda. O que muda é
reconhecer explicitamente que o PASSADO, reconstruído por inferência sobre
dados que já podem ter sido parcialmente perdidos (silenciosamente, sem
nenhuma trilha), só pode carregar precisão derivada, nunca exata por
suposição.

#### Impacto no KPI 9 (§9 do pedido)

**Direção do viés, provada formalmente:** como o timestamp backfillado de
`first_page_published` só pode ser IGUAL ou POSTERIOR ao verdadeiro
primeiro evento histórico (nunca anterior — não há como observar um
evento que não existe mais como sendo mais cedo do que ele foi), a janela
calculada pelo coletor (`first_result.occurred_at - first_page_published.occurred_at`)
é, na pior hipótese, uma SUBESTIMATIVA do tempo real decorrido. Isso
produz um viés em uma única direção: um representante cuja janela
backfillada apareça `> 30 dias` (não conta para KPI 9) **continuaria não
contando** mesmo com o timestamp verdadeiro (a janela real só poderia ser
maior, nunca menor). Já um representante cuja janela backfillada apareça
`<= 30 dias` (conta para KPI 9) **poderia, teoricamente, não contar** se o
verdadeiro primeiro evento tivesse sido cedo o bastante para estourar os
30 dias. Ou seja: o risco de erro do backfill em KPI 9 é unidirecional —
só pode inflar artificialmente o Result Rate, nunca subestimá-lo.

**Verificação empírica tentada, read-only, sem sucesso** (documentada
acima): nenhuma população com ambos os marcos simultaneamente existe hoje
em nenhum ambiente para testar essa hipótese contra dados reais.

**Conclusão, sem inventar certeza que os dados não sustentam:**

```text
HISTORICAL_KPI9_UNCERTAINTY
```

Justificativa: (1) o viés unidirecional acima é comprovado por construção,
não hipotético; (2) `product_activations` não tem trilha de DELETE, então
não é possível provar formalmente que nenhuma linha relevante foi
recriada antes de qualquer backfill futuro; (3) não existe, hoje, uma
população real (nem em produção — a migration nunca foi aplicada lá — nem
em dev/test, onde a limpeza dos próprios testes elimina a evidência) contra
a qual essa incerteza possa ser fechada por inspeção direta. Isto deixa de
ser incerteza no momento em que o backfill for de fato executado contra
uma população real e alguém verificar, com as mesmas consultas usadas
nesta revisão, se `pairs_with_both > 0` e se `negative_gap_count = 0` —
até lá, `NO_CURRENT_KPI9_CLASSIFICATION_CHANGE` seria uma afirmação não
sustentada pelos dados disponíveis.
