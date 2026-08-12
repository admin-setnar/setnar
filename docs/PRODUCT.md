# PRODUCT.md

> Product Vision & Strategy
> Version: 2.0
> Status: Active
> Authority: Level 2 — subordinate only to PRODUCT_CONSTITUTION.md (see `docs/README.md`)
> Product: SETNAR

---

## Cadastro e telefone comercial implementados na Stage 1

O cadastro solicita nome completo, telefone comercial, e-mail, senha,
confirmação e aceite dos termos. O telefone é obrigatório, serve ao perfil
profissional e ao CTA de WhatsApp, e nunca é credencial nem alternativa de
login. Nome e telefone preenchem inicialmente o onboarding, onde permanecem
editáveis e só viram dados profissionais após confirmação explícita.

Contas legadas sem telefone continuam válidas, mas precisam preenchê-lo para
concluir o onboarding. O dado não participa de URLs, logs ou Analytics.

# Vision

SETNAR exists to be the infrastructure layer for authorized independent representation — giving every independent professional authorized by an organization a digital presence that is credible, compliant, and generated for them, not built by them.

Our goal is to be the layer authorizing organizations rely on instead of leaving digital representation to chance, and the layer independent professionals rely on instead of building that presence themselves.

The professional does not design, build, or assemble anything. They **activate** what they are authorized to represent, **configure** their own information, and **personalize within defined limits**. The platform generates the result. This is not a stylistic preference — PRODUCT_CONSTITUTION.md § 3 states the presence is "generated for them, not built by them," and any wording that turns SETNAR into a builder contradicts the Constitution.

---

# Mission

Give every representative authorized by an organization a digital presence that is credible to customers and stays inside the rules that organization sets — automatically, without either side needing to employ a developer, a designer, or a compliance reviewer to keep it that way.

---

# Long-Term Vision

Become the infrastructure layer that authorizing organizations and the independent professionals they authorize rely on, across every category of authorized independent representation — starting with, but never limited to, the market SETNAR validates first.

The direction of travel is that SETNAR progressively centralizes what a representative needs in order to operate digitally. The areas below describe **that direction, not a commitment and not a delivery schedule**:

- Digital presence
- Commercial pages
- Lead generation
- Marketing materials
- Analytics
- CRM
- Campaign management
- Artificial Intelligence
- Business automation

**None of these may be communicated publicly as available.** Availability is stated in one place only — *What Exists Today*, below. Sequencing and the validation each area must pass live in `ROADMAP.md`; several of them are candidate capabilities there, not planned work.

---

# Problem Statement

Stated in three separate registers, because conflating them is how a business plan starts believing its own assumptions.

## Observation — what has been directly seen

Independent representatives present themselves today through generic link aggregators, PDF catalogs, and WhatsApp conversations. They have no digital identity of their own, no consistent way to share content, and no performance metrics. Nothing in their presentation distinguishes an authorized professional from anyone else claiming the same.

This is observable in the market SETNAR entered and is not in dispute.

## Evidence — what has been verified

**Very little, and this must not be overstated.** The reference commercial page templates for the seven iGreen products exist and were compliance-reviewed, which evidences that the authorizing organization considers this presentation problem real enough to have addressed it. iGreen's brand usage policy evidences that unmanaged representation is a risk the organization already recognizes.

**There is no evidence yet from SETNAR's own users**, because the product has not been through a paying validation cycle. No conversion data, no retention data, no willingness-to-pay data.

## Hypothesis — what is believed and not yet proven

- That these limitations reduce trust, engagement, and ultimately sales conversion.
- That a credible, authorized digital presence measurably improves a representative's results.
- That representatives will pay for it out of their own pocket.

**All three are hypotheses.** They are reasonable, they motivate the product, and none of them has been tested. Stage 1 of `ROADMAP.md` exists to test the third; the first two remain untested even after Stage 1 succeeds.

Public communication must never present any of the three as established fact (§ *Limits of public communication*).

---

# Solution

SETNAR generates, for each authorized representative, the commercial pages of the products they represent — carrying their identity, their authorization, and their contact channel — together with the links and QR Codes needed to distribute them.

The representative activates a product; the platform produces the page. They do not brief anyone, wait for anyone, or assemble anything.

Instead of sharing loose files, PDFs and several different links, the representative shares one professional address that identifies them.

## "Digital Office" — formal definition

**"Digital Office" is a commercial category and a public name. It is not a technical object.**

