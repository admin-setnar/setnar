# ENGINEERING_GUIDELINES.md

> Engineering Guidelines
> Version: 2.0
> Status: Active
> Authority: Level 7 — everyday practice (see `docs/README.md`)
> Product: SETNAR

---

# Purpose

This document defines the everyday engineering standards adopted by SETNAR: how code is written, reviewed, tested, named and operated.

This document is subordinate to PRODUCT_CONSTITUTION.md. Where a technical decision here appears to conflict with a principle stated there, the Constitution prevails and this document must be revised.

**Structure is not decided here.** Modules, layers, boundaries, dependencies, tenant isolation and architectural security belong to `ARCHITECTURE.md`. If a rule concerns what may depend on what, it belongs there, not here.

## How to read the rules in this document

Three kinds of statement, used deliberately and distinguished by wording:

- **Must** — an invariant. Breaking it is a defect, with no case-by-case judgement.
- **Should** — a strong default. Deviating requires a reason, stated in the pull request or in a comment.
- **May** — a permitted option, with no obligation either way.

A numeric threshold in this document is a **review trigger**, not a pass/fail gate: crossing it means "look at this and justify it," never "this is automatically wrong."

Every contributor, whether human or AI, must follow these guidelines.

Consistency is more important than personal preference.

The codebase should feel as if it was written by a single experienced engineer.

---

# Engineering Philosophy

Software should be:

Simple.

Predictable.

Maintainable.

Scalable.

Readable.

Well documented.

The objective is not to write clever code.

The objective is to write software that another engineer can understand in five minutes.

---

# Product First

Engineering exists to serve the product.

Never implement technology for the sake of technology.

Business value always comes first.

When in doubt:

Choose the simplest implementation.

---

# Engineering Principles

Every implementation must follow:

KISS

Keep It Simple.

---

YAGNI

Do not build features that are not required.

---

DRY

Never duplicate business logic.

---

SOLID

Apply SOLID whenever it increases clarity.

Do not force abstractions.

---

Composition over inheritance.

Prefer small reusable modules.

---

Readable code beats clever code.

---

# Naming Conventions

Folders

kebab-case

```
commercial-pages
```

Files

kebab-case

```
create-user.ts

page-card.tsx

generate-qrcode.ts
```

React Components

PascalCase

```
CommercialCard

ProfileAvatar

QRCodeButton
```

Functions

camelCase

```
createUser()

generateQRCode()

publishCommercialPage()
```

Variables

camelCase

```
userProfile

companyId

campaignLink
```

Constants

UPPER_SNAKE_CASE

```
MAX_UPLOAD_SIZE

DEFAULT_PAGE_SIZE
```

Enums

PascalCase

```
UserStatus

CampaignType
```

Interfaces

PascalCase

```
User

Company

CommercialPage
```

Types

PascalCase

```
Representative

AnalyticsData
```

---

# Folder Organization

Every business domain owns its files.

Never organize by file type.

Correct

```
modules/

users/

pages/

analytics/

companies/
```

Wrong

```
controllers/

services/

repositories/

hooks/

helpers/
```

Business comes first.

---

# File and Function Size

These are heuristics, not limits. **Size on its own is never a defect.**

- A file beyond roughly **300 lines** should be reviewed for cohesion: is it still one responsibility?
- A function beyond roughly **40 lines** should be reviewed for whether it is doing more than one thing.

Both questions are about responsibility, not about line count. A long, cohesive, linear function that reads top to bottom is better than three short functions that only exist to satisfy a number — splitting for the metric's sake makes code harder to follow while appearing to comply.

Conversely, a 60-line file doing three unrelated things should be split even though it is well under the threshold.

The rule that does hold without exception: **every function should solve one problem**, and a reviewer should be able to name that problem in one sentence.

---

# Component Size

React components should remain focused.

If a component becomes difficult to understand:

Split it.

---

# Comments

Comments explain WHY.

Never explain WHAT.

Bad

```ts
// Increment counter
counter++
```

Good

```ts
// Prevent duplicate submissions during async operations.
```

Good code reduces comments.

---

# Imports

Order imports.

External libraries

↓

Internal modules

↓

