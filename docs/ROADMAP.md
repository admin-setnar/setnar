# ROADMAP.md

> Product Roadmap
> Version: 1.0
> Status: Active
> Product: SETNAR

---

# Purpose

This roadmap defines the strategic evolution of SETNAR.

Its objective is not to list features.

Its objective is to guide product decisions while maintaining focus on business validation, sustainable growth and long-term scalability.

Every phase exists to validate one business hypothesis.

Only after validation should the next phase begin.

---

# Product Strategy

SETNAR evolves through four major stages.

Stage 1

Validate

↓

Stage 2

Optimize

↓

Stage 3

Scale

↓

Stage 4

Expand

The product must never skip stages.

---

# STAGE 1 — VALIDATE

## Objective

Validate that independent representatives are willing to pay for a Digital Office.

This stage focuses exclusively on solving one problem:

Professional Digital Presence.

---

## Business Hypothesis

Representatives need a professional way to present themselves and their products online.

---

## Success Criteria

- First active users
- First paying customers
- Positive qualitative feedback
- Organic referrals
- Daily usage

---

## Features

### Authentication

- Login
- Logout
- Password recovery

---

### User Profile

- Name
- Profile photo
- Phone
- Email
- City
- Social links

---

### Companies

- Company registration
- Company branding
- Company settings

---

### Catalog

- Product catalog
- Product activation
- Product organization

---

### Commercial Pages

- Public profile
- Product pages
- Responsive design
- WhatsApp CTA
- URL: `<representative-slug>.<domain>` — subdomain per representative, not a path (README.md ADR-026)

---

### QR Codes

- Automatic generation
- Download
- Copy link

---

### Analytics (Basic)

- Visits
- WhatsApp clicks
- Referrer source

---

### Dashboard

- Products
- Links
- QR Codes
- Basic statistics

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

---

# STAGE 2 — OPTIMIZE

## Objective

Increase representative productivity.

---

## Business Hypothesis

Representatives need marketing resources to generate more opportunities.

---

## Success Criteria

Higher engagement

Higher retention

Higher page sharing

---

## Features

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

## Success Criteria

Lead management usage

Higher conversion

Longer retention

---

## Features

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

## Features

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

Companies need centralized administration.

---

## Features

### Multi-Tenant

Multiple companies

Isolated environments

Company administration

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

Companies want to distribute products directly through SETNAR.

---

## Features

Marketplace

Partner Portal

Product Distribution

API Integrations

Third-party Applications

Developer Platform

Public APIs

---

## Definition of Done

SETNAR becomes the operating system for commercial ecosystems.

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