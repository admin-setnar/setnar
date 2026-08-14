Status: Draft — aguardando decisão do Product Owner
Authority: Non-normative (auditoria operacional, não altera nenhuma decisão de produto ou arquitetura)
Code baseline: branch `set-78-commercial-pages-templates` @ `b7a3bcc`, com 3 arquivos não commitados no working tree
Last reviewed: 2026-08-14 (Achado 1 investigado e resolvido nesta mesma data — ver nota no início do achado)
Superseded by: n/a

# Auditoria de prontidão para lançamento do MVP

**Pergunta**: o código e a operação do SETNAR estão prontos para o lançamento do MVP (Stage 1 do `ROADMAP.md`)?

**Método**: leitura direta do código, execução de `npm run verify`, leitura dos runbooks/ADRs/planos existentes e conferência cruzada entre o que a documentação normativa declara e o que o histórico de commits/migrations mostra. Nenhum código foi alterado. Nenhuma decisão de produto foi tomada — esta auditoria só registra achados, na mesma linha do padrão já usado em `docs/plans/archive/AUDIT_SET-44_privacidade.md`, `AUDIT_SET-71`, `AUDIT_SET-72`.

**Escopo não coberto**: teste manual em navegador do fluxo ponta a ponta (não executado nesta sessão); auditoria de custo/billing da própria infraestrutura (Vercel/Supabase/Asaas); revisão jurídica dos termos/política de privacidade.

---

## Veredito

**Atualizado após investigação da causa raiz do Achado 1 (mesma sessão): GO técnico — nenhum bloqueador de código. `npm run verify` confirmado 100% verde (597/597 testes, build compilado com sucesso). Achados 2, 4, 6 e 8 seguem em aberto como melhorias recomendadas, nenhum bloqueador.**

O projeto está operacionalmente muito mais maduro do que a documentação normativa (`PRODUCT.md`) deixa transparecer: domínio e SSL validados em produção real, gateway de pagamento Asaas configurado com credenciais reais e testado ponta a ponta, CI com gate `npm run verify`, RLS extensivamente testada, observabilidade e runbooks de billing/deploy/LGPD/backup escritos e parcialmente ensaiados contra dado real. Isso é trabalho sério de pré-lançamento e já foi feito.

**O que parecia bloquear um GO incondicional não era um defeito de código.** A leitura inicial desta auditoria (abaixo, preservada para registro) apontou 3 testes vermelhos na função que aplica os webhooks do Asaas ao estado da assinatura — o tipo de achado que justificaria um NO-GO. Investigando a causa raiz (ver Achado 1), a função em si está correta: o vermelho vinha de **contaminação entre execuções de teste** no projeto Supabase de desenvolvimento (não o de produção — ver nota de correção no Achado 1), já limpa nesta sessão. Reexecução completa de `npm run verify` após a limpeza: **597/597 testes passam, build compila com sucesso, exit code 0.**

Os demais achados (2, 4, 6, 8) são reais, mas nenhum é um bloqueador técnico por si só — são lacunas de processo, documentação ou hygiene de ambiente ainda em aberto.

---

## Achado 1 [RESOLVIDO] — `apply_billing_event` falhava em 3 cenários de billing — causa raiz investigada e resolvida (era contaminação de teste, não um bug de código)

**Resumo da conclusão, para quem só vai ler esta linha:** a função está correta. O vermelho era um resíduo de execução de teste anterior interrompida, já limpo. Detalhes abaixo, preservados porque documentam como se chegou lá.

### O que a primeira leitura desta auditoria encontrou

`npm run test` (parte de `npm run verify`) rodou 597 testes; 594 passaram, 3 falharam, todos em `tests/apply-billing-event.integration.test.ts`:

1. `SUBSCRIPTION_CREATED` não preenchia `external_subscription_id` — esperado `'sub_test_1'`, obtido `null`.
2. Um evento de renovação subsequente, casado só por `external_subscription_id`, gravava a data errada — esperado `current_period_end = 2026-10-13`, obtido `2026-09-13`.
3. `PAYMENT_OVERDUE` não suspendia a assinatura — esperado `status = 'suspended'`, obtido `status = 'active'`.

### Correção de rota nº 1 — qual banco os testes usam