It means: the integrated experience through which a representative operates digitally on SETNAR — their identity, the products they are authorized to represent, their pages, links, QR Codes, and contact channels, presented as one coherent whole.

It **must not** be read as implying:

- a database entity or table (`digital_offices` does not exist and is not planned);
- a mandatory aggregate or bounded context;
- one single technical object;
- that every capability the term might evoke exists.

Specifically, **"Digital Office" does not imply that CRM, artificial intelligence, campaigns, automations, or any other future tooling is available in the MVP.** Today the term denotes the set described under *What Exists Today* — nothing more. `DOMAIN_MODEL.md` § 3 is the authority on how the term maps to the domain.

---

# Core Value Proposition

SETNAR is not a website builder.

SETNAR is the infrastructure that makes a representative's presence credible to the customer and compliant for the authorizing organization, at the same time.

Our value is not creating pages.

Our value is the trust between a representative and the organization that authorizes them — the reason a customer can act on that presence with confidence.

---

# Target Audience

Primary audience

Any independent professional authorized by an organization to represent it — under their own name, effort, and risk. Today this includes, without being limited to:

- Licensed representatives
- Independent consultants
- Sales agents
- Affiliates
- Franchisees
- Insurance brokers
- Real estate brokers
- Commercial representatives

Secondary audience

Organizations that authorize and manage distributed representative teams.

---

# Product Principles

Every feature must respect the following principles.

## Simplicity

The platform should require almost no training.

If users need documentation to complete basic tasks, the product has failed.

---

## Speed

Users should complete their main objective within minutes.

Navigation should feel immediate.

---

## Professionalism

Every generated page should increase user credibility.

Professional appearance is mandatory.

---

## Scalability

The platform must support thousands of users without requiring architectural redesign.

---

## Accessibility

Digital tools should be accessible even for users with minimal technical knowledge.

---

# MVP Goal

The MVP has one objective:

Validate whether independent representatives are willing to pay for a Digital Office.

Nothing else.

The MVP is not intended to solve every commercial problem.

It only validates demand.

**Known gap, stated openly:** the product cannot yet measure this hypothesis. Subscriptions exist as a record and are enforced both when a Commercial Page is published and when it is served, but they are activated manually — there is no payment gateway, billing flow, or automated Subscription lifecycle. Until that closes, "willing to pay" is being observed outside the product, not by it. Tracked in `docs/plans/SPRINT_E_PLAN.md` (E3–E6).

---

# Success Metrics

These are the metrics against which the MVP is to be judged. Listing a metric here is **not** a claim that it is currently instrumented.

## Business Metrics

- Paying customers
- Monthly recurring revenue
- User retention
- Referral rate

## Product Metrics

- Active pages
- Generated QR Codes
- WhatsApp clicks
- Returning visitors

**Instrumentation status.** Page visits and WhatsApp clicks are recorded, but there is no read path and no interface that displays them — to the representative or to anyone else. Every business metric above is currently obtained outside the product. Any statement implying that a representative can "track their results today" is false.

---

# Initial Market

The first implementation targets iGreen representatives.

This decision is strategic.

Reasons:

- Existing market access
- Immediate customer feedback
- Existing branding guidelines
- Existing product catalog
- Lower validation cost

The platform architecture must never become dependent on iGreen.

The first customer is not the product.

This is a direct application of PRODUCT_CONSTITUTION.md's Core Belief 6 — one relationship proven is worth more than many assumed. Expansion to a new authorizing organization or category follows validation; it never substitutes for it.

## Relationship with iGreen

Because the first market is a single organization, the boundary has to be written down rather than assumed:

- iGreen is **the first authorizing organization served**, and a customer. It is not SETNAR's identity.
- **SETNAR is never presented as belonging to, or being an official channel of, iGreen** — or of any organization its users represent.
- The architecture must not depend structurally on iGreen. Organization-specific rules are configuration or isolation, never core domain (`ARCHITECTURE.md`, Multi-Tenancy).
- A representative's page must never look like an official page of the represented organization. Credibility comes from **authorized identification** — the representative's real name, their authorization identifier, their own contact details, and approved assets — never from resemblance (PRODUCT_CONSTITUTION.md, Core Belief 1).
- Domain, branding, and page authorship must remain unambiguous to a visitor.
- The MVP may focus entirely on iGreen without the core domain becoming iGreen-specific.

## Brand authorization — current status

