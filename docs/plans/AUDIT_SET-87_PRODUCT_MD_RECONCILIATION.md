Status: Proposta — investigação concluída, aguardando aprovação do Product Owner para aplicar as edições em `PRODUCT.md`
Authority: Non-normative (auditoria/investigação da SET-87; não altera nenhuma decisão de produto por si só)
Code baseline: branch `develop` @ `b1cd1da` (2026-08-27), worktree `admin/set-87-revalidar-a-verdade-atual-do-produto-e-reconciliar-productmd`
Last reviewed: 2026-08-27
Related: SET-87 (Linear, primeiro gate da série de revisão documental; bloqueia SET-88, SET-89, SET-90, SET-91, SET-92)
Superseded by: n/a

# SET-87 — Revalidação de `PRODUCT.md` contra a implementação real

**Pergunta**: `docs/PRODUCT.md`, e em especial sua seção *What Exists Today*, ainda descreve corretamente o produto verificável no código atual?

**Método**: leitura de `README.md` (raiz, não lido de novo aqui pois já coberto por `AUDIT_PRE_LAUNCH_CONSISTENCY.md`), `docs/PRODUCT_CONSTITUTION.md`, `docs/README.md` (mapa de autoridade) e `docs/PRODUCT.md` por completo; leitura dos ADRs referenciados diretamente por `PRODUCT.md` (ADR-055, ADR-057, ADR-088, ADR-089, ADR-090, ADR-091, ADR-092, ADR-082); `git log df8db50..HEAD` (baseline atual de `PRODUCT.md` até `HEAD`) para levantar tudo que foi enviado desde a última verificação; inspeção direta do código (`src/app`, `src/modules/billing`, `src/modules/analytics`, `src/modules/leads`, `src/modules/marketing-materials`, `src/modules/representatives/presentation/commercial-pages`) e de `supabase/migrations/`; confirmação de ausência de PWA (`manifest.json`, service worker, dependência `next-pwa`/`workbox`) por busca direta. Nenhuma alteração de código ou de documento normativo foi feita nesta etapa — esta é a matriz exigida pela SET-87 antes de qualquer edição de `PRODUCT.md`.

**Escopo não coberto nesta passada**: `ROADMAP.md`, `DOMAIN_MODEL.md`, `ARCHITECTURE.md`, `DESIGN_SYSTEM.md`, `ENGINEERING_GUIDELINES.md` e governança (`README.md`/Constitution) — esses são objeto das issues SET-88 a SET-91, que dependem desta ser fechada primeiro. Os 93 ADRs não citados diretamente por `PRODUCT.md` não foram lidos individualmente.

---

## Veredito

`PRODUCT.md` não contradiz `PRODUCT_CONSTITUTION.md` em nenhum ponto verificado — a Visão, o Core Value Proposition e as seções de Public Positioning continuam consistentes com a Constitution e não reduzem o SETNAR a "criador de páginas". O problema está concentrado, como nas auditorias anteriores, na seção *What Exists Today* e nos dois parágrafos fora dela que também descrevem estado atual (MVP Goal / Success Metrics): a data de verificação (`df8db50`, 2026-08-06) está **cerca de 140 commits atrasada**, e pelo menos três afirmações de capacidade estão hoje factualmente erradas ou contraditórias com outra seção do mesmo documento.

---

## Achado 1 [Reabre D13 / Achado 1 de `AUDIT_PRE_LAUNCH_CONSISTENCY.md`] — MVP Goal ainda nega o billing automatizado

`docs/PRODUCT.md:196` continua afirmando: *"there is no payment gateway, billing flow, or automated Subscription lifecycle"*.

Isso é falso. Confirmado diretamente no código, não apenas por ADR:
- `src/app/api/billing/asaas-webhook/route.ts` — webhook autenticado, idempotente, que aplica eventos `PAYMENT_*`/`CHECKOUT_*` via `apply_billing_event()`.
- `src/modules/billing/application/start-checkout.ts`, `cancel-subscription.ts` — checkout hospedado e cancelamento pelo representante.
- `supabase/migrations/20260828000000_handle_subscription_created_event.sql` e o histórico de commits SET-26 a SET-35, SET-67 (trial de 30 dias) — lifecycle completo: criação, ativação automática, cancelamento, reconciliação, trial.

