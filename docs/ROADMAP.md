# ROADMAP.md

> Product Roadmap
> Version: 2.0
> Status: Active
> Authority: Level 3 — sequencing only (see `docs/README.md`)
> Product: SETNAR

---

# Purpose

This roadmap defines the strategic evolution of SETNAR.

Its objective is not to list features.

Its objective is to guide product decisions while maintaining focus on business validation, sustainable growth and long-term scalability.

Every stage exists to validate one business hypothesis.

Only after validation should the next stage begin.

## What this document may and may not decide

The roadmap decides **sequencing**: which hypothesis is tested when, under what conditions, and against what evidence.

It does **not** define the company's identity (that is `PRODUCT_CONSTITUTION.md`), the public narrative (that is `PRODUCT.md`), or domain entities (that is `DOMAIN_MODEL.md`). A capability listed here is not thereby a domain entity, a public promise, or a commitment.

**Nothing in this document authorizes implementation.** See `docs/README.md`.

---

# Product Strategy

SETNAR evolves through **six stages**. These are their official names, used identically in every heading and every reference in this document:

| # | Official name | Hypothesis being tested |
|---|---|---|
| 1 | **Validate** | Representatives will pay for a professional digital presence |
| 2 | **Optimize** | Representatives need marketing resources to generate more opportunities |
| 3 | **Sell** | Representatives need to organize the leads they receive |
| 4 | **Automate** | Automation increases representative productivity |
| 5 | **Enterprise** | Authorizing organizations need centralized administration |
| 6 | **Ecosystem** | Organizations want to distribute products through SETNAR |

Stages 1–3 are near-term and specified in concrete terms. **Stages 4–6 are strategic direction: their content is a set of candidate capabilities, not planned work.** The further a stage is from today, the less its list should be trusted as a specification and the more it should be read as "the shape the product would take if the earlier hypotheses hold."

## Stage order is governance, not dogma

The sequence exists to stop the product from building on hypotheses it never tested. It is enforced as a **decision procedure**, not as a prohibition:

- **A stage's hypothesis is not skipped.** Building Stage 3 while Stage 1's hypothesis is untested means the CRM rests on an assumption nobody checked. That is the failure the order prevents.
- **Individual capabilities may be pulled forward** when a validated need requires it — and the way to do that is to say so explicitly, in an approved execution plan, with the reason recorded. What is prohibited is drifting into a later stage without noticing.
- **Stages may overlap.** A Stage 2 capability may begin while Stage 1's last items close, provided Stage 1's hypothesis is not left unmeasured.
- **The order may be revised** if evidence contradicts it. It is a plan, and plans that cannot respond to evidence are how a roadmap becomes a liability.

The rule with no exception is narrower than "never skip a stage," and is the only one worth stating that way: **no stage's hypothesis may be declared validated without evidence.** Everything else about the ordering is a strong default that a documented decision can override.

## Confidence in this document decreases with distance

| Stage | Confidence | How to read it |
|---|---|---|
| 1 | High — partly built | Specification. Verify against `PRODUCT.md` § *What Exists Today* before building |
| 2–3 | Medium | Direction with plausible content. Requires an approved execution plan |
| 4–6 | Low | Candidate capabilities. Do not treat any item as decided |

---

# Multi-tenancy is not a stage

The one point this document needs to make, because an earlier version of it listed "Multi-Tenant" as a Stage 5 feature and thereby implied the architecture becomes multi-tenant there:

**Architectural multi-tenancy is in force now and is not scheduled by this roadmap.** It is a permanent structural constraint, defined in `ARCHITECTURE.md` § *Multi-Tenant Strategy* and derived from PRODUCT_CONSTITUTION.md Core Belief 8. Violating it is a defect at any stage, never a deferred feature.

What Stage 5 sequences is **multi-organization operations** — the operational product for authorizing organizations (institutional onboarding, administration, per-tenant policies, white label, permission management). That does not exist, and building it does not make the architecture multi-tenant; it builds a product on an architecture that already is.

Definitions of both terms: `DOMAIN_MODEL.md` § 3.

---

# STAGE 1 — VALIDATE

## Objective

Validate that independent representatives perceive enough recurring value in a Digital Office to adopt it and pay for it (see `PRODUCT.md` § *MVP Goal*).

This stage focuses on one problem: a professional digital presence a representative can distribute, that captures the interest it generates, and that shows them it worked — not on solving every commercial need a representative might have (see *Explicitly out of scope for Stage 1*, below).

---

## Business Hypothesis

Representatives need a professional digital presence — distributable and measurable, not just a page — and will pay for it.

