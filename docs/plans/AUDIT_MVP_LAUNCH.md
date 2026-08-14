Status: Draft — aguardando decisão do Product Owner
Authority: Non-normative (auditoria operacional, não altera nenhuma decisão de produto ou arquitetura)
Code baseline: branch `main` @ `280ced3` (working tree limpo)
Last reviewed: 2026-08-14 (segunda passada — fecha os Achados 4, 5 e 8; registra o que foi entregue desde a primeira leitura: SET-65 e a correção de overflow mobile)
Superseded by: n/a

# Auditoria de prontidão para lançamento do MVP

**Pergunta**: o código e a operação do SETNAR estão prontos para o lançamento do MVP (Stage 1 do `ROADMAP.md`)?

**Método**: leitura direta do código, execução de `npm run verify`, leitura dos runbooks/ADRs/planos existentes e conferência cruzada entre o que a documentação normativa declara e o que o histórico de commits/migrations mostra. Nenhuma decisão de produto foi tomada — esta auditoria só registra achados, na mesma linha do padrão já usado em `docs/plans/archive/AUDIT_SET-44_privacidade.md`, `AUDIT_SET-71`, `AUDIT_SET-72`.

**Escopo não coberto**: teste manual em navegador do fluxo ponta a ponta do caminho crítico completo (coberto indiretamente por `tests/e2e/critical-path.spec.ts` em CI, não reexecutado manualmente nesta auditoria); auditoria de custo/billing da própria infraestrutura (Vercel/Supabase/Asaas); revisão jurídica dos termos/política de privacidade; verificação do ledger de migrations no projeto de **produção** (só o de teste foi verificado — ver Achado 6).

---

## Veredito

**GO técnico — nenhum bloqueador de código.** `npm run verify` confirmado 100% verde na última execução desta sessão (618/618 testes — subiu de 597 desde a primeira leitura, com a cobertura nova de materiais de marketing —, typecheck/lint limpos, build compilado com sucesso). Dos 8 achados da primeira leitura, **3 foram fechados** (Achados 4, 5 e 8) e um quarto capítulo de trabalho real (SET-65) foi entregue e verificado depois da primeira leitura. Nenhum achado remanescente bloqueia o lançamento.

O projeto está operacionalmente muito mais maduro do que a documentação normativa (`PRODUCT.md`) deixa transparecer no seu próprio cabeçalho de verificação: domínio e SSL validados em produção real, gateway de pagamento Asaas configurado com credenciais reais e testado ponta a ponta, CI com gate `npm run verify`, RLS extensivamente testada, observabilidade e runbooks de billing/deploy/LGPD/backup escritos e parcialmente ensaiados contra dado real, e — desde a primeira leitura — uma feature nova (materiais de marketing, SET-65) entregue com POC documentado, ADR, testes unitários e E2E reais em navegador. Isso é trabalho sério de pré-lançamento e já foi feito.

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

### Risco residual estrutural do teste — ainda não corrigido (baixa severidade, não bloqueia)

O literal fixo `'sub_test_1'` faz este teste específico permanecer vulnerável à mesma colisão sempre que uma execução futura for interrompida no meio (o `after()` do arquivo não roda em caso de crash/timeout do processo, e não há nenhuma limpeza "antes de começar" que remova lixo de uma execução anterior). Diferente da maioria dos outros arquivos de teste do projeto, que usam `randomUUID()` para gerar identificadores de fixture únicos por execução (evitando esse tipo de colisão por design), este arquivo usa um literal fixo para os ids `sub_test_1`/`cus_test_1`. Isso não foi corrigido nas passadas seguintes desta auditoria — continua um candidato barato para uma sessão futura.

**Mitigação de produção que segue válida independentemente deste achado:** `npm run reconcile:billing` (`scripts/reconcile-billing-subscription.ts`) consulta o Asaas diretamente e corrige uma assinatura divergente sem depender de `apply_billing_event` — útil como plano B mesmo que o bug relatado aqui não seja real.

---

## Achado 2 — `PRODUCT.md` § *What Exists Today* tem cabeçalho de verificação desatualizado (conteúdo já foi corrigido; a data/baseline declarada, não)

Na primeira leitura, esta seção declarava textualmente *"não há gateway de pagamento, fluxo de cobrança, ou lifecycle automatizado de Subscription"* — isso já não é mais verdade no texto atual: o conteúdo de *What Exists Today* já lista o gateway Asaas, a verificação de assinatura, e — mais recentemente — os 21 materiais de marketing do SET-65 (linha 381, citando explicitamente ADR-090). **O conteúdo foi corrigido.**