**Severidade: Alta** — é o segundo parágrafo do documento mais importante da hierarquia; um leitor concluiria que o SETNAR não tem como cobrar, quando o billing está em produção há semanas.

**Ação proposta**: reescrever o parágrafo para registrar o billing Asaas automatizado como existente, preservando a ressalva real que continua válida (ver Achado 2).

---

## Achado 2 [Novo] — Baseline de *What Exists Today* está ~140 commits atrasada

Baseline atual: commit `df8db50`, 2026-08-06. `git log df8db50..HEAD` lista 140+ commits, incluindo SET-78 (sete árvores independentes), SET-83 (Company na URL — este já está refletido no texto), SET-91 (QR sob demanda), SET-65 (materiais — já refletido), e todo o subsistema de billing do Achado 1.

O texto de *What Exists Today* já foi parcialmente editado depois de `df8db50` sem que a linha de baseline fosse atualizada junto (o mesmo padrão já registrado em `docs/README.md` D13 e em `AUDIT_PRE_LAUNCH_CONSISTENCY.md` Achado 4 para `DOMAIN_MODEL.md`) — o que faz o documento parecer mais verificado do que está.

**Severidade: Alta** — `docs/README.md` é explícito: *"Every other document in this set defers to this one on the question of what exists, so a stale date here makes the whole set stale."*

**Ação proposta**: atualizar o bloco de verificação para baseline `b1cd1da` / 2026-08-27, método e verificador mantidos, e registrar nesta auditoria como a evidência rastreável.

---

## Achado 3 [Novo] — Commercial Pages: o documento descreve uma implementação já substituída

`docs/PRODUCT.md:372` descreve as sete Commercial Pages como *"currently delivered by the shared-shell implementation of ADR-088"*, com a substituição por sete árvores independentes (ADR-089) *"in development and not described here as shipped"*.

Isso não é mais verdade. Confirmado no código:
- `src/modules/representatives/presentation/commercial-pages/{conexao-club,conexao-green,conexao-livre,conexao-placas,conexao-solar,green-seguros,telecom}/` — sete árvores independentes, cada uma com seu próprio `.tsx`/CSS Modules.
- Nenhum resquício do shell/registro compartilhado do ADR-088 (`CommercialPageContent`, registro tipado por Produto) permanece no código — busca por esses símbolos não retorna nada em `src/`.
- Commits posteriores à decisão (`fa618ed`, `7c0dd5f`, `b7a3bcc`, `2ae5bd8`) mostram trabalho de acabamento (paridade tipográfica, rodapé, gap mobile) sobre essa nova estrutura, não sobre o shell antigo.

**Nota lateral, fora do escopo desta issue**: o cabeçalho do próprio `ADR-089` ainda diz *"Status: Accepted — implementação reaberta e incompleta"* (2026-08-13), o que também parece desatualizado frente aos commits de acabamento acima — mas corrigir o status de um ADR não é escopo de `PRODUCT.md`; registrado aqui apenas para quem for revisar governança de ADRs (SET-91/92).

**Severidade: Média-alta** — é exatamente o tipo de contradição "existe e é futuro ao mesmo tempo" que a SET-87 pede para eliminar.

**Ação proposta**: reescrever o bullet para descrever as sete árvores independentes como a implementação atual, sem mencionar o shell do ADR-088 como estado presente.

---

## Achado 4 [Novo] — Contradição interna: analytics "mostrado" numa seção, "não mostrado" em duas outras

Três seções do mesmo documento descrevem o mesmo fato de forma incompatível:

