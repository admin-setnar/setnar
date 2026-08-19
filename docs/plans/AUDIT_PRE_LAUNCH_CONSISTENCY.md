Status: Proposta — requer decisão do Product Owner
Authority: Non-normative (auditoria de consistência, não altera nenhuma decisão de produto ou arquitetura)
Code baseline: branch `develop` @ `9824ff9` (working tree limpo, exceto `espacamento-id.png` não rastreado, fora de escopo)
Last reviewed: 2026-08-19
Superseded by: n/a

# Auditoria de consistência — código e documentação antes de clientes reais

**Pergunta**: existe redundância, inconsistência ou contradição — no código ou nos documentos — que um cliente pagante real ou um investidor encontraria e que comprometeria a credibilidade do SETNAR como profissional e tecnicamente sólido?

**Método**: leitura direta do código (`src/`, `supabase/`) e dos documentos normativos (`PRODUCT_CONSTITUTION.md`, `PRODUCT.md`, `ROADMAP.md`, `DOMAIN_MODEL.md`, `ARCHITECTURE.md`, `ENGINEERING_GUIDELINES.md`, `DESIGN_SYSTEM.md`, `docs/README.md`, `README.md` raiz, os 92 ADRs, os 6 runbooks, e os planos `Approved`/`Implemented`), em três frentes paralelas independentes, mais verificação direta pontual. `npm run typecheck` e `npm run lint` executados e confirmados limpos. Nenhuma decisão de produto foi tomada e nada foi editado — esta auditoria só registra achados, no mesmo padrão de `docs/plans/AUDIT_MVP_LAUNCH.md`.

**Relação com auditorias anteriores**: esta auditoria **não substitui** `AUDIT_MVP_LAUNCH.md` (prontidão operacional — billing, RLS, deploy, CI) nem a tabela *Outstanding Documentation Debt* de `docs/README.md` (D1–D13). Ela **reconcilia** as duas: confirma o estado atual de cada débito aberto, corrige uma afirmação de `AUDIT_MVP_LAUNCH.md` que hoje está errada (Achado 1 abaixo), e adiciona achados novos que nenhuma das duas cobria — principalmente na camada normativa superior (`README.md` raiz, `ROADMAP.md`, `DOMAIN_MODEL.md`) e uma varredura de redundância de código que nunca tinha sido feita.

**Escopo não coberto**: revisão jurídica de termos/política de privacidade; conteúdo de vendas/pitch (não existe no repositório); os 21 arquivos de materiais de marketing (`templates/marketing-materials/`, `src/modules/marketing-materials/`) não foram lidos por completo, só sua estrutura; `docs/plans/archive/` e planos `Draft`/`Proposed` (não relevantes para "o que existe hoje").

---

## Veredito

**Nenhum bug de código bloqueia o lançamento.** `npm run typecheck` e `npm run lint` limpos; nenhum `TODO`/`FIXME`/`console.log` esquecido em caminho de produção; a única sobra de nomenclatura antiga (`licenseId`) está isolada a um comentário em uma migration já aplicada.

**A documentação normativa, porém, não está pronta para ser lida por um cliente ou investidor técnico sem uma passada de correção.** O problema não está nos runbooks operacionais (`BILLING_OPERATIONS.md`, `DEPLOYMENT.md`, `PILOT_METRICS.md`, `LGPD_RIGHTS.md`, `OBSERVABILITY.md`, `BACKUP_RECOVERY.md`) — esses estão detalhados, honestos e sem achados — nem no log de 92 ADRs, que é internamente consistente (numeração limpa, índice íntegro, sem contradição não sinalizada). O problema está concentrado em **três documentos no topo da hierarquia normativa** (`README.md` raiz, `PRODUCT.md`, `ROADMAP.md`) mais `DOMAIN_MODEL.md`: todos têm pelo menos uma afirmação factual desatualizada que um leitor externo verificaria em minutos — e que, encontrada, mancha a credibilidade do resto do repositório, mesmo o resto estando sólido.

