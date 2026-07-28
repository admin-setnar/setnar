# ENGINEERING_GUIDELINES.md

> Engineering Guidelines
> Version: 1.0
> Status: Active
> Product: SETNAR

---

# Purpose

This document defines the engineering standards adopted by SETNAR.

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

# File Size

Maximum recommended file size:

300 lines.

If a file grows beyond that, evaluate splitting responsibilities.

---

# Function Size

Functions should ideally remain below:

40 lines.

Every function should solve one problem.

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

Never ignore errors.

Every error must be:

Handled

Logged

Presented gracefully

Users should never see technical messages.

---

# Logging

Log only meaningful events.

Examples

Authentication

Commercial page publication

Campaign creation

Billing

Errors

Never log passwords.

Never log tokens.

Never log sensitive information.

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

Every table requires:

Primary key

CreatedAt

UpdatedAt

Soft delete only when justified.

---

# State Management

Prefer local state.

Lift state only when necessary.

Global state should remain minimal.

---

# Environment Variables

Every secret belongs in environment variables.

Never hardcode:

Keys

Secrets

URLs

Passwords

Tokens

---

# Configuration

Configuration belongs inside:

config/

Never scatter configuration across the project.

---

# Styling

Use the Design System.

Never hardcode colors.

Never hardcode spacing.

Never hardcode typography.

Everything should come from design tokens.

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

Product Vision

Architecture

Design System

Engineering Guidelines

Roadmap

AI must never introduce architectural changes on its own.

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