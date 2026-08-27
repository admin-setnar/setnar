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

## Addendum — segunda passada investigativa (2026-08-27)

Escopo: os seis pontos levantados pelo Product Owner sobre a primeira versão desta auditoria. Nenhum código ou documento normativo foi alterado nesta passada — apenas investigação adicional. `PRODUCT_CONSTITUTION.md` não foi tocado nem se propõe tocá-lo.

### A1. Reavaliação do Core Value Proposition

**Conclusão: o texto atual não contradiz a Constitution, mas não estabelece por que materiais, leads e analytics pertencem ao produto.**

`docs/PRODUCT.md` § *Core Value Proposition* (linhas 111–120) afirma que o valor do SETNAR é a confiança entre representante e organização autorizante — "not creating pages". Isso é fiel à Constitution (Core Belief 5: progresso não se mede em artefatos) e não deveria mudar. Mas a seção não conecta essa confiança a nada distribuível ou verificável: quem lê só esse parágrafo não tem base textual para saber por que materiais de divulgação, QR Codes, captura de leads ou analytics básico fazem parte do produto, em vez de serem scope creep acidental sobre um "gerador de páginas confiável".

A seção *Solution*, logo abaixo, já cobre parcialmente isso ("together with the links and QR Codes needed to distribute them" / "the representative shares one professional address"), mas capture de leads e analytics não são mencionados em nenhuma das duas seções — só aparecem, sem conexão explícita, em *Success Metrics* e *What Exists Today*.

**Ação proposta (nova, adicional ao Achado 3 original)**: acrescentar um parágrafo curto ao final de *Core Value Proposition* — não substituir o existente — estabelecendo que a confiança só tem valor se for **distribuível** e **verificável**, e que por isso materiais/links/QR (distribuição) e leads/analytics básico (verificação) integram a mesma proposta de valor hoje, sem torná-la uma plataforma de marketing. Texto sugerido para a Parte 2:

> A presence a customer never finds, or that a representative can never confirm produced real interest, would not test this value proposition — it would only test whether a page can be generated. This is why distributing that presence (links, QR Codes, ready-made materials) and closing the loop on it (captured leads, basic analytics of visits and clicks) are part of what "infrastructure that makes a representative's presence credible" means in practice today — not a marketing platform grafted onto a page generator, and not a promise that any of these capabilities will expand beyond what *What Exists Today* states.

### A2. Reavaliação do MVP Goal

**Conclusão: "Nothing else" mistura duas afirmações diferentes — disciplina de escopo e composição do que está sendo validado — e isso vai além de só corrigir a frase do payment gateway (Achado 1 original).**

O parágrafo atual ("Validate whether independent representatives are willing to pay for a Digital Office. Nothing else. [...] It only validates demand.") é correto ao dizer que o MVP não resolve todo problema comercial do representante. Mas "Nothing else" pode ser lido como se o "Digital Office" sendo validado fosse só a página — o que não é o que a hipótese realmente testa. Se a Constitution e o próprio `PRODUCT.md` (definição formal de "Digital Office", linha 94) já incluem identidade, produtos, páginas, links, QR Codes e canais de contato como parte do mesmo conjunto, então validar "disposição a pagar" precisa necessariamente incluir a capacidade de distribuir e de medir — do contrário a oferta testada não é a mesma que o representante de fato usaria.

Isto é distinto do achado sobre billing (Achado 1): aquele corrige um fato factualmente errado (billing manual vs. automatizado); este é sobre a formulação do objetivo do MVP em si, que continua incompleta mesmo depois de corrigir a frase do billing.

**Ação proposta (nova, adicional ao Achado 1)**: acrescentar uma frase ao parágrafo de MVP Goal, sem remover "Nothing else" (que continua correto como disciplina de escopo). Texto sugerido para a Parte 2:

> "Nothing else" bounds the objective, not the Digital Office itself: this is a demand-validation exercise, not a mandate to solve every commercial problem a representative has (CRM, campaigns, AI and automation remain excluded — see *Non-Goals* and *Long-Term Vision*). The presence being validated already includes the distribution, capture and measurement described under *What Exists Today*, because a representative asked to pay for a page nobody can find, share or measure would not be evaluating the same offer this hypothesis tests.