---

## Achado 1 [Reabre e corrige D13/Achado 2 de AUDIT_MVP_LAUNCH.md] — `PRODUCT.md` nega a existência do billing automatizado numa seção, afirma noutra

`docs/PRODUCT.md:196`, seção **"MVP Goal"**, ainda diz textualmente: *"Subscriptions exist as a record and are enforced [...] but they are activated manually — there is no payment gateway, billing flow, or automated Subscription lifecycle."*

Isso é falso hoje. `ADR-072` a `ADR-078` e `ADR-085` documentam um subsistema de billing Asaas completo: checkout hospedado, webhook com idempotência, cancelamento, reconciliação, trial gratuito de 30 dias. `docs/runbooks/PILOT_METRICS.md` §8 confirma contra o banco real: assinaturas já existem em `trialing`.

**Isto contradiz diretamente `docs/plans/AUDIT_MVP_LAUNCH.md`, Achado 2**, que afirma "o conteúdo já foi corrigido, só o cabeçalho de verificação ficou desatualizado". Essa afirmação está certa para a seção *What Exists Today* (linha ~381 em diante, que já cita Asaas corretamente) — mas errada para a seção "MVP Goal" (linha 196), um trecho **diferente** do mesmo arquivo que a primeira leitura daquela auditoria não cobriu. As duas auditorias, lidas junto, hoje se contradizem sobre o estado de `PRODUCT.md` — depois desta reconciliação, não deveriam mais.

Este é exatamente o item **D13** já catalogado em `docs/README.md` § *Outstanding Documentation Debt* — confirmado ainda aberto, e é o achado de maior severidade de toda a tabela.

**Severidade: Alta.** Um investidor ou cliente técnico que leia só "MVP Goal" — a segunda seção do documento mais importante da hierarquia — concluiria que o SETNAR não tem como cobrar.

**Recomendação**: reescrever o parágrafo da linha 196 para refletir o billing Asaas real, com a mesma disciplina de "Verification record" (baseline/data/quem verificou) já usada em *What Exists Today*.

---

## Achado 2 [Novo, não rastreado antes] — `ROADMAP.md` descreve a mesma coisa como inexistente, em documento diferente

`docs/ROADMAP.md:126,150,215-220,260-262` também descreve billing como não implementado: *"Payment gateway | No plan — the largest gap"*, *"Activation is manual"*, com baseline de verificação em `df8db50`/2026-08-06 — anterior a todo o subsistema Asaas.

Mesma classe de problema do Achado 1, mas é um documento **diferente**, então não é resolvido pela correção do Achado 1 — precisa da sua própria passada. `ROADMAP.md` nunca apareceu na tabela de débitos de `docs/README.md` nem em `AUDIT_MVP_LAUNCH.md`; este é um achado genuinamente novo desta auditoria.

**Severidade: Alta.** `ROADMAP.md` é o documento que declara "o que vem" — um investidor que o leia concluiria que billing ainda está no backlog, quando já está em produção há semanas.

**Recomendação**: atualizar as seções citadas para refletir que o gateway de pagamento foi implementado (linkar `ADR-072`–`078`), e atualizar a baseline de verificação.

---

## Achado 3 [Novo] — `README.md` raiz erra o número de ADRs por quase 30

`README.md:28` e `README.md:162` dizem **"63 ADRs"/"63 decisions"**. A contagem real hoje é **92** (confirmado por contagem de arquivos em `docs/adr/` e pelo próprio índice, `docs/adr/README.md:3`, que já diz corretamente "92 decisions").

**Severidade: Alta.** É o arquivo mais lido do repositório, o número é trivialmente verificável (`ls docs/adr | wc -l`), e é exatamente o tipo de erro que um cliente/investidor técnico notaria em segundos — minando a credibilidade de tudo que vem depois.