---

## Entry condition

None — this is the first stage.

---

## Success Criteria

- First active users
- First paying customers
- Positive qualitative feedback
- Organic referrals
- **Recurring use consistent with how the product is actually meant to be used**

**Numeric thresholds exist and are approved.** `docs/plans/PILOT_SUCCESS_THRESHOLDS_PLAN.md` (Product Owner, 2026-08-12) sets 🟢/🟡/🔴 targets for Activation, Result, paid conversion, MRR, D30/D60 retention and qualitative feedback, anchored to the 30-slot founding cohort; `docs/plans/STAGE_1_KPI_SPECIFICATION.md` (2026-08-14) is the canonical definition of each metric. The numbers themselves live in those plans, not duplicated here — whether real pilot data has been evaluated against them is a separate question this reconciliation does not answer.

**"Daily usage" was removed as a criterion, deliberately.** SETNAR's product is a presence that works while the representative is doing something else: they publish a page, share a link, and the page does its job without them logging in. A representative who signs in once a month and receives leads every week is a *success*, not a retention problem. Adopting daily usage as a target would have pushed the product toward manufacturing reasons to log in — notifications, streaks, dashboards that must be checked — which is precisely the "complexity exported to the customer" that PRODUCT_CONSTITUTION.md Core Belief 9 prohibits.

The honest question is not "did they come back today?" but **"is the presence still working for them, and would they miss it if it stopped?"** Until that can be measured, it stays qualitative.

---

## Exit condition

Stage 1 is complete when, at minimum:

1. Representatives can publish and share their pages without assistance — **met**;
2. the product can charge, and can measure who paid — **met** (Asaas hosted checkout, webhook and the Subscription record; see `PRODUCT.md` § *MVP Goal*). No in-product view surfaces it to a representative or the founder yet — see *Still open*;
3. representatives can see that their presence produces results — **met** (visits, WhatsApp clicks and leads shown per Product in `/app/paginas`, SET-37/ADR-082);
4. there is qualitative evidence that they consider it worth paying for — **pending**. Criteria and thresholds are defined (`docs/plans/PILOT_SUCCESS_THRESHOLDS_PLAN.md`); whether real pilot data meets them has not been evaluated in this reconciliation.

Items 2 and 3 are now met; advancing to Stage 2 while item 4 is still pending would mean optimizing a hypothesis before the qualitative evidence for it exists.

---

## Risks

- **Measuring the wrong thing.** Billing and basic statistics both exist now, but no representative- or founder-facing view of business metrics (paying customers, MRR, churn) does — the payment hypothesis is still read from the database directly, not from an in-product read path (see *Still open*).
- **Single-organization bias.** Everything validated so far was validated with one authorizing organization, one catalog, one market.
- **Third-party brand dependency, resolved for the current scope.** The Product Owner confirmed the iGreen brand authorization for the seven Commercial Pages on 2026-08-13 (`PRODUCT.md` § *Brand authorization — current status*); it remains scoped to that controlled surface, not a blanket permission.

---

## Explicitly out of scope for Stage 1

CRM; campaigns; the full Material Library (a minimal, already-shipped slice of 21 personalized materials was pulled forward into this stage as its own distribution mechanism — see § *Authenticated application*, below; campaign creation, a visual editor, user-generated artwork and upload remain out of scope); artificial intelligence; advanced analytics; multi-organization administration; white label; marketplace; public APIs; and any capability from Stages 2–6.

---

## Capabilities

Status verified against the working tree based on commit `b1cd1da` on 2026-08-27 (SET-88). `PRODUCT.md` § *What Exists Today* is the authority; this list is the sequencing view of the same facts.

### Authentication — **done**

- Login, logout, password recovery

---

### Representative Profile — **partly done**

- Public name — done; prefilled from account name during onboarding and independently editable afterward
- Commercial phone — done; mandatory for new writes and profile edits, with an explicit correction path for legacy rows
- City — done
- Authorization identifier — done
- E-mail — done (identity, from the account)
- **Profile photo — not implemented**
- **Social links — not implemented**

---

### Organizations and Catalog — **done for the MVP's purposes, by seed**

- The authorizing organization and its products exist, seeded by migration
- Product activation and deactivation by the representative — done
- **No self-service registration, branding or settings interface for organizations.** That is Stage 5 (multi-organization operations), not Stage 1

---

### Commercial Pages — **done**