| Seção | O que diz |
|---|---|
| *Success Metrics — Instrumentation status* (linha ~218) | "there is no read path and no interface that displays them [visits/clicks] — to the representative or to anyone else" |
| *Product Capabilities — Analytics* (linha ~462) | "Visits — collected, not shown", "Clicks — collected, not shown", "Sources — collected, not shown" |
| *What Exists Today* (linha ~378) | "Basic analytics shown to the representative in `/app/paginas`: visits, WhatsApp clicks and leads, counted per Product over a 7- or 30-day window (SET-37/ADR-082)" |

A terceira é a correta. Confirmado no código: `src/modules/analytics/domain/analytics-metrics-repository.ts` define o contrato de leitura agregada (visitas, cliques, leads por Produto/janela), consumido por `src/app/app/paginas/page.tsx`. As duas primeiras descrevem o estado **anterior** à SET-37/ADR-082 e nunca foram atualizadas quando a leitura foi entregue.

**Severidade: Alta** — é literalmente o ponto que a SET-87 pede para resolver ("elimine contradições internas... casos em que uma capacidade aparece simultaneamente como existente e futura/não exibida").

**Ação proposta**: corrigir as duas seções desatualizadas para refletir que visitas, cliques e leads **são** mostrados hoje, por Produto, em janela de 7/30 dias — preservando a ressalva real e ainda válida: sem breakdown por referrer/dispositivo/cidade, sem taxa de conversão (isso continua Future/Advanced Analytics).

---

## Achado 5 [Novo] — "In validation or development" lista dois itens que a realidade já ultrapassou

- **"Manual Subscription activation/reactivation (`SPRINT_E_PLAN.md`, E3)"** — `SPRINT_E_PLAN.md` linha 26 confirma E3 como "Não implementado" (documenta um UPSERT manual via SQL Editor como procedimento, nunca código). Com o billing automatizado do Achado 1 em produção, a ativação manual documentada em E3 foi superada pelo webhook — listá-la como algo "em validação" sugere que a ativação de assinatura ainda depende de um passo manual, o que não é mais o caminho real.
- **"Analytics event retention/purge (AN7)"** — já implementado. `supabase/migrations/20260904000000_add_retention_purge_job.sql` (ADR-086, SET-73) confirma a purga automática via `pg_cron`, com o próprio histórico de commits (`9d52559`, `bc389e0`) registrando validação contra o Supabase real.

**Severidade: Média** — não é uma contradição visível como o Achado 4, mas é a mesma classe de erro: a seção descreve como "não utilizável ainda" algo que já está em produção (AN7) ou que a realidade tornou irrelevante (E3).

**Ação proposta**: remover AN7 da lista (mover a capacidade correspondente — purga de retenção — para nota em *Available now*, se for considerada visível o suficiente para constar ali, ou simplesmente removê-la por ser infraestrutura interna sem superfície voltada ao representante); remover a menção a E3 como "em validação", já que o caminho real de ativação hoje é o webhook do Achado 1.

---

## Achado 6 [Precisão, severidade baixa] — QR Code: geração sob demanda não está descrita

`docs/PRODUCT.md:373` descreve o QR Code como renderizado no navegador com download/copiar link/fallback/retry, mas não menciona que, desde `ADR-091` (SET-91), a geração passou a ser **sob demanda** (abre um diálogo via botão "Gerar QR Code") em vez de sempre renderizada no card. Confirmado em `ADR-091` e consistente com o histórico de commits (`cf74c52`).

**Severidade: Baixa** — não é uma contradição, é uma imprecisão de UX que não muda nenhuma conclusão sobre "o que existe".

**Ação proposta**: opcional. Se o Product Owner preferir manter `PRODUCT.md` no nível de granularidade atual (que já não descreve outros detalhes de UX, como a confirmação de despublicar), este achado pode ficar sem ação. Incluído aqui só para registro completo.

---

## Achado 7 [Confirmação, sem ação] — Landing page pública existe mas não é citada em *What Exists Today*

