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
`NEXT_PUBLIC_DEFAULT_TENANT` have working defaults, so `/`, `/termos` and
`/privacidade` all render with no Supabase configuration at all — verified
end to end (`next build` + `next start` + `curl`), not assumed; see ADR-024
for the incident this claim used to be false for. Authentication needs the
three Supabase-related variables filled in — see `supabase/README.md` for
where each one comes from and what else has to be set up on the
Supabase/Vercel side first.

### Verification status

Everything below was run against this codebase, not assumed:

| Check | Result |
| --- | --- |
| `tsc --noEmit` (strict, `noUncheckedIndexedAccess`) | clean |
| `next lint` | clean |
| `tsx --test` (`npm run test`) | 59/59 passing with a configured Supabase project (`.env.local` present); 53/53 without one — the 6 login-rate-limiter integration tests self-skip, and `npm run test`'s own summary cannot tell the two scenarios apart (see note below the table) |
| `npm run test:integration` (new — see note below) | passes only when the 6 integration tests above actually ran |
| `next build` | success — `/` at **127 kB**, `/entrar`/`/criar-conta` at 156 kB, `/termos`/`/privacidade` at 127 kB First Load JS |
| Served HTML (`next start` + fetch) | headings, JSON-LD, OG tags, tenant tokens and legal notice all present |
| `/robots.txt`, `/sitemap.xml`, `/opengraph-image` (1200×630 PNG), `/icon.svg`, 404 | all correct |
| WCAG AA contrast audit on every colour pair in use | lowest ratio 5.73:1 against a 4.5 requirement |
| Rendered list semantics (`ul`/`ol` children) | every list contains only `<li>` |

**`npm run test`'s own pass/fail summary cannot signal a skipped integration
suite — confirmed directly, not assumed.** `tests/login-rate-limiter.integration.test.ts`
gates its two `describe` blocks (6 `it()`s total) behind `skip: !canRun`.
Node's test runner does not count a skipped `describe`'s children as
`skipped` — it removes them from the total outright. Run twice against this
exact codebase: with `.env.local` present, `npm run test` prints `tests 59 /
pass 59 / fail 0`; with it absent, `tests 53 / pass 53 / fail 0`. Both read
as "everything passed." Since the total grows as the project grows, diffing
the denominator across builds doesn't surface this either — a CI run with no
Supabase credentials would give a clean, fully green signal without ever
having exercised the credential-stuffing defense ADR-012/ADR-018 depend on.
`npm run test` itself is deliberately left unchanged — it must stay green on
a machine with no Supabase project configured (ADR-017). Instead,
`npm run test:integration` (`scripts/require-integration-env.mjs`) is a
separate, new script that does not re-run the RPCs; it only fails loudly,
with a non-zero exit and a message naming exactly what wasn't exercised, if
the two env vars are missing. `npm run verify` now runs
`test && test:integration && build`, so `verify` — the thing CI should
actually run — goes red end to end (confirmed: exit code `1`, build never
reached) exactly when this blind spot would otherwise hide something.

**Not yet verified against a real Supabase project in this session** — pending
the credentials and the migration described in `supabase/README.md`:

- Sign-up/sign-in end to end, `profiles`/`login_attempts` rows written and
  shaped as expected.
- The 6th failed login for one e-mail (or the 31st from one IP) in 15 minutes
  returning `rate_limited`.
- That no update policy exists on `profiles` post-migration.
- The 6 skipped integration tests above.
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

**Fail-open on missing OR invalid Supabase config in the session-refresh
middleware, matching ADR-019's own stated scope (ADR-024).**
`src/middleware.ts` runs on every request, including `/`, `/termos` and
`/privacidade` — so ADR-019's fail-open fix inside
`getCurrentTermsVersion()` never got a chance to run: `updateSession()`
threw first, on every route, before either page's own code executed. Fixed
with an explicit guard for missing/empty env vars and a narrowly-scoped
`try/catch` around client construction for a present-but-malformed value —
both fail open (`200`), each logging its own distinguishable warning at
most once per process, never per request. A well-formed URL/key pointing
at an unreachable project remains a separate, already-correctly-handled
case (network failure, not configuration) and is unaffected — see ADR-024
for the reproduction of all three and why the first, narrower version of
this fix contradicted ADR-019 and had to be corrected.

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

**Migration rule.** A file under `supabase/migrations/` that has already been
applied — to any real environment, not only production — is never edited.
Fixes and follow-ups always land as a new migration with a new timestamp; the
already-applied file stays exactly as it was applied. The sequence of files in
that folder is a true history of what ran, in order, never a moving target.

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

### ADR-014 — `email_service_unavailable` is its own code, and a message fallback covers sign-up duplicates too
**Decision.** `mapSupabaseAuthError` gained a case for GoTrue's
`over_email_send_rate_limit` → new code `email_service_unavailable`, and a
second message-text fallback (status 422, `/already (been )?(registered|exists)/i`)
alongside the existing invalid-credentials one, for sign-up duplicates when
`error.code` isn't populated.
**Why a new code instead of reusing `rate_limited`.** They are unrelated
limits with unrelated remedies. `rate_limited` (ADR-012) is this app's own
per-account/per-IP login-attempt limiter — waiting a few minutes clears it.
`over_email_send_rate_limit` is Supabase's built-in transactional e-mail
service, capped at 2 e-mails/hour for the whole project, not per user;
telling a user blocked by the project-wide e-mail cap to "wait a few
minutes and try logging in again" (the `rate_limited` copy) is simply wrong
advice — the fix is either time (up to an hour) or moving off Supabase's
built-in mailer, never a login retry.
**Why the sign-up message fallback exists, mirroring the sign-in one.**
`invalid_credentials` already had a text fallback because older/self-hosted
GoTrue does not always populate `error.code` (see the fallback this file
already had for sign-in). The same gap exists on the sign-up side: nothing
in this codebase previously caught a duplicate-account message without a
matching `code`, so it silently fell through to `unknown`, discarding
information the response actually carried.
**Consequence.** Both branches were unreachable by the fabricated-object
unit tests in `tests/map-supabase-auth-error.test.ts` before this change, and
still are only proven against fabricated error shapes, not a live GoTrue
response — the same caveat the "Verification status" table above already
records for the pre-existing `invalid_credentials` fallback.
**Reversal cost.** Low — two `switch`/`if` branches and one `AuthErrorCode`
member; removing them only widens what falls into `unknown`, it does not
change any other behaviour.

