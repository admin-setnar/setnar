Status: Superseded
Authority: Non-normative
Code baseline: branch `develop`, commit `0e7d305` (2026-09-01)
Last reviewed: 2026-09-04
Superseded by: [`CONEXAO_EXPANSAO_PLAN_V2.md`](CONEXAO_EXPANSAO_PLAN_V2.md) — the Product Owner made three decisions (in-scope, public 8th Commercial Page, catalog not fixed at seven) that reverse this document's `NO_GO` on those specific points. Kept on record for its reasoning, per `docs/plans/README.md`'s "nothing is deleted" rule — do not treat its verdict as current.

---

# Conexão Expansão — Investigation, Copy Proposal & Implementation Plan

This document is the output of a read-only investigation. **No code, migration, config, test, or content file was created or modified while producing it.** Its purpose is to give the Product Owner what is needed to decide *whether and how* to build a "Conexão Expansão" page, before any implementation starts.

**Headline finding, stated up front:** the premise stated in the request — "the new page should be built directly in Next.js, reusing the components/pattern already used by the sibling pages" — rests on an assumption that does not hold. There is no shared, reusable page template between Club/Placas/Solar/Livre (or the other three sibling products this investigation found). That architecture was tried, then explicitly reverted by ADR-089. Beyond that, the source content in Appendix A is not the same *kind* of thing as the seven existing pages — it is not a product sold to a Representative's customer, it is the Representative's own compensation/recruiting plan. See §1 and §3.

---

## 1. Investigation Summary

### 1.1 Location and baseline

Analyzed on branch `develop`, commit `0e7d305144df047d457b445b08d38b4b60797962` (2026-09-01). This is the integrated baseline, not a worktree or open PR.

**Correction to the prompt's premise:** the prompt names four sibling pages (Club, Placas, Solar, Livre). The catalog actually seeds **seven** products, all integrated in `develop`, all wired through the same dispatcher, all covered by the same test suite:

| Slug | Name | Page file |
|---|---|---|
| `conexao-club` | Conexão Club | [conexao-club-page.tsx](../../src/modules/representatives/presentation/commercial-pages/conexao-club/conexao-club-page.tsx) |
| `conexao-green` | Conexão Green | [conexao-green-page.tsx](../../src/modules/representatives/presentation/commercial-pages/conexao-green/conexao-green-page.tsx) |
| `conexao-livre` | Conexão Livre | [conexao-livre-page.tsx](../../src/modules/representatives/presentation/commercial-pages/conexao-livre/conexao-livre-page.tsx) |
| `conexao-placas` | Conexão Placas | [conexao-placas-page.tsx](../../src/modules/representatives/presentation/commercial-pages/conexao-placas/conexao-placas-page.tsx) |
| `conexao-solar` | Conexão Solar | [conexao-solar-page.tsx](../../src/modules/representatives/presentation/commercial-pages/conexao-solar/conexao-solar-page.tsx) |
| `green-seguros` | iGreen Seguros | [green-seguros-page.tsx](../../src/modules/representatives/presentation/commercial-pages/green-seguros/green-seguros-page.tsx) |
| `telecom` | iGreen Telecom | [telecom-page.tsx](../../src/modules/representatives/presentation/commercial-pages/telecom/telecom-page.tsx) |

Evidence these are genuinely live, not experimental: [dispatch-commercial-page.tsx](../../src/modules/representatives/presentation/commercial-pages/dispatch-commercial-page.tsx) exhaustively switches on all seven slugs; the public route [src/app/[productSlug]/page.tsx](../../src/app/%5BproductSlug%5D/page.tsx) resolves them by Host+slug with no feature flag; the product catalog seed migration [`20260803000000_seed_igreen_catalog.sql`](../../supabase/migrations/20260803000000_seed_igreen_catalog.sql) inserts exactly these seven rows; `tests/commercial-page-templates.test.ts` asserts the dispatcher has exactly 7 `case` branches.

**This matters for the plan:** the request refers to "the 5th page of this format." It would actually be the 8th.

### 1.2 Structure: is there a shared template?

**No — and this was a deliberate, reversed architectural decision, not an oversight.**