O que continua desatualizado é só o **cabeçalho da tabela "Verification record"** (linhas 356-358): `Baseline` ainda cita o commit `df8db50` e `Date` ainda mostra `2026-08-06`, mesmo com o corpo do documento já refletindo trabalho de commits bem posteriores a essa data (billing completo, SET-65). O próprio documento é explícito sobre o que isso significa: *"Se a data acima for mais antiga que o último sprint fechado, esta seção não está verificada."* — pelo critério do próprio documento, ela continua tecnicamente "não verificada", mesmo o conteúdo estando correto na prática.

**Impacto:** baixo — quem ler só o conteúdo (não o cabeçalho) já vê o estado real. O risco é alguém confiar no cabeçalho como um selo de "verificado nesta data" e presumir que nada mudou desde 2026-08-06.

**Recomendação:** atualizar `Baseline`/`Date`/`Performed by` da tabela em `PRODUCT.md` § *What Exists Today* para o commit e a data reais da última revisão de conteúdo — é uma correção de metadado, não uma decisão de produto nova, e é exatamente o processo que `docs/README.md` § *Documentation Definition of Done* já exige.

---

## Achado 3 — A hipótese de negócio do MVP genuinamente não está validada (não é um defeito, é o estado real)

`docs/runbooks/PILOT_METRICS.md` §8 (ensaio de 2026-08-12) mostra, contra o banco real: **2 assinaturas em `trialing`, 0 em `active`, R$ 0,00 de MRR, 0 respostas de feedback de percepção de valor.** `ROADMAP.md` Stage 1 já registra isso como item 4 em aberto: *"há evidência qualitativa de que consideram vale a pena pagar — pendente."*

Isso não é um bug nem uma lacuna de engenharia — é exatamente o que o Stage 1 existe para medir. Com o Achado 1 esclarecido (a função de billing está correta) e o Achado 4 fechado (canal de suporte já existe), não há mais nenhuma dúvida técnica ou operacional pendente sobre a confiabilidade da medição ou sobre o que fazer se um pagante tiver um problema — só falta o piloto gerar pagantes reais.

**Recomendação:** nenhuma ação de código. Registrar explicitamente que "lançar o MVP" e "validar a hipótese do MVP" são marcos diferentes — o primeiro já é tecnicamente possível hoje, o segundo depende só do piloto rodar e gerar dado real.

---

## Achado 4 [RESOLVIDO] — Nenhum contato de suporte/incidente estava preenchido

`docs/runbooks/BILLING_OPERATIONS.md` §8 registrava explicitamente que o campo estava vazio e pedia uma decisão do Product Owner antes do primeiro incidente de produção. **Preenchido em 2026-08-14**: `contato@setnar.com` é agora o canal de suporte para problemas de pagamento, documentado em `BILLING_OPERATIONS.md` §8. Os dois itens que continuam em aberto na mesma seção (canal de suporte direto do Asaas e um eventual gerente de conta dedicado) não bloqueiam mais nada, já que o canal primário existe — ficam como preenchimento futuro, se e quando essa informação existir.

**Recomendação:** nenhuma — fechado.

---

## Achado 5 [RESOLVIDO] — 1 arquivo não commitado com mudança real de produto

Na primeira leitura, `git status` mostrava 3 arquivos modificados e não commitados em `src/modules/representatives/presentation/`: `onboarding-form.tsx` continha uma mudança de produto real e não trivial (preview ao vivo da URL da página no formulário de onboarding), sem commit e sem cobertura de teste; os outros dois (`authorized-representative-identification-block.tsx`, `product-content-tabs.tsx`) eram ruído de normalização de fim de linha (`core.autocrlf=true`), sem mudança de conteúdo real.

**Decisão do Product Owner**: manter e commitar. `onboarding-form.tsx` foi commitado, testado (o E2E `tests/e2e/critical-path.spec.ts` foi ajustado na mesma branch — a nova dica de preview de URL havia tornado uma asserção antiga por `getByText(fixture.slug)` ambígua) e mergeado via PR #34. Working tree confirmado limpo desde então.

**Recomendação:** nenhuma — fechado.

---

## Achado 6 — Ledger de migrations com histórico de aplicação fora do processo oficial (já conhecido, sem fechamento — mas a suspeita levantada pelo Achado 1 não se confirmou)

Já documentado em `DEPLOYMENT.md` §4: migrations aplicadas via ferramenta MCP em vez de `supabase db push --linked` já causaram uma entrada duplicada no ledger remoto em produção. A investigação do Achado 1 comparou diretamente `pg_get_functiondef('apply_billing_event')` no projeto de **teste** contra o arquivo de migration local — **são idênticos**, então, ao menos para esta função e neste projeto, não há drift. Isso não descarta drift em outras funções nem no projeto de **produção** — nenhuma passada desta auditoria verificou produção diretamente.