**Recomendação**: corrigir "63" → "92" nas duas linhas, ou (melhor, mais durável) trocar o número fixo por uma referência a "o índice em `docs/adr/README.md`" para não voltar a ficar obsoleto a cada ADR nova.

---

## Achado 4 [Novo] — `DOMAIN_MODEL.md` é o terceiro documento com data de verificação vencida

`docs/DOMAIN_MODEL.md:242`, tabela "Implemented Domain", tem baseline no commit `23290c4`/2026-08-05 — anterior a SET-65 (materiais de marketing), SET-77, SET-83 e, como os Achados 1–2 mostram, anterior ao próprio reconhecimento de billing em outros documentos.

Junto com `PRODUCT.md` (Achado 1) e `ROADMAP.md` (Achado 2), este é o **terceiro** documento-fonte com verificação vencida pelo próprio critério que cada um declara. Isso é, em conjunto, um indício de que a reconciliação por sprint descrita em `docs/README.md` § *When this documentation is re-verified* não está sendo seguida na prática — não é só um documento isolado esquecido, é um padrão.

**Severidade: Média-alta.**

**Recomendação**: reverificar e atualizar a baseline da tabela; considerar, à parte desta auditoria, se D10 (falta de enforcement automatizado da reconciliação, `npm run docs:check` nunca implementado) merece ser priorizado justamente por causa deste padrão.

---

## Achado 5 [Novo] — 5 de 7 planos `Approved`/`Implemented` não têm o cabeçalho que o próprio `docs/plans/README.md` exige

`docs/plans/README.md` exige, "no topo" de todo plano, um cabeçalho com `Status:`/`Authority:`/`Code baseline:`/`Last reviewed:`/`Superseded by:`. Confirmado: `QR_ANALYTICS_PLAN.md`, `SPRINT_E_PLAN.md`, `BILLING_DECISIONS_PLAN.md`, `MARKETING_MATERIALS_PLAN.md` e `DATA_RETENTION_DECISIONS_PLAN.md` não têm esse cabeçalho. Só os dois planos mais recentes (revisados em 2026-08-14) cumprem o formato — sugerindo que a exigência foi adotada depois desses cinco terem sido escritos, e nunca retroaplicada.

**Severidade: Média** — é uma regra que o próprio repositório declara e não segue, o tipo de inconsistência que mina a alegação "isto é um processo disciplinado".

**Recomendação**: retroaplicar o cabeçalho aos 5 planos (é mecânico — `Status: Approved`/`Implemented` já é conhecido pela tabela-resumo do `docs/plans/README.md`, só falta escrever).

---

## Achado 6 [Novo] — Diagramas ASCII quebrados em `ARCHITECTURE.md`