- **ADR-088** (2026-08-13, superseded) first built exactly what the prompt assumes exists: a typed `CommercialPageContent` registry + one shared shell component (`getCommercialPageTemplate`-style composition) rendering all seven products from configuration.
- **ADR-089** (2026-08-13, accepted, "implementação reaberta e incompleta") **reverted ADR-088 the same day**. Reason, quoted: normalizing structure, spacing, hierarchy, responsiveness and visual detail across products "fizeram parte da experiência específica de cada Produto" (were part of each product's specific experience) — the shared shell was homogenizing pages that were supposed to look and behave differently. The decision explicitly frames this as viable *because* the catalog is closed: "Neste conjunto fechado de sete Produtos, o custo de manter markup e CSS próprios é aceito" (in this **closed set of seven Products**, the cost of maintaining separate markup and CSS is accepted).
- This isn't just documentation — it's enforced by a test. [`tests/commercial-page-templates.test.ts:32-41`](../../tests/commercial-page-templates.test.ts#L32-L41) asserts `dispatcher.match(/case '/g).length === 7` (exactly seven, no more) and `assert.doesNotMatch(dispatcher, /CommercialPageContent|getCommercialPageTemplate/)` — i.e., it actively fails the build if anyone reintroduces the shared-registry pattern ADR-089 rejected, or adds an 8th case.

**What actually is shared** (confirmed by reading all five files named in the prompt plus Green): a library of generic, content-free section *components* — `CommercialPageHeader`, `HeroSection`, `TrustStrip`, `ConsultorSection`, `CommercialLeadForm` (+ `LeadSection` wrapper), `StepsSection`, `CardsSection`/`CheckedListSection` (from [content-sections.tsx](../../src/modules/representatives/presentation/commercial-pages/content-sections.tsx)), `FaqSection`, `CtaFinalSection`, `CommercialPageFooter`, `FloatingWhatsapp` — plus one base CSS module ([commercial-page-base.module.css](../../src/modules/representatives/presentation/commercial-pages/commercial-page-base.module.css)) and shared infrastructure (lead submission, analytics, Company/Representative/Product resolution). Each product's page is a hand-written tree that *composes* these primitives with its own copy, its own ordering, its own one-off widgets (`PlacasPaymentSelector`, `SolarHeroWidget`, `GreenCalculator`, `ClubCategoryWidget`, `LivreEligibilityQuiz`), and, where needed, entirely custom markup the shared primitives don't cover (e.g. Placas' payment-methods grid, Club's category grid, Green's video embed).

So: "reusing the pattern" cannot mean "plug content into an existing template" — no such template exists to plug into. It means writing an 8th fully independent presentation tree, matching the sections' *visual/interaction conventions* by hand, exactly as Club/Green/Livre/Placas/Solar/Seguros/Telecom each did independently.

### 1.3 Content storage

Hardcoded as JSX literals directly inside each product's `*-page.tsx`, not in JSON/MD/a CMS or a database. Two narrow exceptions found, both for content a widget needs as *data* rather than prose: [`product-content/conexao-club.ts`](../../src/modules/representatives/domain/product-content/conexao-club.ts) (the Club category-tab array consumed by `ClubCategoryWidget`) and [`product-compliance-notice.ts`](../../src/modules/representatives/domain/product-compliance-notice.ts) (the mandatory pre-contract notice, keyed by slug, grouped into 3 regulatory categories: Energia / Seguros / generic CDC). Both are explicitly *not* general-purpose content registries — the compliance-notice file's own comment states "If Stage 5 ever adds a Company other than iGreen, this map does not generalize."

ADR-055/ADR-056 (referenced, not re-read in full here) record the underlying reasoning: compliance-approved copy is versioned as code, reviewed by diff/PR, deliberately never a `jsonb` column or CMS field — "zero migration."

### 1.4 Reusable UI blocks

Directly reusable for page scaffolding, unchanged: `CommercialPageHeader`, `HeroSection` (has a slot for a per-product widget), `TrustStrip`, `ConsultorSection`, `CommercialLeadForm`/`LeadSection`, `StepsSection`, `CardsSection`, `CheckedListSection`, `FaqSection`, `CtaFinalSection`, `CommercialPageFooter`, `FloatingWhatsapp`.

**Not present anywhere in the existing seven:** a royalty/commission table by qualification tier, a tiered-qualification ladder (Sênior → Acionista), a points-per-connection-type table, or a "PRO status" rules block. Appendix A's core content (bonus tables, royalty tiers, PML limits, qualification ladders) has no existing analog to reuse — it would need new one-off components, the same way Placas needed `PlacasPaymentSelector` and Solar needed a documents checklist. This is expected under ADR-089 (one-off widgets per product are the norm), not a gap in the investigation.

### 1.5 Distribution and access — the most consequential finding

**All seven existing pages are public and unauthenticated.** [`src/app/[productSlug]/page.tsx`](../../src/app/%5BproductSlug%5D/page.tsx) resolves purely by `Host` header + path slug (`resolveCommercialPresence`), with no session check; an unresolved page renders the generic `not-found.tsx` (an anti-enumeration measure, not an access control). [`DOMAIN_MODEL.md:93-95`](../../docs/DOMAIN_MODEL.md#L93-L95) defines Commercial Page as, verbatim, "the **public-facing**, personalized digital page." They are linked from wherever a Representative shares their link/QR Code — there is no in-app menu link *to* another Representative's page; each Representative sees only their own via `/app/paginas`.

**Appendix A's content is materially different from what is public today.** The seven existing pages carry compliance-reviewed *marketing claims about a product being sold to the Representative's customer* (a discount, a financing option, an insurance plan). Appendix A instead contains the Representative's own internal commercial-network economics: exact R$ bonus amounts per qualification tier, royalty percentages, "Royalties Equiparação" rules, and point thresholds that determine how much *the Representative themself* earns from recruiting and from their downline's activity. Publishing this, unauthenticated, on the open internet — where the Representative's competitors, their own downline, or the general public can read it — is a materially different exposure decision than publishing "here's the discount we offer" copy. This needs an explicit Product Owner/compliance decision (see §6), not an assumption that "the sibling pages are public, so this one is too."

### 1.6 Normative classification

Per [`DOMAIN_MODEL.md:81-97`](../../docs/DOMAIN_MODEL.md#L81-L97): **Product** = "The sellable unit. Everything a Commercial Page ultimately promotes is a Product." **Commercial Page** = "The public-facing, personalized digital page that presents a Representative and exactly one Product they have activated, **ending in a call to action (WhatsApp contact)**." Both definitions model a Representative selling something to *their own end customer*.

Appendix A's content does not fit either definition. It is not something a Representative's customer buys — it is the compensation plan by which the Representative earns money for **recruiting new Representatives** ("licenciados") and being paid royalties on their downline's activity. Its natural "call to action" would be something like "become a licenciado under me" or "here is how much I / you earn," not a WhatsApp lead asking to buy an energy product. No entity in `DOMAIN_MODEL.md` currently models "recruit a new Representative" or "a Representative's own compensation/royalty structure" — the closest concepts (Product, Product Activation, Commercial Page, Lead) are all scoped to the Representative-sells-to-consumer relationship. See §7.

Separately, and independently of the above: `DOMAIN_MODEL.md:248` records that **Catalog is not even a persisted entity** ("no Catalog table or entity, deliberately — ADR-028"); the seven Products are seeded directly. The seed migration's own header comment states this is "para um catálogo fixo de 7" (for a fixed catalog of 7) and that changing it requires a new migration, "não... escrita" as a mutable admin surface. Adding an eighth product — regardless of what it is — is a schema change against a migration that was explicitly designed around the number seven, not an additive content change.

Also relevant: **ADR-060** establishes that "licenciado" is not a domain term at all — it is tenant-configured **display string** only ("Licenciado Autorizado iGreen Energy"); `Representative` is the sole domain term. Any new content/domain code must say "Representative," never introduce "Licenciado" as a type, field, or component name.

### 1.7 Existing tests

- [`tests/commercial-page-templates.test.ts`](../../tests/commercial-page-templates.test.ts): Node test-runner, source-string assertions. Verifies the dispatcher has exactly 7 cases and no shared-registry symbols; verifies public and preview routes both render through `DispatchCommercialPage`; verifies each of the 7 pages contains `CommercialLeadForm`/`CommercialPageFooter`/`CommercialPageHeader` and no analytics-script leakage (`GA4_ID`/`fbq(`); verifies specific literal marker strings from each page still match the corresponding `templates/commercial-pages/*/index.html` reference file (a fidelity/no-drift check).
- `tests/commercial-page-metadata.test.ts` — Open Graph/metadata resolution per product (not read in full for this investigation; referenced by name from the grep sweep).
- `tests/e2e/commercial-pages.spec.ts` (Playwright) — per ADR-088's own text, the E2E "verifica os tokens e as cores computadas no navegador em desktop e mobile," i.e. per-product visual/token regression, not generic across all seven.

Any 8th page would need the same three layers: a literal-marker fidelity test tied to some canonical reference content, a metadata test, and an E2E pass — and the existing template test's hard-coded `=== 7` assertion would itself need a deliberate, reviewed edit (it currently exists specifically to prevent silent growth of this switch statement).

### 1.8 Relevant ADRs

- **ADR-088** (superseded): shared `CommercialPageContent` registry + one shell. Rejected same-day.
- **ADR-089** (accepted, current): 7 independent presentation trees; explicitly reasons about a "closed and known catalog," accepting the duplication cost *because* the set won't grow casually.
- **ADR-092**: public address format includes Company (`<representative-slug>.<company-slug>.setnar.com/<product-slug>`).
- **ADR-057**: per-Company/vertical brand-token mechanism used by all seven pages.
- **ADR-055/056** (referenced, not fully re-read): compliance copy lives as versioned code, never a `products` column/migration.
- **ADR-060**: "Representative" is the only valid domain term; "licenciado" is display-string-only, never a type/field/component name.
- **ADR-090**: marketing materials (Post/Story/Poster) export via client-side capture — the closest existing precedent for the "Materiais de Comunicação" block in Appendix A, and it too is scoped to the same seven products (`MATERIALS_REGISTRY`, 7×3 = 21 items, confirmed in [registry.ts](../../src/modules/marketing-materials/registry.ts)).

---

## 2. Copy Proposal

**Framing caveat, not a stylistic choice:** the sections below are organized using the sibling pages' visible structural vocabulary (hero, trust strip, steps, cards, checked-list, FAQ, CTA, footer) so the Product Owner can review Appendix A's content in a familiar shape. This is **not** a claim that Conexão Expansão should literally be assembled from `HeroSection`/`StepsSection`/etc. as-is — §4 covers that separately. Every number, percentage, and rule below is copied verbatim from Appendix A; nothing was rounded, simplified, or invented. Where Appendix A itself was ambiguous or incomplete, it is flagged inline as **[GAP]** rather than filled in.

### 2.1 Header / identification
Same fixed block as the other seven: representative name + "Licenciado Autorizado iGreen Energy (ID: {authorizationId})" (from [`commercial-page-footer.tsx`](../../src/modules/representatives/presentation/commercial-pages/commercial-page-footer.tsx) — used in header too via `CommercialPageHeader`). Product name: **"Conexão Expansão."**

### 2.2 Hero
- Eyebrow: "Plano de expansão da sua equipe comercial"
- Headline: "Conecte novos licenciados e ganhe bônus imediatos, royalties e reconhecimento pela sua rede."
- Subhead: "Veja como funcionam as bonificações por conexão direta e indireta, os royalties por qualificação e as regras para avançar de nível."
- **[GAP]** The sibling pages' hero always carries a WhatsApp CTA ("Quero minha proposta," "Quero ativar meu Club"). Appendix A gives no equivalent single call to action — it is a rules/regulation document, not a pitch. A literal CTA here would have to be invented (e.g. "Falar com meu patrocinador sobre expansão"), which the instructions forbid me from doing unilaterally. **Needs PO decision** on what, if anything, the CTA says.

### 2.3 Trust strip
No equivalent claims exist in Appendix A (the sibling pages' trust strips are customer-facing reassurances — "fornecedores homologados," "sujeito a análise de crédito"). Appendix A contains no comparable 3-point trust list. **Recommend omitting this section** rather than inventing claims.

### 2.4 "Como funciona" — Conexão Expansão (Licença Connect PLUS)

> Conexão de novos licenciados na sua equipe comercial, diretos ou indiretos. É possível trabalhar as soluções iGreen Seguros, iGreen Telecom e iGreen Expansão.

**Ganhos diretos e indiretos**
- **Conexão Direta (CD):** conexão realizada por você — R$150,00 pagos imediatamente por cada novo licenciado direto conectado.
- **Conexão Indireta (CI):** conexão realizada pelos seus diretos — R$50,00 pagos imediatamente por cada nova conexão indireta realizada pelos seus indiretos. Você precisa ser PRO no mês anterior para receber o ganho de CI.

**Royalties Expansão** — conforme sua qualificação, até R$150,00 a mais por toda Conexão Expansão realizada na sua equipe comercial, inclusive CD e CI:

| Qualificação | Royalties Expansão |
|---|---|
| Pré-Sênior | R$25 a mais |
| Sênior | R$35 a mais |
| Pré-Gestor | R$50 a mais |
| Gestor | R$65 a mais |
| Pré-Executivo | R$80,00 a mais |
| Executivo | R$85 a mais |
| Pré-Diretor | R$110,00 a mais |
| Diretor | R$125 a mais |
| Acionista | R$150,00 a mais |

*O Bônus Royalties Expansão será proporcional de acordo com o avanço de qualificações e pré-qualificações da sua equipe.*

**Exemplo 1:** Você é Gestor, sobre todas as conexões expansão realizadas pela sua equipe você recebe R$65 de Royalties.

**Exemplo 2:** Você é executivo e recebe R$85 de todas as conexões expansão realizadas pela sua equipe comercial. Se um licenciado da sua equipe avançar a Sênior, ele recebe R$35 sobre as conexões expansão realizadas pela equipe comercial dele, e você recebe R$50,00 proporcional sobre a equipe deste Sênior.

**Royalties Equiparação Green** — bônus exclusivo para Pré-Executivos ou Executivos e acima:

| Nível | Valor |
|---|---|
| 1º Nível | R$15,00 |
| 2º Nível | R$12,50 |
| 3º Nível | R$10 |
| 4º Nível | R$7,50 |
| 5º Nível | R$5,00 |

Após o bônus Royalties Expansão ser equiparado por algum licenciado que alcançar a mesma graduação que você, você passa a receber o Royalties Equiparação Expansão até o 5º Nível de qualificados.

**Exemplo:** Você é executivo, tem um executivo abaixo, você não recebe mais o bônus Royalties Expansão, agora inicia o Royalties Equiparação Expansão, R$15,00 sobre todas as Conexões Expansão realizadas na equipe deste executivo.

*Conclusão (verbatim from source):* "Ao conectar novos licenciados diretamente ou por meio de sua equipe, você recebe bônus imediatos e recorrentes, proporcionais à atividade e desempenho da sua rede. Além disso, à medida que avança nas qualificações, é possível aumentar os ganhos por meio de royalties adicionais sobre as conexões realizadas pela equipe, com valores crescentes conforme sua qualificação. Se um licenciado em sua rede atingir a mesma qualificação que você, os bônus passam a ser ajustados por equiparação, garantindo ganhos em múltiplos níveis."

**[GAP — naming inconsistency in the source itself:** the source calls this bonus table "Royalties Equiparação **Green**" in its heading but "Royalties Equiparação **Expansão**" in the body/example two sentences later. This is preserved verbatim above; I have not resolved it, since correcting it would mean guessing which is correct. **Flag to the Product Owner** before publishing.]

**Upgrade da Licença Telecom para Licença Full**

> Quando o licenciado que tem "licença connect plus" faz o upgrade para a "connect full", é pago bônus da diferença. Exemplo: Uma licença full gera R$300 de expansão para o licenciado, e uma licença plus gera R$150. Ao fazer o upgrade de Plus para Full, é pago R$300-150 = R$150 de bônus para o patrocinador. O mesmo vale para Royalties e GI.

### 2.5 "Como funciona" — Conexão Expansão (Licença Connect Full)

> Conexão de novos licenciados com LICENÇA FULL na sua equipe comercial, de forma direta ou indireta.

- **Conexão Expansão Direta:** R$300,00, pagos imediatamente, por cada novo licenciado direto conectado.
- **Conexão Expansão Indireta:** R$100,00, pagos imediatamente, por cada nova conexão indireta, desde que você tenha sido PRO no mês anterior.

**Royalties Expansão (Full)** — até R$300,00 adicionais:

| Qualificação | Royalties Expansão |
|---|---|
| Pré-Sênior | R$50,00 a mais |
| Sênior | R$70,00 a mais |
| Pré-Gestor | R$100,00 a mais |
| Gestor | R$130,00 a mais |
| Pré-Executivo | R$160,00 a mais |
| Executivo | R$190,00 a mais |
| Pré-Diretor | R$220,00 a mais |
| Diretor | R$250,00 a mais |
| Acionista | R$300,00 a mais |

**Exemplo 1:** Você é Gestor. Sobre todas as Conexões Expansão realizadas pela sua equipe, você recebe R$130,00 em Royalties. *(O bônus de Royalties Expansão será proporcional de acordo com o avanço de qualificações e pré-qualificações da sua equipe.)*

**Exemplo 2:** Você é Executivo e recebe R$190,00 sobre todas as Conexões Expansão realizadas pela sua equipe comercial. Se um licenciado da sua equipe avançar para Sênior, ele recebe R$70,00 sobre as Conexões Expansão realizadas pela equipe dele, e você recebe R$120,00 proporcionais sobre a equipe desse Sênior.

**Royalties de Equiparação Expansão (Full)** — exclusivo para Pré-Executivos, Executivos e acima:

| Nível | Valor |
|---|---|
| 1º Nível | R$30,00 |
| 2º Nível | R$25,00 |
| 3º Nível | R$20,00 |
| 4º Nível | R$15,00 |
| 5º Nível | R$10,00 |

**Exemplo:** Você é Executivo e possui um Executivo abaixo de você. Nesse caso, você deixa de receber o bônus de Royalties Expansão direto e passa a receber o Royalties de Equiparação Expansão, com R$30,00 sobre todas as Conexões Expansão realizadas pela equipe desse Executivo.

*Conclusão (verbatim):* "Ao conectar novos licenciados, diretamente ou por meio da sua equipe, você recebe bônus imediatos e recorrentes, proporcionais à atividade e ao desempenho da sua rede. [...] Quando um licenciado da sua rede atinge a mesma qualificação que você, os bônus passam a ser ajustados por equiparação, garantindo ganhos em múltiplos níveis."

### 2.6 Regras para sua qualificação

Three performance levels: **01 – Graduação** (base level), **02 – Graduação Expansão** (reached via Green Points from expansion activity; unlocks a higher Royalties percentage), **03 – Graduação Elite** (max performance tier per graduation; unlocks the highest available Royalties percentage).

**Qualification ladder:**

| Graduação | Conexões diretas | Pontos | Alternativa |
|---|---|---|---|
| Sênior | 5 | 10.000 | 2 Licenciados Diretos Green OU 10.000 pontos de Geração Própria |
| Gestor Green | 10 | 50.000 | 5 Licenciados Diretos Green OU 50.000 pontos de Geração Própria |
| Executivo Green | 20 | 150.000 | 7 Licenciados Diretos Green (2 Gestores) OU 150.000 pontos de Geração Própria |
| Diretor Green | 40 | 500.000 | 10 Licenciados Diretos Green (2 Gestores + 2 Executivos) — obrigatório |
| Acionista Green | 80 | 1.000.000 | 15 Licenciados Green (4 Gestores + 4 Executivos) — obrigatório |

⚠️ **Observação importante (verbatim):** "Para se qualificar nos níveis Sênior, Gestor e Executivo, é permitido utilizar pontos de Geração Própria (válido também para Conexão Telecom com Portabilidade), sem a necessidade de recrutar novos licenciados. Já para as qualificações de Diretor e Acionista, é obrigatório: Acumular os pontos mínimos exigidos; e Conectar novos licenciados à rede, conforme os critérios de cada nível."

⚠️ **Atenção sobre o PML (Pontos Máximo por Linha):** existe um limite máximo de pontos contabilizável por linha. Exemplo — Qualificação Sênior: meta total 10.000 pontos; limite por linha 30% de 10.000; máximo contabilizável por linha: 3.000 pontos.

**Reconhecimento:** para participar dos grupos oficiais e ter reconhecimento na Live Grand Show, é preciso estar qualificado e manter a qualificação por, no mínimo, 30 dias durante o período vigente. Link oficial para as viagens bonificáveis de cada nível: https://academy.igreenenergy.com.br/categoria/manual-de-negocio/regras-de-viagens

**Qualificação Expansão** (preparatory tiers, network structure only, no minimum kWh volume unlike the official qualification):

| Graduação Expansão | Conexões (Green ou Telecom c/ portabilidade) | Licenciados Diretos Green |
|---|---|---|
| Sênior Expansão | 5 | 2 |
| Gestor Expansão | 10 | 5 (2 Sênior Expansão) |
| Executivo Expansão | 20 | 7 (2 Gestores Expansão) |
| Diretor Expansão | 40 | 10 (2 Gestor Expansão + 2 Executivo Expansão) |

### 2.7 Tabela de pontos qualificáveis por tipo de conexão

| Tipo de conexão | Pontuação |
|---|---|
| Conexão Green | 100% dos pontos contratados, enquanto estiver ativa |
| Conexão Placas | 4× o ponto gerado na proposta, válido por 12 meses (ex.: proposta de 1.000 pontos de geração conta 4.000 pontos por 12 meses) |
| Conexão Solar | 100% dos pontos gerados na proposta, enquanto estiver ativa |
| Conexão Livre | Até 100% dos pontos contratados, enquanto estiver ativa |
| Conexão Telecom (Portabilidade) | 200 pontos por cliente conectado, enquanto estiver ativo. Apenas clientes com portabilidade contam como ativos; inadimplência de 30 dias remove o cliente e os 200 pontos correspondentes |

### 2.8 Regras Licenciado PRO

**STATUS PRO** — válido por conexão/vertical; determina o percentual de GP (Bônus de Geração Própria) e da geração de rede recebido:

- **PRO:** 100% do bônus de geração própria, indireta royalties e equiparação.
- **Não PRO:** 50% do bônus de geração própria, 0% da indireta royalties e equiparação.

**Como se tornar PRO:**

| Forma | Requisito |
|---|---|
| PRO Energia | 5 conexões Green, ou 1 Livre, ou 1 Solar, ou 1 Placas |
| PRO Telecom | 5 portabilidades |
| PRO Seguro | 2 seguros |
| PRO 360 | 1 Energia + 1 Seguro + 1 Portabilidade (uma Conexão Expansão pode substituir uma dessas conexões); OU 2 Conexões Expansão Full; OU 4 Conexões Expansão Plus; OU combinação equivalente (ex.: 2 Plus + 1 Full) |

Combinações entre verticais também valem, ativando o status PRO apenas nas verticais envolvidas: 4 Green + 1 Seguro → PRO Energia + PRO Seguro (100% dos GP e GI de Energia e Seguro). 4 Green + 1 Telecom → PRO Energia + PRO Telecom. 1 Energia + 1 Seguro + 1 Portabilidade → PRO 360 (100% dos GP em todas as vertentes).

**Vantagens de ser PRO:** 100% do Bônus de Geração Própria e da Geração da Rede nas vertentes em que estiver PRO; recorrência garantida com recebimento imediato até o faturamento do primeiro boleto do cliente; saques ilimitados; vantagens e condições exclusivas em promoções; pulseira exclusiva PRO, entregue na Convenção iGreen Expert.

### 2.9 FAQ
Appendix A contains no Q&A block (unlike all seven sibling pages, each of which has 5 FAQ items). **I have not invented one** — every sibling FAQ paraphrases the page's own preceding claims into question form, and doing that here would mean generating claims not present in Appendix A, which the instructions explicitly forbid. **Recommend the Product Owner supply real recurring questions** (e.g. from the WhatsApp/support channel) rather than have this fabricated.

### 2.10 Footer / compliance
The three-paragraph shape (`disclaimer` / representative identification / `dataCollectedNote`) applies structurally, but its actual content cannot be safely drafted here:

- The sibling disclaimers are grounded in an approved compliance source per product category (`PRODUCT_COMPLIANCE_NOTICE`, keyed to iGreen's Manual de Conduta item 19.3 for energy, or SUSEP/BP Seguradora wording for insurance). **No equivalent compliance-approved source exists for a compensation/recruiting-plan disclosure.** Writing one myself would be inventing a legal disclaimer for content whose lead type (recruit a new business partner) has never gone through this codebase's compliance-review process — this is exactly the kind of thing the instructions say not to invent.
- The existing `dataCollectedNote` assumes the standard 4-field customer lead form (nome/telefone/cidade/email). If Conexão Expansão has no lead form (§2.2's open CTA question), this paragraph doesn't apply as-is either.

### 2.11 Blocks from Appendix A that do not map to any section above

Flagged separately per the instructions, not folded into the copy above:

1. **Regulamento do Voucher Boas-vindas** — a time-bound, dated regulatory notice (valid from 01/08/2026, "por prazo indeterminado," alterable by iGreen with prior notice) about a one-time store-credit bonus tied to license purchase. This reads as a standalone legal regulation document, not marketing copy for a product page.
2. **Treinamentos e Tutoriais** — live weekly training schedule ("Segundas, APN às 20h, Start às 21h") + a link to an external YouTube channel/playlist. This is an operational content feed that changes on its own schedule, unrelated to any single product's sales copy.
3. **Benefícios e Promoções** — explicitly stated in the source as **updated monthly** ("Esses conteúdos são atualizados todo mês"). Hardcoded-JSX-per-product content (the pattern every existing page uses) is unsuited to monthly-changing content; it would need a different storage mechanism entirely.
4. **Central de Rankings** — an interactive map (UCs ANEEL vs. iGreen by state) plus a live leaderboard for the "Pote Milionário" promotion. This is a data/visualization feature, not static copy — categorically different from anything the seven existing pages contain.
5. **Materiais de Comunicação — Expansão** — links out to a repository of campaign assets, editable art, and templates. Adjacent to, but not the same as, the existing `marketing-materials` module (which *generates* three personalized formats per Representative × Product from `MATERIALS_REGISTRY`, not a general asset-library link).

**Recommendation, not a decision:** items 1–5 look like they belong to a different, currently-nonexistent surface for a Representative's own business-operation content (something closer to an authenticated "Academy"/back-office area than a public Commercial Page) — or, in the case of items 2–5, may not belong inside SETNAR's Stage 1 scope at all, since PRODUCT.md's Core Domain is "turning a Representative's identity and authorized Products into a credible, personalized Commercial Page" for their *own customers*, not hosting iGreen's internal training/ranking/asset infrastructure. This is the Product Owner's call — see §3 and §8.

---

## 3. Gaps Identified

1. **Audience/domain mismatch (blocking).** §1.6 — Appendix A's core content (royalties, qualification tiers) is a Representative's own compensation plan for recruiting other Representatives. `DOMAIN_MODEL.md`'s Product/Commercial Page definitions model a Representative selling to *their own end customer*. No existing concept covers "recruit a Representative" or "show a Representative their own royalty structure." Needs a Product Owner decision on whether this is in scope at all, and if so, whether it's modeled as a Product (current pattern) or something new.
2. **Public vs. authenticated exposure (blocking).** §1.5 — publishing internal per-tier R$ bonus amounts and royalty percentages on an unauthenticated public URL, discoverable by anyone (competitors, the Representative's own downline, iGreen itself) is a materially different exposure decision than the existing seven pages' marketing claims. Needs explicit sign-off, not inherited by default from the sibling pattern.
3. **No compliance-approved disclaimer source.** §2.10 — every existing disclaimer traces to a specific approved source (Manual de Conduta 19.3, SUSEP/BP Seguradora wording, or an explicitly-flagged-as-provisional generic CDC notice). Nothing in Appendix A or this investigation identifies an equivalent approved source for compensation-plan/recruiting disclosures. Writing one without that source risks the exact "GENERIC_NOTICE... NOT reviewed by iGreen's legal team" situation the codebase already flags as a known gap for Telecom/Club — except here there is no fallback category to reuse.
4. **No CTA / no FAQ in the source.** §2.2, §2.9 — both are present in every sibling page and absent from Appendix A. Needs Product Owner input, not invention.
5. **Source content contains its own internal inconsistency.** §2.4 — "Royalties Equiparação Green" (heading) vs. "Royalties Equiparação Expansão" (body/example) for the Licença Plus tier. Needs the Product Owner (or whoever owns the source regulation) to confirm which is correct.
6. **Five of Appendix A's blocks don't fit a single product page.** §2.11 — Voucher regulation, Treinamentos, Benefícios (monthly), Central de Rankings, Materiais de Comunicação. Needs a Product Owner decision, per block, among: (a) part of the same Conexão Expansão page, (b) separate pages/sections elsewhere in the product, (c) out of scope for this implementation.
7. **The catalog is closed by design, with an automated guard.** §1.6, §1.7 — a schema migration (against a seed explicitly commented as "fixed catalog of 7") and a deliberate edit to a test that currently asserts `=== 7` would both be required. This is a bigger, more consequential change than "add a page," and should be scoped/approved as such.
8. **"Licenciado" vocabulary.** Appendix A uses "licenciado" throughout (correct — it's the source regulation's own tenant-facing term). Per ADR-060, any resulting code must use "Representative" for all domain names; "licenciado" is display-string-only. Not a blocker, just a rule to apply during implementation.

---

## 4. Implementation Plan (proposed, pending decisions above)

**This section describes what building this would require, given the current architecture — it is not a recommendation to proceed before §3's gaps are resolved.**

Because ADR-089's premise ("closed set of seven") is broken by definition the moment an eighth product is added, "reusing the existing pattern" cannot mean copy-paste-and-restyle in the way it did for, say, Solar reusing Placas' shape. It means:

1. **A Product Owner/architecture decision on whether to reopen ADR-089's catalog**, or record a new ADR explaining why the catalog is no longer closed at seven (or why Conexão Expansão is *not* a Product/Commercial Page at all — see gap 1). This should happen before any file is touched, since it changes the shape of everything below.
2. **If proceeding as an 8th Commercial Page:**
   - New migration adding `conexao-expansao` (or the agreed slug) to `products`, following the exact pattern of `20260803000000_seed_igreen_catalog.sql`.
   - New folder `src/modules/representatives/presentation/commercial-pages/conexao-expansao/` with `conexao-expansao-page.tsx` + `.module.css`, composing the shared section primitives (§1.4) plus new one-off components for: royalty-by-tier tables, the qualification ladder, the points-per-connection table, and the PRO-status rules — none of which exist today and would need to be built from scratch, styled consistently with `commercial-page-base.module.css`.
   - `dispatch-commercial-page.tsx` gains an 8th `case`.
   - `tests/commercial-page-templates.test.ts`'s hard-coded `=== 7` assertion and `PRODUCTS`/`FIDELITY_MARKERS` arrays updated deliberately (this test exists specifically to prevent silent growth — updating it is a real, reviewable decision, not a mechanical sync).
   - `tests/commercial-page-metadata.test.ts` and `tests/e2e/commercial-pages.spec.ts` extended for the 8th product.
   - A compliance-notice entry in `product-compliance-notice.ts` — blocked on gap 3 above.
   - A decision on the lead form: reuse `CommercialLeadForm`'s existing nome/telefone/cidade/email contract (built for "quero comprar," semantically odd for "quero ser recrutado"), or determine no lead form applies here at all.
3. **If proceeding as something other than a Commercial Page** (e.g., an authenticated back-office/Academy surface for the Representative's own network): this plan's file-level detail above does not apply, and a fresh, much smaller investigation of `/app/*` routes and authenticated content patterns would be needed instead — not scoped here, since it depends on gap 1's resolution.
4. Items flagged in §2.11 (Voucher, Treinamentos, Benefícios, Rankings, Materiais) are excluded from the plan above; each needs its own scoping once §3 gap 6 is resolved.

---

## 5. Proposed Acceptance Criteria (for whichever path is approved)

- All Appendix A figures (R$ values, percentages, point thresholds) appear verbatim, matching the source exactly — covered by a literal-marker fidelity test, following `tests/commercial-page-templates.test.ts`'s existing pattern.
- The "Royalties Equiparação Green/Expansão" naming inconsistency (§2.4, gap 5) is resolved one way, consistently, before publish — not left ambiguous in the shipped copy.
- Representative identification block present and correct, matching the fixed format used by all other Commercial Pages/authenticated pages.
- No "official iGreen channel" implication; `NOT_OFFICIAL_CHANNEL_NOTICE` (or its authenticated-surface equivalent) present if the page is public.
- No unapproved compliance/legal disclaimer language — gap 3 must be closed with a real approved source before this criterion can be met.
- Mobile responsiveness and no horizontal overflow, verified the same way SET-99 checked the other seven ([project_set99_mobile_overflow_fixes] — overflow-hidden ancestors can hide bugs from simple `scrollWidth` checks; must be checked visually, not just programmatically).
- Visual consistency with sibling pages' *conventions* (typography, spacing scale, card/section rhythm from `commercial-page-base.module.css`) — not literal componentry, per ADR-089.
- If public: access-exposure decision (gap 2) has been explicitly signed off, not defaulted.
- If a lead form is included: it uses the existing secure submission path (`/api/leads`, honeypot, rate limit) unmodified, per ADR-089's "shared and non-duplicable" list.

---

## 6. Residual Risks

- **Compliance/brand (high).** Publishing detailed internal recruiting-compensation numbers publicly, under iGreen's brand identification, without an iGreen-approved disclaimer source, is the single biggest risk this investigation surfaced. Unlike the existing seven pages (whose brand authorization and claims were "compliance-reviewed" per `PRODUCT.md:253`), no equivalent review is known to exist for this content type. Recommend treating this the same way `product-compliance-notice.ts`'s own comment treats its unreviewed generic notice: do not publish until a real legal/compliance source is identified.
- **Regulatory content going stale.** The Voucher regulation is explicitly dated/time-bound ("válida a partir de 01/08/2026... podendo ser alterada"); if any part of it is folded into a page, it needs an owner and a review cadence — hardcoded JSX (today's pattern for all seven pages) has no mechanism for that.
- **Sensitive data exposure to competitors/downline.** §1.5, gap 2 — separate from general compliance, this is a competitive/business-strategy exposure question specific to Conexão Expansão, absent from every existing page.
- **Visual inconsistency.** Building an 8th tree by hand (per ADR-089's own accepted risk) always carries some chance of drifting from the other seven's conventions — accepted cost under the current architecture, not unique to this page.
- **Scope creep via §2.11's five blocks.** If those get pulled into "just build them too" without their own scoping, this stops being "an 8th Commercial Page" and becomes a meaningfully larger initiative (a training hub, a rankings dashboard, an asset library) — each with its own risk profile this document does not cover.

---

## 7. Documentation Affected

- **`docs/DOMAIN_MODEL.md`** — only if the Product Owner decides Conexão Expansão (or "recruit a new Representative") is genuinely in scope. It currently has no concept for it, and Product/Commercial Page's definitions ("the sellable unit... promoted... ending in a WhatsApp call to action" for the Representative's own customer) don't stretch to cover it without a real conceptual addition — not a wording sync. If the Product Owner instead decides this is out of scope, or belongs to a different, not-yet-modeled surface, no DOMAIN_MODEL.md change is needed now.
- **`docs/PRODUCT.md`** — only if scope changes; "What Exists Today" would need a new bullet once (if) this ships, and the Core Domain framing (§ *Core Domain*, currently "Commercial Presence & Representative Enablement" scoped to selling to end customers) may warrant a note if Representative-recruitment content becomes a real, named part of the product.
- **A new ADR** — required either way: either "ADR-XXX: Conexão Expansão reopens the closed seven-product catalog" (if built as an 8th Commercial Page, explicitly superseding/qualifying ADR-089's closed-catalog reasoning) or an ADR recording the decision that this content belongs to a different surface entirely and is not a Commercial Page/Product.
- Nothing else needs updating "just to synchronize" — per this repo's own rule (`docs/plans/README.md`), plans and audits don't carry authority, and no change should be made to a normative doc without a real decision behind it.

---

## 8. Verdict: **NO_GO**

Not because the content or the request is unreasonable — because too much of what's needed to scope real implementation work is still an open Product Owner decision, and several of those decisions change the shape of the work materially (whether this is a Commercial Page at all; whether it's public; what the compliance basis for the disclaimer is). Proceeding to code now would mean guessing at exactly the things the original prompt said not to guess at.

**What needs a Product Owner decision before this can become GO:**

1. Is "Conexão Expansão" in scope for SETNAR at all, given it's Representative-recruitment content, not a product sold to an end customer? (§1.6, gap 1)
2. If yes: is it a Commercial Page (public, per the existing pattern) or does it need a new, authenticated surface? (§1.5, gap 2)
3. What is the approved compliance/legal source for the disclaimer? (gap 3)
4. What CTA and FAQ content apply, if any, since Appendix A supplies neither? (gap 4)
5. Which reading of "Royalties Equiparação Green" vs. "Expansão" is correct? (gap 5)
6. For each of the five out-of-pattern blocks (Voucher, Treinamentos, Benefícios, Rankings, Materiais): same page, separate surface, or out of scope? (gap 6)
7. Is reopening the seven-product closed catalog (ADR-089) something the Product Owner wants to formally decide and record, or is an eighth product the wrong shape for this entirely? (gap 7)

The copy in §2 is ready for the Product Owner to react to on its merits — but it should be read as a *draft for review*, not as approved page content, given gaps 3, 4 and 5 in particular.

---

## Sources consulted

`docs/PRODUCT.md`, `docs/DOMAIN_MODEL.md`, `docs/adr/ADR-088-*.md`, `docs/adr/ADR-089-*.md`, `docs/adr/ADR-060-*.md`, `docs/plans/README.md`, `supabase/migrations/20260803000000_seed_igreen_catalog.sql`, `src/app/[productSlug]/page.tsx`, `src/modules/representatives/presentation/commercial-pages/**`, `src/modules/representatives/domain/product-compliance-notice.ts`, `src/modules/representatives/domain/product-content/conexao-club.ts`, `src/modules/marketing-materials/registry.ts`, `src/app/app/divulgacao/page.tsx`, `tests/commercial-page-templates.test.ts`.
