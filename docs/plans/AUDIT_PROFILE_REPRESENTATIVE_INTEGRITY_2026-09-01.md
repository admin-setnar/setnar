Status: Investigation complete — READ-ONLY, no remediation implemented. Two of the §15 hardening options (anti-production guard, DELETE audit trail) have since been implemented — see the addendum at the end of this document. Recovery and the deeper architectural questions (§15's structural options, §16's open questions) remain unresolved, awaiting Product Owner decision.
Authority: Non-normative (ver `docs/plans/README.md`)
Investigation date: 2026-09-01
Investigator: Claude (Claude Code), read-only production access via PostgREST + Auth Admin API
Superseded by: —

# AUDIT_PROFILE_REPRESENTATIVE_INTEGRITY_2026-09-01.md

> Investigação estritamente read-only sobre a divergência entre `profiles`
> (8 linhas) e `representatives` (6 linhas) observada no snapshot de KPIs de
> 01/09/2026. **Nenhuma correção foi implementada.** Nenhum INSERT/UPDATE/
> DELETE foi executado — todas as consultas usadas aqui são `GET` contra a
> API REST (PostgREST) e a Auth Admin API do projeto de produção
> (`xiysyzauoifbcoviqblf`), mutação estruturalmente impossível pelo método
> HTTP usado.

---

## 1. Executive Summary

Dois `profiles` (Luiz Carlos e Wesley) existem sem `representative`
correspondente. A investigação encontrou:

- **Wesley**: nenhuma evidência, em nenhuma tabela, de que um
  `representative` jamais tenha existido para ele. O padrão observado —
  conta criada, onboarding de representante nunca concluído — é um estado
  **válido e esperado pela arquitetura atual** (cadastro e registro de
  representante são dois passos deliberadamente não-atômicos, "Opção B",
  decidida em 2026-08-01). Classificação: **onboarding abandonado**, alta
  confiança.
- **Luiz Carlos**: o brief desta investigação afirma que, na coleta de KPIs
  de 27/08/2026, ele possuía `representative` e era contado como "ativado".
  Essa afirmação **não pôde ser confirmada nem refutada** a partir do
  estado atual do banco — se um `representative` seu existiu com qualquer
  filho (subscription/product_activation/lead/analytics/feedback), sua
  remoção completa não deixou **nenhum** vestígio órfão em nenhuma das seis
  tabelas filhas verificadas. Isso não é o comportamento esperado de um bug
  de aplicação: as FKs de `representatives` para essas seis tabelas são
  `NO ACTION` (nunca `CASCADE`), e nenhum código deste repositório — app,
  RPC, trigger, cron ou os dois scripts administrativos existentes — jamais
  executa `DELETE FROM representatives`. Uma remoção completa e limpa,
  sem resíduo, é consistente apenas com uma operação manual, multi-tabela,
  na ordem correta, feita fora de qualquer caminho de código auditado deste
  projeto (SQL Editor/Table Editor do Supabase Studio, ou um script ad hoc
  usando `SUPABASE_SERVICE_ROLE_KEY` fora deste repositório).
- **Os dois casos são estruturalmente diferentes** e não devem ser tratados
  como o mesmo bug, como o brief desta tarefa já advertia.
- **Achado independente, não solicitado diretamente mas relevante para
  severidade**: KPI 2 ("Representante Ativado") é definido em
  `docs/plans/STAGE_1_KPI_SPECIFICATION.md` como métrica **lifetime, que
  nunca decresce** ("já publicou pelo menos uma vez"). O snapshot de 27/08
  registrou 8 ativados; o de 01/09 registra 6. Uma métrica lifetime caindo
  é, por definição do próprio documento oficial de KPIs, uma violação de
  invariante — independente da causa exata da remoção de Luiz Carlos.
- **Nenhuma correção foi aplicada.** Este documento apenas descreve o
  estado encontrado e propõe opções de remediation para decisão do Product
  Owner.

---

## 2. Estado atual confirmado (produção, 2026-09-01, consultas read-only)

| Tabela | Contagem | Observação |
|---|---|---|
| `auth.users` | 8 | via Auth Admin API |
| `profiles` | 8 | 1:1 com `auth.users` (trigger atômico) |
| `representatives` | 6 | |
| `subscriptions` | 6 | 1:1 com `representatives` (unique constraint) |
| `product_activations` | 35 | 32 dessas com `status='published'` (consistente com o snapshot fornecido) |
| `leads` | 2 | idêntico ao snapshot fornecido |
| `analytics_events` | 149 | = 120 `visit` + 29 `whatsapp_click` do snapshot fornecido (soma exata) |
| `feedback_responses` | 7 | |
| `billing_reconciliation_log` | 0 | `scripts/reconcile-billing-subscription.ts --apply` nunca foi executado em produção |
| `lgpd_request_log` | 0 | confirma a afirmação do brief — nenhum pedido LGPD formal foi registrado |

Os números batem exatamente com o snapshot de 01/09/2026 citado no brief,
confirmando que as consultas desta investigação leram o mesmo estado.

**Profiles sem representative correspondente: exatamente 2** — os dois
já identificados no brief (Luiz Carlos, Wesley). Nenhum terceiro caso foi
encontrado.

**Representatives sem profile correspondente: 0.** Estruturalmente
esperado — `representatives.profile_id` é `not null unique references
profiles(id)`, sem `on delete cascade` a partir de `representatives`; a FK
impede fisicamente que um `representative` referencie um `profile`
inexistente enquanto a constraint estiver ativa (confirmada ativa: nenhuma
violação encontrada).

**Órfãos em tabelas filhas de `representatives`** (linhas cujo
`representative_id` não corresponde a nenhum dos 6 `representatives`
atuais) — verificado em `subscriptions`, `product_activations`, `leads`,
`feedback_responses`, `billing_reconciliation_log`, `analytics_events` e
`lgpd_request_log`: **zero em todas as sete tabelas.** Este é o achado
técnico mais importante da investigação — ver §13.

---

## 3. Modelo de dados

```
auth.users (Supabase Auth)
   │  on delete cascade
   ▼
profiles                                     (1:1 com auth.users, criado por
   │  trigger handle_new_user(), atômico com o INSERT em auth.users)
   │  NOT NULL, UNIQUE profile_id, sem on delete cascade
   ▼
representatives                              (criado por register_representative(),
   │                                          RPC separada, chamada depois do login —
   │                                          NÃO atômica com a criação do profile)
   ├──▶ subscriptions          (unique representative_id; NO ACTION; desde
   │                            20260901000000, nasce atomicamente DENTRO da
   │                            mesma chamada de register_representative())
   ├──▶ product_activations    (NOT NULL representative_id; NO ACTION)
   ├──▶ analytics_events       (NOT NULL representative_id; NO ACTION)
   ├──▶ leads                  (NOT NULL representative_id; NO ACTION)
   ├──▶ feedback_responses     (NOT NULL representative_id; NO ACTION)
   ├──▶ billing_reconciliation_log (NULLABLE representative_id; NO ACTION)
   └──▶ lgpd_request_log       (NULLABLE representative_id; ON DELETE SET NULL,
                                 corrigido por 20260907000001)
```