**Recomendação:** antes do lançamento, confirmar que `supabase migration list --linked` no projeto de **produção** não mostra nenhuma divergência, e preferir a CLI real para qualquer migration daqui em diante. Ainda não feito em nenhuma passada desta auditoria.

---

## Achado 7 — Dívida de documentação pré-existente (baixa severidade, não bloqueia lançamento)

`docs/README.md` § *Outstanding Documentation Debt* já cataloga isto e nada aqui é novo, mas vale registrar como parte do quadro geral:

- **D2**: `ADR-058` cita `docs/AUDIT_CONSTITUTION_RECONCILIATION.md`, que não existe no repositório.
- **D3**: `README.md` raiz lista dashboard e recuperação de senha como ausentes; ambos existem.
- **D4/D12**: comentários no código referenciam `docs/<PLAN>.md`/ADRs pelo caminho antigo (`README.md`), que hoje vivem em `docs/plans/`/`docs/adr/`.

Achado incidental da primeira leitura, mesma categoria: a memória de sessão deste agente registrava um `docs/AUDIT_DUAL_BUSINESS_MODEL.md` como "produzido, aguardando aprovação" — mas `git log --all` confirmou que esse arquivo nunca foi commitado neste repositório, em nenhuma branch. A memória correspondente já foi corrigida para refletir isso.

**Recomendação:** nenhuma ação de código necessária para o lançamento. D2/D3/D4/D12 são candidatos a uma passada de correção documental separada, já com dono definido na própria tabela de dívida.

---

## Achado 8 [RESOLVIDO] — Vazamento sistemático de fixtures de teste no projeto Supabase de desenvolvimento

Das 18 linhas órfãs encontradas e removidas na primeira leitura (ver Achado 1), 17 eram do mesmo teste, `feedback-responses.integration.test.ts` (fixture `outsider`, slug `feedback-outsider-*`), acumulando desde 2026-08-13 12:08 até 2026-08-14 12:28 — um vazamento recorrente e contínuo, não um incidente isolado.

