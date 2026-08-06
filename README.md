# SETNAR — Web Application

`setnar.com`: the institutional landing, the authentication flow
(`/entrar`, `/criar-conta`, password recovery), the authenticated
representative hub (`/app`), and the public commercial pages
(`/[productSlug]`, resolved per representative subdomain).

**Governance lives in `/docs`, not here.** This file is onboarding — how to
run the project and how it's laid out. What SETNAR is, what it may promise,
what exists today, and why any given decision was made are answered by
`docs/README.md`, not by this file. Where anything below conflicts with
`/docs`, `/docs` wins — see `docs/README.md` § *Which document wins*.

---

## Documentation map

| Question | Where |
|---|---|
| What is SETNAR, and what may we say publicly? | [`docs/PRODUCT.md`](docs/PRODUCT.md) |
| What does the product actually do today? | [`docs/PRODUCT.md`](docs/PRODUCT.md) § *What Exists Today* |
| Permanent identity and principles | [`docs/PRODUCT_CONSTITUTION.md`](docs/PRODUCT_CONSTITUTION.md) |
| Business vocabulary and domain model | [`docs/DOMAIN_MODEL.md`](docs/DOMAIN_MODEL.md) |
| System structure and module boundaries | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| Visual and interaction rules | [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) |
| Everyday engineering practice | [`docs/ENGINEERING_GUIDELINES.md`](docs/ENGINEERING_GUIDELINES.md) |
| Sequencing and what's only a candidate | [`docs/ROADMAP.md`](docs/ROADMAP.md) |
| Why a specific decision was made | [`docs/adr/`](docs/adr/README.md) — 63 ADRs, one per decision |
| What's being worked on right now | [`docs/plans/`](docs/plans/README.md) |
| Reading order, authority, and governance | [`docs/README.md`](docs/README.md) |

---

## Running it

```bash
npm install
npm run dev          # http://localhost:3000

npm run verify       # typecheck → lint → tests → production build
```

Copy `.env.example` to `.env.local`. `NEXT_PUBLIC_SITE_URL` and
`NEXT_PUBLIC_DEFAULT_TENANT` have working defaults, so the institutional
pages render with no Supabase configuration at all. Authentication,
representative onboarding, product activation, commercial pages, leads and
analytics all need the Supabase project set up — see
[`supabase/README.md`](supabase/README.md) for the environment variables and
the manual steps required (disable e-mail confirmation, configure Supabase's
own rate limits, set the Vercel env vars) before testing any of it end to end.

`npm run verify` is the authoritative check — it must be green before any
change is considered done. It runs `typecheck → lint → test →
test:integration → build`. `npm run test` intentionally stays green with no
Supabase project configured; `npm run test:integration`
(`scripts/require-integration-env.mjs`) fails loudly instead, naming exactly
what wasn't exercised, when the two Supabase env vars are missing — see
[`docs/adr/ADR-017-the-test-script-now-loads-envlocal-with-nodes.md`](docs/adr/ADR-017-the-test-script-now-loads-envlocal-with-nodes.md).

> **Measure performance against a production build, in an incognito window.**
> `npm run dev` serves unminified React with HMR and source maps; a Lighthouse
> run against it reports blocking time and minification savings that don't
> exist in production. Browser extensions inflate the numbers further.

---

## Project structure

The layering follows [`ARCHITECTURE.md`](docs/ARCHITECTURE.md): a modular
monolith with four layers, folders organised by business domain rather than
by file type. See that document for the dependency rule and layer
responsibilities — not restated here.

```
src/
├── app/                     Next.js routes: landing, auth, /app, /[productSlug],
│                            legal pages, robots, sitemap, OG image
├── config/                  site.ts (env), seo.ts — configuration lives in one place
├── modules/
│   ├── tenancy/             which organization is this request for
│   ├── auth/                who is this person (sign-in/up, session, rate limiting)
│   ├── representatives/     Representative, Product Activation, Commercial Page,
│   │                        onboarding, compliance notices, company-brand tokens
│   ├── leads/                lead capture from a Commercial Page
│   ├── analytics/           page-visit and WhatsApp-click event recording
│   └── marketing/           institutional landing content
└── shared/
    ├── ui/                  the design system (see src/shared/ui/README.md)
    ├── layout/               Container, Section, Navbar, Footer
    ├── brand/                Logo
    ├── hooks/                useScrollThreshold
    └── lib/                  cn, getClientIp, supabase/ (client.ts, server.ts)
```

Each module follows the same internal split where it applies: `domain/`
(ports and rules, zero framework dependency), `application/` (use cases),
`infrastructure/` (adapters — Supabase implementations, factories),
`presentation/` (components, Server Actions, schemas).

