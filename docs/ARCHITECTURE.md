# ARCHITECTURE.md

> Software Architecture
> Version: 2.0
> Status: Active
> Authority: Level 5 — structure (see `docs/README.md`)
> Product: SETNAR

---

# Purpose

## Signup phone boundary

The auth Server Action validates the masked Brazilian value and normalizes it
through `shared/domain/br-phone` before calling the auth gateway. Supabase Auth
metadata is only the atomic carrier into `handle_new_user`; the trigger copies
a valid E.164 value to nullable `profiles.phone`. Authenticated application
reads are owner-scoped by `profiles_select_own`. Public pages and professional
settings never read this snapshot: after onboarding they use only
`representatives.phone`.

This document defines the **structure** of SETNAR: its modules, layers, boundaries, dependencies, integration rules, tenant isolation and architectural security posture.

This document is subordinate to PRODUCT_CONSTITUTION.md. Where a technical decision here appears to conflict with a principle stated there, the Constitution prevails and this document must be revised.

## Scope boundary with ENGINEERING_GUIDELINES.md

Architecture decides what may depend on what. Engineering guidelines decide how code is written day to day. They are different documents on purpose, and duplicating a rule across both guarantees they will diverge.

| Belongs here | Belongs in ENGINEERING_GUIDELINES.md |
|---|---|
| Modules and their boundaries | Naming conventions |
| Layers and the dependency rule | File and function size |
| Integration and communication patterns | Comments, imports, formatting |
| Tenant isolation | Logging practice and levels |
| Structural security | Review checklist, PR practice |
| Infrastructure and scaling | Test writing practice |
| Decisions that are hard to reverse | Choices reversible in one commit |

Where this document previously restated day-to-day rules, it now references instead. **If both documents appear to state the same rule, this one is the defect** — day-to-day practice has a single home.

Every contributor must follow these guidelines to ensure consistency, maintainability, scalability and simplicity.

Architecture is a long-term asset.

Complexity is technical debt.

---

# Core Philosophy

SETNAR follows one fundamental principle:

> Build the simplest architecture capable of supporting future growth.

We prioritize:

- Maintainability
- Predictability
- Low operational cost
- High developer productivity
- Vertical scalability first
- Horizontal scalability only when required

Never optimize for imaginary problems.

---

# Architectural Principles

Every architectural decision must satisfy the following principles.

## KISS

Keep It Simple.

Simple software survives.

Complex software fails.

---

## YAGNI

You Aren't Gonna Need It.

Never implement functionality before there is real demand.

---

## SOLID

All modules should follow SOLID principles whenever applicable.

---

## DRY

Avoid duplicated business logic.

Every business rule should have a single source of truth.

---

## Clean Architecture

Business rules must never depend on frameworks.

Frameworks are implementation details.

---

# High-Level Architecture

The system is organized into four independent layers.

```
┌──────────────────────────────┐
│        Presentation          │
├──────────────────────────────┤
│        Application           │
├──────────────────────────────┤
│          Domain              │
├──────────────────────────────┤
│      Infrastructure          │
└──────────────────────────────┘
```

---

# Layer Responsibilities

## Presentation

Responsible for:

- UI
- Components
- Routing
- Forms
- Client validation

Must never contain business rules.

---

## Application

Responsible for:

- Use Cases
- Services
- Orchestration
- Authorization
- Business workflows

Contains application logic.

---

## Domain

The heart of SETNAR.

Contains:

- Entities
- Value Objects
- Domain Services
- Business Rules

Must have zero dependency on frameworks.

---

## Infrastructure

Responsible for:

- Database
- Authentication
- Storage
- APIs
- Logging
- Cache
- Email
- External Services

Everything replaceable belongs here.

---

# Architectural Style

Modular Monolith

The project intentionally starts as a Modular Monolith.

Reasons:

- Faster development
- Lower complexity
- Easier deployment
- Lower infrastructure cost
- Easier debugging

Microservices are explicitly prohibited until justified by real scaling needs.

---

# System Modules

SETNAR is divided into independent modules.

Each module owns its own business rules.

**The list below is the reserved module map, not the current codebase.** Modules exist when a validated capability needs them — creating an empty module for a Conceptual capability is exactly the premature structure YAGNI forbids. Naming a module here is not authorization to scaffold it.

**The map is not a one-to-one mirror of `src/modules/`, and must not be read as one.** Two things make the correspondence loose in both directions, permanently:

- **Some real modules are not business domains at all.** `tenancy` (which organization is this request for) and `marketing` (the institutional landing's content) exist in code and correspond to no Bounded Context, because they are not business capabilities — one is request-scoped infrastructure, the other is a surface. They are legitimate and they will not appear in this map.
- **One real module can carry several contexts.** `representatives` currently holds Representative Management, Product Activation, the Commercial Page presentation, and compliance notices. Splitting it into four modules to satisfy a diagram would fragment code that changes together.

Within the Commercial Page presentation, the seven seeded Products deliberately
use independent React/CSS subtrees (ADR-089). This is presentation isolation,
not seven domain modules: Host/slug resolution, Lead security, analytics,
metadata and compliance remain shared module capabilities. Presentational
markup may be repeated for template fidelity; business rules may not.

A module boundary is drawn where code changes together, not where the domain vocabulary draws a line. When the two coincide, prefer the same name; when they do not, the code's boundary wins and the difference is recorded here rather than hidden.

```
Modules

Authentication

Companies

Catalogs

Products

Users

Commercial Pages

Analytics

Media Library

Campaigns

CRM

AI

Billing

Administration
```

Each module should expose services rather than internal implementation.

---

# Dependency Rule

Dependencies must always point inward.

```
UI

↓

Application

↓

Domain

↓

Infrastructure
```

Never invert this flow.

---

# Folder Structure

```
src/

app/

modules/

auth/

companies/

catalog/

products/

users/

pages/

analytics/

crm/

campaigns/

shared/

domain/

application/

infrastructure/

presentation/

config/

types/

utils/
```

Folders should represent business domains rather than technical concerns.

**This is the shape a folder takes when it is created, not a set of folders to create.** Several of the module folders above do not exist, because the capabilities they would hold do not exist. A module directory is created by the first feature that needs it — an empty `crm/` or `campaigns/` folder scaffolded in advance is structure without content, and it makes the codebase look like it does more than it does.

---

# Shared Layer

Shared code must contain only:

- reusable utilities
- reusable UI components
- shared types
- generic helpers

Business rules must never live inside shared.

---

# Business Rule Isolation

Every business rule belongs to exactly one module.

Example:

QR Code rendering (derived from a Commercial Page's address, not a stored artifact — `DOMAIN_MODEL.md` § 8.7) belongs to:

Commercial Pages

Not:

Shared

---

# State Management

Prefer local state.

Use global state only when necessary.

Global state should contain only:

- authenticated user
- company
- theme
- session

Never store business data globally without reason.

---

# Database Philosophy

The database must reflect business concepts.

Never optimize the schema prematurely.

Tables should represent domains.

Not screens.

---

# API Philosophy

REST-first architecture.

Predictable endpoints.

Consistent naming.

Stateless communication.

Future GraphQL adoption must not require rewriting business logic.

---

# Authentication

Authentication must remain isolated.

Business modules should never know how authentication works.

They only receive the authenticated user.

---

# Authenticated Application Shell

Every `/app/*` route is protected server-side by `src/app/app/layout.tsx`; middleware refreshes sessions but is not the authorization boundary. The shared layout owns only session resolution, responsive navigation and the page frame. Route-specific data stays with its consumer:

- `/app/paginas` loads onboarding, catalog, activations, publication links and QR Codes;
- `/app/paginas/marketing` renders the 21 personalized marketing materials as a nested destination alongside Pages, gated by the same publication rule (SET-65/ADR-090) — see `PRODUCT.md` for what it delivers;
- `/app/contatos` reads the Representative's immutable Lead projection through a request-scoped authenticated client and existing owner RLS; it is not a CRM write surface;
- `/app/conta` loads the Representative profile and current access e-mail;
- `/app` redirects to `/app/paginas` and owns no duplicated overview.

Infrastructure failures throw into the authenticated error boundary. A missing Representative and a legitimate empty catalog remain explicit domain states, never fallback values for failed queries. See ADR-066.

---

# Authorization

Authorization must be permission-based.

Never hardcode roles.

Future permission system must allow:

Company

↓

Role

↓

Permission

↓

Action

---

# Multi-Tenant Strategy

**Architectural multi-tenancy is in force now, not scheduled.** The system is tenant-isolated and organization-agnostic from the first commit, and any code that assumes a single Company is a defect at any stage.

This is distinct from **multi-organization operations** — the enterprise product for authorizing organizations (institutional onboarding, administration surfaces, per-tenant policies, white label), which does not exist and is a candidate capability in `ROADMAP.md` Stage 5. Stage 5 does not make the architecture multi-tenant; it builds a product on an architecture that already is.

Structurally, the constraint derives from PRODUCT_CONSTITUTION.md Core Belief 8 and requires:

- every business row scoped to exactly one Company;
- resolution of the tenant server-side, per request, through a port (ADR-001);
- organization-specific rules held in configuration or in an isolated adapter, never in the core domain;
- a domain vocabulary that describes the thousandth organization as naturally as the first.

Hierarchy:

Company

↓

Catalog

↓

Product

↓

Representative

↓

Commercial Page

All data must be scoped by Company.

No module should assume a single company.

Representative resolution — which Representative owns the Commercial Page
being served — is a second, nested resolution problem, one level inside the
Company already resolved by [`ADR-001`](adr/ADR-001-tenant-resolution-by-host-header-in-the-application.md)'s
`Host`-based tenant resolution. **This is now implemented** and followed the
intended shape: a separate repository port (`RepresentativeRepository`,
[`ADR-031`](adr/ADR-031-resolucao-de-representative-e-um-port-novo-representativerepository.md)),
resolved server-side from the request, one level deeper than the Company
resolution rather than a new mechanism. The URL scheme (subdomain per
representative) is decided in
[`ADR-026`](adr/ADR-026-representative-pages-resolve-by-subdomain-slugdomain-not-by.md).

The public address itself carries a third label: `<representative>.<company>.setnar.com`
([`ADR-092`](adr/ADR-092-endereco-publico-da-commercial-page-passa-a-incluir-a-company.md)).
This is **not** a third tier of tenant resolution — the Company label is
validated against `RepresentativeRepository`'s own data (the Company a
Product Activation's Product belongs to), never used to look up a
`TenantRepository` entry. `Tenant`, `Company`, and `Representative` remain
three distinct concepts: Tenant resolution (ADR-001) still runs first and
alone decides which known root domains exist; Company only ever
participates as a label to be matched, one level inside that root, never as
a second Tenant.

---

# Scalability Strategy

Current Stage

Single Application

↓

Single Database

↓

Single Deployment

↓

Single Storage

Future

Application scaling

↓

Database optimization

↓

Background workers

↓

Distributed cache

↓

Microservices only if required

Scaling must happen incrementally.

---

# Performance Goals

Time to Interactive

< 2 seconds

Largest Contentful Paint

< 2.5 seconds

API Response

< 300 ms

Build Time

As small as possible.

---

# Error Handling — architectural contract

The structural rule, not the practice:

**A module's failures are part of its interface.** Every module validates its own inputs at its boundary, handles its own failures, and returns predictable, typed outcomes to its callers. Internal implementation detail — provider error codes, stack traces, storage specifics — must never cross a module boundary or reach a client.

A caller must never have to know *how* a module failed in order to handle *that* it failed.

How errors are written, surfaced and worded day to day: `ENGINEERING_GUIDELINES.md`.

---

# Observability — architectural contract

Meaningful business and operational events must be observable at the boundary where they occur, and a single event must not be logged again at every layer it passes through. Sensitive data never enters a log at any layer.

Levels, formats and everyday practice: `ENGINEERING_GUIDELINES.md` § *Logging*.

---

# Security — architectural posture

Structural security decisions, which are hard to reverse:

- **Trust boundaries are explicit.** Client input is untrusted at every entry point; validation happens server-side regardless of any client-side validation.
- **Authorization is enforced where the data lives**, not only in the UI that requests it. A read path that is safe only because no interface exposes it is not safe.
- **Tenant isolation is a security boundary**, not merely a data-modelling one — see Multi-Tenant Strategy.
- **Secrets never reach the client bundle** and never enter version control.
- OWASP recommendations are the baseline for structural choices.

Everyday secure-coding practice — escaping, sanitizing, upload validation, dependency hygiene: `ENGINEERING_GUIDELINES.md` § *Security*.

---

# Compliance

Compliance is non-negotiable infrastructure, per PRODUCT_CONSTITUTION.md (Core Belief 2) — not a facet of Security.

Any public surface that makes a claim on behalf of an Authorizing Organization must have a resolvable compliance mechanism before it can publish.

`ProductComplianceNotice` (ADR-055) is the existing reference implementation of this rule in code.

---

# Testability — architectural requirement

The architectural obligation is that **business rules must be testable without infrastructure**. That is the point of the dependency rule: a domain that depends on no framework can be verified without a database, a network, or a browser. An architecture that forces integration tests to verify a business rule has failed, regardless of how many tests pass.

Test priorities, coverage expectations and how tests are written: `ENGINEERING_GUIDELINES.md` § *Testing Strategy*.

---

# Documentation — architectural governance

Two rules belong to architecture rather than to practice:

- **A decision that is permanent, structural, hard to reverse, or cross-cutting requires an ADR** before or alongside the code that implements it. ADRs live in [`docs/adr/`](adr/README.md), one numbered series. Small and stylistic choices do not get an ADR.
- **A module's public surface is documented at its boundary** — a module whose contract can only be learned by reading its internals has no real boundary.

Documentation explains intent; code explains implementation.

---

# Technology Philosophy

Frameworks are replaceable.

Business rules are not.

Never couple business logic to framework-specific APIs.

---

# Definition of Good Architecture

Good architecture is invisible.

Developers should spend their time implementing business value rather than understanding the codebase.

If adding a new feature feels difficult, the architecture has failed.

---

# Final Principle

SETNAR should remain understandable by a new developer after years of continuous development.

The best architecture is not the most sophisticated.

The best architecture is the one that allows the product to evolve with confidence.