A leitura inicial presumiu que `.env.local` deste worktree apontava para o **projeto Supabase de produção**, com base em um representante (`pedro-policeno`) encontrado lá que coincidia com o nome usado no ensaio de produção real do `DEPLOYMENT.md`. **Isso estava errado.** Pedro esclareceu: existem dois arquivos — `.env.production.local` (`xiysyzauoifbcoviqblf.supabase.co`, Asaas real) é produção de verdade; `.env.local` (`smspbjmqhpjcjilzoexr.supabase.co`, Asaas sandbox) é o projeto de desenvolvimento/teste. O `pedro-policeno` no projeto de teste é uma conta pessoal de teste do próprio Pedro, não o registro de produção. **`npm run test`/`test:integration` nunca tocaram produção** — a suspeita levantada e depois descartada fica registrada aqui só para não se repetir em outra sessão.

### Causa raiz confirmada

Comparando a definição da função **realmente aplicada** no projeto de teste (via `pg_get_functiondef`, MCP do Supabase) contra `supabase/migrations/20260828000000_handle_subscription_created_event.sql`, as duas são **idênticas**. A hipótese de drift entre local e remoto (aventada na primeira leitura, com base no achado de `DEPLOYMENT.md` §4) não se confirma para esta função.

A causa real: uma consulta ao projeto de teste revelou **18 representantes de fixture órfãos** (de 19 linhas totais em `representatives`), acumulados entre 2026-08-13 12:08 e 2026-08-14 12:28 — resíduo de `after()` de suítes de teste que não roda até o fim quando o processo é interrompido no meio (timeout, `Ctrl+C`, falha de memória). Um desses órfãos era exatamente uma linha de fixture de `apply-billing-event.integration.test.ts` (slug `billing-event-629612bc-...`), **com uma `subscription` já carregando `external_subscription_id = 'sub_test_1'`** — o mesmo literal fixo que o teste reusa em toda execução (`tests/apply-billing-event.integration.test.ts:141` e adiante). A função casa por `external_subscription_id` **antes** de tentar `external_reference` (linhas 54-58 da migration) — então todo evento da execução nova que só carrega `asaasSubscriptionId: 'sub_test_1'` (exatamente os 3 que falharam) acertava essa linha órfã antiga, não a linha nova criada pelo `before()` do próprio run. A linha nova nunca era tocada, e as asserções liam a linha nova — daí os 3 "falsos vermelhos".

### Como foi corrigido

Com aprovação explícita de Pedro, apaguei os 18 representantes órfãos + 1 subscription + 18 `auth.users` correspondentes do projeto de teste (consultas somente-leitura antes, para confirmar que não havia `subscriptions`/`product_activations`/`leads`/`billing_events` legítimos amarrados a eles — só a linha de billing-event tinha 1 `subscription`, sem `billing_events`). Confirmado depois: só resta o representante real de teste do Pedro (`pedro-policeno`). Reexecutando **só** `tests/apply-billing-event.integration.test.ts` isoladamente após a limpeza: **10/10 passam.**

### Risco residual — não é mais um bloqueador, mas vale corrigir

O literal fixo `'sub_test_1'` faz este teste específico ser vulnerável à mesma colisão sempre que uma execução futura for interrompida no meio (o `after()` do arquivo não roda em caso de crash/timeout do processo, e não há nenhuma limpeza "antes de começar" que remova lixo de uma execução anterior). Diferente da maioria dos outros arquivos de teste do projeto, que usam `randomUUID()` para gerar identificadores de fixture únicos por execução (evitando esse tipo de colisão por design), este arquivo usa um literal fixo para os ids `sub_test_1`/`cus_test_1`. Um novo `AUDIT_SET-*` ou uma pequena correção de teste (trocar o literal por algo derivado de `randomUUID()`, mesmo padrão já usado no resto do arquivo para `eventId`) eliminaria a classe inteira de falso-vermelho, sem depender de lembrar de limpar manualmente depois de uma interrupção.

**Mitigação de produção que segue válida independentemente deste achado:** `npm run reconcile:billing` (`scripts/reconcile-billing-subscription.ts`) consulta o Asaas diretamente e corrige uma assinatura divergente sem depender de `apply_billing_event` — útil como plano B mesmo que o bug relatado aqui não seja real.