**The dependency rule is enforced by ESLint, not by good intentions.**
`no-restricted-imports` blocks any import from `modules/*/infrastructure/**`
except the `*-factory` composition roots. Presentation asks a factory for an
adapter and depends only on the domain port.

---

## Multi-tenancy

Full rule and the architectural-vs-operational distinction:
[`ARCHITECTURE.md`](docs/ARCHITECTURE.md) § *Multi-Tenant Strategy*.

The one fact worth stating here because it's where a new contributor will
look for it: **one file owns everything tenant-specific**,
`modules/tenancy/infrastructure/tenants/setnar.tenant.ts`. Brand name,
palette, legal links, feature flags and every string on the institutional
page live there. A second tenant is a second file of the same shape.
Resolution is by `Host`, server-side, once per request
([`ADR-001`](docs/adr/ADR-001-tenant-resolution-by-host-header-in-the-application.md)).

A test asserts that no third-party brand name appears anywhere in the
rendered institutional-landing content.

---

## Compliance — read before editing representative-facing copy

Full rule: [`PRODUCT.md`](docs/PRODUCT.md) § *Relationship with iGreen* and
§ *Brand authorization — current status*. The operational instruction for
anyone editing code or copy:

**The permanent legal notice in the footer must not be removed.** It states
that SETNAR is an independent platform, not an official channel of the
organizations its users represent, and that every published page identifies
the responsible representative. Every Commercial Page's compliance notice
(per-product, [`ADR-055`](docs/adr/ADR-055-aviso-antes-de-contratar-por-categoria-de-produto.md))
is a publication precondition, not a template detail — the same applies to it.

**iGreen's brand and visual identity have no public-use authorization from
iGreen.** One prototype exists in code that uses iGreen's palette on
Commercial Pages ([`ADR-057`](docs/adr/ADR-057-mecanismo-de-tokens-de-marca-por-verticalcompany-aplicado.md));
it is explicitly unapproved and must not be presented as sanctioned. Current
status: [`docs/plans/COMMERCIAL_PAGE_CONTENT_PLAN.md`](docs/plans/COMMERCIAL_PAGE_CONTENT_PLAN.md) § 3.3.

---

## Architecture Decision Records

63 decisions, one file per decision, in [`docs/adr/`](docs/adr/README.md).
Moved out of this README on 2026-08-05 so that a 232 KB decision log stops
looking like part of the onboarding document — see that folder's own
`README.md` for the index and the migration note.

**The migration rule that governed the old log still applies.** A migration
under `supabase/migrations/` that has already been applied — to any real
environment, not only production — is never edited; fixes land as a new
migration with a new timestamp. The sequence of files in that folder is a
true history of what ran, in order, never a moving target.

---

## Accessibility

Non-negotiable, per [`DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md). What is
implemented and verified in this codebase:

- Every input has a real `<label>`; placeholders are never used as labels.
  `FormField` owns the `aria-describedby` wiring for hints and errors.
- One focus treatment across the product, defined once in `globals.css`,
  always visible.
- Modals and the mobile menu are Radix Dialogs — focus trapped and restored,
  Escape closes, the background is inert.
- Landmarks throughout; each `Section` is labelled by its own heading id.
- A skip link to `#conteudo` as the first focusable element.
- `prefers-reduced-motion` removes every animation and transition globally.
- Colour never carries meaning alone.

---

## What exists, and what doesn't

This file does not maintain its own list — that list exists in exactly one
place and duplicating it here is how a README goes stale.
[`PRODUCT.md`](docs/PRODUCT.md) § *What Exists Today* is the authoritative,
dated, baseline-verified answer, split into *Available now*, *In validation
or development*, and *Future vision*. Read it there.

What is safe to say permanently, because it is a principle rather than a
snapshot: nothing ships ahead of demand. Seams exist for capabilities not
yet built (`AuthGateway`'s `signInWithProvider`, dark-mode tokens,
`tenant.locale`), but the capability itself is only built when a real need
requires it — see `ARCHITECTURE.md`'s YAGNI principle.

---

## Current work and what's next

Not tracked here, for the same reason as the section above: a fixed list in
a README is exactly the kind of information that is correct on the day it's
written and wrong a sprint later.

- **What's actively being decided or built:** [`docs/plans/`](docs/plans/README.md).
- **What's sequenced next, and why:** [`docs/ROADMAP.md`](docs/ROADMAP.md), particularly Stage 1's *Still open* table.
- **Known gaps in the documentation itself:** [`docs/README.md`](docs/README.md) § *Outstanding Documentation Debt*.