### ADR-015 — `signUp()` no longer trusts "no `error`" as proof of success
**Decision.** `SupabaseAuthGateway.signUp()` now runs a duplicate-account
check (`isDuplicateSignUp`, in its own file) on `result.user` before treating
a Supabase response as a real success, and calls `this.supabase.auth.signOut()`
before returning `failure('email_already_registered')` when that check trips.
**Why `signUp()` needed this at all.** `@supabase/auth-js`'s own JSDoc on
`signUp()` (vendored at `node_modules/@supabase/auth-js/src/GoTrueClient.ts`)
documents that calling `signUp()` for an existing confirmed user, with
**Confirm email** and **Confirm phone** both enabled, returns an
"obfuscated/fake user object" with **no `error` at all**. The gateway's only
check before this change was `if (!result.user) return failure('unknown')` —
which that fake object satisfies, so the app reported a brand-new account
created for someone else's already-registered e-mail. This was reproduced in
manual browser testing against this exact code before the fix: creating an
account with an already-registered e-mail sometimes rendered the success
screen with no error shown at all.
**Why `identities` and not some other field.** An empty (or absent)
`identities` array is the signal Supabase uses to mark that fake object —
a genuinely new sign-up always comes back with one populated identity. It
is intentionally a pure function in its own file
(`is-duplicate-signup.ts`), not a private method on the gateway: the
gateway file starts with `import 'server-only'`, which a `tsx --test` unit
test cannot import (it runs in plain Node, no Next.js runtime), so the
check had to live somewhere importable on its own.
**Known limitation, recorded rather than solved.** The same empty-`identities`
signal is, in some GoTrue versions, also what comes back for an account that
already exists but is still waiting on its own confirmation e-mail — so this
function cannot tell "already exists and confirmed" apart from "already
exists and unconfirmed". Left as-is because both sub-cases should show the
user the same message today ("this e-mail already has an account"); telling
them apart would require a second query and only matters once the product
needs two different messages for them.
**Why the `signOut()` call is essential, not defensive extra.** `@supabase/ssr`
(`shared/lib/supabase/server.ts`) writes whatever session comes back from any
auth call straight into an httpOnly cookie, unconditionally — it has no
concept of "this response turned out to be a mistake". If Supabase's fake
object for a duplicate sign-up ever carries a session (some GoTrue
configurations return one), returning `failure('email_already_registered')`
without also calling `signOut()` would leave the browser authenticated as
the pre-existing account while the screen shows an error — a session mix-up,
not merely a wrong message.
**Reversal cost.** Medium. Removing the check reopens the exact bug this
ADR fixes; removing only the `signOut()` call keeps the correct error code
but reintroduces the session-mix-up risk silently, which is the more
dangerous partial rollback to watch for.

### ADR-016 — A third `AuthResult` state for "account created, not yet authenticated"
**Decision.** `AuthResult` is now `AuthSuccess | AuthFailure | AuthPendingConfirmation`.
`signIn` and `signInWithProvider` — which can never produce that third state,
since there is no account to create — return the narrower `SignInResult =
AuthSuccess | AuthFailure` instead, threaded through `AuthGateway`,
both sign-in use cases, both gateway adapters, and `signInAction`/
`signInWithProviderAction`. Only `signUpAction` still returns the 3-state
`AuthResult`.
**Why this needed a real domain state instead of a UI-only tweak.** Before
this change, `signUp()` returned `success(...)` whenever `result.user`
existed post duplicate-check, without checking `result.session` — so a
project with **Confirm email** enabled (the correct, secure default) made
`sign-up-form.tsx` render "Você já está autenticado no Setnar" for an
account that was not, in fact, authenticated: no session exists until the
user clicks the confirmation link. This was reproduced in manual browser
testing: the confirmation e-mail arrived and clicking its link did create a
real session (verified via the `amr: [{ method: 'otp' }]` claim in the
resulting cookie/JWT) — proving the earlier "already authenticated" message
had been false at the moment it was shown.
**Why narrow `SignInResult` instead of leaving every method on `AuthResult`.**
Once `AuthResult` grew a third state, every caller of `signIn`/
`signInWithProvider` would otherwise need a dead branch for a state their
own gateway methods can never return — `sign-in-form.tsx` and
`social-auth-buttons.tsx` would have to handle `'pending_confirmation'`
just to satisfy the type checker, for a case that can't happen on those
paths. Narrowing the type instead of the runtime check means the compiler
enforces "sign-in only ever succeeds or fails", not a code comment.
**Consequence.** `sign-up-form.tsx` now has three render branches instead of
two: error, pending confirmation, and success — each mapped from a distinct,
named domain state, not inferred from the shape of the success payload.
**Reversal cost.** Medium — collapsing back to two states means deciding
what a project with Confirm email enabled should show instead, and touching
every file this ADR lists again.
**Update (Sprint B) — the "Confirm email enabled" premise above is now
explicitly decided the other way.** This ADR was written when that setting's
final value was still open. It has since been turned OFF as a closed
product decision (`supabase/README.md` §2) — see ADR-022 for the full
reasoning and what that decision enables. Nothing above is invalidated:
`AuthPendingConfirmation`/`awaitingConfirmation` remain exactly as this ADR
built them, deliberately dead code today, not removed.