- One page per (representative × product)
- Authorized-representative identification and per-product compliance notice
- Responsive design
- WhatsApp CTA and lead capture form
- Public address: subdomain-and-path, per (representative × product) — canonical current format and its ADR trail in `PRODUCT.md` § *What Exists Today* and [`ADR-092`](adr/ADR-092-endereco-publico-da-commercial-page-passa-a-incluir-a-company.md); do not restate the format here, it has changed once already

---

### QR Codes — **done**

- Automatic generation, download, copy link

---

### Analytics (Basic) — **done**

- Visits — recorded
- WhatsApp clicks — recorded
- Referrer source — recorded, not yet surfaced as a breakdown (Stage 2). Any future lightweight per-visit origin/channel signal stays this stage's concern only while it remains a single untracked value with no Campaign entity or lifecycle attached — see Stage 2 § *Campaign Links*
- Leads — recorded (Lead Capture, above)
- Read path: visits, WhatsApp clicks and leads shown per Product, per 7/30-day window, in `/app/paginas` (SET-37/ADR-082)
- **No breakdown by referrer, device or city, and no conversion rate.** That is Advanced Analytics, Stage 2 — not this capability

---

### Authenticated application — **partly done**

- App Shell, responsive navigation, account and pages routes — done
- Products, links, QR Codes — done in `/app/paginas`
- Read-only delivery of captured contacts — done in `/app/contatos` (SET-77/ADR-087); this does not activate CRM lifecycle
- Basic statistics — done in `/app/paginas` (SET-37/ADR-082)
- 21 downloadable marketing materials (7 products × Post/Story/Poster), personalized and gated by the same publication rule — done in `/app/divulgacao/biblioteca` (SET-65/ADR-090; moved here from `/app/paginas/marketing` by ADR-094). Pulled forward from Stage 2's Material Library, below, as the distribution mechanism this stage's own hypothesis needs — see `MARKETING_MATERIALS_PLAN.md` §0 for the recorded reason. Scoped to exactly these 21 existing pieces, not the full Material Library

---

### Subscription / billing — **done**

- Subscription lifecycle (hosted checkout, authenticated/idempotent webhook, representative-initiated cancellation, 30-day free trial, manual reconciliation) — done; see `PRODUCT.md` § *MVP Goal* for the current billing state
- Enforcement when a Commercial Page is published and when it is served, through the same Subscription rule — done
- **A representative- or founder-facing view of who paid, MRR or churn — not implemented.** The Subscription record itself can answer whether a trial converted; there is no in-product read path for it (`PRODUCT.md` § *Success Metrics*) — see *Still open*

---

## Definition of Done

A representative can:

Create an account

↓

Configure profile

↓

Activate products

↓

Subscribe (checkout, trial or paid)

↓

Share pages

↓

Receive leads

↓

Track basic statistics

**All seven steps are met at this baseline** — see `PRODUCT.md` § *What Exists Today* (SET-37/ADR-082 for statistics) and § *MVP Goal* (the Asaas billing lifecycle for the Subscribe step). What is not yet met: nothing in the product itself surfaces whether a trial actually *converted* to paid — the stage's real hypothesis — that still has to be read from the database directly (see *Still open*).

---

## Still open in Stage 1

| Item | Where it is tracked |
|---|---|
| Profile photo and social links | No plan — undecided whether Stage 1 needs them |
| Representative-/founder-facing view of business metrics (paying customers, MRR, churn) beyond the existing manual runbook | `docs/plans/ANALYTICS_DATA_LAYER_METABASE_READINESS.md` (D8–D12 approved 2026-08-14, not yet built) |
| Whether real pilot data meets the approved success thresholds | `docs/plans/PILOT_SUCCESS_THRESHOLDS_PLAN.md` — thresholds exist; evaluating real data against them was not part of this reconciliation |

---

# STAGE 2 — OPTIMIZE

## Objective

Increase representative productivity.

---

## Business Hypothesis

Representatives need marketing resources to generate more opportunities.

---

## Entry condition

Stage 1's exit condition met — in particular, that representatives can already **see** the results of the presence they have. Optimizing traffic for a representative who cannot measure their current traffic tests nothing.

---

## Success Criteria

Higher engagement

Higher retention

Higher page sharing

No thresholds defined. To be set by the Product Owner when the stage is entered.

---

## Exit condition

Representatives can measure the performance of a specific marketing effort and act on what they measure.

---

## Risks

- Adding marketing surface before Stage 1's core is complete dilutes the validation.
- The material library depends on the authorizing organization supplying approved assets — an external dependency, not an engineering one.

---

## Out of scope

CRM lifecycle and lead working state — status, notes, tasks, pipeline, assignment or mutation — remain Stage 3; any automation remains Stage 4. The Stage 1 read-only delivery of already captured contact data is explicitly not CRM (SET-77/ADR-087).