Não existe tabela `commercial_pages` separada — uma "página" é o par
`(representative_id, product_id)` com `product_activations.status =
'published'` (ADR-029, confirmado em `STAGE_1_KPI_SPECIFICATION.md` KPI 3).

### PKs/FKs relevantes (confirmado nas migrations lidas)

| FK | Origem | `ON DELETE` |
|---|---|---|
| `profiles.id → auth.users.id` | `20260728000000` | `CASCADE` |
| `representatives.profile_id → profiles.id` | `20260731000000` | `NO ACTION` (default) |
| `subscriptions.representative_id → representatives.id` | `20260731000000` | `NO ACTION` |
| `product_activations.representative_id → representatives.id` | `20260731000000` | `NO ACTION` |
| `analytics_events.representative_id → representatives.id` | `20260810000000` | `NO ACTION` |
| `leads.representative_id → representatives.id` | `20260731000000` | `NO ACTION` |
| `feedback_responses.representative_id → representatives.id` | `20260822000000` | `NO ACTION` |
| `billing_reconciliation_log.representative_id → representatives.id` | `20260830000000` | `NO ACTION` (nullable) |
| `lgpd_request_log.representative_id → representatives.id` | `20260907000000`, corrigida `20260907000001` | `SET NULL` (era `NO ACTION`, bug corrigido em 2026-08-27 real) |

Nenhuma FK aponta para `representatives`/`profiles` com `CASCADE`, exceto
`profiles ← auth.users`. Isso é confirmado pelo próprio runbook do projeto
(`docs/runbooks/LGPD_RIGHTS.md` §7), que verificou ao vivo contra o banco
real (`information_schema`/`pg_constraint`) que as seis FKs de tabelas
filhas de `representatives` são todas `NO ACTION`.

### Q1 — Um `profile` sem `representative` é um estado válido?

**Sim, por desenho, deliberado e documentado.** A migration
`20260806000000_add_register_representative.sql` (linhas 1-9) declara
explicitamente que esta é a "Opção B — onboarding explícito pós-login",
decisão fechada por Pedro em 2026-08-01. Cadastro (`auth.users` +
`profiles`, atômico via trigger) e registro de representante
(`register_representative()`, RPC separada, chamada só depois do login) são
**dois passos distintos, não transacionais entre si**. `STAGE_1_KPI_SPECIFICATION.md`
KPI 1 confirma isso na prática: "Um `profile` (...) sem `representative`
correspondente NÃO conta [como cadastrado] — é 'cadastro incompleto', uma
métrica derivada separada."

### Q2 — Existe constraint garantindo `representative.profile_id → profiles.id`?

Sim: `representatives.profile_id uuid not null unique references
public.profiles (id)` (`20260731000000:160`). Não tem `on delete cascade`
— um `profile` referenciado por um `representative` não pode ser apagado
enquanto o `representative` existir (confirmado: zero `representatives`
órfãos de `profiles` na produção).

### Q3 — Existe constraint garantindo que todo `profile` tenha exatamente um `representative`?

**Não, e isso é deliberado** — não existe, nem poderia existir de forma
simples, porque a arquitetura escolhida (Q1) exige que a janela "profile
sem representative" seja permitida enquanto o onboarding não é concluído.
Uma constraint `NOT NULL`/`CHECK` nessa direção quebraria o próprio fluxo
de signup.

### Q4 — Quais registros são apagados automaticamente se um `representative` for removido?

**Nenhum**, hoje, por FK/trigger — todas as seis FKs de tabelas filhas são
`NO ACTION`. Um `DELETE FROM representatives` com qualquer filho existente
falha com violação de FK, a menos que os filhos sejam apagados primeiro,
manualmente, em ordem. Isto é confirmado tanto pela leitura das migrations
quanto pelo próprio runbook do projeto (`LGPD_RIGHTS.md` §7, verificado ao
vivo).

---

## 4. Write paths — todos os lugares que podem criar/alterar/remover `representatives`

| Write path | Arquivo | Operação | Pode apagar `representative`? | Pode criar `profile` sem `representative`? | Condições |
|---|---|---|---|---|---|
| `handle_new_user()` trigger | `20260728000000`, `20260901000000` (add phone) | INSERT em `profiles` (não em `representatives`) | Não | **Sim — é exatamente este o mecanismo**: todo signup cria `profile`, nunca `representative` | Dispara em todo INSERT em `auth.users`, atômico com ele |
| `register_representative()` RPC | `20260806000000` → `20260813/14` (rename) → `20260901000000` (+ trial) | INSERT em `representatives` (+ INSERT em `subscriptions` desde 20260901000000, mesma transação) | Não | N/A | `grant ... to authenticated`; scoped a `auth.uid()`; nunca aceita `profile_id` do chamador |
| `update_representative_profile()` RPC | `20260808000000` | UPDATE `phone`/`city`/`license_id`→`authorization_id` | Não | Não | `authenticated`, escopado à própria linha |
| `set_activation_status()` / publicação | `20260807000000` | INSERT/UPDATE em `product_activations` | Não (não toca `representatives`) | Não | — |
| `execute-lgpd-request.ts --right=correcao` | `scripts/execute-lgpd-request.ts:249-269` | UPDATE `phone`/`city`/`display_name` | Não | Não | manual, `service_role`, auditado em `lgpd_request_log` |
| `execute-lgpd-request.ts --right=eliminacao` | `scripts/execute-lgpd-request.ts:271-312` | UPDATE `status='suspended'` + redação de PII (**nunca DELETE**, comentário explícito no código: "Nunca um DELETE da linha") | **Não, por desenho** — bloqueado pelas FKs `NO ACTION` mesmo com `service_role`, e o script nem tenta | Não | manual, `service_role`, auditado |
| `reconcile-billing-subscription.ts` | `scripts/reconcile-billing-subscription.ts` | INSERT/UPDATE em `subscriptions`/`billing_reconciliation_log` | Não (nunca toca `representatives`) | Não | manual, `service_role` |
| `purge_expired_retention_data()` (pg_cron, diário 03:00) | `20260904000000` | DELETE em `leads` (>24 meses) e `analytics_events` (>12 meses) | Não (nunca toca `representatives`/`subscriptions`/`product_activations`) | Não | automático, mas escopo explicitamente restrito a essas duas tabelas |
| Testes de integração (`tests/*.integration.test.ts`, `tests/e2e/support/fixtures.ts`) | 27 arquivos, ex.: `tests/subscription-cancellation.integration.test.ts:121` | `service!.from('representatives').delete().eq('id', ...)` | **Sim — mas apenas por `id` explícito que o próprio teste criou momentos antes**, em cleanup (`afterEach`/`afterAll`) | Não (cria e limpa o próprio profile também) | Roda contra `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` do ambiente — **nenhum guard de código impede essas variáveis de apontar para produção**; ver §9 |
| Deleção de `auth.users` (Supabase Auth Admin) | — nenhum caminho de código chama isso | `DELETE auth.users` → `ON DELETE CASCADE` apaga `profiles` também | Sim, indiretamente (bloqueada pela mesma FK `NO ACTION` se houver `representative`) | N/A | **Descartado para os dois casos**: apagaria `profiles` junto, e os dois `profiles` continuam existindo |
| Supabase Studio (SQL Editor / Table Editor), ou script ad hoc fora do repositório | não versionado | Qualquer operação, sem guard de aplicação | **Sim** — é o único caminho tecnicamente capaz de produzir o estado observado (representative + todos os filhos removidos sem resíduo) | Sim | Requer posse de `SUPABASE_SERVICE_ROLE_KEY` (ou acesso de dono de projeto no dashboard) — "Executor único: Pedro" por `docs/runbooks/LGPD_RIGHTS.md` §3, mesma pessoa/credencial usada nos dois scripts acima |