### A3. Divergência SET-84 / Attribution — resolução factual

**Situação B, confirmada com evidência de código e git — não há divergência sem explicação restante.**

1. **`git branch --contains 766652a`** (commit final da SET-84) retorna só `worktree-set-84-divulgacao-atribuicao-origem`. **`git merge-base --is-ancestor 766652a HEAD`** (baseline `b1cd1da`, `develop`) retorna falso — **não está no baseline**.
2. Branch: `worktree-set-84-divulgacao-atribuicao-origem`, 11 commits próprios (`3bede93`…`766652a`), divergindo de `develop` em `a8ab2de` (2026-08-26). `develop` só recebeu, dessa linha de trabalho, o commit de documentação `43e6450` (plano + relatório de validação de funil) — nenhum código.
3–6. Migrations da branch (`20260908000000` a `20260908000003`, incluindo `add_origin_to_analytics_events`/`add_origin_to_leads`/`add_origin_write_functions`) e o parsing de `?src=` em `[productSlug]/page.tsx` **não existem em `develop`** — confirmado por `git diff --name-status develop worktree-set-84-divulgacao-atribuicao-origem -- supabase/migrations/` e por busca de `searchParams` em `src/app/[productSlug]`, que não retorna nada no baseline atual.
7. Read paths/breakdown: implementados na branch (passo 7/D5, commit `7bf40bb`, breakdown de visitas/leads por origem em `/app/paginas`) — também ausentes do baseline.
8. Testes: `tests/divulgacao-page.test.ts` (20 casos) e `divulgacao-attribution.spec.ts` (E2E, desktop + mobile) existem só na branch.

**Achado adicional, não solicitado mas relevante para a decisão**: a própria branch documenta, em `docs/plans/SET-84_DIVULGACAO_LEAN_PLAN.md` § 13.5 (na ponta da branch), uma regressão real e não corrigida — a migration `20260908000002` recriou `record_page_visit`/`record_whatsapp_click` restaurando o corpo anterior ao ADR-065 e **parou de chamar `private.is_page_publicly_accessible`**, a checagem canônica de acesso público. O próprio texto da branch registra: *"Isso bloqueia merge/release até uma migration forward-only restaurar o contrato canônico [...]"*. Ou seja, SET-84 não é apenas "ainda não mesclada" — está explicitamente marcada como bloqueada para merge por uma regressão de segurança conhecida e não corrigida.

**Conclusão**: `PRODUCT.md` não precisa de nenhuma correção sobre attribution — o texto atual ("no breakdown by referrer... remains Advanced Analytics, Future vision") já está correto para o baseline `b1cd1da`. A auditoria original (achado "attribution é só Referer bruto") estava certa; o que faltava era explicar a divergência com a evidência da SET-84, o que este addendum faz. Nenhuma mudança de texto é necessária neste ponto — mas ver ação opcional abaixo para *In validation or development*.

**Ação proposta (opcional, mesma classe do Achado 5 original)**: acrescentar uma linha a *In validation or development* registrando o estado real, para não deixar um trabalho já implementado e testado invisível ao leitor:

> Origin/channel attribution for visits and leads (SET-84): implemented and E2E-validated on a separate branch, not merged into `develop` — blocked by a known regression in the canonical public-access check inside `record_page_visit`/`record_whatsapp_click`, introduced by one of its own migrations. Not part of *What Exists Today* until merged and the regression is fixed.

### A4. Terminologia — Marketing Materials × futura Material/Media Library

**Conclusão: existe uma omissão (não uma contradição direta como o Achado 4 original) em `Product Capabilities` § *Marketing*.**

`docs/PRODUCT.md` § *Product Capabilities* (linha ~466) lista, sob "Marketing": Material Library, Campaigns e Smart Links, todos *future vision* — sem qualquer bullet reconhecendo que uma versão mínima de materiais de divulgação (SET-65, 21 materiais) **já existe hoje**. Isso contradiz silenciosamente `What Exists Today`, que já é cuidadoso sobre a diferença ("Pulled forward from Stage 2's Material Library [...] not the full Media Library"). Um leitor que consultasse só a tabela de `Product Capabilities` concluiria, incorretamente, que nenhuma capacidade de marketing existe ainda.