**SETNAR has no formal authorization from iGreen to use the iGreen brand or visual identity publicly.** This is the status as of 2026-08-05 and it must not be softened anywhere.

The distinction that matters, and that has already been blurred once:

| What exists | What it is | What it is **not** |
|---|---|---|
| `templates/commercial-pages/` — seven reference pages with iGreen branding | **Reference material**, received as input | Not a licence to publish |
| Compliance-reviewed copy ported into the product (ADR-055) | Wording aligned with the organization's own requirements | Not blanket brand authorization |
| iGreen brand tokens in the code (ADR-057) | **An internal, unapproved prototype**, built deliberately as a presentation piece to *request* authorization | Not approved, not cleared to publish |

**Reference material is not authorization.** Possessing an organization's assets, and even having their compliance wording, says nothing about the right to reproduce their visual identity on software-generated pages under SETNAR's own domain.

iGreen's brand usage policy expressly prohibits licensees from creating advertising material using the iGreen brand. Whether a platform-generated commercial page falls inside or outside that prohibition is a question **only iGreen can answer**, and it has not been asked and answered formally.

Until it is: the prototype must not be published, and no public surface may imply the association is sanctioned. Tracked as CP1 in `docs/plans/COMMERCIAL_PAGE_CONTENT_PLAN.md` § 3.3 — the single most consequential open item in this documentation set.

---

# Public Positioning and Communication

This section is normative. It governs the landing page, sales material, decks, and any public statement about SETNAR. Where marketing copy and this section disagree, the copy is wrong.

## Permanent identity

**SETNAR is a product company and an infrastructure layer for authorized, professional digital representation.**

SETNAR must never be permanently reduced to:

- a landing page creator;
- a website builder;
- an agency;
- a hosting service;
- a tool exclusive to iGreen;
- a platform restricted to a single segment;
- a QR Code generator.

Any of these may describe a *feature* SETNAR happens to include. None of them describes what SETNAR is.

## Public category of the first product

**"Digital presence platform" is the public commercial category of the first product — not the permanent definition of the company.**

Three distinct things, which must not be collapsed into one:

| Layer | What it is | Changes? |
|---|---|---|
| **Permanent identity** | Infrastructure for authorized independent representation | No — Constitution-level |
| **Commercial category of today's product** | Digital presence platform | Yes — the first product is not the last |
| **Future ecosystem capabilities** | Additional commercial capabilities over the same base | Hypotheses; see `ROADMAP.md` |

SETNAR may later operate other products and services beyond the initial digital presence. Public communication must not write the company's identity in terms that only the first product can satisfy.

## The transformation being promised

Public communication must **not** sell "we make you a page." The page is the means. The promise is what the page makes possible:

- building trust;
- conveying professionalism;
- presenting products and services clearly;
- making contact easy;
- strengthening digital presence;
- increasing commercial capability;
- creating better conditions to generate opportunities and sales.

**Language of potential and consequence, never of certainty.**

Acceptable:

- "Increase your chances of converting."
- "Create better conditions to sell."
- "Convey more trust to your customer."
- "Make contact and your commercial presentation easier."

Prohibited:

- "Increase your sales, guaranteed."
- "Sell more automatically."
- "Proven results" — absent real evidence.
- "The platform that will make you sell more," stated as certainty.

## The ecosystem, honestly stated

SETNAR is the progressive base of a digital ecosystem. It is **not one yet**, and must not be described as one.

The narrative to preserve:

> SETNAR starts by organizing professional digital presence: identity, authorized products, pages, links, QR Codes and contact channels. On top of that base, further commercial capabilities can be added progressively.

Which requires stating plainly:

- the MVP is **not** a complete ecosystem;
- the first product is the initial core, not the whole;
- future capabilities arrive progressively, each after its own validation;
- **the landing must never present future capabilities as if they already existed.**

## What Exists Today

The single authoritative answer to "what does the product do?" Three categories that must never be merged.

### Available now

**Verification record.** Every line below was checked against the code, file by file, not inferred from another document.

| | |
|---|---|
| Baseline | Parte 2 working tree based on commit `df8db50`, branch `develop` |
| Date | 2026-08-06 |
| Performed by | Documentation governance audit, approved by the Product Owner |
| Method | Direct reading of `src/`, `supabase/migrations/` and `package.json`. A capability is listed only where a code path was found that a user can actually reach |
| Not covered | Runtime behaviour in production, and whether any real representative has used any of it |
| Re-verified | At every sprint close, and before every release — `docs/README.md` § *When this documentation is re-verified* |