Nenhum código de aplicação, RPC, trigger ou job agendado deste repositório
executa `DELETE FROM representatives` fora dos arquivos de teste — e os
arquivos de teste só apagam IDs que o próprio teste criou segundos antes,
nunca um ID pré-existente arbitrário. `tests/authenticated-app-consolidation.test.ts`
e `tests/analytics-integrity-consolidation.test.ts` inclusive contêm
asserções estáticas (`assert.doesNotMatch`) que falham a suíte se qualquer
migration futura introduzir `delete from public.representatives` — uma
proteção deliberada contra esse write path aparecer por acidente.

---

## 5. Fluxo de onboarding

```
1. Usuário submete signUpSchema (email/senha/nome, NAME_MIN_LENGTH=2)
2. auth.users INSERT
     └─ trigger on_auth_user_created → handle_new_user() (SECURITY DEFINER)
          └─ profiles INSERT — ATÔMICO com o passo 2 (mesma transação Postgres)
3. [GAP — sem transação, sem prazo, sem retry automático]
   Usuário precisa logar (se ainda não estiver) e navegar até o formulário
   de onboarding (`onboarding-form.tsx`), preencher slug/nome/authorization_id/
   telefone/cidade, e submeter
4. registerRepresentativeAction → register_representative() RPC
     └─ representatives INSERT + subscriptions INSERT (trialing, 30 dias) —
        atômico entre si (mesma função, mesma transação) DESDE 20260901000000;
        antes dessa migration, só representatives era criado aqui
5. redirect('/app') em caso de sucesso
```

**A janela entre o passo 2 e o passo 4 é real, sem timeout, e não tem
nenhuma recuperação automática.** Se o usuário fecha a aba, perde conexão,
não confirma e-mail/telefone (**ambos os dois casos desta investigação
têm `phone_confirmed_at` nulo no Auth**, achado read-only confirmado), ou
simplesmente não volta, o sistema fica permanentemente em
"`profile` sem `representative`" — não há job, trigger ou processo que
tente completar ou expirar esse estado. Isso é aceito pela arquitetura
(§3, Q1) e é exatamente a "cadastro incompleto" que `STAGE_1_KPI_SPECIFICATION.md`
KPI 1 já nomeia como métrica derivada esperada, não um erro.

Nenhuma race condition dentro do próprio `register_representative()` deixa
esse estado: a função é `SECURITY DEFINER`, roda em uma única transação
Postgres, trata `unique_violation` via `exception` block (disambiguando
`already_registered` vs `slug_taken`), e qualquer falha antes do
`insert ... returning id` faz rollback completo — não há cenário de
"representative criado pela metade".

---

## 6. Caso Luiz Carlos

| Campo | Valor |
|---|---|
| `auth.users.id` | `2f805506-d2fa-472a-b56e-9e0c4260f751` |
| `auth.users.created_at` | `2026-08-25T23:44:08.855585Z` |
| `phone_confirmed_at` | null (não confirmado) |
| `profiles.created_at` | `2026-08-25T23:44:08.853598+00:00` (idêntico ao auth, confirma criação atômica) |
| `profiles.updated_at` | **idêntico a `created_at`** — o profile nunca foi tocado desde a criação |
| `representative` atual | **não existe** |

### Q5 — Existe evidência independente do snapshot de 27/08 de que ele possuía um `representative`?

**Não, dentro do que esta investigação consegue verificar.** O brief desta
tarefa afirma que a coleta de 27/08 o contabilizava com `representative` e
"ativado". Não existe, nas tabelas atuais, nenhum vestígio independente
disso: nenhuma linha em `subscriptions`/`product_activations`/`analytics_events`/
`leads`/`feedback_responses`/`billing_reconciliation_log`/`lgpd_request_log`
referencia um `representative_id` que não corresponda a um dos 6 atuais
(§2/§13). Isso significa uma de duas coisas, indistinguíveis a partir do
estado atual do banco:

  (a) Um `representative` seu existiu com filhos, e **todos** foram
  removidos, na ordem correta, sem deixar resíduo em nenhuma tabela —
  operação manual multi-tabela; ou
  (b) Ele nunca teve `representative`, e a coleta de 27/08 continha um erro
  de medição/atribuição.

Esta investigação **não teve acesso** a WAL/logs de query do Postgres de
produção, ao histórico de `pg_stat_statements`, nem à API de Management do
Supabase (fora do escopo de `.env.production.local`, que só contém
credenciais de dados, não de gestão do projeto) — não há como reconstituir
o estado exato do banco em 27/08 com os meios read-only disponíveis aqui.
**Isto é uma limitação de evidência, registrada explicitamente, não uma
conclusão.**

### Q6 — É possível determinar quando o registro desapareceu?

Não, com os meios disponíveis. `profiles.updated_at` (o único timestamp que
sobreviveria a uma remoção do `representative`) está **idêntico** a
`created_at` — o que só prova que o `profile` em si nunca foi tocado; não
dá nenhuma pista sobre quando (ou se) um `representative` associado foi
removido.

### Q7 — Quais operações existentes no código poderiam produzir exatamente "profile permanece, representative desaparece"?

**Nenhuma.** Ver §4 — toda operação de código deste repositório que toca
`representatives` é INSERT (só criação) ou UPDATE (correção/redação LGPD).
A única operação de DELETE em qualquer código deste repositório é nos
testes de integração, e esses sempre deletam um ID que o próprio teste
acabou de criar — nunca um `representative` pré-existente e nunca sem
também apagar o `profile` correspondente que o mesmo teste criou. Nenhum
teste teria como conhecer ou visar o `profile_id`/`representative.id` real
de Luiz Carlos.