`src/app/page.tsx` (módulo `marketing/presentation`: Hero, HowItWorks, Benefits, Pricing, FinalCta) é uma rota pública real, e a seção *Public Positioning and Communication* de `PRODUCT.md` já pressupõe sua existência ("This section is normative. It governs the landing page..."). Ainda assim, *What Exists Today* — a seção que a própria SET-87 pede para conferir quanto a "rotas atuais, incluindo superfícies de marketing/divulgação" — nunca lista essa rota explicitamente.

**Severidade: Baixa.** Não é uma contradição (nada afirma que a landing não existe), é uma omissão.

**Ação proposta**: opcional — adicionar uma linha curta em *Available now* confirmando a landing page pública como rota existente, sem descrever conteúdo comercial específico (isso já é regido por *Public Positioning*, que não deve virar changelog).

---

## Achados verificados e confirmados corretos (sem ação necessária)

Para que a matriz fique completa, os pontos abaixo — todos citados como obrigatórios na SET-87 — foram verificados e **não** apresentam divergência:

| Ponto | Verificação | Resultado |
|---|---|---|
| Materiais de divulgação (SET-65) | `src/modules/marketing-materials/presentation/` tem 7 pastas de Produto × 3 arquivos (post/story/poster) = 21 | Bate exatamente com o texto atual |
| Attribution/source tracking | `src/modules/analytics/domain/analytics-gateway.ts` e `src/modules/leads/domain/lead-gateway.ts` só capturam o header HTTP `Referer` bruto — nenhum `utm_`/parâmetro de canal encontrado no código | Texto atual já é preciso ("no breakdown by referrer... remains Future") |
| Caixa de contatos (`/app/contatos`) | `lead-inbox.tsx` não tem status, nota, atribuição ou busca | Bate com "no status, note, edit, assignment, search or automation" |
| Company no endereço público (SET-83/ADR-092) | Já refletido corretamente no texto atual | Sem ação |
| PWA | Sem `manifest.json`, sem service worker, sem `next-pwa`/`workbox` em `package.json` | Confirma que PWA não existe — `PRODUCT.md` já não o lista em *What Exists Today* (correto); nenhuma ação necessária aqui |

---

## Matriz consolidada — documentado × implementado × ação proposta

| # | Documentado hoje | Implementado hoje | Ação proposta |
|---|---|---|---|
| 1 | Sem gateway de pagamento, billing manual | Billing Asaas automatizado (checkout, webhook, cancelamento, trial 30d, reconciliação) | Reescrever parágrafo de MVP Goal |
| 2 | Baseline `df8db50`/2026-08-06 | `b1cd1da`/2026-08-27, ~140 commits à frente | Atualizar bloco de verificação |
| 3 | Commercial Pages via shell compartilhado (ADR-088); 7 árvores "em desenvolvimento" | 7 árvores independentes já shipped, shell removido | Reescrever bullet de Commercial Pages |
| 4 | "Analytics coletado, não mostrado" (2 seções) | Mostrado em `/app/paginas` por Produto, janela 7/30d (SET-37/ADR-082) | Corrigir Success Metrics e Product Capabilities |
| 5 | AN7 e E3 "em validação" | AN7 shipped (SET-73); E3 superado pelo billing automatizado | Remover/atualizar lista "In validation or development" |
| 6 | QR sempre renderizado | QR sob demanda (dialog, ADR-091) | Opcional — precisão de UX |
| 7 | Landing page não citada em *What Exists Today* | Rota pública real (`src/app/page.tsx`) | Opcional — adicionar uma linha |

---

## Próximo passo

Esta auditoria não altera `PRODUCT.md`. Conforme o padrão já estabelecido no projeto (`docs/plans/AUDIT_MVP_LAUNCH.md`, `docs/plans/AUDIT_PRE_LAUNCH_CONSISTENCY.md`) e conforme a própria SET-87 ("Só então alterar PRODUCT.md"), a Parte 2 — aplicar os Achados 1 a 5 (obrigatórios) e decidir sobre 6 e 7 (opcionais) diretamente em `docs/PRODUCT.md`, com baseline `b1cd1da`/2026-08-27 — só deve ser executada após aprovação do Product Owner.

**Aguardando aprovação.**