**If the date above is older than the last closed sprint, this section is unverified.** Treat it as a starting point for checking the code, not as an answer. Every other document in this set defers to this one on the question of what exists, so a stale date here makes the whole set stale.

- Account creation, sign-in, sign-out, and password recovery (request link and set a new password).
- Representative onboarding: creating the representative's own record, with public name prefilled from the account, mandatory commercial phone, authorization identifier and public address (slug).
- Editing own profile: display name, authorization identifier, phone, city. **These four fields are the whole of it.**
- Authenticated App Shell with `/app/paginas` for page management, `/app/contatos` for the read-only inbox of captured contacts, `/app/conta` for professional/access data, and `/app` redirecting to Pages. No Performance or Materials destination exists.
- Reading the products of the authorizing organization's catalog. The catalog is seeded by migration; there is no interface to manage it.
- Product activation and deactivation by the representative.
- Publication of a commercial page per activated product, subject to four ordered preconditions: active representative, active SETNAR Subscription, name filled in, phone filled in. Only the first failure is reported.
- Public commercial page containing: authorized-representative identification (name, authorization identifier, city, phone), per-product compliance notice, WhatsApp CTA, and a lead capture form. **No representative photo, and no free-text description** — neither exists in the product.
- Per-product explanatory content on **one** of the seven products (Conexão Club). The other six render without it.
- QR Code rendered in the browser from the page's public address, with **download**, **copy link**, manual-copy fallback and retry after a generation error. There is **no persisted QR Code** and no content-level regeneration.
- Public address by subdomain, one page per (representative × product). There is no public hub page listing a representative's products.
- Lead capture, with an IP rate limit and attribution to the originating page.
- Read-only contact inbox in `/app/contatos`, owner-scoped by RLS, with Product/date attribution and user-initiated WhatsApp/e-mail actions. There is no status, note, edit, assignment, search or automation.
- Recording of page visits and WhatsApp clicks, with referrer and a hashed IP.
- Basic analytics shown to the representative in `/app/paginas`: visits, WhatsApp clicks and leads, counted per Product over a 7- or 30-day window (SET-37/ADR-082, `QR_ANALYTICS_PLAN.md` AN6). **No breakdown by referrer, device or city, and no conversion rate** — that remains Advanced Analytics, Future vision.
- Subscription checked through the same `is_subscription_active` rule both when a Commercial Page is published and when it is served.
- `/app/paginas` reads that same Subscription and profile-completeness decision: it blocks publication, offers an actionable path to `/app/conta`, suppresses public links/QR Codes for inaccessible pages, and never labels an inaccessible stored `published` row as “Publicado.”

**Known limits of the "organization-agnostic" claim.** Tenant resolution, the schema, and the core flows carry no assumption of any particular organization. Two presentation-level pieces currently do: the identification block renders the fixed string "Licenciado Autorizado iGreen Energy," and the compliance notices are iGreen-specific copy keyed to the seven seeded products. Both are documented as such in the code and are known scope, not accidental coupling — but a second authorizing organization would require changing them. This is stated here so that nobody reads "multi-tenant architecture" as "a second organization could be onboarded today."

### In validation or development

Decided or under way, **not yet usable**:

- Manual Subscription activation/reactivation (`SPRINT_E_PLAN.md`, E3).
- Analytics event retention/purge (AN7).
- Richer per-product page content beyond the single proof of concept (`COMMERCIAL_PAGE_CONTENT_PLAN.md`, CP4–CP8).

### Future vision

Hypotheses and concepts. **Not commitments, not authorization to build, and never publicly presentable as existing:** marketing material library, campaigns and smart links, advanced analytics, CRM and sales pipeline, artificial intelligence, business automation, enterprise multi-organization operations, white label, marketplace, developer platform and public APIs. Each one's status is in `ROADMAP.md`; each one's domain status is in `DOMAIN_MODEL.md` § 3.1.

**A representative profile photo, social links, and business hours are not implemented** — despite appearing in `ROADMAP.md` Stage 1.

## Limits of public communication

The following are prohibited in any public surface, with no exception for "placeholder," "illustrative," or "temporary":

- invented metrics;
- invented customers;
- invented testimonials;
- numbers without a source;
- non-existent security seals;
- non-existent certifications;
- unproven commercial results;
- **future capabilities described in the present tense**;
- false institutional association with iGreen, or with any represented organization;
- presenting SETNAR as the property or official channel of a represented organization;
- any wording that would lead a visitor to believe every roadmap capability already exists.