A única forma tecnicamente compatível com o estado observado é uma
operação **fora deste repositório**: SQL Editor / Table Editor do Supabase
Studio, ou um script não versionado usando `SUPABASE_SERVICE_ROLE_KEY`.

### Q8 — Alguma dessas operações também apagaria subscription/páginas/analytics/leads/feedback?

Se a hipótese (a) do Q5 for verdadeira, **sim, necessariamente** — as seis
FKs `NO ACTION` tornam fisicamente impossível apagar `representatives`
enquanto qualquer filho existir. Um `representative` "ativado" (per KPI 2,
que exige uma linha em `product_activations` com
`status in ('published','unpublished')`) teria, no mínimo, essa linha de
`product_activations`, e muito provavelmente uma `subscriptions` (trial
automático desde `20260901000000`, migration confirmada aplicada em
produção — ver §8). Isso significa que, se a hipótese (a) for verdadeira,
**dados históricos de página publicada, e possivelmente de tráfego/leads
daquele representante específico, teriam sido apagados junto** — não
apenas a linha de `representatives`.

### Q9 — Existem vestígios que permitam inferir cascata de exclusão?

Não. Uma cascata manual completa e correta, por definição, não deixa
vestígio nas tabelas ainda existentes — o vestígio, se existisse, estaria
em logs de query do Postgres ou em um backup/snapshot anterior a 01/09, aos
quais esta investigação não teve acesso read-only.

---

## 7. Caso Wesley

| Campo | Valor |
|---|---|
| `auth.users.id` | `7c3a7589-113f-494b-b98d-8e898f414804` |
| `auth.users.created_at` | `2026-08-27T20:14:01.216581Z` |
| `phone_confirmed_at` | null (não confirmado) |
| `profiles.created_at` | `2026-08-27T20:14:01.214785+00:00` |
| `profiles.updated_at` | idêntico a `created_at` |
| `representative` atual | não existe |

Investigado **independentemente** do caso Luiz Carlos, sem reutilizar a
conclusão dele, conforme exigido pelo brief.

### Q10 — Wesley chegou a completar o onboarding?

Não há evidência de que sim. Nenhum `representative` existe para ele hoje.

### Q11 — Existe qualquer evidência de que um `representative` chegou a ser criado?

**Nenhuma.** Diferente do caso Luiz Carlos, não há nenhuma afirmação prévia
(nem no brief, nem em nenhum snapshot citado) de que Wesley tenha
aparecido em uma contagem de `representatives`/"ativados" em algum momento
passado. A única coleta de KPI que o inclui (01/09) já o mostra sem
`representative`.

### Q12/Q13/Q14 — Subscription/trial, páginas, eventos pós-`representative`?

Todas negativas pelo mesmo raciocínio do §2/§13: nenhuma linha órfã em
`subscriptions`/`product_activations`/`analytics_events`/`leads`/
`feedback_responses` referencia um `representative_id` fora dos 6 atuais
— e, para Wesley especificamente, não há sequer uma alegação prévia de que
ele tenha tido um. Nada nessas tabelas poderia existir "depois" de um
`representative` seu, porque nenhuma delas pode ser escrita sem um
`representative_id` válido (`analytics_events`/`leads`/`product_activations`
têm FK `not null`).

### Q15 — Classificação, com evidências

**(A) Onboarding abandonado — classificação com maior suporte de
evidência.**

- `profiles.created_at` (27/08 20:14) é o **mais recente dos 8 profiles**
  no dataset de 01/09 — ele é, literalmente, o último usuário a se
  cadastrar antes do snapshot, com poucos dias de conta.
- `phone_confirmed_at` nulo no Auth (mesmo padrão de Luiz Carlos) —
  consistente com uma sessão de signup que não foi levada até o fim.
- Nenhum vestígio, em nenhuma tabela filha de `representatives`, de que
  qualquer atividade pós-onboarding (publicação, tráfego, lead, trial)
  jamais tenha ocorrido em nome dele.
- A arquitetura já documenta esse exato estado como esperado e sem prazo
  de expiração (§5) — "cadastro incompleto" é uma categoria nomeada, não
  uma anomalia.
- Não há nenhuma reivindicação histórica (diferente de Luiz Carlos) de que
  ele tenha sido contado como "ativado" em qualquer coleta anterior.

Nada nos dados é compatível com (C) "representative criado e
posteriormente excluído" — essa hipótese exigiria alguma evidência
histórica de existência prévia, que não existe para Wesley (ao contrário
de Luiz Carlos, cujo caso tem pelo menos a alegação do snapshot de 27/08).
(B) "falha parcial durante onboarding" é tecnicamente descartada pelo
desenho atômico de `register_representative()` (§5) — não há um estado
intermediário possível dentro dessa função. (D) "comportamento
intencional" não se aplica a um usuário individual (é intencional que o
*estado* seja possível, não que Wesley especificamente tenha sido alvo de
alguma ação).

---

## 8. Histórico Git relevante

Busca em `git log` sobre `supabase/migrations`, `scripts`,
`src/modules/representatives`, `src/modules/auth` entre 2026-08-20 e
2026-09-02 (datas reais de commit, não os nomes de arquivo de migration,
que neste repositório não correspondem de forma confiável à data real de
commit — confirmado comparando `git log --format=%cI` de várias migrations
contra seus nomes de arquivo).

**Nenhum commit nesse intervalo toca `representatives`, onboarding, LGPD,
signup, cancelamento, cleanup ou qualquer write path para
`representatives`.** Os únicos commits no período tocam analytics de
atribuição de origem (SET-84/SET-105), CTAs comerciais (SET-97/SET-100) e
navegação (SET-107) — nenhum relacionado à criação/remoção de
representantes.

A migration mais relevante ao ciclo de vida (`20260901000000_add_trial_lifecycle.sql`,
que torna `representatives`+`subscriptions` atômicos) tem **data real de
commit 2026-08-10**, bem antes do cadastro de Luiz Carlos (25/08) e Wesley
(27/08) — confirmado (§ próximo parágrafo) como já aplicada em produção
antes dos dois cadastros. Isso significa que, se Luiz Carlos completou o
onboarding em algum momento, ele teria recebido uma linha de `subscriptions`
`trialing` atomicamente junto — mais um filho que precisaria ter sido
removido para produzir o estado atual, caso a hipótese (a) do §6/Q5 seja
verdadeira.

**Confirmação read-only de que a migration está aplicada em produção**:
`GET /rest/v1/subscriptions?status=eq.trialing` retornou linhas com esse
status (só existe se o `CHECK` constraint de `20260901000000` estiver
ativo). Por comparação, `analytics_events.origin`/`leads.origin` (das
migrations de 27-28/08, commits reais) **não existem ainda** em produção —
confirmando que produção está num ponto do histórico de migrations
anterior a essas duas, mas já posterior a `20260901000000`. Não há
indício de que qualquer migration relacionada a `representatives`/
onboarding/LGPD tenha sido aplicada ou revertida fora de ordem no período
relevante.

