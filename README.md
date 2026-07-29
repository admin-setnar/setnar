# SETNAR — Interface Gateway

The first screen of `setnar.com`. It has exactly three jobs: explain the
product, let a returning user sign in, and let a new user create an account.
No dashboard, no product pages, no internal features.

This README is the project's long-term memory. When a decision is made,
it is recorded here — the code explains *how*, this file explains *why*.

---

## Running it

```bash
npm install
npm run dev          # http://localhost:3000

npm run verify       # typecheck → lint → tests → production build
```

Copy `.env.example` to `.env.local`. `NEXT_PUBLIC_SITE_URL` and
`NEXT_PUBLIC_DEFAULT_TENANT` have working defaults, so the marketing page
renders with no configuration at all. Authentication needs the three
Supabase-related variables filled in — see `supabase/README.md` for where
each one comes from and what else has to be set up on the Supabase/Vercel
side first.

### Verification status

Everything below was run against this codebase, not assumed:

| Check | Result |
| --- | --- |
| `tsc --noEmit` (strict, `noUncheckedIndexedAccess`) | clean |
| `next lint` | clean |
| `tsx --test` | 23/23 passing — the 4 login-rate-limiter integration tests self-skip without a configured Supabase project (see below) |
| `next build` | success — `/` at **127 kB**, `/entrar`/`/criar-conta` at 156 kB, `/termos`/`/privacidade` at 127 kB First Load JS |
| Served HTML (`next start` + fetch) | headings, JSON-LD, OG tags, tenant tokens and legal notice all present |
| `/robots.txt`, `/sitemap.xml`, `/opengraph-image` (1200×630 PNG), `/icon.svg`, 404 | all correct |
| WCAG AA contrast audit on every colour pair in use | lowest ratio 5.73:1 against a 4.5 requirement |
| Rendered list semantics (`ul`/`ol` children) | every list contains only `<li>` |

**Not yet verified against a real Supabase project in this session** — pending
the credentials and the migration described in `supabase/README.md`:

- Sign-up/sign-in end to end, `profiles`/`login_attempts` rows written and
  shaped as expected.
- The 6th failed login for one e-mail (or the 31st from one IP) in 15 minutes
  returning `rate_limited`.
- That no update policy exists on `profiles` post-migration.
- The 4 skipped integration tests above.
- That the session token is never written to `localStorage`/`sessionStorage`
  (only to the httpOnly cookie the privacy policy §6 claims) — this is an
  assumption about `@supabase/ssr`'s default behaviour, not yet confirmed
  against a running app in a real browser.
- Sign-up with an already-registered e-mail actually returns
  `email_already_registered`, not a generic failure.
- `/termos` and `/privacidade` rendering `current_terms_version()` from a real
  database, including the fail-open fallback (`"Versão indisponível no
  momento"`) under an actual RPC failure — see the note below.
- **Most importantly:** that Supabase's real error shape for both a wrong
  password *and* a non-existent e-mail maps to `invalid_credentials` through
  `mapSupabaseAuthError`. `tests/map-supabase-auth-error.test.ts` only proves
  the mapping is correct for fabricated error objects built to match the
  shape the code expects — if GoTrue's real response differs from that
  assumed shape, either case can fall through to `unknown` instead, and the
  anti-enumeration guarantee this mapping exists for breaks silently while
  the unit test stays green.

**Fail-open on `current_terms_version()`.** `getCurrentTermsVersion()`
previously threw on an RPC error, which would have taken down `/termos` and
`/privacidade` — public, mandatory pages — with a 500 during any database
hiccup. Fixed to return `null` instead: both pages now render the full legal
text unconditionally and show `"Versão indisponível no momento"` in place of
the version number when the RPC fails, the same fail-open trade-off already
used in `isLoginBlocked` (`login-rate-limiter.ts`).

> **Measure performance against a production build, in an incognito window.**
> `npm run dev` serves unminified React with HMR and source maps; a Lighthouse
> run against it reports minification savings and multi-second blocking time
> that do not exist in production. Browser extensions inject scripts into the
> page and inflate Total Blocking Time on their own.

---

## Architecture

The layering follows `ARCHITECTURE.md`: a modular monolith with four layers and
folders organised by business domain, never by file type.