**Recomendação:** (a) nenhuma ação de código obrigatória antes do lançamento — a função está correta; (b) considerado, não decidido aqui: trocar `'sub_test_1'`/`'cus_test_1'` por valores gerados com `randomUUID()` no teste, para que uma futura interrupção nunca mais produza este falso-vermelho; (c) considerar um passo de limpeza periódica (ou um `beforeEach`/`before` mais defensivo) para o projeto de teste em geral, já que o problema de fundo — `after()` não sobrevive a uma interrupção de processo — não é exclusivo deste arquivo.

---

## Achado 2 — `PRODUCT.md` § *What Exists Today* está desatualizado sobre billing

`PRODUCT.md` linha 196 (seção *MVP Goal*) afirma: *"não há gateway de pagamento, fluxo de cobrança, ou lifecycle automatizado de Subscription"* — e a tabela de verificação da seção *What Exists Today* (linha 356-358) declara baseline `commit df8db50`, **datado de 2026-08-06**.

O histórico de commits mostra que isso não é mais verdade desde então: o gateway Asaas (checkout hospedado, webhook autenticado/idempotente, cancelamento, trial de 30 dias, reconciliação manual) foi implementado ao longo de ~15 commits antes dessa data, e **credenciais reais de produção foram configuradas e testadas ponta a ponta em 2026-08-12** (`docs/runbooks/DEPLOYMENT.md` §2: *"primeiro evento real de pagamento entregue ao webhook em produção respondeu 200"*). `PRODUCT.md` foi editado por último em **2026-08-13** (adicionando a confirmação de autorização de marca iGreen), mas a seção *What Exists Today* não foi reverificada nessa edição — a data de baseline continua 2026-08-06.

A própria seção já antecipa este risco: *"Se a data acima for mais antiga que o último sprint fechado, esta seção não está verificada."* Pelo critério do próprio documento, ela está.

**Impacto:** qualquer decisão tomada lendo `PRODUCT.md` como fonte da verdade (é a fonte nº 3 na hierarquia de `AGENTS.md`) vai subestimar o quanto de billing já existe, e vai continuar comunicando a hipótese "willingness to pay ainda não pode ser medida pelo produto" como se nenhuma parte da medição existisse — quando na verdade a parte que falta é só ter pagantes reais (ver Achado 3), não a instrumentação.

**Recomendação:** reverificar `PRODUCT.md` § *What Exists Today* contra o código atual antes do lançamento, atualizando baseline/data/verificador — é exatamente o processo que `docs/README.md` § *Documentation Definition of Done* já exige para qualquer capability visível ao cliente. Isso é uma correção documental, não uma decisão de produto nova.

---

## Achado 3 — A hipótese de negócio do MVP genuinamente não está validada (não é um defeito, é o estado real)

`docs/runbooks/PILOT_METRICS.md` §8 (ensaio de 2026-08-12) mostra, contra o banco real: **2 assinaturas em `trialing`, 0 em `active`, R$ 0,00 de MRR, 0 respostas de feedback de percepção de valor.** `ROADMAP.md` Stage 1 já registra isso como item 4 em aberto: *"há evidência qualitativa de que consideram vale a pena pagar — pendente."*

Isso não é um bug nem uma lacuna de engenharia — é exatamente o que o Stage 1 existe para medir. Com o Achado 1 esclarecido (a função de billing está correta), não há mais nenhuma dúvida técnica pendente sobre a confiabilidade da medição — só falta o piloto gerar pagantes reais.

**Recomendação:** nenhuma ação de código. Registrar explicitamente que "lançar o MVP" e "validar a hipótese do MVP" são marcos diferentes — o primeiro já é tecnicamente possível hoje, o segundo depende só do piloto rodar e gerar dado real.

---

## Achado 4 — Nenhum contato de suporte/incidente está preenchido

`docs/runbooks/BILLING_OPERATIONS.md` (linha ~341-345) registra explicitamente: *"Este projeto não tem sistema de contatos operacionais versionado, e inventar um número/e-mail de suporte aqui seria pior que deixar em aberto... Antes do primeiro incidente de produção, o Product Owner deve preencher"* — e o campo continua vazio.

**Impacto:** se um cliente pagante tiver um problema de cobrança no primeiro dia do piloto, não há um canal documentado para onde ele (ou quem estiver de plantão) deveria escalar.

**Recomendação:** decisão do Product Owner, não de engenharia — preencher o contato antes de abrir o piloto para pagamento real.