**Conclusão desta fase**: nenhuma mudança de código no período em questão
explica o estado observado. Isso reforça, por eliminação, a conclusão do
§4/§6 — a causa mais compatível com a evidência técnica é uma operação
manual fora do código versionado, não uma regressão de código.

---

## 9. Auditoria sistêmica (Fase 7)

| Item | Resultado |
|---|---|
| **A.** `profiles` sem `representatives` | **2** — Luiz Carlos, Wesley. Nenhum terceiro caso. |
| **B.** `representatives` sem `profiles` | **0** — estruturalmente prevenido pela FK `not null` sem cascade a partir de `representatives`. |
| **C.** `representatives` sem `subscription` quando deveriam ter | **0** — 6 `representatives`, 6 `subscriptions`, `unique` constraint 1:1. Todos os 6 atuais têm subscription. |
| **D.** `subscriptions` órfãs (representative_id sem representative) | **0**. |
| **E.** "páginas" órfãs (`product_activations` sem representative) | **0**. |
| **F.** `analytics_events`/eventos referenciando entidade inexistente | **0** — verificado contra os 149 eventos atuais; nenhum `representative_id` fora dos 6 correntes. |
| **G.** `leads` órfãos | **0** — 2 leads, ambos referenciando representatives atuais. |
| **H.** outras inconsistências derivadas de FK | `feedback_responses` (7 linhas) e `billing_reconciliation_log` (0 linhas): mesma verificação, mesmo resultado — zero órfãos. `lgpd_request_log` (0 linhas): vazio, consistente com a afirmação do brief. |

**Risco sistêmico direto**: nenhum, hoje — a população atual de 6
`representatives` está integralmente consistente com todas as tabelas
filhas. O risco não está em uma inconsistência estrutural presente, mas na
**ausência de qualquer guarda que impeça esse mesmo padrão (write path
fora do código, sem auditoria) de se repetir** — ver §14.

**Sobre o risco de recorrência do padrão "profile sem representative" em
si (não a remoção, o estado em si)**: 2 de 8 (25%) dos `profiles` atuais
estão nesse estado. Dado que é um estado intencional/esperado do funil de
onboarding (§3/§5), esse número por si só não é uma anomalia — é o
"cadastro incompleto" que `STAGE_1_KPI_SPECIFICATION.md` já nomeia e
espera medir como métrica derivada. O que **não** é esperado é que um dos
dois (Luiz Carlos, se a alegação de 27/08 for verdadeira) tenha chegado a
esse estado por *remoção* em vez de por nunca ter completado o onboarding.

---

## 10. Impacto em dados dependentes

Nenhum dado dependente **atualmente existente** está em risco — a
auditoria sistêmica (§9) não encontrou órfãos. O impacto relevante é
retrospectivo, condicional à hipótese (a) do §6/Q5: se Luiz Carlos teve um
`representative` com filhos, esses filhos foram apagados junto — o que
significa que qualquer contagem histórica de `product_activations`,
possivelmente `subscriptions`, `analytics_events` ou `leads` daquele
representante específico não é mais reconstituível a partir do banco atual.

---

## 11. Impacto nos KPIs

O snapshot fornecido:

| KPI | 27/08 | 01/09 |
|---|---|---|
| Cadastrados (`representatives`, KPI 1) | 8 | 6 |
| Ativados (`product_activations`, KPI 2 — **lifetime**) | 8 | 6 |
| Com página no ar (KPI 3, snapshot) | — | 6 |
| Páginas publicadas | — | 32 |
| Visitas | — | 120 |
| Cliques WhatsApp | — | 29 |
| Leads | — | 2 |

### Q16 — Os KPIs do SETNAR são atualmente historicamente reprodutíveis?

**Não, em geral, e isso já é uma limitação documentada e aceita
independentemente deste incidente.** `STAGE_1_KPI_SPECIFICATION.md` não
inclui nenhum mecanismo de snapshot histórico point-in-time — todo KPI
"lifetime"/"snapshot" é recalculado a partir do estado *atual* das
tabelas, nunca de um histórico append-only imutável. `billing_events` é a
única tabela append-only real do projeto (e nem essa cobre
cancelamentos — KPI 12/13 já documentam essa lacuna). Isso significa que
qualquer DELETE físico em qualquer tabela-fonte de KPI (mesmo um DELETE
"legítimo", como o `purge_expired_retention_data()` de 12/24 meses)
já é capaz de alterar retroativamente um número recalculado — este
incidente não introduz uma capacidade nova, apenas demonstra um caso
concreto dela em uma tabela (`representatives`/filhos) que não tinha
nenhuma purga automática esperada.

### Q17 — Excluir uma entidade operacional pode reescrever retroativamente os números históricos?

**Sim, confirmado tecnicamente por este próprio incidente**: KPI 2
("Ativados") é definida em `STAGE_1_KPI_SPECIFICATION.md` linha 132 como
"lifetime/marco histórico — **nunca decresce**". O snapshot fornecido
mostra 8 → 6, uma queda de 2. Por definição do próprio documento oficial
de KPIs deste projeto, isso é uma violação do invariante declarado da
métrica — independentemente de qual das hipóteses do §6/Q5 for a
verdadeira, **o número documentado como "nunca decresce" decresceu**.

### Q18 — Existe necessidade arquitetural de preservar eventos históricos independentemente do lifecycle do representative?

Sim — esta é exatamente a lacuna que este incidente expõe. Hoje, todo KPI
"lifetime" (KPI 1, KPI 2(B), KPI 14/15) depende implicitamente de que
`representatives` e suas tabelas filhas nunca sejam fisicamente apagadas
fora dos casos já modelados (suspensão/redação LGPD, que preservam a
linha). Não existe uma tabela de fatos append-only e imutável (ex.: um
`representative_lifecycle_events` ou equivalente a `billing_events`, mas
para o funil de ativação) que sobreviva independentemente de a linha viva
de `representatives` existir. Isso é uma observação arquitetural, não uma
recomendação de implementação — ver §12 para opções, sem implementá-las.

---

## 12. Root Cause Analysis

## Luiz Carlos

**Classificação:** `HIGH_CONFIDENCE` (sobre o *mecanismo*, condicional à
premissa de que um `representative` existiu) / `ROOT_CAUSE_NOT_PROVEN`
(sobre o *ator, momento exato e motivo* — ver o que falta abaixo)

