# ARCHITECTURE.md

> Software Architecture
> Version: 1.0
> Status: Active
> Product: SETNAR

---

# Purpose

This document defines the architectural principles, technical standards, and engineering decisions that govern the development of SETNAR.

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

```

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

QR Code generation belongs to:

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

The system is designed for multiple companies.

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
Company already resolved by ADR-001's `Host`-based tenant resolution (README.md).
When the Commercial Page generator is built (Sprint C, not started), it
should reuse the same pattern already established for Company — repository
port, resolved server-side from the request — applied one level deeper, not
a new resolution mechanism. The URL scheme for that resolution (subdomain
per representative) is decided in README.md ADR-026.

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

# Error Handling

Errors are expected.

Every module must:

Validate inputs

Handle failures

Return predictable responses

Never expose internal implementation details.

---

# Logging

Every important action should generate logs.

Examples:

Authentication

Company creation

Commercial page publication

Profile update

Campaign creation

Errors

Logs must never expose sensitive information.

---

# Security

Follow OWASP recommendations.

Never trust client input.

Validate everything.

Sanitize everything.

Escape everything.

Authentication and authorization are mandatory.

---

# Testing Strategy

Priority:

Unit Tests

↓

Integration Tests

↓

End-to-End Tests

Business rules require the highest test coverage.

UI requires the lowest.

---

# Documentation

Every public service must be documented.

Complex business decisions require Architecture Decision Records (ADR).

Code should explain implementation.

Documentation should explain intent.

---

# Technology Philosophy

Frameworks are replaceable.

Business rules are not.

Never couple business logic to framework-specific APIs.

---

# Engineering Values

Every pull request should improve at least one of:

Readability

Performance

Maintainability

Developer Experience

Testability

Documentation

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