---

## Candidate capabilities, subject to validation

### Material Library

- Images
- Videos
- PDFs
- Presentations

**A minimal slice — 21 static, pre-designed pieces, personalized and downloadable, no campaigns/editor/upload/analytics of its own — was pulled forward into Stage 1** as the distribution mechanism for that stage's own hypothesis (SET-65/ADR-090, `MARKETING_MATERIALS_PLAN.md`). What remains here, genuinely Stage 2, is the rest: campaign creation, a visual editor, user-generated artwork, video/PDF/presentation formats, an open template library, upload.

---

### Campaign Links

Create campaign-specific URLs, backed by a Campaign entity with its own lifecycle (creation, editing, reporting across links). This is a different capability from tagging where a single visit entered from — a lightweight, per-visit origin signal with no Campaign entity and no lifecycle remains Stage 1 scope (see Stage 1 § *Analytics (Basic)*), not evidence that Campaigns exist.

---

### Smart QR Codes

Track campaign performance — requires the Campaign entity above. A QR Code carrying only a per-visit origin tag, with no campaign behind it, is not this capability.

---

### Advanced Analytics

Visitors

Unique visitors

Devices

Cities

Traffic sources

Conversion rates

---

### Profile Improvements

Professional bio

Business hours

Contact methods

Social media

---

## Definition of Done

Representatives can measure and improve their marketing performance.

---

# STAGE 3 — SELL

## Objective

Transform visitors into managed sales opportunities.

---

## Business Hypothesis

Representatives need to organize incoming leads.

---

## Entry condition

Enough lead volume flowing through the product that organizing it is a real problem for real representatives — not an assumed one.

---

## Success Criteria

Lead management usage

Higher conversion

Longer retention

No thresholds defined.

---

## Exit condition

Representatives manage their commercial pipeline without external software, by choice rather than by obligation.

---

## Risks

- PRODUCT.md lists "a generic CRM" as a non-goal. A Stage 3 CRM is justified only as a way to work the leads SETNAR itself produces — the moment it becomes a general-purpose CRM, it has broken a product principle.
- Storing lead data raises data-protection obligations beyond what the product handles today.

---

## Out of scope

Automation and AI (Stage 4); organization-level pipeline visibility (Stage 5).

---

## Candidate capabilities, subject to validation

### CRM

Lead registration

Pipeline

Status

Notes

Tasks

---

### Sales Pipeline

New

Contacted

Negotiation

Won

Lost

---

### Lead Timeline

Activity history

Interaction log

Reminders

---

### Contact Management

Search

Tags

Filters

Segments

---

## Definition of Done

Representatives manage their commercial pipeline without external software.

---

# STAGE 4 — AUTOMATE

## Objective

Reduce manual work.

---

## Business Hypothesis

Automation increases productivity.

---

## Entry condition

Stage 3 validated: there is a real, recurring manual workload that automation would remove. Automating a workflow nobody performs is waste.

---

## Success Criteria

To be defined. No evidence exists yet on which to base a target.

---

## Exit condition

Representatives automate repetitive marketing activity without losing control of what is said in their name.

---

## Risks

- **Constitutional limit.** PRODUCT_CONSTITUTION.md Core Belief 4: automation amplifies the professional and never substitutes their identity or their decisions. Anything that speaks, decides, or acts *as* the representative is prohibited regardless of its measured performance.
- Promising AI before it exists is explicitly prohibited by `PRODUCT.md` § *Limits of public communication*.

---

## Out of scope

Anything that publishes, replies, or negotiates without explicit representative approval.

---

## Candidate capabilities, subject to validation

**Low confidence. None of the following is decided.**

### Artificial Intelligence

Post generation

Sales copy

Call-to-actions

Campaign ideas

Product descriptions

---

### Smart Assistant

Sales suggestions

Optimization recommendations

Performance insights

---

### Workflow Automation

Lead reminders

Automatic follow-up

Notifications

Scheduled actions

---

### Smart Recommendations

Inactive products

Low-performing pages

Suggested improvements

---

## Definition of Done

Representatives automate repetitive marketing activities.

---

# STAGE 5 — ENTERPRISE

## Objective

Support organizations managing distributed sales teams.

---

## Business Hypothesis

Authorizing organizations need centralized administration.

---

## Entry condition

More than one authorizing organization actually wants to operate on SETNAR, and the model has been proven with the first one (PRODUCT_CONSTITUTION.md, Core Belief 6).

---

## Success Criteria