**Causa:** Se o `representative` de Luiz Carlos existiu (conforme afirmado
pela coleta de KPI de 27/08, citada no brief desta investigação), sua
remoção **não foi causada por nenhum código deste repositório** — nem
aplicação, nem RPC, nem trigger, nem cron, nem o script de LGPD (que por
desenho nunca executa DELETE em `representatives`, só suspensão+redação).
A causa mais compatível com a evidência técnica é uma operação manual,
direta contra o banco de produção (SQL Editor ou Table Editor do Supabase
Studio, ou um script ad hoc fora do repositório usando
`SUPABASE_SERVICE_ROLE_KEY`), que apagou o `representative` **e todos os
seus registros filhos, na ordem correta que respeita as FKs `NO ACTION`**
— um procedimento manual multi-tabela deliberado, não um clique acidental
único (um DELETE único na linha de `representatives`, sozinho, teria
falhado com violação de FK caso qualquer filho existisse, e o erro teria
impedido a remoção).

**Evidências:**
- Ausência total de vestígio órfão em qualquer uma das 7 tabelas
  verificadas (§2, §9) — consistente com uma limpeza completa e correta.
- Nenhum write path de código, em nenhuma parte do repositório, executa
  `DELETE FROM representatives` fora de testes que só apagam IDs recém-criados
  pelo próprio teste (§4).
- `profiles.updated_at` de Luiz Carlos é idêntico a `created_at` — a linha
  de `profiles` nunca foi tocada, o que **descarta especificamente** o
  script `execute-lgpd-request.ts --right=eliminacao` como causa (esse
  script sempre escreve em `profiles.full_name`/`phone` como parte da
  mesma operação — se tivesse rodado, `updated_at` teria mudado).
- `lgpd_request_log` está vazio (confirmado, não só pela afirmação do
  brief, mas por consulta direta) — nenhum pedido LGPD formal foi
  registrado para ninguém, não só para Luiz Carlos.
- `billing_reconciliation_log` também está vazio — o outro script
  privilegiado do projeto (`reconcile-billing-subscription.ts`) nunca foi
  executado com `--apply` em produção, e de qualquer forma nunca toca
  `representatives`.
- Precedente documentado real: `docs/runbooks/LGPD_RIGHTS.md` §11 registra
  que, em 2026-08-12, o autor deste projeto (único detentor da
  `SUPABASE_SERVICE_ROLE_KEY`, "Executor único: Pedro" per §3 do mesmo
  documento) já executou manualmente, ao vivo, uma criação e remoção
  completa de um `representative`+filhos sintéticos — contra o projeto de
  teste, não produção, mas demonstrando que essa operação multi-tabela
  específica já foi feita antes, manualmente, pela mesma pessoa/credencial.
- `.env.local` e `.env.production.local` usam exatamente a mesma variável
  (`NEXT_PUBLIC_SUPABASE_URL`, confirmado nas duas linhas 10 dos dois
  arquivos) — um ambiente de shell/terminal carregando o arquivo errado é
  um erro estruturalmente fácil de cometer.

**Evidências contrárias:** Nenhuma encontrada de que a remoção **não**
ocorreu — mas, simetricamente, **não há nenhuma evidência positiva
independente do próprio snapshot de 27/08 de que o `representative` chegou
a existir**. O estado atual do banco é, por construção (ausência de log de
auditoria de operações não-privilegiadas fora dos dois scripts), igualmente
consistente com "nunca existiu" e com "existiu e foi limpo sem resíduo".

**Write path compatível:** Nenhum caminho de código deste repositório —
apenas acesso privilegiado direto ao banco (SQL Editor/Table Editor do
Supabase Studio, ou script não versionado com `SUPABASE_SERVICE_ROLE_KEY`),
executado fora de qualquer script auditado existente no projeto.

**Momento provável:** Não determinável com os meios read-only disponíveis
(sem acesso a WAL/logs de query/Management API de produção). Limitado ao
intervalo entre 27/08/2026 (data da coleta que o contabilizava) e
01/09/2026 (data da coleta atual).

**Impacto:** Se a hipótese de existência prévia for verdadeira: perda
permanente do `representative`, de sua `subscription` (provavelmente
`trialing`, dado que `20260901000000` já estava aplicada antes do cadastro
dele), de ao menos uma linha de `product_activations`, e possivelmente de
`analytics_events`/`leads`/`feedback_responses` associados — nenhum
recuperável a partir do banco atual. Reflexo direto na queda de KPI 2
(8→6), que por definição documentada nunca deveria decrescer (§11/Q17).

**O que falta para provar a causa exata:** acesso a logs de query/auditoria
do Postgres de produção no período 27/08–01/09 (ex.: `pg_stat_statements`
se habilitado, logs do Supabase, ou a API de Management do Supabase, que
não está entre as credenciais disponíveis em `.env.production.local`); ou
um backup/snapshot point-in-time de antes de 01/09 para comparar
diretamente contra o estado atual.

## Wesley

**Classificação:** `HIGH_CONFIDENCE`

**Causa:** Onboarding nunca concluído. Ele criou uma conta
(`auth.users`+`profiles`, atômico) e nunca chegou a submeter o formulário
de registro de representante (`register_representative()`), deixando a
conta permanentemente no estado "cadastro incompleto" que a própria
arquitetura já nomeia e aceita como possível e sem prazo de expiração
(§3/§5).

**Evidências:** Profile mais recente do dataset (27/08, o último dos 8);
`phone_confirmed_at` nulo no Auth; nenhuma linha em nenhuma tabela filha de
`representatives` referencia qualquer id fora dos 6 atuais (§9); nenhuma
alegação histórica prévia (diferente de Luiz Carlos) de que ele tenha sido
contado como representante em qualquer coleta anterior.

**Evidências contrárias:** Nenhuma.

**Write path compatível:** Nenhuma operação de remoção é necessária para
explicar este caso — a simples ausência de uma chamada bem-sucedida a
`register_representative()` já explica o estado observado por completo.

**Momento provável:** Não aplicável — não houve remoção, apenas
onboarding nunca concluído, a qualquer momento entre 27/08/2026 20:14
(criação da conta) e 01/09/2026 (snapshot atual).

**Impacto:** Nenhum dado foi perdido — nunca existiu nada além do
`profile` para perder.

---

## 13. Severidade

| Aspecto | Avaliação |
|---|---|
| **Wesley** | Baixa. Comportamento esperado da arquitetura atual, sem perda de dados, sem violação de invariante. |
| **Luiz Carlos (se a premissa de existência prévia for verdadeira)** | **Alta.** Perda de dados de um representante real e potencialmente pagante (trial), sem qualquer trilha de auditoria (nem `lgpd_request_log`, nem `billing_reconciliation_log`), executada por um caminho totalmente fora do código versionado e das duas ferramentas administrativas auditadas do projeto. Além disso, viola um invariante documentado e oficial de KPI ("lifetime, nunca decresce"), o que compromete a confiabilidade de relatórios do piloto para o Product Owner. |
| **Sistêmico (blast radius atual)** | Baixo — a auditoria de §9 não encontrou nenhuma outra inconsistência na população viva de 6 `representatives`. O risco não é de dado corrompido hoje, é de **recorrência silenciosa** do mesmo padrão (ver §14). |