Illustrative interface figures, where used, must be visibly illustrative and must never depict revenue or earnings.

---

# Complementary Business Model

## Custom development

SETNAR may take on custom development work for third parties. This section defines its boundaries so that it does not, over time, redefine the company.

1. **SETNAR remains a product company.** This is not negotiable by revenue.
2. **Custom development is a complementary model**, never the core.
3. It may generate revenue, learning, and reusable assets.
4. **Not every project will produce reusable assets**, and that is an acceptable outcome.
5. Every project must be assessed against: strategic fit; operational capacity; profitability; risk; learning opportunity; potential for abstraction; conflict with the roadmap.
6. **A custom-development client's code never enters the platform core automatically.**
7. Client-specific knowledge must be abstracted before it can become a permanent capability — this is PRODUCT_CONSTITUTION.md Core Belief 12 applied: validation alone does not promote a capability into the core; abstraction does.
8. A custom-development client's demands do not automatically displace SaaS priorities.
9. **The central product backlog keeps strategic priority over one-off customization.**
10. This service must not turn SETNAR into a generic agency.
11. Public communication may present custom development as a complementary offer, clearly separated from the SaaS product's capabilities. A visitor must never conclude that a custom-built capability is a SETNAR feature.

The operating rule:

> Every project will be analyzed to identify components, patterns, flows, domain models or learnings that may contribute to the platform. Not every project will produce reusable assets, and no client-specific code will be incorporated into the main product automatically.

**Scope note:** this section defines a business boundary. It does not authorize, and must not be read as authorizing, any architecture, module, or entity for the custom-development service.

---

# Product Capabilities

SETNAR's capabilities group into six durable areas. These are not phases to
complete in a fixed order — sequencing and validation gates for each one are
defined in ROADMAP.md. This section describes what each area is for,
permanently, independent of when it ships.

**This is a map of areas, not a catalogue of what exists.** Statuses below use the same three categories as *What Exists Today*, and that section prevails if the two ever disagree.

**Digital Presence** — the initial core.

- Commercial Pages — *available now*
- QR Codes — *available now*
- Professional Profile — *available now* (name, authorization identifier, phone, city; photo and social links **not implemented**)

**Analytics** — proving to the representative that their presence generates interest.

- Visits — *collected, not shown*
- Clicks — *collected, not shown*
- Sources — *collected, not shown*

**Marketing** — helping the representative generate traffic, not just receive it.

- Material Library — *future vision*
- Campaigns — *future vision*
- Smart Links — *future vision*

**Sales** — turning generated interest into a tracked opportunity.

- CRM — *future vision*
- Lead Management — *future vision* (leads are captured and their contact data is available in a minimal read-only inbox; lifecycle/status/notes and other CRM work do not exist)
- Sales Pipeline — *future vision*

**Artificial Intelligence** — reducing the representative's manual effort. Per PRODUCT_CONSTITUTION.md Core Belief 4, it may only ever assist the professional, never speak or decide as them.

- Content Generation — *future vision*
- Sales Assistant — *future vision*
- Automated Campaigns — *future vision*

**Enterprise** — serving the authorizing organization as an operator, not only as a source of catalog.

- Multi-organization operations — *future vision* (distinct from architectural multi-tenancy, which exists today — see `ROADMAP.md`)
- White Label — *future vision*
- Administration — *future vision*
- Permissions — *future vision*

---

# Product Philosophy

Every new feature must answer one question.

"Does this help our users generate more business opportunities?"

If the answer is no, the feature should not be developed.

---

# Non-Goals

SETNAR is not intended to become:

- A social network
- A website builder
- An e-commerce platform
- A CMS
- A blogging platform
- A generic CRM

These capabilities may exist only if they directly improve the Digital Office experience.

Custom development (see *Complementary Business Model*) is not an exception to this list: SETNAR may build one of these things **for a client, as a service**, without adopting it as a platform capability.

---

# Definition of Success

Success is not measured by the number of features.

Success is measured by how many professionals gain real commercial capability through SETNAR — a credible presence they use, that reaches real customers, and that produces contacts they would not otherwise have had.

Sales results depend on the professional, their market, and their offer. SETNAR is accountable for the conditions, not for guaranteeing the outcome. This distinction is what separates a defensible promise from an indefensible one, and it applies internally exactly as it applies in public communication.

Every product decision should reinforce this objective.
