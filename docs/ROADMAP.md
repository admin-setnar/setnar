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

Validate that independent representatives are willing to pay for a Digital Office.

This stage focuses exclusively on solving one problem:

Professional Digital Presence.

---

## Business Hypothesis

Representatives need a professional way to present themselves and their products online, and will pay for it.

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

**No numeric target has been set for any of these.** They are qualitative validation markers until the Product Owner defines thresholds. Inventing numbers here would be worse than leaving them open.

**"Daily usage" was removed as a criterion, deliberately.** SETNAR's product is a presence that works while the representative is doing something else: they publish a page, share a link, and the page does its job without them logging in. A representative who signs in once a month and receives leads every week is a *success*, not a retention problem. Adopting daily usage as a target would have pushed the product toward manufacturing reasons to log in — notifications, streaks, dashboards that must be checked — which is precisely the "complexity exported to the customer" that PRODUCT_CONSTITUTION.md Core Belief 9 prohibits.

The honest question is not "did they come back today?" but **"is the presence still working for them, and would they miss it if it stopped?"** Until that can be measured, it stays qualitative.

---

## Exit condition

Stage 1 is complete when, at minimum:

1. Representatives can publish and share their pages without assistance — **met**;
2. the product can charge, and can measure who paid — **not met** (see *Still open*);
3. representatives can see that their presence produces results — **not met** (statistics collected, never shown);
4. there is qualitative evidence that they consider it worth paying for — **pending**.

Advancing to Stage 2 with items 2 and 3 open would mean optimizing a hypothesis that was never measured.

---

## Risks

- **Measuring the wrong thing.** Without billing and without visible statistics, the payment hypothesis is judged on impressions rather than evidence.
- **Single-organization bias.** Everything validated so far was validated with one authorizing organization, one catalog, one market.
- **Third-party brand dependency.** Visual identity on generated pages is blocked on an authorization SETNAR does not control (`COMMERCIAL_PAGE_CONTENT_PLAN.md` § 3.3).

---

## Explicitly out of scope for Stage 1

CRM; campaigns; material library; artificial intelligence; advanced analytics; multi-organization administration; white label; marketplace; public APIs; and any capability from Stages 2–6.

---

## Capabilities

Status verified against the Parte 2 working tree based on commit `df8db50` on 2026-08-06. `PRODUCT.md` § *What Exists Today* is the authority; this list is the sequencing view of the same facts.

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
- URL: `<representative-slug>.<domain>` — subdomain per representative, not a path ([`ADR-026`](adr/ADR-026-representative-pages-resolve-by-subdomain-slugdomain-not-by.md))

---

### QR Codes — **done**

- Automatic generation, download, copy link

---

### Analytics (Basic) — **collected, not delivered**

- Visits — recorded
- WhatsApp clicks — recorded
- Referrer source — recorded
- **No read path and no interface. The representative cannot see any of it.** Until that closes, this capability delivers nothing to the user it exists for

---

### Authenticated application — **partly done**

- App Shell, responsive navigation, account and pages routes — done
- Products, links, QR Codes — done in `/app/paginas`
- **Basic statistics — not implemented**

---

### Subscription / billing — **partly done, and it is the gate on this whole stage**

- Subscription record — done
- Enforcement when a Commercial Page is served — done
- Enforcement at publication time — done, using the same Subscription rule as public read
- **Payment gateway, billing flow, automated lifecycle — not implemented.** Activation is manual

---

## Definition of Done

A representative can:

Create an account

↓

Configure profile

↓

Activate products

↓

Share pages

↓

Receive leads

↓

Track basic statistics

**Currently met through "receive leads."** The final step is not met: statistics are recorded and never displayed. And "pay" is absent from this flow entirely, even though it is the stage's actual hypothesis.

---

## Still open in Stage 1

| Item | Where it is tracked |
|---|---|
| Show visit/click statistics to the representative | `docs/plans/QR_ANALYTICS_PLAN.md` AN6 |
| Analytics retention/purge | `docs/plans/QR_ANALYTICS_PLAN.md` AN7 |
| Manual subscription activation/reactivation | `docs/plans/SPRINT_E_PLAN.md` E3 |
| Profile photo and social links | No plan — undecided whether Stage 1 needs them |
| Payment gateway | No plan — the largest gap in the stage's own hypothesis |
| iGreen brand authorization | `docs/plans/COMMERCIAL_PAGE_CONTENT_PLAN.md` CP1 |

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

CRM and lead working (Stage 3); any automation (Stage 4).

---

## Candidate capabilities, subject to validation

### Material Library

- Images
- Videos
- PDFs
- Presentations

---

### Campaign Links

Create campaign-specific URLs.

---

### Smart QR Codes

Track campaign performance.

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