**Ação proposta**: adicionar uma linha a essa lista, deixando explícita a distinção entre a capacidade mínima já existente e a futura biblioteca completa — sem antecipar Campaigns nem qualquer capacidade nova:

> - Marketing Materials (personalized Post/Story/Poster per Product, SET-65) — *available now*, the minimal distribution kit the Stage 1 hypothesis needs
> - Material Library (campaign creation, visual editor, user-generated artwork, upload, its own analytics) — *future vision*, not the same capability as the row above

### A5. QR Code e Landing Page — confirmação de não-ação

Conforme orientação do Product Owner: **nenhuma ação proposta** para o Achado 6 (granularidade de UX do QR Code — pertence a `DESIGN_SYSTEM.md`/SET-90) nem para o Achado 7 (rota da landing page — já governada por *Public Positioning and Communication*, não precisa de bullet em *What Exists Today*). Ambos permanecem registrados no corpo principal desta auditoria apenas como observação, sem virar item de patch.

---

## Matriz atualizada (somente pontos afetados por este addendum)

| # | Documentado hoje | Realidade verificada | Ação proposta |
|---|---|---|---|
| 1 (estendido) | MVP Goal nega billing automatizado; "Nothing else" não distingue objetivo de composição do Digital Office | Billing automatizado (Achado 1 original) **+** "Nothing else" ambíguo sobre se distribuição/captura/medição integram a oferta validada | Corrigir parágrafo de billing (já proposto) **+** acrescentar frase de escopo (A2) |
| 3 (contexto) | Core Value Proposition não liga confiança a distribuição/verificação | Materiais, QR, leads e analytics existem hoje mas não têm justificativa textual na proposta de valor | Acrescentar parágrafo de fechamento (A1) |
| 8 (novo) | `PRODUCT.md` não menciona SET-84 em nenhuma seção | Implementado e validado por E2E em branch separada, bloqueado por regressão de segurança conhecida, não mesclado | Opcional — linha em *In validation or development* (A3) |
| 9 (novo) | `Product Capabilities` § Marketing só lista itens *future vision* | Materiais mínimos (SET-65) já existem, distintos da futura Library | Adicionar bullet distinguindo as duas (A4) |

---

## Veredito desta passada

**`READY_FOR_PRODUCT_EDIT`**

Todos os pontos levantados foram investigados e resolvidos com evidência de código/git — nenhuma divergência ficou sem explicação. A SET-84 está confirmada como Situação B (branch separada, bloqueada por regressão conhecida, corretamente ausente de `What Exists Today`) e não bloqueia a edição de `PRODUCT.md`; ao contrário, confirma que o texto atual sobre attribution já está certo. Os pontos A1/A2/A4 são adições de clareza, não acharam nenhuma nova contradição factual que exija mais investigação.

A Parte 2 pode ser executada cobrindo, no total: Achados 1 (com a extensão A2), 2, 3, 4, 5 (com a adição opcional A3) do corpo principal, mais A1 e A4 deste addendum. Achados 6 e 7 do corpo principal permanecem sem ação, por decisão do Product Owner.

---

## Próximo passo

Esta auditoria não altera `PRODUCT.md`. Conforme o padrão já estabelecido no projeto (`docs/plans/AUDIT_MVP_LAUNCH.md`, `docs/plans/AUDIT_PRE_LAUNCH_CONSISTENCY.md`) e conforme a própria SET-87 ("Só então alterar PRODUCT.md"), a Parte 2 — aplicar os Achados 1 a 5 (obrigatórios, com as extensões A1–A4 deste addendum) e decidir sobre 6 e 7 (opcionais) diretamente em `docs/PRODUCT.md`, com baseline `b1cd1da`/2026-08-27 — só deve ser executada após aprovação explícita do Product Owner ao conteúdo deste addendum.

**Aguardando aprovação.**
