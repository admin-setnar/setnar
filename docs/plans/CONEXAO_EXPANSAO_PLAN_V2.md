Status: Proposed
Authority: Non-normative
Code baseline: branch `develop`, commit `0e7d305144df047d457b445b08d38b4b60797962` (2026-09-01) — confirmed unchanged since the first investigation (verified via `git log -1` at the start of this round; `git status` shows no tracked file touched by that prior round either)
Last reviewed: 2026-09-04
Supersedes: [`CONEXAO_EXPANSAO_PLAN.md`](CONEXAO_EXPANSAO_PLAN.md) (first-pass investigation, verdict `NO_GO`) — that document is not deleted; its reasoning stays on record, and §2 below reassesses every finding it raised against the Product Owner's new decisions rather than silently dropping it.
Superseded by: —

---

# Conexão Expansão V2 — Final Information Architecture, Copy & Implementation Plan

**Still investigative. Nothing was implemented while producing this document.** No code, migration, test, ADR, normative doc, component, style, seed, or config file was created or modified. The only filesystem changes from this round are this document itself and its index entry in `docs/plans/README.md` — both non-normative planning artifacts, per that folder's own stated purpose.

This round operates under explicit Product Owner authority that changes the first investigation's conclusions: Conexão Expansão is confirmed in scope (§1), it will be the 8th public Commercial Page (§2), and the "closed catalog of seven" premise is to be re-examined rather than treated as fixed (§8/§9). What has **not** changed is ADR-089's core decision (independent presentation trees, no shared template) or ADR-060 (Representative is the domain term). This document treats those as still binding unless it finds concrete evidence otherwise — it did not.

---

## 1. Executive Summary

**Verdict: `GO WITH CONDITIONS`.**

The Product Owner's three decisions (in-scope, public 8th page, catalog-not-fixed) resolve five of the eight blockers the first investigation raised (§2 below). Two genuine open items remain, and they are the kind the first report already anticipated — not new problems:

1. **No compliance-approved disclaimer source exists for recruiting/compensation-plan copy**, and this round's search for one (in iGreen's actual public materials, not just the codebase) came back empty — see §3. Marked, per this task's own instruction, as **`COMPLIANCE DISCLAIMER SOURCE: UNRESOLVED`**. This is a publish-time gate, not an implementation blocker (§18's own framing already anticipates this split).
2. **Appendix A / `docs/igreen/conexao-expansao.txt`'s specific R$ figures and royalty tables cannot be independently verified against a live, public official iGreen source**, because the actual official source (`academy.igreenenergy.com.br`) is authenticated, licenciado-only — confirmed by directly visiting it (§3). This is not a blocker either, because the recommended copy in §6 does not publish those exact figures on the public page at all — see the reasoning in §3 and §5, which is itself grounded in what iGreen's own public site and independently-run Representative sites already do.

Everything else — the audience mismatch, the public-exposure question, the closed-catalog architecture, the Lead form's semantics, the analytics/materials integration — checks out as buildable with the existing infrastructure, largely unmodified. Full reasoning follows.

---

## 2. Reassessment of Previous Blockers

The first report's §3 actually listed **eight** items, not seven (a minor miscount in this round's brief, noted for the record, not corrected silently). All eight are reassessed below.

| # | Previous blocker | Current status | Evidence | Still blocks? |
|---|---|---|---|---|
| 1 | Audience/domain mismatch — Product/Commercial Page model a Representative selling to *their own customer*; Conexão Expansão's audience is a prospective Representative | **Resolved by PO decision.** §1 of this round instructs the model `Representative → Commercial Page → interessado → conversão/WhatsApp`, deliberately generalized past "consumidor." | This document's §4 (Domain Impact) traces exactly what that costs in `DOMAIN_MODEL.md`/`PRODUCT.md` wording — real but small. | No — open documentation debt, not a blocker. |
| 2 | Public vs. authenticated exposure of internal compensation data | **Resolved by PO decision** (8th page is public) **+ mitigated by this round's recommendation** not to publish exact R$ figures on the page at all (§3, §5, §6). | `src/app/[productSlug]/page.tsx` — still no auth check for any Commercial Page, confirmed unchanged this round. | No, conditionally — see condition 2 in §1/§18. |
| 3 | No compliance-approved disclaimer source | **Still open — genuinely unresolved**, and this round specifically searched for one and did not find it (§3). | `src/modules/representatives/domain/product-compliance-notice.ts:9-24` — grouped into 3 categories (Energia/Seguros/generic CDC), none of which is "recruiting a new Representative." No 4th category or recruiting-specific source found anywhere in the codebase or on iGreen's public web presence this round. | **Yes — the one real remaining item, gates publish not implementation.** |
| 4 | No CTA / no FAQ in the source | **Resolved by recommendation.** §5/§6 propose both, explicitly marked as proposals for PO approval, not fabricated "facts." | — | No. |
| 5 | Source's own inconsistency: "Royalties Equiparação Green" vs. "Royalties Equiparação Expansão" | **Still present, unresolved in the source itself** — confirmed again this round in the file the Product Owner just supplied (`docs/igreen/conexao-expansao.txt:116` says "Green", `:130` and `:195` say "Expansão" — same inconsistency, not a copy-paste artifact from the first round). Per this round's own instruction (§11), resolved for *copy purposes* by using the neutral phrase "Royalties de Equiparação" (§6), without silently picking a winner. | `docs/igreen/conexao-expansao.txt:116,130,195` | No — worked around, not fixed; flagged for whoever owns the source regulation. |
| 6 | Five out-of-pattern content blocks (Voucher, Treinamentos, Benefícios, Rankings, Materiais) | **Explicitly out of scope this round** (task §12) — not part of this implementation, not investigated for placement here beyond noting they exist. | `docs/igreen/conexao-expansao.txt:1-74` still contains all five, unchanged. | No — descoped by instruction, not resolved. |
| 7 | Catalog seeded/tested as closed at exactly seven (ADR-089, `20260803000000_seed_igreen_catalog.sql`, `tests/commercial-page-templates.test.ts`) | **PO explicitly authorizes reopening this premise** (§8/§9 of this task). Confirmed this round that the mechanism itself (dispatcher-per-slug) has no evidence of strain from eight vs. seven — see §8/§9 below. | `tests/commercial-page-templates.test.ts:38` (`.length,7`) — re-read this round, unchanged. | No — becomes a scoped, reviewable edit (§9, §10), not a structural blocker. |
| 8 | "Licenciado" is not a domain term (ADR-060) | **Not a blocker, unchanged rule** — re-confirmed this round (`docs/adr/ADR-060-*.md`, unchanged file). Applies identically to any new code. | — | No — a rule to follow, not a gap. |

---

## 3. Official Source Reconciliation

**Method.** Web research this round (2026-09-04), using `WebSearch` and the Browser pane (`WebFetch` was blocked with HTTP 403 on every `igreenenergy.com.br` sub-page tried, consistent with basic bot-blocking; the Browser pane, which renders a real session, got through to the *public* pages but was itself redirected away from every gated one — see below).

**What was checked:**