`docs/ARCHITECTURE.md:118-130,235-265,275-291,299-341` — os 4 diagramas ASCII (camadas, módulos, dependências, estrutura de pastas) têm fence Markdown malformado (abre \`\`\` vazio, o conteúdo do diagrama fica fora do bloco, fecha \`\`\` solto depois). Repetido nas 4 ocorrências — não é um typo isolado, é um padrão de como os diagramas foram inseridos.

**Severidade: Média** — provavelmente não renderiza como texto monoespaçado em nenhum visualizador Markdown (GitHub incluso), quebrando o alinhamento que o diagrama depende para ser legível.

**Recomendação**: corrigir o fencing dos 4 blocos (mover \`\`\`text/\`\`\`ascii para envolver o diagrama inteiro).

---

## Achado 7 [Novo] — `ENGINEERING_GUIDELINES.md` prescreve uma convenção de branch que ninguém usa

`docs/ENGINEERING_GUIDELINES.md:550-577` prescreve `feature/`, `fix/`, `hotfix/`, `release/vX.Y.Z`. A prática real do repositório (confirmada nesta sessão, ver limpeza de branches feita hoje) é `admin/<descrição>-<TICKET>` — nenhuma branch no padrão documentado existe ou já existiu.

**Severidade: Média** — não é um erro factual sobre o produto, mas é uma regra de engenharia documentada que a própria engenharia não segue; um engenheiro novo lendo o guia seria ativamente mal orientado.

**Recomendação**: atualizar o guia para documentar a convenção real (`admin/<descrição>-<TICKET-ID>`), ou decidir formalmente migrar para o padrão documentado — decisão do Product Owner/engenharia, não só uma correção de texto.

---

## Achado 8 [Atualiza D2 e D3 de `docs/README.md`] — a própria tabela de dívida documental está com dois itens desatualizados

- **D2** (`docs/README.md:276`) registra 1 referência quebrada a `docs/AUDIT_CONSTITUTION_RECONCILIATION.md` (via ADR-058). Na prática são **4 ADRs** citando esse arquivo inexistente: `ADR-058:11`, `ADR-059:4`, `ADR-060:11`, `ADR-061:16`. A tabela subestima o alcance do próprio débito que já rastreia.
- **D3** (`docs/README.md:277`) descreve como pendente uma correção em seções do `README.md` raiz ("What is deliberately not here"/"Next steps, in order") que **não existem mais sob esses nomes** — a raiz já foi reescrita, com "What exists, and what doesn't" e "Current work and what's next" no lugar, ambas já deferindo corretamente a `PRODUCT.md`/`docs/plans/`. O débito parece resolvido, mas a tabela nunca foi atualizada para dizer isso.

**Severidade: Baixa** — nenhum dos dois é visível a cliente, mas é uma inconsistência dentro do próprio mecanismo que existe para rastrear inconsistências.

**Recomendação**: atualizar D2 para "4 ADRs", e marcar D3 como resolvido (ou reescrever seu texto para citar as seções atuais, se ainda houver algo de fato pendente nelas).

---

## Achado 9 — Redundâncias e sobras de baixa severidade no código

Nenhuma bloqueia o lançamento; registradas para uma limpeza de rotina:

1. `src/modules/representatives/presentation/commercial-pages/conexao-club/conexao-club-page.tsx:74-87` — duplica manualmente o markup de `LeadSection` em vez de importar o componente compartilhado (`content-sections.tsx:13-15`, byte-idêntico) que as outras 6 páginas de produto usam. Comportamento idêntico hoje; uma mudança futura em `LeadSection` não propagaria aqui.
2. `src/modules/billing/presentation/checkout-error-messages.ts:3-6` e `cancel-subscription-error-messages.ts:3-6` — duas interfaces locais estruturalmente idênticas (`{title: string; description?: string}`), poderiam ser um único tipo compartilhado.
3. `supabase/migrations/20260806000000_add_register_representative.sql:272` — comentário residual cita `{licenseId}`, nome anterior ao rename para `authorizationId` (ADR-060/061/062). Migration já aplicada — não deve ser editada, só registrado.
4. `package.json:9` — `"lint": "next lint"` está deprecated (o próprio Next.js avisa) e será removido no Next 16. Não quebra hoje.

**Nota positiva**: os 6 wrappers `safe-*-call.ts` (auth/billing/feedback/representatives) são estruturalmente duplicados entre si, mas isso **não é redundância acidental** — é decisão arquitetural documentada inline, espelhando o princípio de `ARCHITECTURE.md` de que cada módulo é dono das próprias regras.

**Severidade: Baixa** (todos os 4 itens).

---

## Achado 10 — Cosméticos menores em documentos

- `docs/PRODUCT_CONSTITUTION.md:132-133` — regra horizontal (`---`) duplicada antes da § 6.
- `docs/adr/README.md:109` — `ADR-063`, cujo título ("...**redefinida**...") sugere que substitui uma regra anterior, tem a coluna `Related` vazia. Não foi possível confirmar qual ADR ela redefiniria sem investigação mais profunda — vale uma checagem humana rápida, não uma correção automática.

**Severidade: Baixa.**

---

## O que já está sólido — não precisa de nova auditoria

- **Os 92 ADRs**: numeração limpa (001–092, sem lacunas nem duplicatas), índice íntegro, nenhuma contradição não sinalizada entre ADRs, nenhum arrasto de terminologia (`licenseId` não aparece fora das próprias ADRs de rename).
- **Os 6 runbooks operacionais** (`BILLING_OPERATIONS`, `DEPLOYMENT`, `PILOT_METRICS`, `LGPD_RIGHTS`, `OBSERVABILITY`, `BACKUP_RECOVERY`): detalhados, honestos sobre o que foi e não foi testado, sem achados nesta auditoria.
- **Código**: `npm run typecheck` e `npm run lint` limpos; nenhum `TODO`/`FIXME`/`console.log`/`debugger` esquecido em caminho de produção; módulo de billing (dinheiro real) bem documentado e sem bugs encontrados.

---

## Resumo executivo

| # | Achado | Documento/arquivo | Severidade | Bloqueia lançamento? |
|---|---|---|---|---|
| 1 | `PRODUCT.md` nega billing automatizado na seção "MVP Goal" (= D13, reabre e corrige Achado 2 de `AUDIT_MVP_LAUNCH.md`) | `PRODUCT.md:196` | Alta | Não é bug — é uma correção de conteúdo antes de material voltado a cliente citar o documento |
| 2 | `ROADMAP.md` descreve billing como não implementado | `ROADMAP.md:126,150,215-220,260-262` | Alta | Idem |
| 3 | `README.md` raiz erra contagem de ADRs ("63" vs 92 reais) | `README.md:28,162` | Alta | Correção trivial, mas visível a qualquer leitor técnico |
| 4 | `DOMAIN_MODEL.md` com verificação vencida (3º documento nessa classe) | `DOMAIN_MODEL.md:242` | Média-alta | Não |
| 5 | 5/7 planos sem o cabeçalho obrigatório | `docs/plans/*.md` | Média | Não |
| 6 | Diagramas ASCII com fence Markdown quebrado | `ARCHITECTURE.md` (4 ocorrências) | Média | Não |
| 7 | Convenção de branch documentada não é a usada na prática | `ENGINEERING_GUIDELINES.md:550-577` | Média | Não |
| 8 | Tabela de dívida documental (D2/D3) desatualizada em si mesma | `docs/README.md:276-277` | Baixa | Não |
| 9 | 4 redundâncias/sobras cosméticas de baixa severidade | `src/`, `supabase/migrations/`, `package.json` | Baixa | Não |
| 10 | 2 cosméticos menores em documentos | `PRODUCT_CONSTITUTION.md`, `docs/adr/README.md` | Baixa | Não |

**Nenhum achado bloqueia tecnicamente o lançamento** — o código está limpo e os runbooks operacionais são sólidos. Mas os Achados 1–3 (severidade Alta) estão exatamente nos três documentos que um investidor ou cliente técnico mais provavelmente leria primeiro (`README.md`, `PRODUCT.md`, `ROADMAP.md`), e são verificáveis em minutos — recomendo fechá-los antes de qualquer material voltado a cliente real citar esses arquivos.

---

## Próximo passo recomendado

Esta auditoria não executa nada — como de costume, aguarda decisão. Pontos que precisam de uma decisão explícita do Product Owner, não só "aprovar a correção":

- **Achado 7** (convenção de branch): corrigir o documento para refletir a prática real, ou migrar a prática para o padrão documentado? São decisões diferentes.
- **Achado 10, ADR-063**: vale o tempo de investigar qual ADR anterior ela redefine, ou aceitar a lacuna no índice?

Todo o resto (Achados 1–6, 8, 9, e a parte "documentar a convenção real" do Achado 7) é correção mecânica de conteúdo/metadado — sem decisão de produto nova — e pode ser executado assim que aprovado, achado por achado ou em bloco.

**Aguardando aprovação.**