To be defined.

---

## Exit condition

An authorizing organization manages its representatives from one platform, without SETNAR operating it on their behalf.

---

## Risks

- Serving the organization at the representative's expense. PRODUCT_CONSTITUTION.md Core Belief 7: both sides are being served and their interests are not automatically aligned.
- Building enterprise administration before a second organization exists would be inventing a customer.

---

## Out of scope

Product distribution and marketplace (Stage 6).

---

## Candidate capabilities, subject to validation

**Low confidence. None of the following is decided.**

### Multi-organization Operations

Institutional onboarding of an organization

Administration surface for organizations

Per-tenant policies

**This is not where SETNAR becomes multi-tenant.** The architecture is already tenant-isolated and organization-agnostic — see *Multi-tenancy* above. What this stage adds is the operational product for an organization, on top of that existing architecture.

---

### White Label

Custom domains

Branding

Themes

Company identity

---

### Permission System

Roles

Permissions

Departments

Teams

---

### Administration

User management

Company settings

Billing

Reports

---

## Definition of Done

Organizations manage their representatives from one platform.

---

# STAGE 6 — ECOSYSTEM

## Objective

Turn SETNAR into a commercial platform.

---

## Business Hypothesis

Organizations want to distribute products directly through SETNAR.

---

## Entry condition

Multiple organizations operating on the platform, with demonstrated demand to reach each other's representatives.

---

## Success Criteria

To be defined.

---

## Exit condition

To be defined when the stage becomes real.

---

## Risks

- Opening a platform to third parties transfers part of the compliance guarantee to people SETNAR does not control — directly in tension with PRODUCT_CONSTITUTION.md Core Belief 2.
- Public APIs are close to irreversible: once published, they constrain every later internal decision.

---

## Direction, not specification

**This stage is intentionally described only by its objective.** The earlier version listed seven named capabilities — marketplace, partner portal, product distribution, API integrations, third-party applications, developer platform, public APIs — with enough specificity to read as a plan. That precision was false: nothing about this stage has been decided, and naming its components invites someone to start designing for them.

What is retained is the objective: **enabling organizations to reach representatives, and representatives to reach products, beyond a single organization's own catalog.**

How that would happen — whether through distribution, a marketplace, an open API, partnerships, or something that does not exist yet — is deliberately left open. It will be decided when there is evidence to decide it with, and the shape of the answer should be determined by that evidence rather than by a list written years earlier.

---

## Intended outcome

SETNAR becomes infrastructure other commercial ecosystems build on.

Stated as a direction, not as a definition of done: a stage this far out has no meaningful completion criteria yet.

---

# Release Strategy

Every release must satisfy:

Small scope

Fast delivery

Low risk

Easy rollback

Continuous validation

Never accumulate large releases.

---

# Prioritization Framework

Every feature receives a priority.

P0

Critical

Must exist.

---

P1

Important

Strong business value.

---

P2

Useful

Improves experience.

---

P3

Future

No immediate impact.

---

# Decision Framework

Every new feature must answer:

Does it increase revenue?

Does it increase retention?

Does it improve representative productivity?

Does it reduce operational cost?

If the answer is "No" to all four questions, the feature should not be prioritized.

---

# Product KPIs

The indicators SETNAR intends to steer by. **Listing one here does not mean it is measured today** — most are not, and several depend on capabilities that do not exist. `PRODUCT.md` § *Success Metrics* records the current instrumentation status.

Business

MRR

ARR

Churn

Retention

Expansion Revenue

CAC

LTV

---

Product

Daily Active Users

Monthly Active Users

Commercial Pages Published

QR Codes Generated

WhatsApp Click Rate

Lead Conversion

Campaign Performance

---

Technical

Availability

Performance

Response Time

Deployment Frequency

Bug Rate

Test Coverage

---

# Roadmap Governance

The roadmap is a living document.

It evolves according to:

Customer feedback

Market changes

Business opportunities

Validated learning

Proof that the model already works for the organization currently served — expansion to a new authorizing organization or category never substitutes for that proof (PRODUCT_CONSTITUTION.md, Core Belief 6).

Roadmaps should never be driven by assumptions alone.

---

# Product Vision

The long-term vision of SETNAR is clear:

From

A platform validated for one authorizing organization and one category of representation.

To

The infrastructure layer every authorizing organization relies on, across every category of authorized independent representation.

Every release should move the product closer to that vision.

---

# Final Principle

Do not build features.

Build capabilities.

Do not chase complexity.

Deliver value.

Every version of SETNAR must be more useful than the previous one without becoming more difficult to use.