Shared modules

↓

Relative imports

Never use wildcard imports.

---

# Error Handling

**No error may be silently ignored.** Every failure must be handled and, when it reaches a user, presented in language they can act on. Users must never see technical messages, provider error codes, or stack traces.

Handled does not mean logged. Whether a given error deserves a log entry is decided below.

The architectural contract for how failures cross module boundaries: `ARCHITECTURE.md` § *Error Handling*.

---

# Logging

The goal is that relevant operational failures are **observable** — not that every error produces a line somewhere.

- Operationally relevant errors — unexpected failures, failed writes, broken integrations, anything nobody would otherwise notice — **must** be observable.
- **An error should be logged once**, at the layer that decides what to do about it. The same failure re-logged as it propagates through three layers produces three entries and one fact, and makes the real signal harder to find.
- **Expected validation errors do not warrant severity logging.** A rejected form, a wrong password, a rate-limited request: these are the system working. Log them, if at all, as counters or at low severity — never as errors.
- Logging **should** be structured and proportional to impact. Severity indicates what someone must do, not how unusual the event felt.
- Sensitive data **must never** be logged: passwords, tokens, secrets, personal data, or anything from which they can be reconstructed.

Business events worth recording regardless of failure: authentication, commercial page publication, billing changes.

---

# Validation

Validate everything.

Client validation improves UX.

Server validation guarantees security.

Never trust browser input.

---

# API Design

REST-first.

Use nouns.

Good

```
GET /users

POST /companies

PATCH /profile

DELETE /campaigns/{id}
```

Avoid verbs.

---

# HTTP Status Codes

Use standard status codes.

200

201

204

400

401

403

404

409

422

500

Never invent custom status codes.

---

# Database Rules

Business tables only.

Avoid premature optimization.

Every table requires a **primary key** and a **`created_at`**. Those two have no exception.

**`updated_at` is required for tables whose rows are updated — which is not all of them.** An append-only table must not carry it: a row written once and never modified would hold a column that is either permanently equal to `created_at` or, worse, quietly implies a mutation that never happens. Several tables in this project are append-only by design, and each says so in its own migration.

The test: **does anything ever update this row?** If yes, `updated_at` with a trigger. If no, omit it and state why in the migration.

The rule as previously written — "every table requires CreatedAt, UpdatedAt" — would have flagged every one of those tables as defective.

Soft delete only when justified.

---

> **State management** is a structural concern — see `ARCHITECTURE.md` § *State Management* for what may live in global state. The practice is simply: prefer local state, and lift it only when a second consumer genuinely needs it.

---

# Environment Variables and URLs

**Secrets must never be hardcoded** — keys, tokens, passwords and credentials belong in environment variables, and never in the client bundle or in version control. That rule has no exceptions.

"Never hardcode URLs" is not a rule, because it conflates five different things:

| Kind of URL | Where it belongs |
|---|---|
| Environment-dependent host or origin (the product's own domain, API base) | Environment variable, read through `config/` |
| Configurable external service endpoint | Configuration |
| Internal application route (`/entrar`, `/app`) | A constant in code, ideally derived from the route that owns it |
| Documentation or reference link in a comment | Inline, where it is being referenced |
| Static asset path | Inline, alongside its use |

The test is whether the value **changes between environments or over time without a code change**. If yes, it is configuration. If no, a literal is clearer than an indirection that hides it.

Configuration belongs in `config/` and nowhere else — see below.

---

# Configuration

Configuration belongs inside:

config/

Never scatter configuration across the project.

---

# Styling

Use the Design System. Tokens exist so that a change of identity, theme or scale is one edit rather than a search across the codebase.

**Tokens are mandatory** for any value that is:

- reused in more than one place;
- part of the visual identity (colour, typography, radius, elevation);
- a step on a scale (spacing, type, breakpoints);
- semantic (success, danger, warning);
- theme-dependent (light/dark);
- expected to stay globally consistent.

**A local, one-off, non-semantic value may live next to the component that uses it** — a single alignment offset, a one-time optical correction, a magic number that has meaning only for that layout. Promoting such a value to a global token is not extra rigour; it adds an abstraction, a name, and a false implication of reuse.

The question to ask is not "is this a visual value?" but **"would anyone else ever need this exact value, and would changing it here need to change it there?"** If yes, tokenize it.

Colour, spacing and typography that carry identity or scale always answer yes.

---

# Accessibility

Every UI component must support:

Keyboard navigation

Focus management

Screen readers

Semantic HTML

Accessibility is mandatory.

---

# Performance

Avoid unnecessary renders.

Memoize only when necessary.

Lazy load large modules.

Optimize images.

Avoid unnecessary dependencies.

---

# Dependencies

Before adding a package ask:

Can this be solved with native APIs?

If yes,

Do not install another dependency.

Every dependency increases maintenance cost.

---

# Security

Follow OWASP recommendations.

Escape outputs.

Sanitize inputs.

Validate uploads.

Protect against:

XSS

CSRF

Injection

Broken authentication

Sensitive data exposure

---

# Git Strategy

Main branches

main

develop

Feature branches

feature/login

feature/analytics

feature/campaigns

Bug fixes

fix/profile-update

Hotfix

hotfix/payment-error

Release

release/v1.0.0

---

# Commit Convention

Use Conventional Commits.

Examples

```
feat(auth): add login page

fix(profile): correct avatar upload

refactor(campaigns): simplify service

docs(readme): update installation guide

test(users): add unit tests
```

---

# Pull Requests

One feature per Pull Request.

PR description must include:

Objective

Screenshots (if UI)

Testing steps

Checklist

Business impact

---

# Code Review Checklist

Readable?

Simple?

Reusable?

Secure?

Tested?

Documented?

Accessible?

Responsive?

If any answer is "No",

The PR is not ready.

---

# Testing Strategy

Priority

Unit Tests

↓

Integration Tests

↓

End-to-End Tests

Business rules have highest priority.

---

# Documentation

Every public service should be documented.

Architecture decisions require ADRs.

Business decisions belong in documentation.

Never rely on tribal knowledge.

---

# AI Collaboration

AI is an engineering assistant.

Not the architect.

Every AI-generated implementation must be reviewed against:

PRODUCT_CONSTITUTION.md, which takes priority over the documents below

Product Vision

Architecture

Design System

Engineering Guidelines

Roadmap

AI must never introduce architectural changes on its own.

## Before writing code

Two governance rules apply to every contributor, human or AI. Both are defined in **`docs/README.md`** and are not restated here, so that they cannot drift into two versions:

1. **The mandatory reading order** — `docs/README.md` § *Reading order*. Documentation is read in a fixed sequence, because each document is only interpretable in the light of the one above it.
2. **Documents do not authorize implementation** — `docs/README.md` § *Documents do not authorize implementation*, including the four-case table that determines whether something described may be built.

What belongs here, as engineering practice rather than governance, is the reason those rules exist at all:

**Most of what is written in this project describes things that do not exist.** `DOMAIN_MODEL.md` models entities deliberately never built. `ROADMAP.md` lists candidates, not decisions. `docs/plans/` holds investigations that raise questions rather than settling them.

Two failure modes have concrete precedent in this repository:

1. **Building from a stale status line.** Several plans carried "not implemented" headers long after their steps had shipped. An agent trusting the header would have duplicated live code.
2. **Building from a conceptual model.** `DOMAIN_MODEL.md` describes CRM, campaigns, materials and AI in full detail. **Detail is not readiness**, and completeness of description is not a queue of work.

When in doubt, ask which case applies — never infer intent from how much detail a document happens to contain.

---

# Definition of Done

A task is complete only if:

Business requirement implemented.

Code reviewed.

Tests passing.

Lint passing.

Formatting correct.

Responsive.

Accessible.

Documented.

No console errors.

No TypeScript errors.

No known regressions.

---

# Definition of Excellence

Excellent software is:

Easy to understand.

Easy to modify.

Easy to test.

Easy to deploy.

Easy to scale.

The best code is not the shortest.

The best code is the one future engineers will thank you for.

---

# Final Engineering Principle

Every line of code should make SETNAR easier to evolve.

Never trade long-term maintainability for short-term speed.

Build software that survives years of continuous growth.