**Causa raiz confirmada e corrigida (PR #33, mergeado)**: o `after()` da fixture `outsider` só chamava `auth.admin.deleteUser()`, com base num comentário afirmando que o resto seria apagado em cascata. Isso era falso — a FK real de `feedback_responses`/`representatives` para `auth.users` é `NO ACTION`, não `CASCADE`. Corrigido adicionando os deletes explícitos de `feedback_responses`/`representatives` antes do delete do usuário, espelhando o padrão já usado pela fixture `owner` no mesmo arquivo.

**Recomendação:** nenhuma — fechado. A mitigação estrutural mais ampla (uma limpeza periódica do projeto de teste, para qualquer futuro vazamento de causa diferente) segue como ideia não implementada, mas de severidade baixa — não é mais urgente agora que a causa recorrente confirmada foi eliminada.

---

## Achado 9 — Regressão de layout mobile no SET-65, encontrada via QA manual real e corrigida; sem cobertura de regressão automatizada

Depois da entrega do SET-65 (materiais de marketing), um print de tela real (~375px de largura) mostrou dois problemas de overflow horizontal:

1. **Navegação mobile** (`src/app/app/app-navigation.tsx`): os 4 itens em `grid-cols-4` não encolhiam abaixo do tamanho do próprio conteúdo (`min-width: auto`, comportamento padrão de grid/flex), vazando ícone/rótulo uns sobre os outros e cortando "Conta" fora da tela.
2. **Preview de material de marketing** (`scaled-frame.tsx`, `material-preview.tsx`): `PREVIEW_TARGET_WIDTH` era um valor fixo de 280px, que ultrapassava o espaço real disponível (~264-279px) em telas de ~360-375px depois do padding da página + do card, vazando o material para fora da viewport.

**Corrigido** (PR #36, mergeado para `develop` e depois fast-forward para `main`): a navegação passou a empilhar ícone sobre rótulo no mobile com truncamento; o `ScaledFrame` passou a medir o espaço disponível via `ResizeObserver` e nunca renderiza mais largo que isso. `npm run verify` completo (typecheck, lint, 618 testes, integração, build) passou antes do merge.

**O que não está coberto:** nenhum teste automatizado (unitário ou E2E) verifica overflow horizontal em viewports estreitos — a correção foi validada só por inspeção de código + confirmação visual manual via print do usuário. Uma futura mudança de CSS/layout poderia reintroduzir esse tipo de regressão silenciosamente, sem que `npm run verify` pegasse.

**Impacto:** nenhum agora — já corrigido e no ar. O risco é só de regressão futura não detectada.

**Recomendação:** considerar, em uma sessão futura, um teste Playwright rodando num viewport estreito (ex.: 360px) que assert a ausência de overflow horizontal (`document.documentElement.scrollWidth <= window.innerWidth`) nas telas autenticadas principais — baixa severidade, não bloqueia o lançamento.

---

## O que já está pronto — não é preciso reprovar de novo

Registrado aqui deliberadamente, para que este documento não leia como só uma lista de problemas:

- **Domínio, SSL, wildcard de subdomínio**: validados ao vivo contra `setnar.com` e um representante real publicado (`DEPLOYMENT.md` §1).
- **Rollback e smoke pós-deploy**: ensaiados de verdade em produção, não simulados (`DEPLOYMENT.md` §3).
- **CI com gate `npm run verify`**: `.github/workflows/verify.yml` roda em todo PR e push para `develop`/`main`; suíte E2E (Playwright) roda como job separado após `verify` passar.
- **RLS**: testada extensivamente e por múltiplos ângulos — isolamento entre representantes, negação a `anon`/`authenticated` em toda RPC privilegiada, ausência de recursão infinita nas policies. Nenhuma falha nesta área em nenhuma das 618 testes que passam.
- **Disciplina de logs/PII**: `ADR-084` aplicado em ~25 call sites, confirmado sem vazamento no runbook de observabilidade.
- **Job de retenção/purga**: `pg_cron` real, agendado, com execução bem-sucedida confirmada (`OBSERVABILITY.md` §3).
- **Materiais de marketing (SET-65)**: 21 peças (7 produtos × Post/Story/Poster) portadas, personalizadas com dado real do representante, exportação client-side validada por POC real (ADR-090), testadas por unidade e por E2E real em navegador (download de arquivo de verdade).
- **Branch hygiene**: `main` e `develop` (locais e remotos) sincronizados em `280ced3`, sem nenhum branch órfão além dos dois. **Achado operacional, corrigido nesta sessão**: o `main`/`develop` *locais* deste worktree estavam, respectivamente, 68 e 16 commits atrasados em relação ao remoto (nunca tinham sido atualizados) — um `git switch main` sem sincronizar antes chegou a reverter momentaneamente o working tree para uma versão bem mais antiga do código. O remoto nunca esteve errado; já corrigido com fast-forward local. Fica registrado como lembrete: sincronizar (`git fetch`) antes de trocar para um branch local que não foi tocado há um tempo, especialmente em worktrees de vida longa.
- **`.env` nunca versionado**: `.gitignore` cobre todo `.env*` exceto `.env.example`, com o motivo documentado inline.

---

## Resumo executivo

| # | Achado | Severidade | Bloqueia lançamento? |
|---|---|---|---|
| 1 | `apply_billing_event` — 3 testes vermelhos por contaminação de dados de teste (**resolvido**: causa raiz confirmada, banco de teste limpo, testes passam) | Resolvida | Não |
| 2 | `PRODUCT.md` — cabeçalho "Verification record" desatualizado (conteúdo já correto) | Baixa | Não (correção de metadado, barata) |
| 3 | Hipótese de "willingness to pay" ainda não validada (0 pagantes) | Informativo | Não é defeito — é o estado esperado do Stage 1 |
| 4 | Contato de suporte/incidente não preenchido (**resolvido**: `contato@setnar.com`) | Resolvida | Não |
| 5 | 1 mudança de produto não commitada (`onboarding-form.tsx`) (**resolvido**: commitado e mergeado) | Resolvida | Não |
| 6 | Ledger de migrations — drift não confirmado para produção (só teste foi verificado) | Baixa-Média | Verificar antes do lançamento, sem urgência nova |
| 7 | Dívida de documentação pré-existente (D2-D12) + memória incorreta (corrigida) | Baixa | Não |
| 8 | Vazamento recorrente de fixtures de teste no projeto Supabase de dev (**resolvido**: causa raiz corrigida) | Resolvida | Não |
| 9 | Overflow de layout mobile no SET-65 (**resolvido**: corrigido e mergeado); sem teste de regressão automatizado para esse tipo de bug | Baixa | Não — considerar teste de viewport estreito numa sessão futura |

**Próximo passo recomendado**: nenhum bloqueador de código pendente — `npm run verify` confirmado verde de ponta a ponta (typecheck/lint/618 testes/build). Dos achados originais, restam só 2, 6 e 7 em aberto, todos de baixa severidade e nenhum urgente; 6 é o único que vale fechar antes do lançamento por prudência (checar produção), sem bloquear.