---

## Achado 5 — 3 arquivos não commitados no working tree; 1 deles com mudança real de produto

`git status` mostra 3 arquivos modificados e não commitados em `src/modules/representatives/presentation/`. Investigando:

- **`onboarding-form.tsx`** tem uma mudança de produto real e não trivial: um preview ao vivo da URL da página (`slug.dominio`) no formulário de onboarding, substituindo a dica estática. Não está coberta por nenhum teste novo, e não está em nenhum commit.
- **`authorized-representative-identification-block.tsx`** e **`product-content-tabs.tsx`** aparecem como modificados no `git status`, mas `git diff` para ambos está vazio — é ruído de normalização de fim de linha (`core.autocrlf=true` neste ambiente Windows), não uma mudança de conteúdo.

**Recomendação:** decidir sobre `onboarding-form.tsx` antes de considerar a branch pronta — commitar (com Issue do Linear correspondente, conforme `AGENTS.md`) ou descartar. Os outros dois arquivos podem ser ignorados com segurança ou o working tree normalizado (`git add --renormalize .`), sem risco de perda de trabalho.

---

## Achado 6 — Ledger de migrations com histórico de aplicação fora do processo oficial (já conhecido, sem fechamento — mas a suspeita levantada pelo Achado 1 não se confirmou)

Já documentado em `DEPLOYMENT.md` §4: migrations aplicadas via ferramenta MCP em vez de `supabase db push --linked` já causaram uma entrada duplicada no ledger remoto em produção. A investigação do Achado 1 comparou diretamente `pg_get_functiondef('apply_billing_event')` no projeto de teste contra o arquivo de migration local — **são idênticos**, então, ao menos para esta função e neste projeto, não há drift. Isso não descarta drift em outras funções nem no projeto de produção (não verificado). A recomendação do próprio runbook segue de pé como boa prática, só sem a urgência que o Achado 1 originalmente sugeriu.

**Recomendação:** antes do lançamento, confirmar que `supabase migration list --linked` no projeto de **produção** não mostra nenhuma divergência, e preferir a CLI real para qualquer migration daqui em diante.

---

## Achado 7 — Dívida de documentação pré-existente (baixa severidade, não bloqueia lançamento)

`docs/README.md` § *Outstanding Documentation Debt* já cataloga isto e nada aqui é novo, mas vale registrar como parte do quadro geral:

- **D2**: `ADR-058` cita `docs/AUDIT_CONSTITUTION_RECONCILIATION.md`, que não existe no repositório.
- **D3**: `README.md` raiz lista dashboard e recuperação de senha como ausentes; ambos existem.
- **D4/D12**: comentários no código referenciam `docs/<PLAN>.md`/ADRs pelo caminho antigo (`README.md`), que hoje vivem em `docs/plans/`/`docs/adr/`.

Achado incidental desta auditoria, mesma categoria: **a memória de sessão anterior deste agente registrava um `docs/AUDIT_DUAL_BUSINESS_MODEL.md` como "produzido, aguardando aprovação"** — mas `git log --all` confirma que esse arquivo nunca foi commitado neste repositório, em nenhuma branch. Ou foi escrito fora do repositório por engano, ou a sessão que o produziu nunca chegou a salvá-lo. A memória correspondente será corrigida para refletir isso.

**Recomendação:** nenhuma ação de código necessária para o lançamento. D2/D3/D4/D12 são candidatos a uma passada de correção documental separada, já com dono definido na própria tabela de dívida.

---

## Achado 8 — Vazamento sistemático de fixtures de teste no projeto Supabase de desenvolvimento (encontrado investigando o Achado 1)

Das 18 linhas órfãs encontradas e removidas (ver Achado 1), só 1 era do arquivo `apply-billing-event`. As outras **17 eram todas do mesmo teste**, `Teste Feedback outsider` (slug `feedback-outsider-*`), acumulando desde 2026-08-13 12:08 até 2026-08-14 12:28 — ou seja, um vazamento **recorrente e contínuo**, não um incidente isolado, provavelmente toda vez que esse arquivo de teste específico é executado (mesma classe de causa do Achado 1: `after()` não sobrevive a uma interrupção, ou o próprio teste tem uma falha de limpeza estrutural, não confirmado qual).