```
src/
├── app/                     Next.js routes, metadata, robots, sitemap, OG image
├── config/                  site.ts (env), seo.ts — configuration lives in one place
├── modules/
│   ├── tenancy/             who is this request for
│   │   ├── domain/          Tenant, BrandTokens, TenantRepository (port)
│   │   ├── application/     resolve-tenant
│   │   ├── infrastructure/  in-memory repository, tenant configs, factory
│   │   └── presentation/    TenantProvider, BrandTokensStyle
│   ├── auth/                who is this person
│   │   ├── domain/          rules, types, AuthGateway (port)
│   │   ├── application/     sign-in, sign-up, sign-in-with-provider
│   │   ├── infrastructure/  SupabaseAuthGateway, MockAuthGateway (tests), factory,
│   │   │                    login rate limiter, Supabase error mapping
│   │   └── presentation/    modals, standalone forms, Server Actions, zod schemas, error copy
│   └── marketing/           what this page says
│       ├── domain/          MarketingContent types, IconKey
│       └── presentation/    Hero, HowItWorks, Benefits, FinalCta, ProductPreview
└── shared/
    ├── ui/                  the design system (see src/shared/ui/README.md)
    ├── layout/              Container, Section, Navbar, Footer
    ├── brand/               Logo
    ├── hooks/               useScrollThreshold
    └── lib/                 cn, getClientIp, supabase/ (client.ts, server.ts)
```

**The dependency rule is enforced by ESLint, not by good intentions.**
`no-restricted-imports` blocks any import from `modules/*/infrastructure/**`
except the `*-factory` composition roots. Presentation asks a factory for an
adapter and depends only on the domain port. Try importing `MockAuthGateway`
from a component and the build fails.

### Mapping to the requested component tree

The brief asked for `components/ui | layout | marketing`. The equivalents are
`shared/ui`, `shared/layout` and `modules/marketing/presentation`. The
`modules/` layout was chosen because `ARCHITECTURE.md` is marked *Active* and
already prescribes it — a second, competing convention would have been the more
expensive decision. Renaming is a folder move, not a refactor, if you prefer the
original tree.

---

## Multi-tenancy

`DOMAIN_MODEL.md` is explicit: *"iGreen is the first tenant of a multi-tenant
business, not a template the business is built around."* The code holds that
line literally.

- **One file owns everything tenant-specific**: `modules/tenancy/infrastructure/tenants/setnar.tenant.ts`.
  Brand name, palette, legal links, feature flags and every string on the page
  live there. A second tenant is a second file of the same shape.
- **Resolution is by `Host`**, server-side, once per request. Unknown hosts fall
  back to the default tenant rather than erroring, so preview URLs still work.
- **Branding is applied as CSS custom properties injected into `<head>`** by
  `BrandTokensStyle`. Correct on first paint, no flash of the wrong palette, no
  rebuild needed to repaint the product.
- **Content is serializable data.** Icons are referenced by key (`"share"`), never
  as React components, so the whole config can move to a database in Stage 5
  without touching a component. `IconKey` is a union, so an unmapped key is a
  compile error.

A test asserts that no third-party brand name appears anywhere in the rendered
marketing content.

---

## Compliance

**This is not a marketing page for any company whose products the users sell.
It is the product page for SETNAR's own software.** That distinction drives
three deliberate constraints. Please read before editing copy.