| Source tried | Result | Consultation date |
|---|---|---|
| `https://igreenenergy.com.br` (official root domain) | **Loads publicly.** Lists 6 customer-facing products (Livre, Green, Placas, Solar, Telecom, **"Conexão Seguros"** — note, not "iGreen Seguros"/`green-seguros`, a naming drift from the SETNAR catalog worth a separate look, out of scope here) plus a *separate*, non-numeric "Seja um licenciado" recruiting section (verbatim: "Empreenda com a iGreen, você pode se tornar um licenciado autorizado e ser remunerado pelas conexões realizadas... Seja remunerado mensalmente pelas conexões realizadas... Fale com um Licenciado Autorizado da sua região."). **No "Conexão Expansão" branded product tile. No R$ figures, no percentages, no qualification tiers published anywhere on this page.** | 2026-09-04 |
| `https://www.igreenenergy.com.br/manual-expansao-igreen` | **Not publicly accessible** — redirects silently to the homepage when visited unauthenticated (confirmed via the Browser pane's `navigate`, which reported landing on `igreenenergy.com.br` instead); returned HTTP 403 to `WebFetch`. | 2026-09-04 |
| `https://www.igreenenergy.com.br/manual-expansao-telecom` | Same — redirects/403, not accessible unauthenticated. | 2026-09-04 |
| `https://www.igreenenergy.com.br/qualificacao-igreen` | Same — redirects/403, not accessible unauthenticated. | 2026-09-04 |
| `https://academy.igreenenergy.com.br` (the platform these manual pages almost certainly live inside) | **Confirmed login-gated.** Page text, verbatim: *"iGreen Academy — Manuais, treinamentos e recursos para licenciados... Use o mesmo e-mail e senha do seu aplicativo iGreen Connect... Acesso exclusivo para licenciados iGreen Energy."* No credentials available to or used by this investigation. | 2026-09-04 |
| `https://academy.igreenenergy.com.br/categoria/manual-de-negocio/regras-de-viagens` (the exact URL `docs/igreen/conexao-expansao.txt:310` cites for travel-bonus rules) | Redirects to the same gated Academy login. Confirms the source document's own citation points at gated content, not a public page. | 2026-09-04 |
| `https://igreenenergyprime.com.br/franqueado/` (found via search, "Conexão Expansão – Igreen Energy Prime") | **Loads publicly — but this is an independent Representative's own site, not an official iGreen page.** Footer reads *"Site do Licenciado ID: 102972."* Its "O que é a Conexão Expansão?" section actually pastes in Conexão **Green**'s pitch (an apparent copy/paste error on that Representative's own site) — direct real-world evidence of the exact "unmanaged representation" risk `PRODUCT.md:70` names as the reason a controlled platform like SETNAR exists. Its actual "Como funciona" content is entirely qualitative: "bônus financeiro imediato," "royalties sobre o desempenho," **zero R$ figures, zero percentages published**, and it explicitly brands itself a "franquia digital"/uses "franqueado" throughout — a legal characterization ("franchise," regulated in Brazil by Lei 13.966/2019) that is not used anywhere in `docs/igreen/conexao-expansao.txt` or on iGreen's own official homepage, and should **not** be echoed in SETNAR's copy. | 2026-09-04 |
| `https://lp.igreendobrasil.com.br/conexao-expansao.html` (found via search) | **Domain does not resolve** (`ERR_NAME_NOT_RESOLVED`) — dead. | 2026-09-04 |
| `WebSearch`'s own AI-generated summary (not a page fetch) | Claimed "R$300 bonus per licensed distributor... up to 5% in royalties... lifetime and hereditary" and, in a separate query, "commissions... up to 4%... monthly earnings between R$2,000 and R$60,000." **Could not be traced to any single page this investigation could open and read directly** — it reads as the search tool's own synthesis across several unofficial, unverified pages (marketing sites with names like `suaenergiasolar.com`, `igreenenergyhub.com`, none of them `igreenenergy.com.br`). **Not used as a source for anything in §5/§6 below** — flagged here only so the Product Owner knows this claim exists on the open web and is unverified, not to be treated as fact. | 2026-09-04 |

**Reconciliation table** — the claims this investigation could actually check against something outside `docs/igreen/conexao-expansao.txt`:

| Informação | `docs/igreen/conexao-expansao.txt` (Appendix A) | Fonte oficial atual (pública) | Status | Observação |
|---|---|---|---|---|
| Existência do programa "Conexão Expansão" / "ser remunerado por conectar novos licenciados" | Todo o documento | Confirmado qualitativamente em `igreenenergy.com.br` ("Seja um licenciado... seja remunerado mensalmente pelas conexões realizadas") | **Confirmado (qualitativo)** | A existência do programa é real e pública; os valores não são. |
| Bônus de R$150 (CD)/R$50 (CI) — Connect Plus | `docs/igreen/conexao-expansao.txt:81,85` | Não encontrado em nenhuma página pública oficial | **NÃO VERIFICÁVEL** — fonte oficial completa está atrás de login (`academy.igreenenergy.com.br`) | Não contradito, apenas não confirmável publicamente hoje. |
| Bônus de R$300 (CD)/R$100 (CI) — Connect Full | `docs/igreen/conexao-expansao.txt:156,161` | Não encontrado em página pública oficial. Um resultado de busca (não uma página aberta e lida) menciona "R$300 bonus," mas não pôde ser atribuído a uma URL oficial verificável — ver linha do `WebSearch` acima | **NÃO VERIFICÁVEL** | Mesma ressalva. |
| Tabela de Royalties Expansão por qualificação (R$25 a R$150 / R$50 a R$300) | `docs/igreen/conexao-expansao.txt:93-109,167-183` | Não encontrado publicamente | **NÃO VERIFICÁVEL** | — |
| "Royalties Equiparação Green" vs. "Royalties Equiparação/de Equiparação Expansão" | Inconsistente na própria fonte (`:116` vs. `:130,195`) | Não verificável (mesma fonte gated) | **Divergência interna preservada, não resolvida** | Ver §2, item 5, e §11. |
| Escada de qualificação (Sênior → Gestor → Executivo → Diretor → Acionista) e pontos/conexões exigidos | `docs/igreen/conexao-expansao.txt:239-278` | Não encontrado publicamente; o link oficial citado pela própria fonte (`academy.igreenenergy.com.br/.../regras-de-viagens`) está atrás do mesmo login | **NÃO VERIFICÁVEL** | A existência de uma "escada de qualificação" por nome (Sênior/Gestor/Executivo/Diretor/Acionista) é plausível e consistente com a linguagem pública ("progressão... de Licenciado a Acionista" aparece em resultados de busca de terceiros), mas os números exatos não são confirmáveis. |
| PRO / PRO 360 e suas combinações | `docs/igreen/conexao-expansao.txt:365-411` | Não encontrado publicamente | **NÃO VERIFICÁVEL** | — |
| "iGreen Seguros" (nome do produto na tabela SETNAR/`green-seguros`) | — | Homepage oficial usa **"Conexão Seguros"** | **Divergência de nomenclatura encontrada, não relacionada a Expansão** | Fora de escopo desta tarefa; registrado porque foi encontrado no mesmo levantamento — não é uma alegação financeira, é um nome de produto. Não decidir aqui. |

**Conclusion, stated plainly:** this investigation could not find, and could not reach, any independently browsable official page that either confirms or contradicts a single R$ figure in `docs/igreen/conexao-expansao.txt`. The file the Product Owner supplied appears to be a transcription of the same gated Academy content the source document itself cites — which makes it the most authoritative material available to this investigation, but not one this investigation can independently verify as current. That gap, not a contradiction, is the actual finding. **This is exactly the situation §5/§6 below are designed around**: build the page's commercial narrative from what's independently confirmable (the program exists, it has two license tiers, it pays for connections and rewards network growth) and keep the unverifiable specifics off the public page, pointing instead to the Representative/official regulation for exact numbers.

---

## 4. Domain Impact

**What the Product Owner's model change actually requires, precisely.**

Re-reading `docs/DOMAIN_MODEL.md` this round (unchanged since the first pass — confirmed by re-opening the file):

- **Commercial Page** (`DOMAIN_MODEL.md:93-95`): *"The public-facing, personalized digital page that presents a Representative and exactly one Product they have activated, ending in a call to action (WhatsApp contact)."* — **Nothing in this sentence's actual mechanics requires the visitor to be an end consumer.** "Ending in a call to action (WhatsApp contact)" is audience-neutral; a Commercial Page for a recruiting-type Product still ends in exactly that. The "sells to a consumer" framing was this investigation's own *inference* from reading seven examples that all happened to be consumer sales, not a constraint the definition's wording actually encodes. So the mechanical fit is closer than the first report characterized it — the gap is narrower than "this concept doesn't cover it," and closer to "this concept's illustrative example set doesn't yet include a case like this."
- **Product** (`DOMAIN_MODEL.md:81-85`): *"The sellable unit. Everything a Commercial Page ultimately promotes is a Product... 'Conexão Solar' (subscription solar energy) and 'iGreen Auto Mensal' (monthly car insurance) are two distinct Products."* "Sellable unit" is doing more work here. Conexão Expansão isn't sold to the visitor in the way a subscription or an insurance policy is — the visitor doesn't pay iGreen for it. What's "sold," if anything, is the opportunity itself, and what the visitor "buys into" is becoming a Representative under the current Representative's downline. **This is the one place where the domain model's wording genuinely doesn't stretch cleanly**, and where a documentation change — not a schema change — is warranted: either loosen "sellable unit" to something like "the thing a Commercial Page promotes, whether purchased by the visitor or is itself the recruiting opportunity a Representative offers," or add one sentence acknowledging this second shape explicitly, the way the Product examples list already gives two examples to establish the concept's range.
- **Lead** (`DOMAIN_MODEL.md:133`, `:403-406`): *"Belongs to exactly one Representative; references the Commercial Page and/or Campaign it originated from."* Nothing here assumes the Lead is a customer prospect specifically — it is generic contact-capture data. No change needed; confirmed again in §7 below at the code level (schema, API, UI all product-agnostic already).
- **Core Domain** (`DOMAIN_MODEL.md:295`): *"The Core Domain is Commercial Presence & Representative Enablement — specifically, the combination of (a) turning a Representative's identity and authorized Products into a credible, personalized Commercial Page, and (b) measuring and converting the traffic that page generates."* This framing already survives the change untouched — "turning identity + Product into a page that converts traffic" describes Conexão Expansão exactly as well as it describes Conexão Solar. No edit needed here.
- **`PRODUCT.md`**: no passage found this round that explicitly restricts a Commercial Page's audience to "the Representative's customer" — the closest is `PRODUCT.md:216`'s glossary entry "**The Representative's customer** (or *end consumer*) — the person who buys the Product the Representative represents," which is a glossary definition of a *different* term ("the Representative's customer"), not a constraint on who a Commercial Page may address. No contradiction found; the term itself just doesn't currently have a "prospective Representative" counterpart entry.

**Minimal documentation changes this would need, if/when the Product Owner formally approves the page** (none executed here):
1. `DOMAIN_MODEL.md`'s **Product** definition (§8.4, line ~81-85) — add a second illustrative example alongside the existing two, showing a Product whose "sellable unit" is the business opportunity itself, not a good/service purchased by the visitor.
2. `DOMAIN_MODEL.md`'s glossary (near line 216) — add "**prospective Representative**" as a second kind of Commercial Page audience, parallel to "the Representative's customer," so both are named rather than one being implicit.
3. A new ADR recording this as a deliberate decision (see §11) — this is the actual authorizing artifact; the two wording edits above just keep `DOMAIN_MODEL.md` in sync with it, per that document's own rule that it must reflect, not originate, decisions.

**What does *not* need to change:** Product Activation, Catalog, Analytics, Lead's own definition, Subscription — all already audience-neutral in their current wording, confirmed by re-reading each this round.

---

## 5. Final Information Architecture

Twelve sections, each scored against the instruction not to "dump" regulatory detail on a first-time mobile visitor. Structure is original to this investigation, not copied wholesale from any one sibling page — closest relatives are Conexão Club (simplest existing page: hero → trust → lead → steps → one illustrative content block → FAQ → CTA → footer) and Conexão Livre (uses `CheckedListSection` for a "who is this for" eligibility block, which maps well to "quem pode se tornar licenciado").

### 5.1 Header
- **Objetivo:** identificação do Representative, igual às outras 7 páginas.
- **Componente compartilhado:** `CommercialPageHeader` — reutilizado sem alteração.
- **Componente específico:** nenhum.
- **Mobile:** já responsivo nas 7 páginas existentes; sem mudança de comportamento esperada.
- **Fonte:** `commercial-page-header.tsx`, padrão existente.

### 5.2 Hero
- **Objetivo:** comunicar em segundos que existe uma oportunidade de negócio, não um produto de consumo, e convidar a saber mais.
- **Mensagem principal:** você pode construir sua própria rede dentro da iGreen e ser remunerado por isso.
- **CTA:** ver §6 para a análise comparativa das três opções pedidas — recomendação: **primário** "Quero conhecer a Conexão Expansão", **secundário** (link de rolagem, não WhatsApp) "Ver como funciona".
- **Componente compartilhado:** `HeroSection` (já tem slot para eyebrow/headline/subhead/CTA/widget) — reutilizável.
- **Componente específico:** o slot de `widget` (o que `SolarHeroWidget`/`GreenCalculator` ocupam nas páginas de energia) fica **vazio ou com um elemento simples e não-numérico** — nenhum widget calculador de ganhos é recomendado (calcularia uma expectativa de renda, o que §17 proíbe). Se um widget for desejado, sugerir algo qualitativo (ex.: um seletor "Sou/Não sou licenciado ainda" que personaliza a mensagem do CTA final) — não obrigatório para o MVP.
- **Mobile:** hero de uma coluna, mesma convenção das 7 páginas (title + subhead + CTA empilhados, widget abaixo).
- **Fonte:** copy comercial original (§6), não factual — não requer fonte externa.

### 5.3 O que é a Conexão Expansão
- **Objetivo:** primeira explicação real, curta, sem jargão de plano de carreira.
- **Mensagem principal:** é a forma de ganhar dinheiro conectando novas pessoas à rede iGreen como licenciados, além de vender os produtos.
- **Componente compartilhado:** `CardsSection` (título + intro + conteúdo livre) — reutilizável, sem alteração de componente.
- **Componente específico:** nenhum — texto puro.
- **Mobile:** 2-3 frases curtas, sem tabela.
- **Fonte das alegações:** existência do programa confirmada em `igreenenergy.com.br` (§3); descrição de mecanismo geral (conexão direta/indireta gera bônus) suportada por `docs/igreen/conexao-expansao.txt:79-91,153-161` (valores omitidos aqui, ver §3/§6).

### 5.4 Como funciona (progressivo)
- **Objetivo:** dar o mecanismo em 3-4 passos visuais, não uma tabela normativa.
- **Mensagem principal:** você indica → a pessoa se torna licenciada → você recebe um bônus → conforme sua equipe cresce, você ganha royalties recorrentes.
- **Componente compartilhado:** `StepsSection` — reutilizável sem alteração (mesmo padrão usado por todas as 7 páginas para "como funciona").
- **Componente específico:** nenhum.
- **Mobile:** já é o padrão de cartões empilhados de `StepsSection`; nenhuma tabela aqui.
- **Fonte:** estrutura geral (CD/CI/Royalties existem) suportada por `docs/igreen/conexao-expansao.txt:79-91`; valores exatos deliberadamente omitidos (§3).

### 5.5 Connect Plus × Connect Full
- **Objetivo:** deixar claro que existem dois planos de licença e que a diferença afeta o tamanho dos ganhos — sem reproduzir a tabela completa.
- **Mensagem principal:** Full paga mais por conexão e por royalty do que Plus; é possível fazer upgrade depois.
- **Conteúdo:** um comparativo simples, 2 colunas, 3-4 linhas no máximo (ex.: "Bônus por conexão direta: menor no Plus, maior no Full" — qualitativo, não numérico, pela mesma razão do §3/§6) — **ou**, se o Product Owner autorizar publicar valores (condição em §1/§18), a tabela reduzida (só CD/CI, sem royalties/qualificação) cabe aqui.
- **Componente compartilhado:** nenhum existe hoje para "comparativo de dois planos" — as 7 páginas não têm este padrão (Placas tem uma grade de formas de pagamento, mas é uma lista, não um comparativo A/B).
- **Componente específico necessário:** um novo componente pequeno, ex. `PlanComparisonCard` (2 colunas, mobile empilha em 2 cards sequenciais, não uma tabela HTML larga — ver §15).
- **Mobile:** cards empilhados verticalmente (Plus em cima, Full embaixo), nunca uma tabela com scroll horizontal.
- **Fonte:** existência dos dois planos confirmada em `docs/igreen/conexao-expansao.txt:76-77,145-151` (nomes "Connect PLUS"/"Connect Full" usados na própria fonte); valores numéricos sujeitos à mesma ressalva do §3.

### 5.6 Formas de ganho
- **Objetivo:** explicar a estrutura de remuneração em alto nível, sem tabela de 9 níveis de qualificação.
- **Mensagem principal:** três formas — bônus por conexão direta, bônus por conexão indireta (equipe), e royalties recorrentes conforme sua qualificação evolui.
- **Conteúdo:** 3 cards curtos, um por forma de ganho, cada um com 1-2 frases — sem valores em R$ (§3), sem "até R$X" que soe como teto prometido.
- **CTA local:** nenhum novo — a página inteira converge para o CTA final (§5.11).
- **Componente compartilhado:** `CardsSection` — reutilizável.
- **Componente específico:** nenhum.
- **Mobile:** 3 cards empilhados.
- **Fonte:** `docs/igreen/conexao-expansao.txt:79-91,116-140,153-183,195-218` (estrutura, não valores — ver §3).

### 5.7 Evolução
- **Objetivo:** mostrar que existe progressão de carreira, sem lançar a régua completa (pré-qualificações, PML, pontos).
- **Mensagem principal:** conforme sua rede cresce, você sobe de nível e destrava percentuais maiores de royalties.
- **Conteúdo recomendado:** uma trilha visual simples com os 5 nomes principais — **Sênior → Gestor → Executivo → Diretor → Acionista** — sem os "Pré-" intermediários, sem PML, sem os dois caminhos alternativos (conexões vs. Geração Própria). Uma frase de rodapé: "Veja os requisitos completos de cada nível nas regras oficiais."
- **Avaliação explícita pedida pelo Product Owner:** pré-qualificações (Pré-Sênior, Pré-Gestor etc.) **não devem aparecer na página comercial** — são detalhe de regulamento, não de descoberta da oportunidade; um visitante de primeira visita não tem contexto para diferenciar "Gestor" de "Pré-Gestor," e a tentativa de explicar a diferença é exatamente o tipo de conteúdo que transforma a página em manual (§4 da tarefa).
- **Componente compartilhado:** nenhum existente cobre uma trilha de progressão em degraus.
- **Componente específico necessário:** um novo componente pequeno, ex. `CareerLadderStrip` (5 pills/degraus horizontais no desktop, lista vertical compacta no mobile).
- **Mobile:** lista vertical de 5 itens com um ícone de seta entre eles — nunca uma tabela de 9 linhas.
- **Fonte:** nomes dos 5 níveis confirmados em `docs/igreen/conexao-expansao.txt:239-278`; requisitos numéricos sujeitos à ressalva do §3.

### 5.8 Status PRO
- **Objetivo:** uma explicação de alto nível, apenas o suficiente para não confundir quem já viu o termo "PRO" em outro lugar (ex. no app do cliente).
- **Mensagem principal:** manter-se ativo/PRO garante que você recebe o valor cheio dos seus bônus.
- **Conteúdo:** 1-2 frases, sem a matriz de combinações (Energia+Seguro+Telecom, 4 Green+1 Seguro, etc.) — essa matriz é claramente "detalhe que prejudica a compreensão" per a instrução do Product Owner.
- **Componente compartilhado:** `CardsSection` ou embutido na seção 5.6 como uma nota — não precisa de seção própria dedicada; **recomendação: dobrar esta seção dentro de 5.6 (Formas de ganho) como uma nota final**, em vez de uma seção separada, para não adicionar mais um "capítulo" à página.
- **Mobile:** um parágrafo curto.
- **Fonte:** `docs/igreen/conexao-expansao.txt:365-401`, valores/combinações sujeitos à ressalva do §3.

### 5.9 Segurança/transparência
- **Objetivo:** deixar explícito que os resultados dependem do esforço/rede do visitante, sem prometer renda — cumprindo diretamente `PRODUCT_CONSTITUTION.md`, Core Belief 13 (*"A sale depends on the professional's own effort, their market, their offer... What SETNAR is accountable for is the conditions"*), que já é um princípio normativo existente, não uma invenção desta investigação.
- **Mensagem principal:** "Os valores e regras seguem as condições vigentes da iGreen e podem ser atualizados — consulte sempre as regras oficiais ou fale com [Representative]. Os resultados dependem do seu esforço e da sua rede; não há garantia de renda ou resultado."
- **Componente compartilhado:** pode reaproveitar o padrão visual de `CheckedListSection`/nota (`icons={['i','i','i']}`) já usado por Green/Livre/Solar para avisos "antes de contratar" — mesma linguagem visual, conteúdo novo.
- **Componente específico:** nenhum novo necessário — reaproveita o padrão de nota existente.
- **Mobile:** já é o padrão responsivo das seções de aviso existentes.
- **Fonte das alegações:** esta seção é **copy comercial de transparência**, não o disclaimer jurídico formal — ver a distinção A/B/C exigida no §16 da tarefa, tratada abaixo em §12. `COMPLIANCE DISCLAIMER SOURCE: UNRESOLVED` continua valendo para o parágrafo jurídico equivalente ao de `product-compliance-notice.ts`; esta seção de "segurança/transparência" é comercialmente segura por si mesma porque não faz nenhuma alegação numérica.

### 5.10 FAQ
- **Objetivo:** responder as dúvidas mais prováveis de quem chega pela primeira vez, sem virar um segundo regulamento.
- **Perguntas propostas** (ver §6 para redação completa; respostas marcadas onde dependem de fonte):
  1. O que é a Conexão Expansão?
  2. Preciso já ser licenciado iGreen para participar?
  3. Como funciona a entrada — preciso comprar algo?
  4. Como e quando eu recebo os bônus?
  5. Preciso montar uma equipe, ou posso só indicar pessoas?
  6. Existe treinamento para quem está começando?
  7. Qual a diferença entre Connect Plus e Connect Full?
- **Componente compartilhado:** `FaqSection` — reutilizável sem alteração.
- **Componente específico:** nenhum.
- **Mobile:** já é acordeão/lista no padrão existente (confirmar comportamento exato de `FaqSection` antes de implementar — não lido byte-a-byte nesta rodada, apenas seu uso já confirmado nas 7 páginas).
- **Fonte:** perguntas são propostas da investigação (permitido pela tarefa); respostas restritas ao que §3 confirma — nenhuma resposta cita R$ específico.

### 5.11 CTA final
- **Objetivo:** converter o interesse educado em conversa com o Representative.
- **Componente compartilhado:** `CtaFinalSection` + `FloatingWhatsapp` — reutilizados sem alteração; ambos já genéricos por `product.slug`/mensagem (confirmado em `floating-whatsapp.tsx`, `whatsapp.ts`).
- **Componente específico:** nenhum.
- **Mobile:** `FloatingWhatsapp` já é sticky/floating no padrão existente ("`.float-whats`... fixed bottom-right, hidden above 760px" — comentário do próprio componente, reconfirmado nesta rodada).
- **Fonte:** N/A — copy comercial.

### 5.12 Footer/compliance
- **Objetivo:** identificação do Representative + disclaimer + nota de dados coletados + nota de "não é canal oficial" — mesma estrutura de 3 parágrafos das outras 7 páginas.
- **Componente compartilhado:** `CommercialPageFooter` — reutilizável estruturalmente; **o conteúdo do parâmetro `disclaimer` é o item pendente** (§1, §12) porque não existe fonte de compliance aprovada equivalente às usadas pelas 7 páginas hoje.
- **Componente específico:** nenhum.
- **Mobile:** já responsivo.
- **Fonte:** `NOT_OFFICIAL_CHANNEL_NOTICE` (reaproveitável sem alteração — é genérico, não específico de produto); `dataCollectedNote` reaproveitável se o formulário de lead permanecer com os 4 campos padrão (§7); `disclaimer` — `COMPLIANCE DISCLAIMER SOURCE: UNRESOLVED`.

---

## 6. Final Copy Proposal

Marked inline: **[PROPOSTA — aguarda aprovação]** for anything not independently confirmed in §3; plain text for what is.

### Header
Padrão existente — nome do Representative + "Licenciado Autorizado iGreen Energy (ID: {authorizationId})".

### Hero
> **Construa sua própria rede. Expanda seus ganhos com a iGreen.**
>
> Conecte novas pessoas à iGreen como licenciados e seja remunerado por cada conexão — com bônus imediatos e ganhos recorrentes conforme sua rede cresce.
>
> **[Quero conhecer a Conexão Expansão]** · Ver como funciona

*(ver §6.1 abaixo para a análise das três opções de CTA pedidas pelo Product Owner)*

### O que é a Conexão Expansão
> A Conexão Expansão é a forma de você crescer dentro da iGreen conectando novas pessoas à rede como licenciados — além de vender os produtos iGreen, você constrói sua própria equipe e é remunerado por isso.
>
> Funciona em duas modalidades de licença, Connect Plus e Connect Full, com bônus por cada nova conexão e ganhos adicionais conforme você e sua equipe evoluem.

### Como funciona
> 1. **Você indica alguém para se tornar licenciado.** Pode ser diretamente por você, ou por alguém da sua equipe.
> 2. **A conexão é confirmada.** A nova pessoa ativa sua licença Connect Plus ou Connect Full.
> 3. **Você recebe um bônus imediato.** Pago na hora, por cada conexão direta.
> 4. **Sua equipe cresce, seus ganhos também.** Conforme sua rede se expande e você evolui de qualificação, você passa a receber royalties recorrentes sobre as conexões da sua equipe.

### Connect Plus × Connect Full
> As duas modalidades de licença têm o mesmo mecanismo — bônus por conexão direta e indireta, mais royalties conforme sua evolução —, mas a Connect Full paga valores mais altos em cada uma dessas frentes. **[PROPOSTA — valores exatos e regra de upgrade Plus→Full aguardam confirmação/fonte pública antes de publicação, ver §3]**
>
> É possível migrar de Plus para Full depois, com bônus proporcional à diferença entre as duas modalidades.

### Formas de ganho
> **Conexão direta.** Você indica, a pessoa se conecta, você recebe um bônus imediato.
>
> **Conexão indireta.** Quando alguém da sua equipe conecta um novo licenciado, você também é bonificado — mantendo sua atividade em dia.
>
> **Royalties de evolução.** Conforme você avança de qualificação, passa a receber um percentual adicional sobre toda a Conexão Expansão realizada pela sua equipe — inclusive conexões diretas e indiretas.
>
> Manter-se ativo (status PRO) garante que você recebe o valor cheio dos seus bônus em todas as frentes em que atua.

*(Sem valores em R$ nesta seção — ver §3 e a recomendação de não publicar os valores exatos publicamente até confirmação de fonte.)*

### Evolução
> Sênior → Gestor → Executivo → Diretor → Acionista.
>
> Conforme sua rede cresce e você avança nessa trajetória, o percentual de royalties que você recebe também aumenta. Veja os requisitos completos de cada nível nas regras oficiais da Conexão Expansão.

### Segurança e transparência
> Os valores e as regras da Conexão Expansão seguem as condições vigentes definidas pela iGreen e podem ser atualizados — consulte sempre as regras oficiais ou fale com [Representative] para os detalhes completos.
>
> Os resultados dependem do seu esforço, da sua rede e do seu mercado. Não há garantia de renda ou resultado.

### FAQ **[PROPOSTA — perguntas propostas, respostas restritas ao confirmável]**
- **O que é a Conexão Expansão?** É a forma de crescer dentro da iGreen conectando novas pessoas como licenciados, com bônus e ganhos recorrentes conforme sua rede se expande.
- **Preciso já ser licenciado iGreen para participar?** Sim — a Conexão Expansão é uma forma de ganho para quem já é licenciado autorizado iGreen. **[Se o programa também servir de "porta de entrada" para quem ainda não é licenciado, essa resposta muda — não confirmado nesta investigação, perguntar ao Representative/PO.]**
- **Preciso comprar algo para participar?** **[PROPOSTA — depende da regra de ativação de licença, não confirmada publicamente nesta investigação; não responder sem fonte.]**
- **Como e quando eu recebo os bônus?** Bônus de conexão direta são pagos imediatamente após a confirmação da conexão; royalties são recorrentes, conforme sua qualificação e a atividade da sua equipe.
- **Preciso montar uma equipe, ou posso só indicar pessoas?** As duas formas geram ganho — conexões diretas (feitas por você) e indiretas (feitas pela sua equipe) são bonificadas separadamente.
- **Existe treinamento para quem está começando?** Sim, a iGreen oferece treinamentos e materiais de apoio para licenciados. **[Fonte: `docs/igreen/conexao-expansao.txt:28-44`, bloco explicitamente fora de escopo desta implementação (§12 da tarefa) — a resposta aqui só confirma que existe, sem linkar/incorporar o conteúdo.]**
- **Qual a diferença entre Connect Plus e Connect Full?** A Full paga valores mais altos por conexão e por royalty; veja a comparação acima.

### CTA final
> **Fale com [Representative] e entenda como a Conexão Expansão pode funcionar para você.**
>
> Sem compromisso — é só chamar no WhatsApp.

### Footer
Estrutura padrão (`CommercialPageFooter`) — `disclaimer`: **`COMPLIANCE DISCLAIMER SOURCE: UNRESOLVED`** (não escrito nesta investigação — ver §12). Identificação do Representative e `NOT_OFFICIAL_CHANNEL_NOTICE` reaproveitados sem alteração.

### 6.1 CTA analysis (requested comparison)

| Opção | Intenção do visitante | Linguagem iGreen | Expectativa pós-clique | Avaliação |
|---|---|---|---|---|
| "Quero conhecer a Conexão Expansão" | Neutra, exploratória | Usa o nome oficial do produto, igual às outras 7 páginas ("Quero minha proposta," "Quero ativar meu Club") | Abre conversa geral — compatível com o formulário/CTA existente | **Recomendada como CTA primário** — é a que menos presume intenção do visitante (não presume que ele já quer "virar licenciado," nem que só quer "entender"), e seins mesmo o padrão de nomenclatura das 7 páginas irmãs. |
| "Quero saber como me tornar um licenciado" | Alta intenção, já decidido | Usa "licenciado" corretamente (termo tenant-facing, ADR-060) | Comunica intenção de conversão mais forte do que a média dos visitantes provavelmente tem no primeiro clique | Boa como **CTA secundário** ou como rótulo do botão do formulário de lead (§7), não como CTA principal do hero — reserva para quem já decidiu. |
| "Quero entender como funciona" | Baixa intenção, só pesquisando | Neutra | Abre expectativa de conteúdo explicativo, não de contato comercial — risco de gerar cliques que não viram lead | Boa como **CTA secundário de rolagem** (leva à seção "Como funciona," não ao WhatsApp) — é exatamente para isso que a Hero já reserva um segundo link. |

**Recomendação final:** primário = "Quero conhecer a Conexão Expansão" (WhatsApp/lead), secundário = "Ver como funciona" (scroll interno, sem fricção de contato).

---

## 7. Conversion Flow

```
link direto / QR Code / material de divulgação (?src=qrcode|whatsapp|instagram_post|instagram_story|direct)
        │
        ▼
Commercial Page pública  src/app/[productSlug]/page.tsx  (productSlug = 'conexao-expansao')
        │  resolveCommercialPresence(host, 'conexao-expansao') → Representative + Product
        │  record_page_visit (after(), best-effort, exclui o próprio dono — inalterado)
        ▼
CTA primário / CTA final / FloatingWhatsapp  →  trackWhatsappClick('conexao-expansao', origin)  →  wa.me/{representative.phone}
        ou
CommercialLeadForm  →  POST /api/leads {productSlug:'conexao-expansao', nome, telefone, cidade?, email?, origin}
        │  resolveRepresentativeActivation (Host header, não confia no body) → leadGateway.submitLead(...)
        ▼
`leads` (Supabase) com product_id = id de 'conexao-expansao'
        ▼
/app/contatos  →  Lead aparece na caixa do Representative, `contact.productName` = "Conexão Expansão" (renderização já genérica, `lead-inbox.tsx:44`)
```

**Reinvestigação do Lead form (item 7 da tarefa).** Reabri `leadSubmissionSchema` (`src/modules/leads/presentation/schemas/lead.schema.ts`), `POST /api/leads` (`src/app/api/leads/route.ts`), `CommercialLeadForm` e `lead-inbox.tsx` nesta rodada. Conclusão: **o contrato é inteiramente genérico.** O schema só exige nome + telefone (BR); `cidade`/`email` são opcionais; nada no schema, na RPC (`submit_lead`, não lida byte-a-byte nesta rodada mas já confirmada product-agnostic nas rodadas anteriores) ou na UI do inbox assume "intenção de comprar energia." O único lugar onde a semântica de "compra" aparece é na **copy** de cada página (`title`, `description`, `submitLabel`, `successDescription` — todos parâmetros livres do componente), que já varia por produto hoje (o de Club já não fala de "comprar" nada, fala de "ativar"). `conexao-expansao` pode reutilizar `CommercialLeadForm` **sem nenhuma mudança de schema, API ou UI** — só copy nova (ex. `submitLabel="Quero saber como me tornar um licenciado"`, `successDescription="Nossa equipe entra em contato para te explicar como a Conexão Expansão funciona."`).

**Pequena inconsistência conceitual encontrada, não bloqueante:** `dataCollectedNote`'s padrão texto ("usados apenas para contato sobre a compra/simulação/ativação...") precisa de uma frase adaptada para "contato sobre a oportunidade" — trivial, já é um parâmetro livre por página, não requer mudança de componente.

- **Solução mínima (MVP):** reaproveitar `CommercialLeadForm` como está, só com copy nova (feito acima em §6).
- **Evolução futura (não fazer agora):** se o volume justificar, um campo de "já sou licenciado / quero me tornar um" poderia melhorar a qualificação do lead — isso *seria* uma mudança de schema/RPC e está fora do escopo mínimo; não recomendado sem evidência de necessidade real (evita overengineering, conforme instrução §7 da tarefa).

**QR Code, materiais, analytics — nenhuma mudança de infraestrutura necessária:**
- QR Code: derivado da própria URL pública no momento da renderização (`DOMAIN_MODEL.md §8.7`) — funciona para qualquer `productSlug` novo automaticamente.
- `origin`/`?src=`: `ORIGIN_IDS` (`src/modules/analytics/domain/origin.ts:13`) é uma lista fixa de 5 valores **desacoplada de produto** — nenhuma mudança necessária.
- `trackWhatsappClick`/`record_page_visit`: ambos recebem `product.slug`/`productSlug` como string livre — nenhuma mudança necessária (reconfirmado em `floating-whatsapp.tsx:35` e `[productSlug]/page.tsx:127-134` nesta rodada).
- Materiais de divulgação (Post/Story/Poster): `PRODUCT_SLUGS_WITH_MATERIALS` (`src/modules/marketing-materials/material-catalog.ts:31-39`) simplesmente **não incluiria** `conexao-expansao` — `hasMaterialsForProduct`/`formatsForProduct` já degradam graciosamente para "sem materiais" em vez de quebrar (confirmado lendo `material-catalog.ts:41-47` nesta rodada). Nenhuma mudança necessária para o MVP; adicionar os 3 formatos no futuro seria puramente aditivo (nova entrada no array + 3 novos componentes React, mesmo padrão dos outros 7×3).
- Não foi encontrado, nesta rodada, nenhum enum de "Pipeline Status" de Lead com rótulos específicos de venda de energia (`lead-inbox-contact.ts` não define nenhum) — não é necessário nenhum ajuste de rótulo de pipeline para este produto.

---

## 8. Architecture Decision

**Confirmando, com evidência desta rodada, a hipótese do Product Owner (§9 da tarefa): manter `dispatcher → presentation tree específica` continua adequado; nenhuma evidência concreta de que a arquitetura atual criou um problema real foi encontrada.**

O que foi verificado:
- `dispatch-commercial-page.tsx` (reaberto nesta rodada, inalterado desde a rodada anterior) é um `switch` puro de 7 linhas — adicionar uma 8ª `case` é uma linha, não uma mudança estrutural.
- Todos os pontos de integração reutilizáveis (Lead, Analytics, origin, QR, materiais) já são genéricos por `productSlug`/string — nenhum deles precisa de uma abstração nova para suportar um 8º valor (§7).
- Os únicos lugares que *hardcodam* a lista de 7 são, deliberadamente, os que **devem** permanecer explícitos por design (ADR-089): o dispatcher, o teste de fidelidade (`tests/commercial-page-templates.test.ts`), o seed de catálogo, o registro de compliance (`product-compliance-notice.ts`) e o registro de materiais (`material-catalog.ts`) — mais 6 outros arquivos de teste que citam os 7 slugs individualmente (levantado nesta rodada via busca: `tests/divulgacao-copy.test.ts`, `tests/marketing-materials-props.test.ts`, `tests/e2e/commercial-pages.spec.ts`, `tests/resolve-representative.test.ts`, `tests/commercial-page-metadata.test.ts`, `tests/commercial-page-url.test.ts`, `tests/marketing-materials-availability.test.ts`, `tests/marketing-materials-registry.test.ts`, `tests/representative-own-activation.test.ts`, `tests/merge-representative-catalog.test.ts`, `tests/product-compliance-notice.test.ts`). Isso é o custo que ADR-089 já aceitou conscientemente ("correções... podem exigir sete alterações" — vira oito), não sintoma de um problema arquitetural.

**Não há evidência de que uma arquitetura dinâmica de templates resolveria algo que o dispatcher hoje não resolve.** Ao contrário: o próprio ADR-089 documenta que a tentativa anterior de generalizar (ADR-088) *reduziu* a fidelidade visual por produto — o risco concreto já observado aponta na direção contrária de generalizar, não a favor. **Recomendação: não propor nenhuma abstração maior neste momento.** `conexao-expansao-page.tsx` deve ser uma árvore de apresentação própria, como as outras sete.

O único ponto genuinamente novo (não coberto por "adicionar mais uma árvore igual às outras"): dois componentes específicos pequenos identificados em §5.5 e §5.7 (`PlanComparisonCard`, `CareerLadderStrip`) não têm equivalente hoje — isso é esperado sob ADR-089 (cada produto já cria widgets próprios: `PlacasPaymentSelector`, `GreenCalculator` etc.) e não constitui uma exceção à decisão.

---

## 9. Não generalizar prematuramente

Resposta direta ao item 9 da tarefa: **confirmado, não generalizar.** A existência de uma 8ª página, por si só, não é evidência de que o dispatcher precisa virar dinâmico. Ver §8 acima para a evidência (ausência de evidência de dor real) que sustenta essa conclusão.

O que muda, e que precisa ser um artefato explícito (não uma mudança de código nesta tarefa): a premissa textual de ADR-089 de "conjunto fechado de sete Produtos" deixa de ser verdadeira. Isso é uma correção de premissa registrada em um novo ADR (§11), não uma mudança de arquitetura.

---

## 10. Exact Implementation Plan

**Nenhum destes arquivos foi criado ou modificado nesta tarefa.** Lista preparada para quando o Product Owner autorizar a implementação.

### Criados
| Arquivo | Por quê |
|---|---|
| `src/modules/representatives/presentation/commercial-pages/conexao-expansao/conexao-expansao-page.tsx` | Árvore de apresentação própria, per ADR-089 — mesmo padrão das outras 7. |
| `src/modules/representatives/presentation/commercial-pages/conexao-expansao/conexao-expansao.module.css` | CSS próprio, per ADR-089. |
| `src/modules/representatives/presentation/commercial-pages/conexao-expansao/plan-comparison-card.tsx` (+ `.module.css`, se necessário) | Componente específico novo, identificado em §5.5 — sem equivalente reutilizável hoje. |
| `src/modules/representatives/presentation/commercial-pages/conexao-expansao/career-ladder-strip.tsx` (+ `.module.css`, se necessário) | Componente específico novo, identificado em §5.7. |
| `supabase/migrations/2026XXXXXXXXXX_add_conexao_expansao_product.sql` | Novo produto no catálogo — segue exatamente o padrão de `20260803000000_seed_igreen_catalog.sql`; migration nova porque, per o comentário daquele arquivo, o seed é "um catálogo fixo de 7" e não é reescrito. |
| Um novo ADR (nome exato a definir — ver §11) | Registra a decisão de qualificar ADR-089 e a mudança de audiência do domínio (§4). |

### Modificados
| Arquivo | Por quê |
|---|---|
| `src/modules/representatives/presentation/commercial-pages/dispatch-commercial-page.tsx` | Adicionar a 8ª `case`. |
| `src/modules/representatives/domain/product-compliance-notice.ts` | Nova entrada no mapa — **bloqueada por `COMPLIANCE DISCLAIMER SOURCE: UNRESOLVED`** (§12); pode ser implementada com um placeholder explicitamente não-aprovado, no mesmo padrão já usado para `GENERIC_NOTICE` (Club/Telecom), mas isso precisa ser uma decisão consciente do Product Owner, não uma omissão silenciosa. |
| `tests/commercial-page-templates.test.ts` | `PRODUCTS`/`FIDELITY_MARKERS` ganham a 8ª entrada; a asserção `.length,7` (linha ~38) muda para `8` — deliberadamente, com revisão, porque essa linha existe hoje especificamente para impedir esse crescimento silencioso. |
| `tests/commercial-page-metadata.test.ts` | Cobertura de metadata/OG para o 8º produto. |
| `tests/e2e/commercial-pages.spec.ts` | Cobertura E2E (tokens, cores computadas, desktop/mobile) para o 8º produto. |
| `tests/commercial-page-url.test.ts`, `tests/resolve-representative.test.ts`, `tests/representative-own-activation.test.ts`, `tests/merge-representative-catalog.test.ts` | Cada um cita os 7 slugs — checar se cada um precisa da 8ª entrada ou se generaliza (não lidos byte-a-byte nesta rodada; ver §Sources). |
| `docs/DOMAIN_MODEL.md` | Duas edições pequenas identificadas em §4 — **só depois** do ADR novo existir, nunca antes (documentos não autorizam implementação; implementação/ADR é que autoriza a edição de doc normativo). |
| `docs/PRODUCT.md` | Bullet novo em "What Exists Today," só depois de publicado. |
| `docs/adr/README.md` | Índice de ADRs, se este projeto mantiver um índice central (não confirmado nesta rodada — verificar antes). |

### Deliberadamente não tocados
| Arquivo/área | Por quê |
|---|---|
| `src/modules/leads/**` (schema, API, gateway, inbox) | Confirmado product-agnostic (§7) — nenhuma mudança necessária. |
| `src/modules/analytics/**` | Confirmado product-agnostic (§7) — nenhuma mudança necessária. |
| `src/modules/marketing-materials/**` | Degrada graciosamente sem o novo slug (§7) — fora de escopo até uma decisão futura explícita. |
| `docs/adr/ADR-089-*.md` | Não editado — sua decisão principal (árvores independentes) permanece válida; a premissa do catálogo fechado é *qualificada* por um ADR novo, não reescrita nela mesma (ADRs deste projeto são log append-only, per o padrão observado nos outros ADRs "Supersedes"/"Superseded by"). |
| `docs/adr/ADR-060-*.md` | Não editado — vocabulário já cobre este caso sem ajuste. |
| Os cinco blocos fora de escopo (Voucher, Treinamentos, Benefícios, Rankings, Materiais) | Explicitamente descartados pela tarefa (§12) — nenhuma arquitetura, rota ou stub criado para eles. |

---

## 11. Test Plan

| Camada | O que cobrir | Arquivo |
|---|---|---|
| Fidelidade de conteúdo/source | Marcadores literais da copy aprovada (§6) presentes na página — mesmo padrão de `FIDELITY_MARKERS`, mas sem um `templates/commercial-pages/ConexaoExpansao/index.html` de referência (não existe um) — o "canônico" passa a ser este documento ou um doc de copy aprovado equivalente. | `tests/commercial-page-templates.test.ts` |
| Dispatcher | 8 `case`s exatos, sem fallback, sem símbolo de registry genérico reintroduzido. | `tests/commercial-page-templates.test.ts` |
| Metadata/OG | Título, descrição, imagem OG resolvidos para o 8º slug. | `tests/commercial-page-metadata.test.ts` |
| Resolução Host+slug | `resolveCommercialPresence`/`resolveRepresentativeActivation` aceitam `conexao-expansao` como qualquer outro slug ativado. | `tests/resolve-representative.test.ts`, `tests/commercial-page-url.test.ts` |
| Preview | `/pre-visualizacao/conexao-expansao` renderiza com `leadFormDisabled`, mesmo padrão dos outros 7. | `tests/commercial-page-templates.test.ts` (já cobre `previewPage` genericamente), `src/app/pre-visualizacao/[productSlug]/page.tsx` (não editado, só exercitado) |
| Lead | Submissão via `/api/leads` com `productSlug: 'conexao-expansao'` — reaproveita o teste genérico existente (não achei um teste específico por produto para o Lead nesta rodada; se existir cobertura genérica de "qualquer productSlug ativo," nenhuma mudança necessária). | a confirmar contra `tests/lead-inbox.test.ts` (citado na rodada anterior, não reaberto nesta) |
| Analytics/CTA/WhatsApp | `trackWhatsappClick`/`record_page_visit` aceitam o novo slug sem mudança — nenhum teste específico por produto encontrado; cobertura já é genérica. | — |
| Catálogo/ativação | Representative consegue ativar `conexao-expansao` como qualquer outro produto do catálogo `igreen`. | `tests/merge-representative-catalog.test.ts`, `tests/representative-own-activation.test.ts` |
| Compliance notice | Nova entrada testada — bloqueada até a fonte ser resolvida (§12); se implementada com placeholder, o teste deve confirmar que o placeholder está marcado como não-aprovado, mesmo padrão do `GENERIC_NOTICE` hoje. | `tests/product-compliance-notice.test.ts` |
| E2E — 8ª página | Tokens/cores computadas, desktop e mobile, igual às outras 7. | `tests/e2e/commercial-pages.spec.ts` |
| E2E — mobile específico | Sem overflow horizontal (checar visualmente, não só `scrollWidth` — lição registrada de SET-99: ancestrais com `overflow: hidden` escondem overflow real de checagens simples), tabela Plus×Full/degraus de evolução legíveis em 375px, WhatsApp flutuante não sobrepõe o CTA final, FAQ acessível por teclado. | `tests/e2e/commercial-pages.spec.ts` (extensão) |
| Regressão | As 7 páginas existentes continuam passando integralmente após todas as edições acima — nenhuma mudança nos arquivos compartilhados (`content-sections.tsx`, `commercial-page-base.module.css`, etc.) é esperada, mas a suíte completa deve rodar, não só os testes novos. | suíte completa |

---

## 12. Documentation/ADR Plan

Nada disto é executado nesta tarefa — lista do que precisaria mudar **depois** de uma aprovação explícita, e qual decisão cada mudança registraria.

| Documento | Mudança | Decisão que registra |
|---|---|---|
| Novo ADR (`docs/adr/ADR-0XX-conexao-expansao-qualifica-catalogo-fechado.md`, nome exato a definir) | Registra que o catálogo deixa de ser "fechado em sete" por decisão deliberada do Product Owner, mantendo o restante de ADR-089 (árvores independentes) válido. Formato "Supersedes/Qualifies ADR-089" — não reescreve ADR-089. | A decisão do Product Owner nesta rodada (§8/§9 da tarefa). |
| `docs/DOMAIN_MODEL.md` — **Product** (§8.4) | Adiciona um segundo exemplo ilustrativo de Product cujo "sellable unit" é a própria oportunidade comercial, não um bem/serviço comprado pelo visitante. | O modelo conceitual `Representative → Commercial Page → interessado → conversão` autorizado pelo Product Owner (§1 da tarefa). |
| `docs/DOMAIN_MODEL.md` — glossário (perto da linha 216) | Adiciona "prospective Representative" como uma segunda categoria de audiência de Commercial Page, ao lado de "the Representative's customer." | Mesma decisão acima. |
| `docs/PRODUCT.md` — "What Exists Today" | Novo bullet, só depois de publicado — não antes. | Fato de produto, não decisão. |
| `docs/plans/README.md` | Índice atualizado — já feito nesta rodada e na anterior, é rotina de manutenção de planos, não uma mudança normativa. | N/A |
| `product-compliance-notice.ts` (código, não doc normativo, mas com peso de compliance) | Nova entrada — **condicionada à resolução do item abaixo.** | Origem do disclaimer aprovado (ainda não existe). |

**`COMPLIANCE DISCLAIMER SOURCE: UNRESOLVED`** — nenhum documento normativo deste projeto, nenhuma página pública oficial da iGreen encontrada nesta rodada, contém um texto de disclaimer aplicável à divulgação da oportunidade Conexão Expansão/Plano de Negócio. Isso permanece como condição de publicação, não de implementação — a página pode ser construída e testada com um placeholder explicitamente marcado como não-aprovado (mesmo padrão já aceito para `GENERIC_NOTICE` em Club/Telecom), mas não deve ir ao ar em produção sem essa fonte resolvida ou uma decisão consciente do Product Owner de aceitar o mesmo nível de risco do placeholder genérico.

---

## 13. Residual Risks

| Categoria | Risco | Severidade |
|---|---|---|
| **Compliance** | Nenhuma fonte de disclaimer aprovada para conteúdo de recrutamento/plano de compensação (`COMPLIANCE DISCLAIMER SOURCE: UNRESOLVED`). | Alto — gate de publicação. |
| **Compliance** | Se o Product Owner decidir publicar os valores exatos (R$, %, tabelas) apesar da recomendação deste documento, a exposição pública de economia interna de recrutamento (§3, achado da rodada anterior) volta a valer integralmente, sem uma fonte pública para verificar se os números ainda estão vigentes. | Alto, condicional. |
| **Stale content** | Mesmo a copy qualitativa proposta (§6) descreve um programa cujas regras "podem ser atualizadas... mediante comunicação prévia" (linguagem do próprio Voucher, mas o espírito se aplica à Expansão também) — a página precisa de um dono que revise periodicamente, mesmo sem números. | Médio. |
| **UX** | Risco de a página crescer de volta para um "manual" se seções como Plus×Full ou Evolução ganharem detalhe demais durante a implementação — mitigado pelas recomendações explícitas de omissão em §5.5/§5.7, mas depende de disciplina na implementação real. | Médio. |
| **Architecture** | Nenhum risco novo identificado além do custo já aceito por ADR-089 (mudanças comuns exigem editar N árvores) — ver §8. | Baixo. |
| **Analytics** | Nenhum risco técnico identificado (§7) — toda a infraestrutura é genérica. Risco *interpretativo*: métricas de "lead" para uma página de recrutamento significam algo diferente de "lead" para uma venda de energia (uma pessoa interessada em virar licenciado, não em comprar); se dashboards agregados um dia somarem leads de todos os produtos sem diferenciar isso, a leitura fica distorcida. Não é um problema hoje (`/app/contatos` já segmenta por produto), mas vale registrar para quando/se houver agregação entre produtos no futuro. | Baixo, hoje. |
| **Domain semantics** | `DOMAIN_MODEL.md`'s "Product = sellable unit" fica com uma leitura ligeiramente forçada até a edição proposta em §4/§12 ser feita — risco puramente documental, não técnico. | Baixo, até o ADR ser escrito. |
| **Maintenance** | Uma 8ª árvore independente, mais dois componentes novos (`PlanComparisonCard`, `CareerLadderStrip`) que nenhuma outra página usa — custo de manutenção adicional aceito conscientemente sob ADR-089, mesmo perfil das outras 7. | Baixo, esperado. |
| **Brand/legal** | O achado de que representantes independentes já usam "franquia"/"franqueado" publicamente (igreenenergyprime.com.br, §3) para descrever este programa é um risco *pré-existente*, fora do controle do SETNAR, mas reforça a importância de a copy do SETNAR **não** adotar essa linguagem — verificado que a proposta em §6 não usa o termo. | Baixo para o SETNAR especificamente, registrado como contexto. |

---

## 14. Final Verdict

**`GO WITH CONDITIONS`**

Condições restantes antes da implementação poder começar com segurança total (nenhuma delas impede a *investigação* de estar concluída — todas são decisões ou fontes que o Product Owner, ou quem tiver acesso à Academy/iGreen Connect, precisa fornecer):

1. **`COMPLIANCE DISCLAIMER SOURCE: UNRESOLVED`** — precisa de uma fonte real, ou uma decisão consciente do Product Owner de aceitar o mesmo risco já aceito para o `GENERIC_NOTICE` de Club/Telecom (copy não revisada por jurídico da iGreen), documentada como tal.
2. **Decisão explícita sobre publicar ou não os valores exatos (R$, %, tabelas) na página pública.** Recomendação deste documento: não publicar (§3, §6) — página fica qualitativa, remete às "regras oficiais" e ao Representative para os números. Se o Product Owner preferir publicar os valores mesmo assim, alguém com acesso à iGreen Academy precisa confirmar, com data, que `docs/igreen/conexao-expansao.txt` reflete o texto vigente antes da publicação.
3. **Aprovação da copy final** (§6) — está pronta para revisão, com toda alegação factual rastreada a uma fonte ou marcada como proposta.
4. **Registro formal da decisão de arquitetura** — um novo ADR qualificando a premissa de "catálogo fechado" de ADR-089 (§11), antes ou junto da implementação (não precisa preceder o código, mas precisa existir antes do merge).
5. **Confirmação de qual dos oito arquivos de teste periféricos** listados em §10/§11 (`tests/commercial-page-url.test.ts` etc.) realmente precisa de uma 8ª entrada vs. já generaliza — não confirmado byte-a-byte nesta rodada, fica como primeiro passo técnico da implementação, não como bloqueio de decisão.

Nenhuma dessas cinco condições é um blocker técnico ou de compliance que impeça a implementação de ser corretamente escopada — são exatamente o tipo de decisão que só o Product Owner (condições 2-4) ou uma verificação técnica rápida (condição 5) pode fechar, e a condição 1 é, por definição própria da tarefa, um gate de publicação, não de código.

---

## Sources consulted (this round)

**Repositório** (branch `develop`, commit `0e7d305`): `docs/igreen/conexao-expansao.txt`, `docs/DOMAIN_MODEL.md`, `docs/PRODUCT.md`, `docs/PRODUCT_CONSTITUTION.md`, `docs/adr/ADR-089-*.md`, `docs/adr/ADR-060-*.md`, `docs/plans/README.md`, `src/app/[productSlug]/page.tsx`, `src/modules/representatives/presentation/commercial-pages/**` (dispatcher, header, hero, trust-strip, footer, floating-whatsapp, content-sections, commercial-lead-form), `src/modules/leads/**` (schema, API route, lead-inbox), `src/modules/analytics/domain/origin.ts`, `src/modules/marketing-materials/material-catalog.ts`, `src/modules/representatives/domain/product-compliance-notice.ts`, `tests/commercial-page-templates.test.ts`, plus a name-only sweep of 11 other test files referencing the seven slugs.

**Web** (consulted 2026-09-04): `https://igreenenergy.com.br` (official, public), `https://academy.igreenenergy.com.br` (official, gated — confirmed), `https://www.igreenenergy.com.br/manual-expansao-igreen` / `manual-expansao-telecom` / `qualificacao-igreen` (official, not publicly reachable — redirect/403), `https://igreenenergyprime.com.br` (independent Representative site, not official), `https://lp.igreendobrasil.com.br` (dead domain). `WebSearch` queries logged in §3, with its AI-summarized claims explicitly not used as sourced fact.