**Impacto, agora que a limpeza foi feita:** nenhum, o projeto de teste está limpo. Mas sem uma correção na causa, a mesma situação volta a se acumular a cada rodada de `npm run test`/`test:integration` que passar por esse arquivo — e da próxima vez pode voltar a causar um falso-vermelho como o do Achado 1, se o literal reusado colidir com um resíduo específico (o `feedback-outsider` parece usar UUIDs por execução, então o risco de falso-vermelho é menor que o do Achado 1, mas o de poluir o banco de teste indefinidamente é o mesmo).

**Recomendação:** identificar por que `tests/lead-canonical-access.integration.test.ts`/o teste correspondente a "Feedback outsider" (nome exato do arquivo não confirmado nesta auditoria — precisa de um `grep` por "Feedback outsider" em `tests/`) não está limpando depois de si, e decidir entre corrigir o `after()` ou adicionar uma rotina de limpeza periódica do projeto de teste. Não é um bloqueador de lançamento — é hygiene de ambiente de desenvolvimento.

---

## O que já está pronto — não é preciso reprovar de novo

Registrado aqui deliberadamente, para que este documento não leia como só uma lista de problemas:

- **Domínio, SSL, wildcard de subdomínio**: validados ao vivo contra `setnar.com` e um representante real publicado (`DEPLOYMENT.md` §1).
- **Rollback e smoke pós-deploy**: ensaiados de verdade em produção, não simulados (`DEPLOYMENT.md` §3).
- **CI com gate `npm run verify`**: `.github/workflows/verify.yml` roda em todo PR e push para `develop`/`main`; suíte E2E (Playwright) roda como job separado após `verify` passar.
- **RLS**: testada extensivamente e por múltiplos ângulos — isolamento entre representantes, negação a `anon`/`authenticated` em toda RPC privilegiada, ausência de recursão infinita nas policies. Nenhuma falha nesta área nos 594 testes que passam.
- **Disciplina de logs/PII**: `ADR-084` aplicado em ~25 call sites, confirmado sem vazamento no runbook de observabilidade.
- **Job de retenção/purga**: `pg_cron` real, agendado, com execução bem-sucedida confirmada (`OBSERVABILITY.md` §3).
- **Branch hygiene**: `develop` e `main` estão hoje sincronizados (sem drift em nenhuma direção) — o risco registrado em memória de sessões anteriores não se repete no momento desta auditoria.
- **`.env` nunca versionado**: `.gitignore` cobre todo `.env*` exceto `.env.example`, com o motivo documentado inline.

---

## Resumo executivo

| # | Achado | Severidade | Bloqueia lançamento? |
|---|---|---|---|
| 1 | `apply_billing_event` — 3 testes vermelhos por contaminação de dados de teste (**resolvido**: causa raiz confirmada, banco de teste limpo, 10/10 passam) | Resolvida | Não |
| 2 | `PRODUCT.md` desatualizado sobre existência do gateway de pagamento | Média | Não (mas deve ser corrigido) |
| 3 | Hipótese de "willingness to pay" ainda não validada (0 pagantes) | Informativo | Não é defeito — é o estado esperado do Stage 1 |
| 4 | Contato de suporte/incidente não preenchido | Média | Recomendado antes de abrir pagamento real |
| 5 | 1 mudança de produto não commitada (`onboarding-form.tsx`) | Baixa | Decidir antes de fechar a branch |
| 6 | Ledger de migrations — drift não confirmado para `apply_billing_event`; recomendação de verificar produção segue de pé | Baixa-Média | Verificar antes do lançamento, sem urgência nova |
| 7 | Dívida de documentação pré-existente (D2-D12) + memória incorreta (corrigida) | Baixa | Não |
| 8 | Vazamento recorrente de fixtures de teste no projeto Supabase de dev (17 linhas de outro arquivo de teste, além da do Achado 1) | Baixa | Não — mas deve ser corrigido para não voltar a acumular |

**Próximo passo recomendado**: nenhum bloqueador de código pendente — `npm run verify` confirmado verde de ponta a ponta (typecheck/lint/597 testes/build). Tratar os Achados 2, 4, 6 e 8 pela ordem que fizer sentido para o Product Owner — nenhum é urgente por si só, mas 2 e 4 são baratos de fechar antes de abrir o piloto para pagamento real.
