Status: Approved — decisões D8–D12 registradas por Pedro em 2026-08-14. D11 é "approved" com uma condição de execução (POC de segurança do mecanismo de ownership/bypass RLS das views, obrigatório antes de qualquer migration final) — ver §12. Nenhum schema/role/view/POC foi executado nesta revisão do documento.
Authority: Non-normative (ver `docs/plans/README.md`)
Code baseline: `0ecc74a`, branch `main`, 2026-08-14
Last reviewed: 2026-08-14
Superseded by: —

# ANALYTICS_DATA_LAYER_METABASE_READINESS.md

> Investigação de camada de dados analítica e prontidão para Metabase —
> construída sobre `docs/plans/MVP_ANALYTICS_AUDIT.md` (auditoria de
> instrumentação) e `docs/plans/STAGE_1_KPI_SPECIFICATION.md` (definições
> oficiais dos 15 KPIs, decisões D1–D7 já fechadas). **Nada foi
> implementado nesta tarefa** — nenhuma migration, view, role, schema,
> configuração de Metabase ou dashboard foi criada. Todo SQL/DDL abaixo é
> conceitual, para demonstrar viabilidade, exatamente como
> `MVP_ANALYTICS_AUDIT.md` §8 já fez.

---

## 0. Achado que precisa estar visível antes de qualquer outra coisa

`docs/runbooks/PILOT_METRICS.md`, o único runbook de métricas que já existe
neste projeto (SET-50), tem em seu próprio cabeçalho uma decisão de escopo
explícita e deliberada:

> "consultas para colar no SQL Editor do Supabase, **sem dashboard, sem
> script, sem job** — coerente com 'sem sistema de roles/admin'
> (`docs/plans/SPRINT_E_PLAN.md` §2.4) e com o escopo do SET-50 (**'sem
> cohorts, funis configuráveis, BI ou exportação sofisticada'**)."

Ou seja: a última vez que este projeto decidiu formalmente sobre
ferramentas de leitura de métricas, a decisão foi **explicitamente não
construir BI**. Esta investigação (Metabase) não é uma continuação neutra
desse trabalho — é uma proposta de **reverter/estender** uma decisão de
escopo já registrada. Isso não invalida a investigação nem impede que ela
prossiga; só significa que adotar Metabase de fato precisa ser uma decisão
consciente do Product Owner, não uma consequência automática de este
documento existir. Está listada como a primeira decisão em aberto na §12.

O resto deste documento assume que a resposta pode vir a ser "sim,
queremos BI agora" e investiga o que isso exigiria tecnicamente — sem
presumir que a resposta já é sim.

**Decisão do Product Owner (D8, 2026-08-14): APPROVED.** A resposta é
sim, com escopo explícito: **Metabase será usado exclusivamente como
dashboard interno mínimo dos KPIs já aprovados** em
`STAGE_1_KPI_SPECIFICATION.md` — não uma ferramenta de exploração livre,
não um substituto para o SQL Editor do Supabase para perguntas ad hoc, não
uma reabertura do escopo de "cohorts, funis configuráveis... exportação
sofisticada" que `PILOT_METRICS.md`/SET-50 já excluiu. A decisão "sem BI"
anterior **é estendida explicitamente, não apagada** — o que muda é que
agora existe uma exceção nomeada e escopada (este dashboard), não uma
reversão geral da postura de manter a superfície operacional pequena.

---

## 1. Método

Leitura do schema real (`supabase/migrations/`), do modelo de RLS/grants já
em vigor, e dos dois documentos anteriores desta série
(`MVP_ANALYTICS_AUDIT.md`, `STAGE_1_KPI_SPECIFICATION.md`) como fonte
única e já aprovada das definições de KPI — nenhuma definição é
reinventada aqui. Também lidos: `docs/runbooks/BILLING_OPERATIONS.md`,
`docs/runbooks/OBSERVABILITY.md`, `docs/runbooks/DEPLOYMENT.md` (para o
contexto operacional real: stack é Vercel + Supabase + Asaas, sem
infraestrutura própria de hosting, sem equipe além de Pedro), e
`supabase/README.md` (para o padrão de auditoria de grants já
estabelecido, ADR-048, que esta proposta reaproveita em vez de inventar um
processo novo).

---

## 2. KPI Data Access Classification

Para cada KPI de `STAGE_1_KPI_SPECIFICATION.md`, três perguntas: pode ser
consultado diretamente contra as tabelas base? Justifica uma SQL View
dedicada? Deveria **não** ser materializado (nem como view, nem como algo
persistido)?

| KPI | Direct query | View justificada | Não materializar | Motivo |
|---|---|---|---|---|
| 1. Registered Representatives | Sim | Não | — | Contagem/filtro simples (`count(*) from representatives`); a ambiguidade de `status='suspended'` (D3, deferred) não tem uma resposta canônica ainda — criar uma view hoje congelaria uma interpretação que o PO explicitamente adiou. |
| Novos representantes no período | Sim | Não | — | `group by date_trunc(...)`, trivial, sem lógica a proteger. |
| 2. Activated Representative / Activation Rate | Não | **Sim** | — | A fórmula oficial (D1: `status IN ('published','unpublished')`, não só `'published'`) é exatamente o tipo de filtro fácil de errar num "New Question" do Metabase — precisa viver numa view, não ser reconstruída por quem monta o card. |
| 3. Published Pages | Sim | Não | — | Filtro único e óbvio (`status='published'`), baixo risco de divergência. |
| 4. Product/Template Adoption | Sim | Não | — | `group by product_id`, trivial. |
| 5. Page Views | Sim (por representante/produto/janela) | Opcional (ver `v_analytics_daily` em §7, útil como base de outras views, não por si só) | — | Consulta simples; a view existe para servir KPIs 7/8/9, não porque KPI 5 sozinho precise. |
| 6. Representatives With Traffic | Não | **Sim** (mesma view de KPI 9) | — | Requer `count(distinct representative_id)` com janela declarada — melhor centralizada. |
| 7. WhatsApp Clicks / WhatsApp Conversion Rate | Não | **Sim** | — | A taxa exige numerador e denominador com a MESMA janela/escopo — a regra mais fácil de violar sem querer num BI self-service. |
| 8. Leads / Lead Conversion Rate | Não | **Sim** | — | Mesmo motivo de KPI 7, mais a exclusão obrigatória de colunas PII de `leads` (§8) — só é segura se vier de uma view já minimizada. |
| 9. Representative With Result / Result Rate | Não | **Sim** | — | A lógica é um `UNION` de dois tipos de evento com janela ancorada em `published_at` (D2) — exatamente o anti-pattern "somar em vez de OR" que `STAGE_1_KPI_SPECIFICATION.md` §9 proíbe explicitamente; sem uma view, é questão de tempo até alguém no Metabase escrever a query errada. |
| 10. Paid Customer | Não | **Sim** | — | O filtro `provider='asaas'` é, pela própria auditoria, "fácil de esquecer" — a razão de existir de uma view é justamente impedir que alguém esqueça. |
| 11. Paid Conversion Rate (geral) | Sim, sobre a view de KPI 10 | Reaproveita `v_paid_customers` | — | Uma vez que KPI 10 é uma view, a taxa geral é só uma divisão por `count(*) from representatives`. |
| 11b. Founding Cohort Conversion | Não | **Sim** | — | Denominador fixo (30) e exclusão `provider not in ('manual','trial')` — a MESMA lógica de `reserve_billing_checkout_slot()`; reimplementar isso ad hoc no Metabase é o mesmo risco de divergência que motivou toda esta série de documentos. |
| 12. Cancellations | Não | **Sim** | — | Precisa filtrar `status='canceled'`, nunca `'suspended'` — o anti-pattern mais citado em `STAGE_1_KPI_SPECIFICATION.md` §9. |
| 13. Churn (Retention D30/D60) | Não | **Sim** | — | Fórmula com `updated_at`/janela relativa já implementada em `PILOT_METRICS.md` §5 — deve ser espelhada, não reescrita. |
| 13b. Period Churn Rate | — | — | **Sim, não materializar** | Deferred por decisão do PO (D7); nem sequer precisamente calculável hoje (sem histórico de status por data) — criar uma view para isso seria dar aparência de precisão a um número que não a tem. |
| 14. Feedback Distribution by Context | Sim | Opcional (ver `v_feedback_responses` em §8, motivada por PII, não por lógica) | — | `group by context, response` é trivial; a view existe para excluir `response_detail`, não pela lógica de agregação. |
| 15. Cancellation Reasons | Sim, sobre a view de KPI 14 | Reaproveita `v_feedback_responses` | — | Mesmo caso de KPI 14 — filtro simples sobre uma view já PII-minimizada. |
| MRR | Não | **Sim** (reaproveita `v_paid_customers`) | — | Mesmo filtro `provider='asaas'` de KPI 10 — nunca uma soma direta de `amount_cents` sem esse filtro. |
| Core Validation Analysis (§6 do spec) | — | — | **Sim, não materializar** | Comparações ainda exploratórias (resultado × pagamento × retenção) — volume do piloto é pequeno demais para o padrão de corte se estabilizar; manter como Metabase "questions"/SQL ad hoc durante o Stage 1, promover a view só se/quando o padrão de análise se repetir de forma estável (mesmo raciocínio já usado em ADR-082 para adiar mover agregação para RPC: "não decidido agora, só registrado como gatilho futuro"). |
| Leitura individual de `feedback_responses.response_detail` (texto livre) | — | — | **Sim, não materializar/não expor a BI** | Ver §8 — nunca deve aparecer numa view de uso geral. |

---

## 3. Joins/filtros canônicos que precisam ficar fora do Metabase

Lista direta da coluna "View justificada" acima, com o porquê específico
de cada um — esta é a resposta central à pergunta "o que não pode ser
deixado para quem monta o card decidir":

1. **`provider = 'asaas'` sempre acompanhando `status = 'active'`** para
   "pagante" (KPI 10/11/MRR) — sem isso, `provider='manual'` infla os
   três números.
2. **`status IN ('published', 'unpublished')`**, nunca só `'published'`,
   para "ativado" (KPI 2, D1) — um Metabase self-service quase certamente
   escreveria só `= 'published'`.
3. **`UNION` (não `JOIN`, não soma) entre `whatsapp_click` e `leads`** para
   "resultado" (KPI 9) — a lógica OR-lógico, não sequencial, que toda esta
   série de documentos existe para proteger.
4. **`status = 'canceled'` distinto de `status = 'suspended'`** para
   cancelamento/churn (KPI 12/13/15) — confundir os dois é o anti-pattern
   mais citado na especificação.
5. **Janela de retenção ancorada em `updated_at` relativo (D30/D60),
   nunca uma data corrida fixa** (KPI 13) — replicar a fórmula exata de
   `PILOT_METRICS.md` §5.
6. **Janela de resultado ancorada em `published_at` por representante**
   (KPI 9, D2), nunca uma data de corte global igual para todos.
7. **`provider NOT IN ('manual', 'trial')`** para o denominador de 30 vagas
   fundadoras (KPI 11b) — mesma exclusão de `reserve_billing_checkout_slot()`.
8. **Exclusão estrutural de colunas PII** (`leads.telefone_e164`,
   `leads.campos`, `analytics_events.ip_hash`,
   `feedback_responses.response_detail`, campos de contato de
   `representatives`) — ver §8. Este item é especial: não é um "filtro"
   que alguém possa esquecer de aplicar numa query, é uma coluna que
   **nunca deve existir do lado do Metabase para começar** — só views
   resolvem isso de forma estrutural; um filtro de WHERE não seria
   suficiente porque um usuário do Metabase sempre poderia remover o
   filtro e ver a coluna se ela estivesse na tabela/view exposta.

---

## 4. RLS/SECURITY DEFINER — riscos

### 4.1 RLS não foi desenhada para uma conexão de BI, e isso corta nos dois sentidos

Toda policy de leitura própria neste projeto (`leads_select_own`,
`analytics_events_select_own`, `feedback_responses_select_own`,
`representatives_select_public`, `product_activations_select_published`)
depende de `auth.uid()` — uma função que lê uma configuração de sessão
(`request.jwt.claims`) que **só existe quando a requisição passa pelo
PostgREST/GoTrue da Supabase**, com um JWT de usuário autenticado. Uma
conexão direta ao Postgres (o que um driver de BI como Metabase usa —
`psql`/`pg` sobre a connection string, não a API REST) nunca populariza
essa configuração. `auth.uid()` retorna `NULL` nesse contexto.

**Consequência prática, não hipotética:** um role de BI que NÃO faz
bypass de RLS, apontado diretamente para as tabelas base, não veria "os
dados certos filtrados por segurança" — veria **zero linhas** em toda
tabela com policy própria (`leads`, `analytics_events`,
`feedback_responses`), porque `profile_id = auth.uid()`/equivalente nunca
é verdadeiro para `auth.uid() = NULL`. E para `representatives`/
`product_activations`, veria só as linhas que já satisfazem os critérios
de página pública (`private.is_page_publicly_accessible`) — ou seja,
excluiria representantes suspensos, ativações em draft, e qualquer coisa
não publicamente elegível **hoje**, mesmo que sejam exatamente os dados
que KPI 1/2/3 precisam contar. **Isto é um bug de completude de dado, não
uma proteção de segurança** — alguém poderia erroneamente concluir "RLS
está me protegendo" quando na verdade só está fazendo os números do
dashboard baterem errado silenciosamente (ex.: "Registered Representatives"
apareceria artificialmente baixo, ou zero).

**Implicação de design:** RLS, do jeito que existe hoje neste projeto, não
é o mecanismo certo para controlar o que o BI vê. O controle de acesso do
BI precisa vir de outro lugar — views curadas (§7), não de policies
pensadas para sessões de representante individual.

### 4.2 O risco oposto: dar bypass de RLS ao role que o Metabase efetivamente usa

A forma ingênua de "resolver" o problema acima seria conceder `BYPASSRLS`
diretamente ao role de login que o Metabase usa. **Isso é desencorajado
por esta investigação.** Um role com `BYPASSRLS` enxerga toda linha de
toda tabela a que tiver `SELECT` — se alguém, no futuro, adicionar um
`GRANT SELECT ON ALL TABLES IN SCHEMA public` a esse role por
conveniência (um erro plausível — "só preciso de mais uma tabela", feito
sob pressão), o resultado é exposição total e instantânea de
`leads.telefone_e164`/`campos`, `analytics_events.ip_hash`, e todo o
schema `public`, para uma ferramenta de terceiros.

**Decisão do Product Owner (D11, 2026-08-14): APPROVED — criar o schema
`bi`, as views curadas e o role `bi_readonly` sem acesso às tabelas de
`public`, seguindo esta arquitetura.** Com uma condição explícita: **o
mecanismo exato de ownership/bypass de RLS das views (o desenho de duas
camadas abaixo) precisa passar por um POC de segurança antes de qualquer
migration final ser aplicada** — este documento descreve o desenho
pretendido e o raciocínio por trás dele, mas não substitui a verificação
prática de que `security_invoker=false` mais um view owner com
`BYPASSRLS` realmente se comporta como descrito contra a versão real do
Postgres deste projeto Supabase, e de que nenhuma policy nova introduzida
depois desta investigação muda esse comportamento. O POC em si — criar o
schema/role/views num projeto de teste e rodar exatamente a "Verificação
manual obrigatória" da §5 — é o próximo passo, ainda não executado por
esta investigação nem por esta atualização do documento.

**Desenho recomendado (arquitetura em duas camadas, não um único role):**

- Um role **sem LOGIN**, só "dono de views" (ex.: `bi_view_owner`), com
  `BYPASSRLS` — nunca usado para autenticar nada, existe só para ser o
  owner das views do schema `bi` (§7). Views em Postgres, por padrão
  (`security_invoker = false`, o padrão até a versão em uso aqui salvo
  confirmação), avaliam RLS contra as tabelas base usando o role **dono
  da view**, não o role que a consulta — é o mesmo princípio que este
  projeto já usa para funções `SECURITY DEFINER` (rodar como o dono,
  independente de quem chama), aplicado a views em vez de funções.
- Um role **com LOGIN**, o que o Metabase efetivamente usa (ex.:
  `bi_readonly`), **sem `BYPASSRLS`**, **sem** ser membro de `anon`,
  `authenticated` ou `service_role`, com `SELECT` só nas views do schema
  `bi` — nunca nas tabelas de `public`. Mesmo que esse role vaze
  (credencial exposta, conta do Metabase comprometida), o dano máximo é
  "alguém vê os dados já minimizados e agregados que as views expõem" —
  nunca as tabelas base, nunca `service_role`.

Isso espelha, deliberadamente, o mesmo padrão que este projeto já usa em
`private.page_publication_blocker`/`private.is_page_publicly_accessible`
(schema separado, funções que rodam com privilégio próprio, chamador só
alcança o resultado, nunca o mecanismo interno) — não é uma técnica nova
sendo importada, é a mesma disciplina de "separar quem decide de quem
consome" aplicada a leitura em vez de escrita.

### 4.3 `SECURITY DEFINER` — risco de execução, não só de leitura

Nenhuma das ~15 funções `SECURITY DEFINER` deste projeto
(`submit_lead`, `apply_billing_event`, `record_page_visit`,
`purge_expired_retention_data`, etc.) concede `EXECUTE` a `PUBLIC` — todas
seguem o padrão `revoke ... from public` + `grant ... to <role específico>`
(ADR-048). Um role novo, criado do zero, **não herda `EXECUTE` em nenhuma
delas automaticamente** — só herdaria se fosse feito membro de `anon`,
`authenticated` ou `service_role` (as únicas concedidas), ou se alguém
concedesse explicitamente. **Risco real, não teórico:** o erro mais fácil
de cometer ao criar o role de BI é, por conveniência, fazê-lo herdar de
`service_role` "para simplificar" — isso concederia `EXECUTE` em toda
função privilegiada do projeto (incluindo `apply_billing_event`,
`purge_expired_retention_data`) a uma ferramenta de terceiros que só
deveria ler. **Mitigação:** o role de BI deve ser criado como um role
completamente independente, sem `GRANT <outro role> TO bi_readonly` de
nenhum tipo — só os `GRANT SELECT` explícitos do schema `bi`.

---

## 5. Como criar o usuário PostgreSQL read-only para BI (conceitual)

Sem executar nada — demonstração de viabilidade, seguindo o mesmo formato
de "queries conceituais" já usado em `MVP_ANALYTICS_AUDIT.md` §8. Esta é a
forma aprovada em princípio por D11; o texto abaixo é o roteiro do POC de
segurança que D11 exige antes de qualquer migration final, não uma
migration já pronta para aplicar.

```sql
-- Conceitual apenas — NÃO executado nesta investigação.

-- 1. Schema dedicado, mesmo padrão já usado para `private` (20260817000000)
create schema if not exists bi;
revoke all on schema bi from public;

-- 2. Role "dono de views" — nunca faz login, existe só para bypassar RLS
--    nas views que possui (ver §4.2).
create role bi_view_owner nologin bypassrls;
grant create on schema bi to bi_view_owner;

-- 3. Role de login real, o que o Metabase usa — SEM bypassrls, SEM
--    herdar de anon/authenticated/service_role.
create role bi_readonly login password '<gerado, rotacionável>' noinherit;
grant usage on schema bi to bi_readonly;
-- SELECT concedido view por view (ou `grant select on all tables in
-- schema bi to bi_readonly` DEPOIS de todas as views existirem, nunca
-- `on all tables in schema public`).

-- 4. Double-check de grants (mesmo espírito do ADR-048, aplicado a este
--    role): confirmar que bi_readonly não tem EXECUTE em NENHUMA função
--    SECURITY DEFINER, e não tem SELECT em NENHUMA tabela de `public`.
select grantee, table_schema, table_name, privilege_type
from information_schema.role_table_grants
where grantee = 'bi_readonly';
-- Esperado: só linhas com table_schema = 'bi'.

select grantee, routine_schema, routine_name
from information_schema.role_routine_grants
where grantee = 'bi_readonly';
-- Esperado: nenhuma linha.
```

**Verificação manual obrigatória, no mesmo formato que
`supabase/README.md` já usa para cada capacidade nova** (a executar se/quando
este role for de fato criado, não nesta investigação):

1. Conectar como `bi_readonly` e confirmar `select current_user, session_user;`
   retorna `bi_readonly` nos dois — nunca `postgres`/`service_role`.
2. Tentar `select * from public.leads limit 1;` como `bi_readonly` —
   esperado: erro de permissão (nenhum `GRANT` em `public`).
3. Tentar `select public.apply_billing_event(...)` como `bi_readonly` —
   esperado: erro de permissão.
4. Confirmar que `select * from bi.v_paid_customers` retorna dados de
   **todos** os representantes pagantes (não zero linhas, o sintoma do
   risco em §4.1, e não só o próprio "representante" de quem estiver
   testando).

---

## 6. Tabelas/views que o role de BI realmente precisa enxergar

**Zero tabelas de `public`.** O role `bi_readonly` não deveria ter
`SELECT` em nenhuma tabela base — só nas views do schema `bi`, listadas
em §7. Isto é o ponto central desta proposta: a superfície do BI é
definida pelo conjunto de views que alguém decide criar, nunca pelo
schema `public` inteiro.

---

## 7. Proposta de nomes para views (sem criá-las)

Todas no schema `bi`, todas de propriedade conceitual de `bi_view_owner`
(§4.2/§5) — nomes e colunas propostos, nenhuma criada.

| View | Base | Colunas propostas | Minimização de PII |
|---|---|---|---|
| `bi.v_representatives` | `representatives` | `id`, `created_at`, `status`, `company_id` | Exclui `display_name`, `phone`, `city`, `avatar_url`, `slug` |
| `bi.v_activated_representatives` | `product_activations` | `representative_id`, `first_activated_at` (min de `published_at`/`created_at` conforme D1) | Sem PII na origem |
| `bi.v_product_activations` | `product_activations`, `products` | `representative_id`, `product_id`, `product_slug`, `status`, `published_at`, `created_at` | Sem PII na origem |
| `bi.v_analytics_daily` | `analytics_events` | `representative_id`, `product_id`, `event_type`, `event_date` (truncado por dia), `event_count` | Exclui `ip_hash`, `referrer` (referrer pode conter querystring de campanha externa — exclusão conservadora até uma decisão específica) |
| `bi.v_leads_agg` | `leads` | `id`, `representative_id`, `product_id`, `created_at` | **Exclui `telefone_e164` e `campos` inteiramente** — ver §8, é a linha mais importante desta tabela |
| `bi.v_subscriptions` | `subscriptions` | `id`, `representative_id`, `status`, `provider`, `amount_cents`, `currency`, `current_period_end`, `created_at`, `updated_at` | Exclui `external_subscription_id`, `external_customer_id` (identificadores do gateway, sem necessidade para nenhum KPI) |
| `bi.v_paid_customers` | `subscriptions` | `representative_id`, `amount_cents`, `created_at`, `updated_at` — já filtrado `status='active' AND provider='asaas'` | Mesma exclusão acima |
| `bi.v_representative_result_status` | `analytics_events`, `leads`, `product_activations` | `representative_id`, `has_whatsapp_click`, `has_lead`, `has_result`, `window_reference` (`published_at` usado como âncora) | Sem PII |
| `bi.v_feedback_responses` | `feedback_responses` | `id`, `representative_id`, `context`, `response`, `shown_at`, `answered_at`, `dismissed_at`, `created_at` | **Exclui `response_detail`** — ver §8 |

Nenhuma dessas views expõe `profiles`/`auth.users` — nenhum KPI da
especificação precisa de nome, e-mail ou telefone de conta.

---

## 8. Tratamento de PII — especialmente `leads`

`leads` é a tabela com o dado mais sensível de todo o schema:
`telefone_e164` (identificador direto) e `campos` (jsonb com
nome/cidade/e-mail — potencialmente identificação completa de uma pessoa
física que nem é usuária do SETNAR, só uma prospect de um representante).
**Nenhum KPI da especificação (`STAGE_1_KPI_SPECIFICATION.md`) precisa de
qualquer uma dessas duas colunas** — KPI 8, 9, 11, 12, 13, 15 usam só
`count(*)`/`exists`/`group by response`, nunca o conteúdo de um lead
individual. A proposta de `bi.v_leads_agg` (§7) reflete isso: a view nem
tem essas colunas na definição, então não há "filtro a esquecer" — a
coluna simplesmente não existe do lado do Metabase.

Outras superfícies de PII a tratar com o mesmo rigor:

- **`analytics_events.ip_hash`** — já é excluído até da leitura do próprio
  representante autenticado (`revoke select ... grant select
  (id, representative_id, product_id, event_type, referrer, created_at)`,
  `20260817000000_secure_analytics_and_public_access.sql:346-348`). A
  view de BI segue exatamente a mesma exclusão, já com precedente
  estabelecido no próprio schema.
- **`feedback_responses.response_detail`** (texto livre, até 140
  caracteres) — não é PII no sentido de identificador direto, mas é
  opinião pessoal atribuível a um `representative_id` específico, numa
  base pequena (piloto de até 30 clientes) onde reidentificação por
  contexto é plausível ("o único representante que reclamou de preço em
  agosto era..."). **Decisão do Product Owner (D12, 2026-08-14): APPROVED
  — excluir estruturalmente de qualquer view de uso geral**, não como
  recomendação, como regra fechada: nenhuma view do schema `bi` inclui
  esta coluna, sem exceção pontual por conveniência. Se um caso de uso
  legítimo de ler o texto verbatim aparecer (ex.: Pedro querendo ler os
  comentários de cancelamento com contexto completo), isso continua
  passando por uma consulta direta no SQL Editor do Supabase (mesmo
  padrão já usado por `PILOT_METRICS.md`/`BILLING_OPERATIONS.md`), nunca
  por um card de BI de uso geral — a mesma lógica de "verificação de
  identidade proporcional ao dado em jogo" que
  `docs/runbooks/LGPD_RIGHTS.md` §2 já aplica a outros direitos.
- **Contato de representante** (`representatives.phone`/`city`/
  `display_name`/`avatar_url`) — nunca necessário para nenhum KPI
  agregado; excluído de `bi.v_representatives` por desenho. Um caso de uso
  de "drill-down para um representante específico" (ex.: suporte
  investigando um caso individual) é uma superfície diferente, com
  controle de acesso diferente — fora do escopo desta proposta de
  dashboard de KPIs agregados.

**Retenção:** como nenhuma view proposta materializa dado (todas são
`VIEW`, não `MATERIALIZED VIEW` nem cópia), a purga já agendada
(`purge_expired_retention_data()`, 12 meses `analytics_events`/24 meses
`leads`) continua sendo a única fonte de verdade de retenção — uma view
comum sempre reflete o estado atual da tabela base, nunca cria uma segunda
cópia de dado pessoal com ciclo de vida próprio para gerenciar. Isto é
outra razão para nunca propor uma `MATERIALIZED VIEW` para `leads`/PII: uma
materialized view precisaria de seu próprio job de refresh **e** herdaria
o problema de "cópia de PII que a purga da tabela original não alcança
automaticamente" — um motivo técnico a mais, além da própria PII, para
manter tudo como `VIEW` comum.

**LGPD — Metabase como operador de dados:** se o produto contratado for
Metabase Cloud (hospedado por terceiro, fora do Brasil), esse terceiro
passa a processar os dados que a conexão expuser — mesmo que já
minimizados/agregados pelas views. Isso é tecnicamente um novo "operador"
de dados sob a LGPD. `docs/plans/AUDIT_MVP_LAUNCH.md` Achado 7 já registra que a
revisão jurídica formal de `/termos`/`/privacidade` (SET-45/SET-74) está
pendente.

**Decisão do Product Owner (D9, 2026-08-14): APPROVED.** SET-45/SET-74
deve **incluir explicitamente a avaliação do Metabase Cloud** como parte
do escopo dessa revisão jurídica pendente, antes de qualquer conexão real
apontar para o banco de **produção**. Isso não bloqueia desenvolvimento
local da camada BI (criar/testar o schema `bi`, as views, o role
`bi_readonly` contra um projeto Supabase de teste/desenvolvimento) — só o
passo de conectar o Metabase (Cloud ou não) ao banco de produção real
precisa esperar essa avaliação.

---

## 9. Proposta de dashboard Stage 1 e cards

Organizado pela mesma taxonomia de `STAGE_1_KPI_SPECIFICATION.md` §3.
Proposta de layout, não configuração real do Metabase.

### Seção "Acquisition"
- **Card:** Registered Representatives (número único, snapshot)
- **Card:** Novos representantes por semana (série temporal)

### Seção "Activation"
- **Card:** Activation Rate (número único + linha auxiliar mostrando
  numerador/denominador)
- **Card:** Published Pages (número único, snapshot)
- **Card:** Adoção por produto (barra horizontal, 7 produtos)

### Seção "Distribution"
- **Card:** Page Views nos últimos 30 dias (série temporal)
- **Card:** Representatives With Traffic (número único, com janela
  declarada no título do card, ex. "— últimos 30 dias")

### Seção "Commercial Result" (a seção mais importante do dashboard,
por ser o eixo da pergunta central do Stage 1)
- **Card:** Result Rate (número único, headline da seção)
- **Card:** WhatsApp Clicks vs. Leads — **dois números lado a lado, NUNCA
  um gráfico empilhado/somado** (reforça visualmente o anti-pattern
  proibido em `STAGE_1_KPI_SPECIFICATION.md` §9: somar as duas métricas)
- **Card:** WhatsApp Conversion Rate / Lead Conversion Rate (dois números,
  lado a lado, mesmo motivo)
- **Card (diagnóstico, seção separada/collapsada):** Traffic-to-Result
  Rate — rotulado explicitamente "diagnóstico, não headline" no próprio
  título do card, conforme D2

### Seção "Monetization"
- **Card:** Founding Cohort Conversion (número único, **headline oficial**
  por D6 — maior destaque visual do que Paid Conversion Rate geral)
- **Card:** Paid Conversion Rate geral (número único, menor destaque,
  rotulado "secundária")
- **Card:** MRR (número único, com nota fixa no card: "não interpretar
  isoladamente como validação — ver Result Rate/Paid Conversion ao lado")

### Seção "Retention"
- **Card:** Cancellations no período (número único)
- **Card:** Retenção D30 / D60 (dois números lado a lado)

### Seção "Feedback"
- **Card:** Feedback Distribution by Context (tabela ou barras agrupadas
  por `context`)
- **Card:** Cancellation Reasons (barra horizontal, 9 categorias)

### Seção "Core Validation Analysis" (exploratória, não fixa no
dashboard principal — Metabase "questions" avulsas, conforme §2)
- Paid conversion among representatives with result vs. without
- Retention among representatives with result vs. without

---

## 10. Cards que precisam carregar ressalva

Reaproveitando a classificação `READY_WITH_CAVEAT` de
`STAGE_1_KPI_SPECIFICATION.md` §10 — todo card abaixo deve exibir o texto
da ressalva na descrição do card no Metabase (Metabase suporta descrição
por card, exibida ao passar o mouse/no modo de edição), nunca só no
título:

| Card | Texto de ressalva a exibir |
|---|---|
| Registered Representatives | "Pode incluir fixtures de teste (ver `MVP_ANALYTICS_AUDIT.md`); `status='suspended'` mistura suspensão temporária e eliminação LGPD (D3, deferred)." |
| Page Views | "Não representa visitantes únicos; pode incluir autovisita do representante; reload conta como nova visualização." |
| Representatives With Traffic | "Herda as ressalvas de Page Views; declare sempre a janela." |
| WhatsApp Clicks / WhatsApp Conversion Rate | "Best-effort — cliques podem ser subcontados se a aba fechar antes do beacon; pode incluir autovisita." |
| Leads / Lead Conversion Rate | "Lead = submissão, não pessoa única; sem deduplicação." |
| Traffic-to-Result Rate | "Diagnóstica, não headline — ver Result Rate para o número oficial (D2)." |
| Paid Customer / MRR | "Já filtrado `provider='asaas'` nesta view — nunca reconstruir sem esse filtro." |
| Paid Conversion Rate (geral) | "Secundária por decisão (D6) — o número headline é Founding Cohort Conversion." |
| Cancellations | "Cobre só cancelamentos feitos pelo fluxo do app (D4, follow-up P1 aprovado); cancelamento direto no gateway pode não aparecer." |
| Retenção D30/D60 | "Baseada em `updated_at`, não numa data de conversão dedicada (D5, deferred) — número conservador, nunca otimista." |
| Cancellation Reasons | "Mesma cobertura parcial de Cancellations (D4)." |
| Feedback Distribution by Context | "`shown_at` não é prova de leitura." |

Cards SEM ressalva necessária (KPI Readiness `READY`): Published Pages,
Product/Template Adoption, Activation Rate (D1 já fechou a definição),
Result Rate (D2 já fechou fórmula/denominador/janela), Founding Cohort
Conversion.

---

## 11. Metabase Cloud vs. self-hosted

### Contexto operacional real deste projeto

Toda a stack atual é hospedada por terceiros geridos (Vercel + Supabase +
Asaas), sem nenhuma infraestrutura própria a operar — e isso não é um
acidente, é um padrão decidido repetidamente: "sem sistema de
roles/admin" (`SPRINT_E_PLAN.md` §2.4), "sem job/fila" além do `pg_cron`
que o próprio Supabase já oferece (`ADR-086`), e um único responsável
operacional (`docs/runbooks/OBSERVABILITY.md`: toda linha da tabela de
sinais tem "Pedro" como responsável). Qualquer proposta de infraestrutura
nova precisa ser lida contra esse padrão já estabelecido, não contra um
padrão genérico de "empresa com time de plataforma".

### Comparação

| | Metabase Cloud | Self-hosted (ex.: Docker num VPS/Fly.io/Railway) |
|---|---|---|
| **Infraestrutura nova a operar** | Nenhuma — só uma connection string configurada no painel deles | Um serviço novo inteiro: host, updates de versão, backup do banco de aplicação do próprio Metabase (metadados/dashboards, não os dados do SETNAR), monitoramento de uptime |
| **Responsável operacional** | Metabase Inc. | Pedro (o mesmo único responsável de tudo hoje, per `OBSERVABILITY.md`) |
| **Custo direto** | Assinatura mensal (plano Starter/Pro, por usuário/recursos) | Custo de hosting (baixo, ex. um VPS pequeno) — mas custo de tempo de Pedro para manter é o custo real, não o custo de infraestrutura |
| **Superfície de credencial exposta a terceiro** | Connection string do Postgres (só `bi_readonly`, escopada às views de `bi`, por esta proposta) enviada à Metabase Inc. | Nenhuma credencial sai da infraestrutura já controlada — mas o host precisa da mesma connection string de qualquer forma |
| **LGPD — operador de dados adicional** | Sim, explicitamente (Metabase Inc. processa os dados que a query retornar) — ver §8 | Não, se hospedado em infraestrutura já sob controle direto (embora o provedor de VPS ainda seja tecnicamente um processador de infraestrutura, categoria diferente e já presumivelmente coberta pela mesma análise que cobre Vercel/Supabase hoje) |
| **Velocidade para o piloto** | Imediata — sem setup de infraestrutura | Depende de configurar e validar um ambiente novo antes do primeiro dashboard existir |

### Decisão do Product Owner (D10, 2026-08-14): APPROVED CONDITIONALLY

**Metabase Cloud para o piloto** — a mesma inclinação levantada nesta
investigação, agora aprovada, **condicionada ao resultado da revisão D9**
(avaliação de LGPD dentro de SET-45/SET-74). Se essa revisão concluir que
Metabase Cloud é inaceitável neste estágio, a decisão volta a ser
reaberta — não fica automaticamente resolvida em favor de self-hosted, é
reavaliada. **Self-hosted fica `DEFERRED`** enquanto D9 não travar Cloud
explicitamente: não é a alternativa padrão em caso de dúvida, é uma opção
que só volta à mesa se D9 justificar.

---

## 12. Decisões em aberto (Product Owner)

1. **Se adotar Metabase (ou qualquer BI) é, de fato, a decisão desejada
   agora** — isso reverte/estende a decisão explícita de escopo já
   registrada em `PILOT_METRICS.md`/SET-50 ("sem BI"). Ver §0.
2. **Se a revisão jurídica de LGPD (SET-45/SET-74, já pendente por outro
   motivo) precisa cobrir Metabase como novo operador de dados antes de
   qualquer conexão real ser configurada** — ver §8.
3. **Metabase Cloud vs. self-hosted** — inclinação registrada em §11
   (Cloud), decisão final do Product Owner.
4. **Se/quando as views do schema `bi` e o role `bi_readonly` propostos
   nesta investigação devem ser efetivamente criados** — nenhuma delas
   foi criada aqui; isso é trabalho de implementação futuro, fora do
   escopo desta tarefa.
5. **Se `response_detail` de `feedback_responses` deve ter algum caminho
   de leitura estruturado além do SQL Editor direto** — proposta desta
   investigação é "não, fica fora de qualquer BI de uso geral" (§8), mas
   isso é uma escolha de produto, não uma consequência técnica automática.

---

## Resumo para o terminal/chat

```
VERDICT: INVESTIGATION_COMPLETE — AWAITING_PO_SCOPE_DECISION
(a decisão de adotar BI em si reverte um "sem BI" já registrado em
PILOT_METRICS.md/SET-50 — ver §0/§12.1, não presumida aqui)

KPIs — DIRECT QUERY (sem view necessária):
1 (cadastrados + novos no período), 3 (páginas publicadas), 4 (adoção),
14 (distribuição de feedback, exceto minimização de PII)

KPIs — VIEW JUSTIFICADA:
2 (ativado, D1), 6/7/8/9 (tráfego/cliques/leads/resultado, janela e UNION
canônicos), 10/11b (pagante, provider='asaas', founding cohort), 12/13
(cancelamento vs. suspensão, D30/D60), MRR

KPIs/DADOS — NÃO MATERIALIZAR:
Period Churn Rate (D7, deferred); Core Validation Analysis (exploratória,
volume pequeno); feedback_responses.response_detail individual (PII)

READ-ONLY ROLE:
bi_readonly (login, sem bypassrls, sem herdar de anon/authenticated/
service_role) lendo só views do schema bi, de propriedade de
bi_view_owner (nologin, bypassrls) — nenhuma tabela de public exposta
diretamente. Nada criado nesta investigação.

RISCO RLS PRINCIPAL:
auth.uid() é NULL fora de uma sessão PostgREST — uma conexão de BI sem
bypass não "vê os dados filtrados por segurança", vê ZERO linhas nas
tabelas com policy própria, e um subconjunto incompleto (só
publicamente elegível) em representatives/product_activations. RLS não
foi desenhada para controlar acesso de BI; views curadas são o mecanismo
certo.

PII MAIS SENSÍVEL:
leads.telefone_e164 e leads.campos — nenhum KPI precisa deles; a view
proposta (bi.v_leads_agg) nem os inclui.

METABASE CLOUD VS SELF-HOSTED:
Recomendação: Cloud, para o piloto — coerente com o padrão já
estabelecido do projeto de não operar infraestrutura própria (mesmo
raciocínio de SPRINT_E_PLAN §2.4). Self-hosted fica como gatilho futuro,
condicionado a revisão jurídica ou custo.

DOCUMENT CREATED:
docs/plans/ANALYTICS_DATA_LAYER_METABASE_READINESS.md
```