1. **The iGreen brand appears nowhere on this page — no name, no logo.**
   iGreen's *Política de Uso da Marca* expressly prohibits licensees from
   creating advertising material using the iGreen brand
   (*"Fica expressamente PROIBIDA a criação de qualquer peça publicitária
   utilizando a marca iGreen Energy"*). The vertical exists in configuration as
   `vertical.internalName`, with `displayName` intentionally left undefined.
   Naming iGreen publicly requires their prior written authorisation — it is not
   a product decision.

2. **A permanent legal notice sits in the footer**, rendered verbatim from
   `footer.legalNotice`: SETNAR is an independent platform, is not an official
   channel of the companies its users represent, and every published page
   identifies the responsible representative. This protects both SETNAR and the
   licensee, and mirrors the identification iGreen's policy requires on any
   licensee-run site (full name + "Licenciado Autorizado iGreen Energy" + ID).
   **Do not remove it.** When commercial pages ship, that per-page identification
   becomes a publication precondition, not a template detail.

3. **No claim about earnings, results, or price.** Every statement on the page
   is about what the software does. Three items still need your sign-off before
   launch, because they are commitments the product must keep:
   *"Publique em minutos"*, *"Criar conta leva menos de dois minutos"*, and the
   illustrative figures in the product preview (visits and clicks only — never
   revenue).

---

## Architecture Decision Records

### ADR-001 — Tenant resolution by `Host` header, in the application layer
**Decision.** Resolve the tenant server-side from `Host`, through a repository
port, with an in-memory adapter.
**Alternatives.** A build-time constant (cheapest, but makes tenant number two a
rebuild); path-based routing like `/t/setnar` (ugly for a product sold on the
strength of its link); middleware (runs on every asset request for no gain).
**Consequence.** `/` renders dynamically rather than statically. Accepted: the
page is small, cached at the edge by the host, and the alternative is a
single-tenant architecture wearing a multi-tenant costume.
**Reversal cost.** Low.

### ADR-002 — Branding as injected CSS custom properties
**Decision.** Tailwind consumes `rgb(var(--token) / <alpha-value>)` for every
colour; the tenant's palette is injected into `<head>` on the server.
**Why the RGB-channel format.** Storing `#14213D` would break every Tailwind
opacity modifier (`bg-brand/10`). Storing `20 33 61` keeps them working.
**Consequence.** White-labelling is a data change. Dark-mode tokens are already
defined for the same reason; no toggle ships yet (YAGNI) — adding one means
writing `dark` onto `<html>`.
**Reversal cost.** Low.

### ADR-003 — Authentication behind a port, with a deliberately fake adapter
**Decision.** `AuthGateway` is a domain port. `MockAuthGateway` is the only
implementation today, and it has deterministic triggers:

| Input | Result |
| --- | --- |
| `senha-invalida@setnar.com` (sign in) | `invalid_credentials` |
| `bloqueado@setnar.com` (sign in) | `rate_limited` |
| `existente@setnar.com` (sign up) | `email_already_registered` |
| any social provider | `provider_unavailable` |
| anything else | success |

**Why.** Every state — idle, submitting, failed, succeeded — is buildable,
reviewable and testable before a backend exists. Failure codes are
provider-agnostic, so the UI never parses a vendor's error strings.
**Status: migrated (Sprint A).** `getAuthGateway()` now returns
`SupabaseAuthGateway`. `MockAuthGateway` stays in the repo for the test
suite, but nothing in `app/` or `presentation/` reaches it any more —
`no-restricted-imports` enforces that. See ADR-011 through ADR-013 for what
the migration itself required. As predicted here, no structural refactor of
`AuthGateway`, the use cases, or their call sites was needed.
**Reversal cost.** Low.

### ADR-004 — shadcn/ui primitives are vendored, not installed
**Decision.** Build the primitives directly on Radix + CVA + `tailwind-merge`,
which is exactly what the shadcn CLI produces.
**Why.** shadcn is a copy-into-your-repo generator, not a runtime dependency.
Vendoring gives the same result with no generator step, and lets each component
carry the documentation block `DESIGN_SYSTEM.md` requires (purpose, states,
accessibility notes) instead of generic boilerplate.
**Reversal cost.** None — the CLI can still be pointed at this project.

### ADR-005 — Framer Motion removed after measurement
**Decision.** Build the scroll reveal on `IntersectionObserver` plus a CSS
transition, and drop the animation library.
**Evidence.** Both versions were built and measured:

| Implementation | Page JS | First Load JS |
| --- | --- | --- |
| Framer Motion | 55.2 kB | 166 kB |
| IntersectionObserver | 15.9 kB | **127 kB** |

**Why.** 39 kB — 24% of First Load JS — for a 6px fade, on a page whose audience
opens it on mid-range Android over mobile data. `ENGINEERING_GUIDELINES.md`
asks, before adding a package: *"Can this be solved with native APIs?"* Here it
plainly can. The library remains the right call for the authenticated app, where
the cost sits behind login and the animations are real.
**Note.** Framer Motion was on your requested stack, so this is the one place
the delivery diverges from the brief. Say the word and it goes back — the change
is one file.
**Reversal cost.** Trivial.

### ADR-006 — Brand typeface self-hosted via `@fontsource-variable`
**Decision.** Ship Plus Jakarta Sans from npm rather than `next/font/google`.
**Why.** No third-party request at runtime, nothing for a privacy review to
raise later, and no build-time dependency on an external service.
**Open conflict.** `DESIGN_SYSTEM.md` names Inter as the preferred font; the
visual identity guide names Plus Jakarta Sans. The identity guide won, being the
more specific and more recent artefact. **`DESIGN_SYSTEM.md` should be updated
so the contradiction does not resurface.**
**Reversal cost.** One token: `--font-sans` in `globals.css`.

### ADR-010 — Ambient declarations for asset imports
**Decision.** `src/types/assets.d.ts` declares `*.css`, `*.scss` and font
modules.
**Why.** Next ships types for `*.module.css` but not for plain `*.css`, so
`import '@/app/globals.css'` has nothing to resolve to. TypeScript only
complains when `noUncheckedSideEffectImports` is enabled — which some editors
and stricter configurations do — producing *"Cannot find module or type
declarations for side-effect import"* while the build itself works fine. The
declaration removes the discrepancy between what the editor reports and what
the bundler does.
**Reversal cost.** None.

### ADR-008 — `Reveal` is polymorphic
**Decision.** The scroll-reveal wrapper takes an `as` prop and renders `<li>`
directly inside lists.
**Why.** It originally rendered a `<div>` between `<ol>` and `<li>`, which
silently destroys list semantics — a screen reader stops announcing "item 1 of
3". Caught by Lighthouse, not by review. A wrapper component must never change
the semantics of what it wraps.
**Reversal cost.** None.

### ADR-009 — `--content-subtle` decoupled from the brand palette
**Decision.** The subtle text token is `90 99 114` rather than the identity's
`#6B7280`.
**Why.** `#6B7280` cleared AA against the sunken surface by 0.12 — technically a
pass, no margin at all. Any tenant shifting its palette would have pushed it
under. It now clears by 1.3. The identity's grey remains available as
`--palette-500` for non-text use.
**Reversal cost.** One token.

### ADR-007 — Server Components by default, three client islands
**Decision.** The page is a Server Component. Only three things run on the
client: `Navbar` (scroll state and mobile menu), `AuthTriggerButton` (opens a
modal), and `Reveal` (scroll transition).
**Consequence.** The initial HTML contains zero form inputs — verified. The
modals, with `react-hook-form` and `zod`, are loaded on first open via
`next/dynamic`, keeping them out of the bundle of the majority of visitors who
only scroll.
**Reversal cost.** Low.

### ADR-011 — Profile provisioning by a `SECURITY DEFINER` trigger, not a second application call
**Decision.** `auth.signUp()` writes only `full_name` to `raw_user_meta_data`.
A Postgres trigger (`handle_new_user()`) inserts the matching `profiles` row
inside the same transaction as the `auth.users` insert. `tenant_id`,
`terms_accepted_at` and `terms_version` are decided by the trigger itself —
`tenant_id` is a literal, `terms_accepted_at` is `now()`, and `terms_version`
comes from `current_terms_version()`, a second database function that is the
single source of truth for which version of `/termos` and `/privacidade` is
currently in force (no duplicate constant in TypeScript, so a signed consent
record and the copy a user actually saw can never drift apart).
**Alternative rejected.** Two sequential application calls — `auth.signUp()`,
then an insert into `profiles`. Without a service role key, a failure between
the two steps leaves a real auth user with no profile: an orphaned account
with no clean way to detect or repair it from the app layer.
**Why this works without a service role key.** `SECURITY DEFINER` runs the
function as its owner, not as the anonymous caller — the same mechanism RLS
is built on, applied deliberately instead of bypassed. If the insert fails,
Postgres rolls back the entire transaction, including the `auth.users` row:
there is no intermediate state to be orphaned in the first place.
**Reversal cost.** Low — the trigger is one function, dropping it stops
provisioning without touching `SupabaseAuthGateway`.

### ADR-012 — Login rate limiting lives in Postgres, not in application memory
**Decision.** `is_login_blocked` / `record_login_failure` /
`clear_login_attempts`, three more `SECURITY DEFINER` functions over a
`login_attempts` table with zero RLS policies — the exact same pattern as
ADR-011 — back the rate-limiting rule within a 15-minute window, keyed
independently by a salted SHA-256 hash of the e-mail and of the IP (never
plain text: an attempt log is personal data, and this table exists in the
same sprint that publishes the privacy policy declaring it).
**Why the e-mail and IP thresholds differ (5 vs. 30).** A single shared
threshold was the first version, but it does not fit Brazilian mobile
traffic: CGNAT means many unrelated users can share one public IP, so a
tight per-IP limit blocks innocent users on the same carrier connection, not
just an attacker. The per-e-mail limit stays tight (5) because it has no
such false-positive risk; the per-IP limit is raised (30) to absorb normal
CGNAT sharing while still catching a scan across many accounts from one
origin.
**Alternative rejected, and why it is wrong, not just simpler.** A `Map` in a
module, counting failures in process memory. This app deploys to Vercel,
which is serverless: there is no process that persists between requests, so
a counter kept in one module-level variable can silently reset on every
single request. The dangerous part is that this is invisible locally —
`npm run dev` runs one persistent process, so the bug only appears in
production, with no error and no signal, as a rate limiter that never
actually limits anything.
**Consequence — a limitation, recorded rather than solved.** Without service
role, this table is reachable through the app's Server Actions. Someone who
calls the Supabase API directly with the publishable key (which is public by
design) bypasses this limiter entirely; native Supabase Auth rate limiting is
the only remaining defence against that path — see ADR-013.
**Reversal cost.** Medium. An in-memory limiter becomes viable again only if
the deployment target changes to a host with a persistent process (a
container, not serverless) — until then, this is the only version that
actually enforces the rule in production, not just in `npm run dev`.

### ADR-013 — No IP forwarded to Supabase's own rate limiting
**Decision.** Nothing forwards the visitor's IP to the Supabase Auth API.
**Why not, even though it looks like the obvious hardening step.** GoTrue
reads the visitor IP from `Sb-Forwarded-For`, not the generic
`x-forwarded-for` — and honouring that header at all requires a secret API
key, which this project does not hold this sprint. Sending
`x-forwarded-for` anyway would have been silently ignored: worse than doing
nothing, because it would read in code review as a protection that does not
exist.
**Consequence.** Every request from this app reaches Supabase carrying the
IP of whichever Vercel function handled it, not the visitor's — so
Supabase's own native rate limiting (Authentication → Rate Limits) currently
sees all of SETNAR's traffic as one origin. This makes `login_attempts`
(ADR-012) the primary defence against credential stuffing through the app,
not a second layer behind Supabase's own.
**Revisit when:** legitimate users start getting HTTP 429 from Supabase
during ordinary traffic (the shared-bucket symptom), or when the project
takes on a secret API key for another reason. Two fixes exist for whenever
that happens: request a secret key scoped only to setting
`Sb-Forwarded-For`, or move the `signInWithPassword`/`signUp` calls to run in
the browser instead of a Server Action, so Supabase sees the real IP without
any forwarding at all.
**Reversal cost.** Low once a secret key is available — one header on one
client construction call.

---

## Accessibility

Non-negotiable, per `DESIGN_SYSTEM.md`. What is implemented and verified:

- Every input has a real `<label>`; placeholders are never used as labels.
  `FormField` owns the `aria-describedby` wiring for hints and errors, so a form
  cannot accidentally ship without it.
- One focus treatment across the product, defined once in `globals.css`, always
  visible. Ratio against white: 9.72:1.
- Modals and the mobile menu are Radix Dialogs — focus trapped and restored,
  Escape closes, the background is inert. Not reimplemented.
- Landmarks throughout; each `Section` is labelled by its own heading id.
- Unbuilt destinations are `aria-disabled` text, never links that go nowhere.
- A skip link to `#conteudo` as the first focusable element.
- `prefers-reduced-motion` removes every animation and transition globally.
- Colour never carries meaning alone. Full AA contrast audit passes — lowest
  measured pair 4.62:1.

---

## What is deliberately not here

Per the brief and YAGNI: a dashboard, product pages, pricing, a theme toggle,
social login, password recovery, and internationalisation. The seams for
each exist (`AuthGateway`'s `signInWithProvider`, dark tokens, `tenant.locale`),
but nothing is built ahead of demand — see `docs/` for the sprint scope that
defines exactly what "ahead of demand" means at each stage.

## Next steps, in order

1. Confirm the three copy claims flagged under **Compliance**.
2. Resolve the Inter / Plus Jakarta Sans contradiction in `DESIGN_SYSTEM.md`.
3. ~~Choose the identity provider, then write one `AuthGateway` adapter.~~ Done
   (Sprint A) — see ADR-011 through ADR-013.
4. ~~Build `/termos` and `/privacidade`.~~ Done (Sprint A), drafted to be
   accurate about what the product actually collects — **still pending formal
   legal review before real public sign-up opens**, as flagged on both pages.
5. Apply `supabase/migrations/` to the project and complete the manual steps
   in `supabase/README.md` (disable e-mail confirmation, configure Supabase's
   own rate limits, set the Vercel env vars) before testing sign-up/sign-in
   end to end.
6. Sprint B: the authenticated `/app` dashboard, and the redirect-to-`/entrar`
   wiring for protected routes and expired sessions that `/entrar` and
   `/criar-conta` exist to serve but do not yet implement.