### ADR-017 — The test script now loads `.env.local`, with Node's own flag
**Decision.** `"test"` in `package.json` changed from
`npx tsx --test tests/**/*.test.ts` to
`node --env-file-if-exists=.env.local node_modules/tsx/dist/cli.mjs --test tests/**/*.test.ts`.
**Why this was silently broken before.** Neither `tsx` nor Node's default
module loader reads `.env.local` on its own — confirmed by running an
isolated probe test from this repo's root (which already has a filled-in
`.env.local`) and observing `process.env.NEXT_PUBLIC_SUPABASE_URL` come back
`undefined` inside the old script. The practical effect: the four
integration tests in `tests/login-rate-limiter.integration.test.ts`
self-skip whenever their `canRun` check finds those variables missing (see
that file's own comment) — which was, silently, every single run of
`npm run test`/`npm run verify` on a machine with a real `.env.local`,
because the variables never reached `process.env` in the first place. The
"23/23 passing" this README's Verification status table recorded already
included those 4 as skipped, not run.
**Why `--env-file-if-exists` and not `--env-file`.** `--env-file` errors out
when the file is missing; `--env-file-if-exists` does not. `npm run test`
must stay green on a machine with no Supabase project configured yet — the
same requirement the integration test file's own skip logic already states.
**Why `node_modules/tsx/dist/cli.mjs` and not `npx tsx` or `node_modules/.bin/tsx`.**
Confirmed by trying it directly: on this project's Windows dev machine,
`node_modules/.bin/tsx` is a POSIX `#!/bin/sh` shim (with separate `.cmd`/
`.ps1` siblings for Windows shells) — `node` cannot execute it, since after
its shebang line is stripped what remains is shell syntax, not JavaScript;
it fails with `SyntaxError: missing ) after argument list`. Pointing `node`
directly at tsx's actual entry file works on every platform regardless of
which shim npm generated.
**Consequence, confirmed by re-running the suite.** With the fix in place,
the same 4 integration tests actually ran against the real Supabase project
already configured in this repo's `.env.local` — not skipped — and passed
(1.48 s / 0.19 s / 0.22 s / 1.70 s; real network round trips, not the
sub-millisecond timing of the unit tests around them). This closes one of
the "Not yet verified against a real Supabase project" items this README's
Verification status section listed.
**Reversal cost.** Low — one line in `package.json`; no test file depends on
the loading mechanism itself, only on the variables it makes available.

### ADR-018 — `email_hash` opacity blocks unlock-by-stranger; lockout-by-stranger is reachable through the real form and is an accepted risk, not a bug
**Decision.** `is_login_blocked`, `record_login_failure` and
`clear_login_attempts` remain `SECURITY DEFINER`, `grant execute to anon,
authenticated` (ADR-012, unchanged). No `SUPABASE_SERVICE_ROLE_KEY` was
introduced. `record_login_failure`'s cleanup was additionally scoped to the
identity being written (`supabase/migrations/20260730000000_...sql`) as
hygiene — the cross-identity data-destruction bug was already closed by
`20260729000000_fix_login_attempts_cleanup.sql`; this migration only narrows
which rows each call's cleanup touches, it does not fix a vulnerability.
**Two distinct findings below — do not conflate them; they have different
verdicts.**

**Finding A — unlocking a victim (`clear_login_attempts`) requires the salted
hash, which nothing outside the server can produce. Not exploitable.** The
hash is `sha256(salt:normalizedEmail)`, computed only in
`login-rate-limiter.ts`'s `hash()` — a `server-only` module — from
`LOGIN_ATTEMPT_SALT`, a server-only env var (no `NEXT_PUBLIC_` prefix).
Verified empirically, not assumed: a production build's `.next/static`
output (what actually ships to browsers) was grepped for both the variable
name and its literal value — zero matches either way; both appear only in
`.next/server`, which never leaves the Vercel function. None of the three
RPCs ever returns a hash to the caller, so there is no oracle to recover one.
An attacker who knows only a victim's plaintext e-mail has no path to the
matching hash short of brute-forcing a 256-bit random salt.

**Finding B — locking a victim out (`record_login_failure`) needs no hash at
all: it is reachable through the real sign-in form by anyone who knows the
victim's e-mail address. Exploitable today. Accepted as risk, not fixed.**
Reproduced against the actual running application, not a raw RPC call: 5
wrong-password submissions on the real `/entrar` form for a fresh target
e-mail each rendered "E-mail ou senha não conferem"; the 6th rendered
"Muitas tentativas seguidas" (`rate_limited`). No hash, no salt, no secret
was used — the attacker only ever typed a public e-mail address and an
arbitrary wrong password into the same form a real visitor uses. A
front-door-equivalent regression test lives in
`tests/login-rate-limiter.integration.test.ts` (it reproduces `hash()`
inline and drives the RPCs with `auth-rules.ts`'s real thresholds, since
`login-rate-limiter.ts`/`supabase-auth-gateway.ts` cannot be imported from a
plain `tsx --test` process — the same `server-only` constraint ADR-015
already documents).
**Why this is being accepted rather than fixed.** This is the rate limiter
working exactly as ADR-012 designed it: blocking by identity (e-mail), not
by caller, so credential stuffing against one account is stopped regardless
of which IP it comes from. Any lockout keyed on "how many times has X failed
recently" is triggerable by anyone who can cause a failure for X, and the
only identity available before authentication succeeds is the e-mail address
itself — not a secret, since it is what any visitor types into the public
form. This trade-off is standard for per-account lockout mechanisms
industry-wide; it is not specific to this implementation.
**Product consequence, recorded plainly.** Any SETNAR-licensed
representative can be locked out of `/entrar` for the 15-minute window
(`LOGIN_RATE_LIMIT_WINDOW_MS`, `auth-rules.ts`) by anyone who knows or
guesses their e-mail — no account access, no password, no secret required.
This is a real, user-facing availability cost, not a hypothetical.
**What was NOT done, and why.** *Blocking only by IP, dropping the
per-e-mail limit* — rejected: ADR-012 already explains why an IP-only limit
fails on Brazilian mobile CGNAT (too loose to catch a targeted attack, or it
locks out every unrelated user sharing that carrier's IP); removing the
e-mail-keyed limit to close this DoS would reopen the credential-stuffing
protection it exists for, a worse trade. *A lockout that also invalidates an
already-active session* — not implemented, and this finding does not need
it: the block only prevents a *new* sign-in for that e-mail; a session
already established before the lockout is unaffected. The blast radius here
is "cannot log in for up to 15 minutes", not "gets signed out."
**Signal that would make us revisit.** A real abuse report (a licensee
actually locked out by someone else, not a theoretical), or CAPTCHA becoming
available first. `supabase/README.md` §4 now names CAPTCHA
(Turnstile/hCaptcha on Supabase's own auth endpoints) as the next lever for
native rate limiting; the same lever raises the cost of triggering this
lockout too, since it requires solving a challenge per attempt instead of a
bare form submission.

**Operational consequence, surfaced while investigating the hash — not a
security finding, recorded because it matters.** `hash()`
(`login-rate-limiter.ts:23-29`) throws if `LOGIN_ATTEMPT_SALT` is unset,
with no fallback. Because `isLoginBlocked`/`recordLoginFailure` sit directly
in `SupabaseAuthGateway.signIn()`'s path, an unset `LOGIN_ATTEMPT_SALT` in
production does not degrade rate limiting — it throws before
`signInWithPassword` is ever called, taking down every sign-in attempt for
every user immediately. This is the opposite of `isLoginBlocked`'s own
documented fail-open trade-off, which only covers RPC *errors*, not a
missing env var upstream of the call. Rotating `LOGIN_ATTEMPT_SALT` has
equivalent severity from a different angle: every hash already stored in
`login_attempts` was computed with the old salt, so a rotation makes every
existing row permanently unmatchable against any hash computed with the new
salt — functionally equivalent to truncating the table for every identity at
once. Neither is changed by this ADR; both are recorded here because they
surfaced during this investigation, not because a fix is proposed.

**Alternative rejected: move these RPCs behind `SUPABASE_SERVICE_ROLE_KEY`.**
This project has never held a service-role key — ADR-011/012 were built
specifically to avoid needing one, and `20260728000000_create_profiles.sql`'s
own header says so. Introducing one now trades a risk that is already
structurally bounded for Finding A (breaking a salted hash to touch one
table) for an unbounded one (a leaked service-role key bypasses RLS on every
table in the project) — and would do nothing for Finding B, which needs no
hash to begin with.
**Alternative rejected: hash inside Postgres instead of the TypeScript
layer.** Floated as cheaper, but worse for Finding A: it would mean these
RPCs accept a *plaintext* e-mail and salt it server-side, removing the
barrier that finding depends on — anyone who knows a victim's e-mail could
recover the "hash" path with no secret at all.

**Reversal cost.** Low for Finding B specifically if CAPTCHA is added later —
raises the cost of triggering the lockout without changing the
identity-keyed design. Low to revisit the service-role alternative for
Finding A if the threat model changes (e.g. a future endpoint that must
return a hash to a client for some reason).

### ADR-019 — `getCurrentTermsVersion()` also fails open on `createClient()` throwing, not only on the RPC's `{ error }`
**Bug, reproduced before any fix.** With `NEXT_PUBLIC_SUPABASE_URL`/
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` absent at build time, `next build`
succeeds, but `next start` turned `GET /termos` and `GET /privacidade` into
HTTP 500: `createServerClient()` (`shared/lib/supabase/server.ts`) throws
synchronously — `Error: Your project's URL and Key are required to create a
Supabase client!` — before `getCurrentTermsVersion()`'s existing `{ error }`
handling ever runs. Confirmed with a real build/start/curl cycle, not
inferred from reading the code.
**Decision.** The `try/catch` was added only inside `getCurrentTermsVersion()`
(`modules/auth/infrastructure/auth-gateway-factory.ts`), wrapping both the
`createClient()` call and the `.rpc('current_terms_version')` call. Each
branch logs a distinguishing `console.error` (config-throw vs RPC-error vs
RPC-throw) before returning `null` — the same contract the pre-existing
`{ error }` branch already had.
**What this covers now.** `/termos` and `/privacidade` render the full legal
text and "Versão indisponível no momento" across all three failure modes:
the RPC returns `{ error }`, the RPC call rejects unexpectedly, or
`createClient()` itself throws because the Supabase env vars are missing or
invalid. Verified both extremes end to end: no env vars → `200` with the
fallback label and a logged, distinguishable error; valid env vars → `200`
with the real version from `current_terms_version()`.
**What this deliberately does NOT cover — `createClient()` and
`getAuthGateway()` still throw, unchanged.** `signInAction`/`signUpAction`/
`signInWithProviderAction` (`modules/auth/presentation/actions.ts`) call
`getAuthGateway()`, which calls the same `createClient()` — neither catches.
A missing or invalid Supabase config still 500s every sign-in/sign-up
attempt. This is intentional, not an oversight left over from this fix:
unlike the legal pages, there is no safe degraded rendering for
authentication — a `SupabaseAuthGateway` built on a broken client (or, worse,
some placeholder client an alternative fix might have manufactured) is a
worse failure mode than a visible 500. **Do not "fix" this asymmetry by
making `createClient()` fail open or return `null`** — that would force
every caller, including the auth Server Actions, to null-check, and a
silently-degraded auth path is precisely the risk being avoided here for
`/termos` and `/privacidade` specifically, not a general policy.
**Alternative rejected: make `createClient()` itself catch and return `null`
or a stub client.** Rejected because it moves the fail-open decision into
the one place that cannot know which caller can tolerate it — every caller,
including the security-critical auth path, would inherit the same
permissive behavior.
**Reversal cost.** Low — confined to one function; removing the `try/catch`
restores the original throw-through behavior, and no other file depends on
the new contract.

### ADR-020 — Auth Server Actions never let an unexpected exception become a silent no-op; `safeAuthCall` is the one place that decides
**Bug, reproduced before any fix, in all three call sites.** With
`NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` absent,
`getAuthGateway()` throwing inside `signInAction`/`signUpAction`/
`signInWithProviderAction` (`modules/auth/presentation/actions.ts`) had no
consistent, safe outcome:
- **Sign-in and sign-up forms** (`sign-in-form.tsx`, `sign-up-form.tsx`):
  react-hook-form's `handleSubmit` (`node_modules/react-hook-form/dist/index.esm.mjs:3007-3030`)
  already wraps the `onSubmit` callback in its own `try/catch`, so
  `isSubmitting` correctly resets — the button does **not** get stuck — but
  it then re-throws the caught error, which becomes an unhandled promise
  rejection. No `FormAlert` ever renders: `setFailureCode` is never reached.
  Confirmed in-browser: the submit `POST` returned `500`, no `[role=alert]`
  element existed afterward, and the button read "Entrar"/"Criar conta",
  not disabled.
- **Social sign-in button** (`social-auth-buttons.tsx`): worse, confirmed by
  temporarily enabling `googleAuth` on the tenant and clicking it — no
  `try/finally` existed around `signInWithProviderAction`, so
  `setPending(null)` (originally placed *after* the `await`) never ran.
  `aria-busy` stayed `"true"` and the spinner kept animating indefinitely;
  `onFailure` was never called either.
Both are the same root cause as ADR-019 — an exception the caller never
expected — but the correct fix here is the opposite of ADR-019's: this path
must fail **closed and visibly**, not open and silently. Silently proceeding
past a broken `getAuthGateway()` is not an option for authentication in the
first place, and silently doing *nothing* visible to the user is just as
wrong as a fake success would be.
**Decision.** `safeAuthCall<T>(call: () => Promise<T>)`
(`modules/auth/presentation/safe-auth-call.ts`) wraps the body of all three
Server Actions. On an unexpected exception it logs `console.error` with the
real error, then returns `failure('unknown')` — turning a would-be
unhandled rejection into a normal `AuthFailure` the existing UI already
knows how to render (`FormAlert` via `authErrorCopy`). `social-auth-buttons.tsx`
additionally wraps its own `setPending(null)` in a `finally`, so the spinner
clears even in the (now theoretical, but not guaranteed forever) case of a
throw reaching the client.
**Why `getAuthGateway()` is called *inside* the callback passed to
`safeAuthCall`, not before it.** `return safeAuthCall(async () =>
signIn(await getAuthGateway(), parsed.data))` — not
`const gateway = await getAuthGateway(); return safeAuthCall(async () =>
signIn(gateway, ...))`. The latter would run `getAuthGateway()` outside the
`try`, protecting nothing while reading as if it were protected. Covered by
a dedicated test (`tests/safe-auth-call.test.ts`) that fails the *first*
step of the callback, not the use case, and asserts the use case body never
runs.
**Why `'unknown'` was reused instead of a new `AuthErrorCode`.** It already
exists for exactly this shape of problem — Zod parse failures in the same
file already return `failure('unknown')`, and `mapSupabaseAuthError` falls
back to it for anything unrecognised. Its copy ("Não foi possível concluir
agora / Tente novamente em instantes") is already generic enough to not
imply a specific domain cause, and is already visually and semantically
distinct from every specific code (`invalid_credentials`, `rate_limited`,
etc.). A new code would only be justified if it needed different copy or
different handling; it doesn't.
**Why the catch does not swallow `redirect()`/`notFound()`.** Both work by
throwing an `Error` whose `digest` starts with `NEXT_REDIRECT` or
`NEXT_HTTP_ERROR_FALLBACK` — Next's own rendering pipeline depends on that
throw reaching it uncaught. No auth action calls either today, so this is
inert right now, but Sprint B's planned post-login redirect will add one to
`signInAction`. A blind `catch` would then turn every successful login's
redirect into a visible "Não foi possível concluir agora" — the failure
mode is worse than doing nothing, because it actively contradicts a
successful sign-in. `safeAuthCall` checks the `digest` prefix and re-throws
when it matches; see the full rationale and the "what breaks this on a
Next.js upgrade" note in `safe-auth-call.ts`'s own comment, including why a
public, stable Next.js export was not available to depend on instead
(`next/navigation` does not re-export `isRedirectError`/
`isHTTPAccessFallbackError` in the installed 15.5.22).
**Why `safeAuthCall` lives outside `actions.ts`.** `actions.ts` has
`'use server'` and imports `getAuthGateway`, which starts with `import
'server-only'` — unconditionally throwing the moment anything requires it
outside Next's bundler, the same constraint ADR-015 already documents as
the reason `isDuplicateSignUp` was extracted into its own file. `actions.ts`
itself is therefore still not unit-testable; `safeAuthCall` is, because it
has no such import.
**This ADR and ADR-019 form one policy, not two unrelated fixes — read them
together.** Both exist because `createClient()`/`getAuthGateway()` throw on
misconfiguration, and both had to decide what a *caller* does with that.
The two decisions are deliberately opposite, and that asymmetry is the
point, not an inconsistency to "clean up" later:
- `/termos`, `/privacidade` (ADR-019): fail **open**, degrade **silently**
  to the user (only the version label changes) — these pages have a safe
  default rendering and must never 500.
- Auth Server Actions (this ADR): fail **closed to the network's actual
  effect** (no login/signup happens) but **visibly** to the user (an alert
  explains something went wrong) — there is no safe default "pretend it
  worked" rendering for authentication, and doing nothing visible is its
  own bug, the one this ADR fixes.
**What is NOT covered, and is manual-only.** No end-to-end browser
assertion runs in CI; the three flows above were verified by hand against a
running `npm run dev` instance with the Supabase env vars removed (and, for
the social button, `googleAuth` temporarily flipped to `true` on the tenant
and reverted after — confirmed clean via `git diff`). `safeAuthCall`'s
mechanism is unit-tested; the actual wiring inside `actions.ts` (that each
call site truly puts `getAuthGateway()` inside the callback, not before it)
is not and cannot be, for the same `server-only` reason `actions.ts` itself
has no tests.
**Reversal cost.** Low for the `try/finally` in `social-auth-buttons.tsx`.
Low-to-medium for `safeAuthCall` itself — removing it restores the original
unhandled-rejection/stuck-spinner behavior this ADR exists to prevent, and
any future auth Server Action that skips wrapping its body in
`safeAuthCall` silently reopens the same hole for that one action.

### ADR-021 — Session-refresh middleware, refresh-only by design
**Decision.** `src/middleware.ts` calls `updateSession()`
(`shared/lib/supabase/middleware.ts`) on every non-static request. It does
exactly one thing: build a `@supabase/ssr` client bound to the request's/
response's cookies and call `supabase.auth.getUser()`, which refreshes the
access token when it is near expiry and writes the refreshed cookie back
onto the response. It does not decide what counts as a protected route —
that stays entirely in `/app/page.tsx`'s own `redirect()`.
**Why this needs its own Supabase client, distinct from
`shared/lib/supabase/server.ts`.** `server.ts` reads/writes cookies through
`next/headers`'s `cookies()`, which does not exist in middleware —
middleware runs before that request lifecycle even starts. Confirmed
against the installed `@supabase/ssr` (0.12.4) type definitions before
writing any of this, not assumed from memory:
`node_modules/@supabase/ssr/dist/module/createServerClient.d.ts`'s own JSDoc
documents a `getAll`/`setAll` shape specifically for middleware use,
including a second `headers` argument to `setAll` that must also be applied
to the response (`Cache-Control`, etc., so a response that just set an auth
cookie is never cached by a CDN/reverse proxy for a different user). The
deprecated `get`/`set`/`remove` shape is not used anywhere.
**Why the matcher excludes static assets, `_next/*` and images.** The same
cost concern ADR-001 already raised against putting *tenant* resolution in
middleware ("runs on every asset request for no gain") — a session check is
cheaper than a Host-based tenant lookup, but still pointless work against a
CSS bundle or a favicon that never carries a session cookie relevant to it.
**Why splitting "refresh" from "protect" into two places, not one
middleware that does both.** A route becomes (or stops being) protected by
editing that one page's own `redirect()`, without touching the single file
every request already pays the cost of running. Folding the protected-route
allowlist into middleware would mean every new protected route requires
editing a file with no direct connection to that route.
**Consequence.** Every request (except the excluded assets) now does one
`getUser()` round trip to Supabase, even for fully public pages (`/`,
`/termos`, `/entrar` itself). Accepted: this is the only correct place to
refresh a token before a Server Component renders — Server Components
cannot write cookies at all (`server.ts`'s own `setAll` silently no-ops
there, by design).
**Reversal cost.** Low — deleting `src/middleware.ts` returns to no
proactive session refresh (a session would only ever refresh reactively,
e.g. on a client-side Supabase call); it does not affect `/app`'s own
protection, which reads the session independently through
`getCurrentUser()`.

### ADR-022 — Password reset: Confirm email decided OFF, and the flow this closes for Sprint B
**Decision, closing what ADR-016 left open.** "Confirm email" is turned OFF
in the Supabase dashboard (`supabase/README.md` §2) — a closed product
decision for this sprint, not a "to be decided" note anymore.
`auth.signUp()` therefore always returns an active session immediately.
`AuthPendingConfirmation`/the `awaitingConfirmation` branch in
`sign-up-form.tsx` stay in the code exactly as ADR-016 built them — dead in
production today, not removed or simplified, ready for the day self-hosted
SMTP exists and this setting is switched back on.
**Two-step flow, mirroring Supabase's own documented pattern.** (1)
`/esqueci-senha` calls `requestPasswordResetAction` →
`AuthGateway.requestPasswordReset(email, redirectTo)` →
`supabase.auth.resetPasswordForEmail()`, with `redirectTo` pointing at
`GET /auth/callback?next=/redefinir-senha`. (2) The user clicks the e-mail
link; `GET /auth/callback` — **the first Route Handler in this project** —
exchanges the PKCE `code` for a session via `exchangeCodeForSession()` and
redirects to `/redefinir-senha`. (3) That page's form calls
`updatePasswordAction` → `AuthGateway.updatePassword()`, authorized entirely
by the session the callback just established — the form itself has no
e-mail field; identity comes from the cookie, never from user input.
**Why a Route Handler, and not a Server Component or Server Action, for step
2.** Exchanging the code is not a pure render — it has a real side effect
(writing an auth cookie) triggered by a `GET` request from an e-mail
client, which cannot invoke a Server Action. `shared/lib/supabase/server.ts`'s
own docstring already lists Route Handlers as one of its three valid
consumers; this is the first time anything in the app actually needed one.
**Anti-enumeration, verified, not assumed.** `requestPasswordReset`'s
success path never checks whether the account exists —
`SupabaseAuthGateway.requestPasswordReset` returns success on `!error`
unconditionally, and Supabase's own `resetPasswordForEmail` is documented
to answer identically (no `error`) for both an existing and a non-existent
e-mail; only a project-wide send-limit produces a real `error`.
`ForgotPasswordForm`'s success copy ("Se este e-mail tiver uma conta,
enviamos um link…") matches that behaviour instead of contradicting it.
**`reset_link_expired` is its own `AuthErrorCode`, not reused `unknown`.**
`SupabaseAuthGateway.updatePassword` checks for a session explicitly before
calling `updateUser()` — the only way to reach that method without one is
an expired, already-used, or tampered link — and that failure needs
different copy ("request a new link") from every other `unknown` case
("try again"), the same bar ADR-020 applied when it chose to *reuse*
`unknown` for a different failure instead of adding a code.
**Shares the project's 2-e-mails/hour Supabase cap (ADR-014), not a new
one.** `resetPasswordForEmail`'s errors are mapped through the existing
`mapSupabaseAuthError`, which already turns Supabase's
`over_email_send_rate_limit` into `email_service_unavailable` — the same
code sign-up's duplicate-e-mail-service-error path uses. Recorded here as a
real constraint, not blocking anything: password-reset e-mails and sign-up
confirmation e-mails (dormant while Confirm email is off) draw from the
same 2/hour project-wide quota. Revisit if reset volume and any future
confirmation-e-mail volume start competing for it.
**Reversal cost.** Medium — the three routes and the Route Handler would
need to be removed together; `AuthGateway.requestPasswordReset`/
`updatePassword` have no other caller today.

### ADR-023 — `?next=` is validated server-side before every `redirect()`, not trusted from the query string
**Decision.** `safeRedirectTarget()`
(`modules/auth/presentation/safe-redirect-target.ts`) is the single gate
every `?next=` value passes through before reaching a `redirect()` call:
`signInAction`, `signUpAction`, `signInWithProviderAction`, and
`GET /auth/callback`. It accepts only a same-origin path starting with
`/`, rejects `//host` (protocol-relative) and anything not starting with
`/`, and falls back to `/app` otherwise.
**Why this is a real vulnerability, not theoretical.** `?next=https://
site-malicioso.com` (or `?next=//site-malicioso.com`) makes a link that
visibly points at Setnar's own trusted domain end on an attacker's page
right after a real, successful login — a classic phishing-ready open
redirect, made more convincing precisely because the address bar shows the
genuine `setnar.com` domain up until the final hop.
**Why validated inside the Server Action, not only on the page reading
`searchParams`.** `/entrar`/`/criar-conta` do sanitise `next` before passing
it to the form (`safeRedirectTarget(next)` in each page), but that pass is
UX-only. A Server Action is a callable endpoint independent of the React
tree that happens to invoke it — nothing stops a request calling
`signInAction` directly with an arbitrary `next` argument, bypassing the
page entirely. The actual security boundary is the last point before
`redirect()` runs, which is inside `safeAuthCall`'s callback in each action.
**Why the backslash check, beyond the two cases the tests require.**
`/\site-malicioso.com` starts with `/` and is not literally `//`, so it
would pass a check that only looks for that exact prefix — some URL parsers
have historically normalised a leading `/\` the same as `//`. Costs nothing
to also reject, and there is no legitimate reason for a backslash in one of
this app's own paths.
**Tested, not just reasoned about.** `tests/safe-redirect-target.test.ts`
covers a valid relative path (accepted), an absolute URL (rejected), a
`//`-prefixed value (rejected), the backslash case, and empty/missing
input.
**Reversal cost.** Low — a single pure function; every call site already
goes through it, so removing or weakening the check is a one-line diff to
spot in review.

### ADR-024 — Session-refresh middleware fails open on "missing or invalid" config, exactly ADR-019's own scope — with the two causes kept distinguishable, logged once per process
**Bug, reproduced before any fix, on every route.** An external audit
reported HTTP 500 on `/`, `/termos` and `/privacidade` — not just the
authenticated routes ADR-019/ADR-020 already cover — whenever
`NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are unset.
Confirmed with a real `next build` + `next start` + `curl` cycle, not
inferred from reading the code: `src/middleware.ts` calls `updateSession()`
(`shared/lib/supabase/middleware.ts`) on every non-static request (ADR-021),
which passed `process.env...!` straight into `createServerClient`. That
throws synchronously — `Error: Your project's URL and Key are required to
create a Supabase client!` — before any page's own code, including
ADR-019's fail-open `getCurrentTermsVersion()`, ever runs. Because
middleware sits in front of everything, this one throw took down `/` too,
which has no Supabase call of its own at all.
**First version of this fix was too narrow, and contradicted ADR-019 —
caught in review, not shipped.** ADR-019 states its own scope explicitly:
`getCurrentTermsVersion()` fails open "because the Supabase env vars are
missing or invalid" (that ADR's own wording, above). A first pass at this
fix only guarded on *missing* vars in middleware, leaving a
present-but-malformed URL still throwing there — which still 500'd
`/termos` and `/privacidade` before either page's own ADR-019 fail-open
code could run, silently narrowing ADR-019's stated guarantee for exactly
the two pages it names. Two ADRs disagreeing about the same case in the
same README is a bug in the README, not an acceptable trade-off — fixed
below by matching ADR-019's scope, not by re-arguing it.
**Three scenarios exist here, verified separately, and they are not the
same bug.**
1. **Env vars absent (or present but empty — `NEXT_PUBLIC_SUPABASE_URL=`
   with no value, the common shape of "set but left blank" on Vercel).**
   `createServerClient` throws on its own presence check. Falls under
   ADR-019's "missing" branch.
2. **Env vars present, well-formed, pointing at a project that does not
   exist** (verified against `https://nao-existe-xyz123.supabase.co`).
   `createServerClient` does not throw — it only checks presence, not
   reachability — and `supabase.auth.getUser()`'s own network failure is
   caught internally by `@supabase/ssr`/`@supabase/auth-js` and returned as
   an error value, not thrown. `/`, `/termos`, `/privacidade` were already
   `200` and `/app` already `307` to `/entrar?next=/app` in this scenario,
   **before any change in this ADR** — confirmed by curl against the
   unmodified code first, specifically to delimit what needed fixing from
   what already worked. This is a network failure, not a configuration
   error, is not mentioned anywhere in ADR-019's "missing or invalid"
   wording, and stays out of scope here.
3. **Env vars present but malformed** (verified with
   `NEXT_PUBLIC_SUPABASE_URL=not-a-valid-url`). `@supabase/supabase-js`'s
   `SupabaseClient` constructor validates the URL eagerly and throws
   `Error: Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL.` — a
   different, real error, still reproducing the same 500. Falls under
   ADR-019's "invalid" branch — the case the first version of this ADR
   missed.
**Decision.** `updateSession()` fails open on both scenario 1 and scenario
3, matching `getCurrentTermsVersion()`'s own scope exactly: an explicit
presence check first (also catching the empty-string case — `!''` is
`true` — so a blank-but-set var reads as "missing", not a third category),
then a `try/catch` scoped narrowly to the `createServerClient(...)` call
itself (nothing else) to catch scenario 3's synchronous validation throw.
Both branches return `NextResponse.next({ request })` unchanged — no
client is built, no refresh attempted, the request proceeds exactly as if
middleware did not exist for it — and each logs its own distinguishable,
**once-per-process** `console.error` (a module-level `{ missing, invalid }`
flag pair, tracked independently so hitting one first never suppresses the
other): *"...not set — session refresh is disabled..."* for scenario 1,
*"...are set but invalid — session refresh is disabled..."* for scenario 3.
Neither message is a substring of the other, checked directly in
`tests/supabase-middleware.test.ts`.
**Why a `try/catch` here doesn't repeat ADR-019's own rejected
alternative.** ADR-019 rejects making `createClient()` itself catch and
fail open, because that would force *every* caller — including the
security-critical auth Server Actions — to inherit the same permissive
behaviour, with no way for a caller that needs to fail loud (`getAuthGateway()`)
to opt out. That objection is about *where* the catch lives, not about
catching at all: this `try/catch` lives in `updateSession()` itself, wraps
only the `createServerClient(...)` call (a synchronous, no-network,
config-validation step — confirmed by reading `validateSupabaseUrl` in
`node_modules/@supabase/supabase-js/src/lib/helpers.ts` before writing
this, not assumed), and is invisible to every other caller.
`shared/lib/supabase/server.ts`'s `createClient()` is untouched and still
throws — sign-in/sign-up still 500 on the exact same misconfiguration, per
ADR-019's own explicit carve-out, unchanged by this ADR.
**Why "fail loud" for middleware means a distinct log line, not a 500 on a
public page.** ADR-019 already forecloses 500ing `/termos`/`/privacidade`
for this exact cause; there is no principled reason `/` — which makes no
Supabase call of its own — should be *worse* protected than pages that
call Supabase directly. "Loud" here is aimed at whoever reads production
logs, not at the visitor: a present-but-malformed URL is a real deploy bug
(a truncated copy-paste, a typo) that must not read identically to "nobody
has configured Supabase yet" in the log, even though both currently
produce the same HTTP response. Collapsing the two into one `try/catch`
with one message — the shape of the fix's first, rejected draft — would
have hidden that distinction; two messages, two independently-tracked
flags, keep it.
**Why once per process, not once per request.** Middleware runs on every
non-static request (ADR-021) for the entire lifetime of a misconfigured
deployment; a `console.error` per request would flood the log with the
same fact on every hit, from the first request onward, with nothing new to
learn from repetition. Verified against a running server, not only against
a unit test: two consecutive `curl`s (`GET /`, `GET /termos`) against a
build with the env vars absent produced exactly one matching log line, not
two — `grep -c` against the captured server output confirmed this
directly.
**Why `getCurrentUser()`'s fail-closed-to-`null` behaviour needed no
change.** `/app`'s protection does not depend on this middleware at all —
`getCurrentUser()` (`auth-gateway-factory.ts`) calls `createClient()`
independently and already catches any exception, including both the
missing- and invalid-config throws, returning `null`. Verified unchanged
after this fix, for both scenario 1 and scenario 3: `/app` still redirects
`307` to `/entrar?next=/app`.
**What this deliberately does NOT cover.** `getAuthGateway()` and
`createClient()` (`shared/lib/supabase/server.ts`) are unchanged — ADR-019
already explains why sign-in/sign-up must keep failing loud (a visible 500,
not a degraded log line) on the same misconfiguration, and that reasoning
is untouched here. Only the middleware's own client construction got the
guard.
**Tested, not just reasoned about.** `tests/supabase-middleware.test.ts`
imports `updateSession` and `resetUpdateSessionWarningsForTests` directly
— `updateSession` has no `import 'server-only'`, unlike `server.ts`, so no
mock or stub of the Next.js runtime is needed. The reset export exists only
because the warn-once state is deliberately module-level (see "once per
process" above), which would otherwise let only the first test per
process observe a given warning; it is not used outside this test file.
Six cases: both vars missing, only one missing, both set to empty strings,
a malformed-but-present URL, a second call proving the once-per-process
dedupe, and a case proving the missing/invalid flags don't suppress each
other. Full `npm run verify`
(`typecheck && lint && test && test:integration && build`) passes end to
end after this change.
**Reversal cost.** Low — confined to `updateSession()`; removing the
`try/catch` around client construction restores the narrower,
ADR-019-inconsistent behaviour this revision fixes, while removing the
whole guard restores the original throw-through bug.

### ADR-025 — `server.ts`'s `setAll` does not apply `@supabase/ssr`'s anti-cache headers; Next's own dynamic-rendering default already does
**Question raised, verified before deciding.** `@supabase/ssr` 0.12.4's
`createServerClient` passes a second argument to `setAll` — `headers`, the
`Cache-Control`/`Expires`/`Pragma` values the library's own type doc says
callers "must" apply alongside a cookie write, so that a response setting
an auth cookie is never cached by a CDN or reverse proxy and replayed to a
different user (`node_modules/@supabase/ssr/dist/module/types.d.ts`'s own
JSDoc on `SetAllCookies`, read directly, not assumed). `shared/lib/supabase/server.ts`'s
`setAll(cookiesToSet)` only ever declared the first parameter — the second
is silently dropped. `shared/lib/supabase/middleware.ts` already applies it
correctly (ADR-021); this ADR is only about `server.ts`.
**Verified live, not assumed, against a production build (`next build` +
`next start`), on the actual cookie-writing path.** A `fetch` wrapper was
injected into a real signed-in browser session to capture true response
headers (`Headers.entries()`, not guessed) for the exact Server Action that
calls `server.ts`'s `createClient()` and writes a fresh session cookie —
`signInAction`, via `POST /entrar` (confirmed by its own
`x-action-redirect: /app;push` header). The captured response:
`cache-control: private, no-cache, no-store, max-age=0, must-revalidate`.
The same exact string was independently observed on an unrelated dynamic
response (`/app`'s own `redirect()` for an unauthenticated visitor, via
plain `curl -D-`) — confirming this is Next's blanket default for *any*
dynamic response, not a coincidence specific to the sign-in action.
**Decision: documented, not applied.** `server.ts`'s `setAll` keeps
ignoring the `headers` argument. Every caller of `createClient()` already
calls `await cookies()` (line 17, above `createServerClient`) before
`setAll` can ever run — and `cookies()` is what forces a Next.js App Router
route out of static/cacheable rendering into fully dynamic rendering in the
first place. That forced-dynamic path is what emits the header captured
above, for every response from every caller of this function, whether or
not that particular call happens to write a cookie. Applying the library's
headers on top would be redundant in this stack today.
**Why this isn't "skip it because it currently doesn't bite," the same
class of reasoning ADR-019 explicitly rejected elsewhere.** The two cases
differ in what the fallback is if the assumption breaks. ADR-019's rejected
alternative would have made a *silent* wrong default the norm for every
caller, including security-critical ones, with no signal if the assumption
stopped holding. Here, the fallback if Next.js ever stopped forcing dynamic
rendering on `cookies()` usage would be a *missing* `Cache-Control` header
— which is not silent: it is directly observable with one `curl -D-`
against any route that reads `cookies()`, exactly how this ADR's own
finding was produced, and Next.js's own docs treat "reading `cookies()`
forces dynamic rendering" as foundational, documented App Router behaviour,
not an implementation detail likely to change silently.
**What `Expires`/`Pragma` add that `Cache-Control` alone captured above
does not — nothing observable in this stack.** The captured header omits
`Expires`/`Pragma` entirely; only `Cache-Control` is present. Both legacy
headers exist for HTTP/1.0-only caches to honour the same "do not store"
instruction `Cache-Control: no-store` already gives every HTTP/1.1+ cache —
Vercel's edge network and every modern browser are in the latter group.
Their absence changes nothing for the actual risk `@supabase/ssr`'s
contract exists to prevent.
**Reversal cost.** Low — applying the ignored `headers` argument the same
way `middleware.ts` already does is a five-line change if this assumption
is ever revisited (e.g. a future Next.js version changing dynamic-rendering
defaults, or a caller of `createClient()` appearing outside a context that
forces dynamic rendering).

### ADR-026 — Representative pages resolve by subdomain (`<slug>.<domain>`), not by path — decided before Sprint C, before a single QR code exists
**Decision.** Every representative's commercial page (Sprint C — the page
generator itself is not built yet) will be served on its own subdomain,
e.g. `joao-silva.setnar.com.br`, not on a path under SETNAR's domain
(`setnar.com.br/joao-silva`). Decided now, before the generator exists and
before any representative has a QR code, business card, or WhatsApp bio
link pointing anywhere.
**Alternatives.** Path-based (`setnar.com.br/joao-silva`) is cheaper today —
no wildcard DNS, no wildcard certificate. Rejected for two reasons, in this
order of weight: (1) the cost of changing URL schemes only grows over time
— there is no number of already-distributed QR codes or physical links that
is "safe" to invalidate, so the cheapest moment to decide is before the
first one exists, not after the MVP is validated and the scheme turns out
to need changing; (2) credibility — a URL carrying the representative's own
name before the domain reads as more trustworthy than a path inside SETNAR's
domain, matching the independent-professional audience `PRODUCT.md`
describes (representatives who sell under their own name, not SETNAR's).
Subdomain per representative (chosen) pays the infrastructure cost once,
now, before any physical material depends on the URL shape.
**Consequence.** Requires wildcard DNS (`*.setnar.com.br`) on Vercel plus a
wildcard SSL certificate configured before public launch — pulling the
purchase/configuration of the production domain forward to before launch,
where `ROADMAP.md`'s Stage 5 "White Label → Custom domains" entry had it
planned for after validation. This is a new hard dependency blocking public
launch, not just a preference. It is compatible with — not a new idea
against — that same Stage 5 vision and `DOMAIN_MODEL.md` §827's White Label
note: that entry is a Company's own custom domain (tenant level 1, what
ADR-001 resolves); this decision is a Representative's subdomain nested
inside SETNAR's domain (tenant level 2, one layer inside the Company ADR-001
already resolves). The two are independent and both hold.
**Reversal cost.** High, deliberately — unlike ADR-001 (`Low`, because no
physical material depended on that URL), reversing this after launch means
invalidating every QR code, business card, and WhatsApp bio link already
distributed by licensed representatives. The team accepts that cost
consciously; this is not modeled as cheap to change later.

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
2. ~~Resolve the Inter / Plus Jakarta Sans contradiction in `DESIGN_SYSTEM.md`.~~
   Done — `DESIGN_SYSTEM.md` now states Plus Jakarta Sans as the preferred
   font, matching ADR-006 and `layout.tsx`.
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