---

## 14. Risco de recorrência

**Real, e estruturalmente favorecido pelo desenho atual, por três razões
independentes:**

1. **Nenhum guard de código impede um script de teste/limpeza de apontar
   para produção.** `scripts/require-integration-env.mjs` só verifica que
   as três variáveis (`NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)
   *existem* — nunca verifica *qual projeto* elas apontam. `.env.local` e
   `.env.production.local` compartilham exatamente o mesmo nome de
   variável (§12), tornando um erro de shell/ambiente estruturalmente
   fácil.
2. **Os dois scripts administrativos privilegiados (`execute-lgpd-request.ts`,
   `reconcile-billing-subscription.ts`) são as únicas operações
   "protegidas" e auditadas — mas nada impede uma operação manual via SQL
   Editor/Table Editor do Supabase Studio, que não passa por nenhum dos
   dois e não é registrada em nenhuma tabela de auditoria deste projeto.**
   O runbook de LGPD já demonstra (§11 daquele documento) que operações
   manuais multi-tabela diretas no banco real já foram praticadas pela
   mesma credencial — só que, naquela ocasião documentada, contra o
   projeto de teste.
3. **Não existe alerta ou verificação periódica** que compare KPI 1 (ou
   KPI 2, lifetime) entre coletas e sinalize uma queda — a violação do
   invariante "nunca decresce" só foi percebida porque o Product Owner
   comparou manualmente dois snapshots.

---

## 15. Opções de correção (propostas — NÃO implementadas)

### Correção imediata

O menor ajuste para impedir novas ocorrências do vetor mais barato de
recorrência (testes/scripts apontando para produção por engano):
adicionar, em `scripts/require-integration-env.mjs` (e/ou em um novo guard
chamado no início de `npm run test:integration`), uma verificação que
compara `NEXT_PUBLIC_SUPABASE_URL` contra uma lista de hosts de produção
proibidos (ou, inversamente, contra um allowlist do projeto de
teste/dev), abortando com erro alto e claro se detectar produção. Isso não
impede uma operação manual deliberada via SQL Editor, mas fecha o vetor
mais barato e mais parecido com um "acidente".

### Correção estrutural

Garantir os invariantes entre `auth.users`/`profiles`/`representatives`/
`subscriptions`/dependentes exigiria decisão do Product Owner sobre pelo
menos um destes eixos, sem implementá-los aqui:

- Uma tabela de fatos append-only e imutável para o funil de ativação
  (paralela a `billing_events`), que sobreviva independentemente do
  lifecycle de `representatives` — resolveria diretamente o Q18/§11.
- Um mecanismo de auditoria (trigger `AFTER DELETE` em `representatives`,
  ou revogação do privilégio de DELETE físico até para `service_role`,
  reservando remoção física a um procedimento documentado e auditado)
  que tornasse qualquer DELETE futuro, de qualquer origem, obrigatoriamente
  rastreável.
- Uma verificação periódica automatizada (job ou query agendada) que
  compare a contagem atual de KPI 1/KPI 2 contra a coleta anterior e
  alerte em caso de queda, já que KPI 2 é documentado como uma métrica que
  nunca deveria decrescer.

### Recovery (não executado)

Para os dois usuários atualmente inconsistentes:

- **Wesley**: nenhum recovery de dado é necessário — nada foi perdido.
  Se o Product Owner desejar, um convite/lembrete para retomar o
  onboarding seria uma ação de produto, não de dado.
- **Luiz Carlos**: se a premissa de existência prévia for confirmada
  (ex.: por evidência adicional fora do escopo desta investigação), o
  recovery de dado real (slug, `authorization_id`, telefone, cidade,
  histórico de publicação/tráfego/leads daquele representante) **não é
  possível a partir do banco atual** — nada disso sobrevive em nenhuma
  tabela hoje. A única ação de recovery viável seria pedir a Luiz Carlos
  que refaça o onboarding do zero (novo `representative`, nova
  `subscription` trial), o que é uma decisão de produto/relacionamento com
  o cliente, não uma restauração técnica.

**Nenhuma ação de recovery foi executada nesta investigação.**

### Observabilidade

Logs/auditoria que deveriam existir para que remoções futuras sejam
rastreáveis:
- Um log de auditoria (`representatives_audit_log` ou equivalente) escrito
  por um trigger `BEFORE DELETE`/`AFTER DELETE` em `representatives`,
  capturando o estado da linha e (quando disponível) o `role`/sessão que
  executou a operação — cobrindo inclusive operações via SQL Editor, que
  hoje não passam por nenhum dos dois scripts auditados.
- Retenção configurada de logs de query do Postgres de produção
  (atualmente fora do escopo verificável por esta investigação — não há
  evidência de que existam ou não; ver "perguntas ainda sem resposta").

### Testes

- **Unitário**: nenhum aplicável diretamente (o "bug", se confirmado, é
  operacional, não de lógica de aplicação).
- **Integração**: um teste que verifique que `DELETE FROM representatives`
  falha com violação de FK quando qualquer filho existe (documentando o
  invariante atual como comportamento intencional e testado, não apenas
  como comentário).
- **Regressão de KPI**: um teste/script agendado que compare a contagem
  atual de `representatives`/`product_activations` (KPI 1/2) contra a
  última coleta persistida e falhe/alerte em caso de queda — cobre
  diretamente o achado do §11.
- **Concorrência/falha parcial**: não aplicável a este incidente — a
  investigação já descartou falha parcial de `register_representative()`
  como causa possível (§5, função atômica).

---

## 16. Perguntas ainda sem resposta

1. O que exatamente foi executado contra a linha de `representatives` de
   Luiz Carlos (se algo foi) — ferramenta usada, sessão, timestamp exato,
   motivo — permanece **não provado**, por falta de acesso a logs de
   auditoria/query do Postgres de produção ou à API de Management do
   Supabase.
2. Não foi possível confirmar, de forma independente da própria alegação
   do brief, que Luiz Carlos de fato possuía um `representative` em
   27/08/2026 — apenas que, **se** possuía, a causa mais provável do seu
   desaparecimento é uma operação manual fora do código.
3. Não foi verificado se o Supabase mantém backups point-in-time (PITR)
   habilitados para o projeto de produção que permitiriam reconstituir o
   estado de 27/08 — essa verificação requer acesso à API de Management
   do Supabase (ou ao dashboard), fora do escopo de credenciais disponível
   nesta investigação.
4. Não é possível confirmar se alguma outra pessoa, além de Pedro, teve ou
   tem acesso a `SUPABASE_SERVICE_ROLE_KEY` de produção em algum momento
   entre 25/08 e 01/09/2026.

---

## 17. Recomendação final

**Não implementar nenhuma correção agora sem antes esgotar, se possível, o
que falta para provar a causa exata (§16)** — em particular, verificar
junto ao painel do Supabase (fora do escopo desta investigação read-only
via API) se existem backups point-in-time ou logs de query cobrindo o
período 27/08–01/09/2026, que poderiam confirmar ou refutar
definitivamente a existência prévia do `representative` de Luiz Carlos.

Independentemente dessa confirmação, a correção imediata do §15 (guard de
ambiente em `require-integration-env.mjs`/testes de integração) é de baixo
custo, não requer decisão de arquitetura, e fecha o vetor de recorrência
mais barato — recomendada para implementação assim que autorizada pelo
Product Owner.

As decisões estruturais (tabela append-only para o funil de ativação,
auditoria de DELETE em `representatives`, alerta de queda de KPI lifetime)
ficam para decisão explícita do Product Owner, dado seu custo maior e
impacto em arquitetura já documentada (`DOMAIN_MODEL.md`,
`STAGE_1_KPI_SPECIFICATION.md`).

**Aguardando decisão explícita do Product Owner antes de qualquer
implementação**, conforme instruído.

---

## 18. Verdict, evidências e queries usadas (resumo para leitura rápida)

- **Verdict**: dois casos estruturalmente diferentes. Wesley =
  onboarding abandonado (alta confiança, sem perda de dado). Luiz Carlos =
  causa não provada com certeza absoluta, mas altamente consistente com
  remoção manual multi-tabela fora do código versionado deste projeto
  (nenhum caminho de aplicação é capaz de produzir o estado observado).
- **Confiança**: `HIGH_CONFIDENCE` (Wesley); `HIGH_CONFIDENCE` sobre o
  mecanismo / `ROOT_CAUSE_NOT_PROVEN` sobre ator e momento exatos (Luiz
  Carlos).
- **Severidade**: Baixa (Wesley); Alta, condicional (Luiz Carlos).
- **Blast radius atual**: Baixo — zero inconsistências na população viva
  de 6 `representatives` (§9).
- **Risco de recorrência**: Real — três vetores estruturais identificados
  em §14, nenhum corrigido.
- **Arquivos/código envolvidos**: `supabase/migrations/20260728000000_create_profiles.sql`,
  `20260731000000_create_representative_domain.sql`,
  `20260806000000_add_register_representative.sql`,
  `20260901000000_add_trial_lifecycle.sql`,
  `20260907000000_add_lgpd_request_log.sql`,
  `20260907000001_fix_lgpd_request_log_fk_on_delete.sql`,
  `20260904000000_add_retention_purge_job.sql`,
  `scripts/execute-lgpd-request.ts`, `scripts/reconcile-billing-subscription.ts`,
  `scripts/require-integration-env.mjs`,
  `docs/runbooks/LGPD_RIGHTS.md`, `docs/plans/STAGE_1_KPI_SPECIFICATION.md`,
  `docs/plans/DATA_RETENTION_DECISIONS_PLAN.md`.
- **Queries read-only utilizadas**: todas via `GET` contra
  `{SUPABASE_URL}/rest/v1/*` (PostgREST) e
  `{SUPABASE_URL}/auth/v1/admin/users` (Auth Admin API) do projeto de
  produção, usando `SUPABASE_SERVICE_ROLE_KEY` lida diretamente de
  `.env.production.local` (nunca exposta em comando de shell ou no
  transcript). Nenhum `INSERT`/`UPDATE`/`DELETE`/RPC de escrita foi
  chamado — estruturalmente impossível pelo método `GET`. Scripts usados
  (não versionados no repositório, mantidos apenas no scratchpad local
  desta sessão):
  - contagem e verificação de órfãos em `profiles`, `representatives`,
    `subscriptions`, `product_activations`, `leads`, `feedback_responses`,
    `billing_reconciliation_log`, `lgpd_request_log`, `analytics_events`;
  - resolução dos dois usuários por telefone via
    `/auth/v1/admin/users`;
  - verificação pontual de `profiles.updated_at`/sentinela de redação LGPD
    para os dois casos;
  - verificação de presença de colunas/constraints recentes
    (`subscriptions.status='trialing'`, `analytics_events.origin`,
    `leads.origin`) para posicionar o estado de migrations de produção no
    tempo.
- **Caminho do relatório**: [docs/plans/AUDIT_PROFILE_REPRESENTATIVE_INTEGRITY_2026-09-01.md](docs/plans/AUDIT_PROFILE_REPRESENTATIVE_INTEGRITY_2026-09-01.md)

---

*Nenhuma correção foi implementada como parte desta investigação. Nenhum
INSERT/UPDATE/DELETE foi executado em nenhum ambiente. Aguardando decisão
explícita do Product Owner antes de qualquer implementação.*

---

## Addendum (2026-09-01) — dois hardenings operacionais implementados

Escopo restrito e explicitamente autorizado, separado desta investigação:
apenas os dois itens abaixo de §15 foram implementados. Nenhuma outra
correção, recovery, ajuste de onboarding, mudança de KPI, event sourcing ou
refatoração foi feita — ver a entrega completa (achados fora de escopo,
riscos remanescentes, resultado de validação) no histórico da sessão que
implementou isto. Recovery de Luiz Carlos/Wesley e as opções estruturais de
§15 (tabela append-only, alerta de KPI) continuam **não implementados**,
aguardando decisão do Product Owner.

**Hardening A — guard anti-produção.** `scripts/supabase-production-guard.mjs`
(lógica canônica, pura, testada em `tests/supabase-production-guard.test.ts`)
+ `scripts/preload-supabase-production-guard.mjs` (`--import` no script
`test` do `package.json`) + uma chamada equivalente no topo de
`playwright.config.ts` + reforço em `scripts/require-integration-env.mjs`.
Aborta, antes de qualquer chamada ao Supabase, se `SUPABASE_SERVICE_ROLE_KEY`
estiver presente e `NEXT_PUBLIC_SUPABASE_URL` resolver para o projeto de
produção (`xiysyzauoifbcoviqblf`) ou para qualquer projeto fora de um
allowlist de projetos de teste/dev conhecidos.

**Hardening B — auditoria de DELETE em `representatives`.** Migrations
`supabase/migrations/20260909000000_add_representative_delete_audit_log.sql`
e `20260909000001_revoke_public_execute_from_log_representative_delete.sql`:
tabela `representative_delete_audit_log` (RLS habilitada, zero policies,
mesmo padrão de `billing_reconciliation_log`/`lgpd_request_log`) + trigger
`AFTER DELETE FOR EACH ROW` em `representatives`. Nenhuma FK foi alterada de
`NO ACTION` para `CASCADE` — a proteção contra DELETE continua a mesma;
apenas um DELETE que efetivamente comita agora deixa rastro.
