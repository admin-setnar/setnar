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

### ADR-027 — Company e Representative como entidades reais; nome público do representante vive em `representatives`, não em `profiles`
**Decisão.** Tabelas `companies` e `representatives`
(`supabase/migrations/20260731000000_create_representative_domain.sql`),
com `representatives.profile_id` referenciando `profiles(id)` — réplica da
distinção User/Representative de `DOMAIN_MODEL.md` §7.1/§7.3. O nome
público exibido na Commercial Page é `representatives.display_name`
(`20260731000000_create_representative_domain.sql:175`), não um join com
`profiles.full_name`: `profiles_select_own`
(`20260728000000_create_profiles.sql:27-29`, `auth.uid() = id`) nunca
permitiu leitura pública, e abrir essa policy exporia a linha inteira de
`profiles` (`tenant_id`/`terms_accepted_at`/`terms_version` junto), mais
superfície que o necessário pra expor um nome. Todo outro campo público
(`phone`/`city`/`avatar_url`/`license_id`,
`20260731000000_create_representative_domain.sql:176-179`) já vivia em
`representatives` — o join era a única exceção, agora deixa de ser.
`profiles.full_name` continua existindo como o nome "de cadastro" (usado
em `/app`). **Alternativas rejeitadas.** Ampliar `profiles_select_own` ou
criar uma função `SECURITY DEFINER` só pra esse campo — rejeitadas por
abrir mais superfície do que denormalizar uma coluna que já seguia esse
padrão em todo o resto da tabela. **Custo de reversão.** Médio — sem dado
real de produção ainda, mas uma migração de dados de verdade seria
necessária mais tarde.

### ADR-028 — Product e Product Activation reais; Catalog fica conceitual, não uma tabela própria
**Decisão.** `products` (`company_id`, `slug`, `name`) e
`product_activations` (`representative_id`, `product_id`, `status`
draft/published/unpublished —
`supabase/migrations/20260731000000_create_representative_domain.sql:204-240`)
— o ciclo de vida de publicação da página vive na mesma linha da
Activation, não em duas tabelas separadas. **Por quê não uma tabela
`catalogs` literal.** Com uma Company só, um Catalog por Company é
exatamente `products.company_id` — uma tabela `catalogs` seria uma
tabela de uma linha, sem comportamento próprio. Generalizar isso agora
seria a categoria exata de complexidade prematura que o projeto evita
até validar um segundo nicho/Company. **Custo de reversão.** Baixo para
separar `catalogs` depois, se um dia uma segunda Company existir.

### ADR-029 — Uma Commercial Page por (Representative × Product); sem hub público — o hub é o `/app` privado
**Decisão.** Cada produto ativado tem sua própria página
(`<slug>.setnar.com/<produto>`), não uma página unificada — confirmado
pelos 7 templates de origem em `templates/commercial-pages/`
(ConexaoClub, ConexaoGreen, ConexaoLivre, ConexaoPlacas, ConexaoSolar,
GreenSeguros, Telecom), cada um falando de um produto só. O "hub" de
gerenciamento (links ativos, cliques, KPIs) vive no `/app` autenticado,
não numa página pública no root do subdomínio — `docs/ROADMAP.md` já
separa isso em dois recursos distintos do Stage 1 ("Commercial Pages",
linha 119, vs. "Dashboard", linha 145) — essa decisão só confirma o que
já estava implícito. **Consequência.** `/app`
(`src/app/app/page.tsx`, 53 linhas), hoje um stub mínimo (Sprint B), é o
lugar natural pra crescer — inclusive é onde `DOMAIN_MODEL.md`'s "AI
Content Suggestion Service" (Stage 4, linha 605) vai precisar viver,
quando existir: superfície autenticada, com acesso agregado a
KPIs/analytics/páginas ativas, já é o desenho certo sem construir nada
de IA agora. **Custo de reversão.** Baixo — nenhuma URL pública depende
dessa escolha.

### ADR-030 — Página de representante não resolvível: `notFound()` padrão, mesma URL — não redirect cross-origin
**Decisão.** Quando `resolveRepresentativeActivation` retorna null (host
não é subdomínio de representante válido, produto não existe, ou
activation não está `published`), a rota
(`src/app/[productSlug]/page.tsx:58-60`) chama `notFound()` — reaproveita
`src/app/not-found.tsx`, mantém `<slug>.setnar.com/<produto>` na barra.
Mesma resposta genérica pros três motivos, sem diferenciar — mesmo
princípio anti-enumeração já aplicado nas mensagens de erro de login
deste projeto (ADR-018): alguém testando subdomínios não descobre se um
slug existe, nunca foi publicado, ou está suspenso. **Alternativa
rejeitada.** Redirect cross-origin pra `setnar.com` — destoa do resto do
produto, que evita qualquer coisa que pareça sequestrar a navegação de
alguém (mesma cautela do aviso "não é canal oficial" no rodapé dos
templates). **Custo de reversão.** Baixo.

### ADR-031 — Resolução de Representative é um port novo (`RepresentativeRepository`), distinto do `TenantRepository` do ADR-001
**Decisão.** `TenantRepository` (ADR-001) continua resolvendo Company. Um
port novo, `RepresentativeRepository`
(`src/modules/representatives/domain/representative-repository.ts`),
resolve subdomínio de Representative — `extractRepresentativeSlug`
(`src/modules/representatives/application/resolve-representative.ts:89-110`)
extrai o label antes do domínio conhecido do `Host`, consulta
`representatives`/`product_activations` no Supabase (RLS já filtra pra
linhas públicas, ver ADR-027/028). Resolução de Company é sempre tentada
primeiro; só tenta Representative se isso não bater — cobre
`setnar.com`, `www.setnar.com`, `localhost`
(`src/modules/tenancy/infrastructure/tenants/setnar.tenant.ts:16`) e
previews `*.vercel.app` por construção, sem precisar excluí-los
individualmente no parsing. **Por quê dois ports, não um.** Naturezas
diferentes — lista pequena e fixa em memória vs. dinâmica e ilimitada em
banco. **Custo de reversão.** Baixo — isolado atrás do port, como o
próprio ADR-001 já previa.

### ADR-032 — Rota de produto vive no root (`src/app/[productSlug]/page.tsx`), não atrás de rewrite em middleware
**Decisão.** Rota dinâmica no nível raiz de `src/app/`, resolução dentro
do Server Component — mesmo padrão de `layout.tsx` (ADR-001), sem tocar
`middleware.ts`. Confirmado contra o código-fonte do Next.js instalado
(`node_modules/next/dist/shared/lib/router/utils/sorted-routes.js`,
`_smoosh`): rotas estáticas sempre vencem uma dinâmica irmã pro mesmo
path, em qualquer Host — o router do Next não tem conceito de virtual
host, então não existe risco de uma rota estática existente (`/entrar`,
`/app` etc.) ser "roubada" pela rota dinâmica de produto. **Alternativa
rejeitada.** Path aninhado com rewrite condicional no middleware —
eliminaria por completo o risco (estreito, hipotético) de colisão futura
entre um slug de produto e uma rota estática nova, mas reintroduziria
resolução em middleware numa base que tem o ADR-001 explicitamente
contra isso, só pra mitigar uma colisão que ainda não existe.
**Mitigação do risco aceito.** `tests/route-collision-guard.test.ts` lê
os slugs de produto direto do comentário da migration e falha o CI se
algum colidir com um nome de rota em `src/app/`. **Lacuna conhecida,
documentada, não resolvida aqui.** Rotas estáticas do root continuam
respondendo em qualquer Host, incluindo subdomínio de representante
(`joao-silva.setnar.com/entrar` renderiza o login do próprio Setnar) —
decisão consciente de não bloquear isso agora, não esquecida
(`src/app/[productSlug]/page.tsx:29-35`). **Custo de reversão.** Baixo —
a URL pública não muda; só o arquivo se move internamente se a colisão
virar problema real.

### ADR-033 — Identificação do licenciado é componente estrutural; Subscription é tabela própria desde já, gerenciada manualmente até o gateway existir
**Decisão.** `LicenseeIdentificationBlock`
(`src/modules/representatives/presentation/licensee-identification-block.tsx`)
é um componente próprio, não conteúdo inlined na página — o próprio
comentário do arquivo documenta por quê: é o único bloco que os 7
templates de origem repetem (`grep -rn "Quem vai te atender"
templates/commercial-pages/`), então nasce pronto pra virar layout
compartilhado assim que existir mais de uma página de produto, sem
precisar ser tocado — mesmo raciocínio de denormalizar em vez de
duplicar que motivou ADR-027. `subscriptions`
(`supabase/migrations/20260731000000_create_representative_domain.sql:274-292`,
status active/past_due/suspended/canceled, provider,
external_subscription_id, current_period_end) já nasce no vocabulário
que um gateway real usaria — gerenciada manualmente (`provider =
'manual'` por padrão) até a cobrança automatizada existir, sem RLS
policy nenhuma (mesmo padrão de `login_attempts`: acessível só por
função `SECURITY DEFINER` futura, que ainda não existe — ver o
comentário da migration nas linhas 79-91). **Correção ao texto
original.** Não encontrei, no repositório, nenhum bug documentado de "ID
hardcoded" nos templates originais — os 7 templates usam `{{REP_ID}}`
como placeholder (`templates/commercial-pages/ConexaoGreen/index.html`,
linhas 45/61-62/145/164/352/564/587), não um valor fixo. Essa alegação
foi removida; a justificativa de denormalização (ADR-027) já sustenta a
decisão sem depender dela. **Custo de reversão.** Baixo — a tabela já
nasce no formato que o gateway real vai preencher.

### ADR-034 — Captura de lead via `submit_lead` (SECURITY DEFINER), reaproveitando o padrão e o salt de `login_attempts` — não um novo esquema
**Decisão.** `submit_lead`
(`supabase/migrations/20260801000000_add_lead_submission.sql`), uma função
`SECURITY DEFINER` sobre uma tabela nova `lead_submission_attempts` (RLS
habilitado, zero policies) — o mesmo formato de `is_login_blocked`/
`record_login_failure`/`clear_login_attempts` sobre `login_attempts`
(ADR-012), reaproveitado deliberadamente, não reinventado: essa era
exatamente a lacuna que a nota de design de RLS no topo de
`20260731000000_create_representative_domain.sql` já deixava documentada
("a captura de lead é trabalho futuro, via API route com rate limiting").
`POST /api/leads` (`src/app/api/leads/route.ts`) é a única porta de entrada
— `leads` continua sem policy de INSERT, como antes.
**Por que uma função só, não três.** Login separa leitura
(`is_login_blocked`) de escrita (`record_login_failure`) porque só
tentativas *falhas* contam contra o limite — um login bem-sucedido não pode
ser penalizado. Uma submissão de lead não tem essa distinção: toda
submissão (aceita ou rejeitada) é o próprio evento sendo limitado, então
`submit_lead` checa e grava atomicamente numa função só — o que também
fecha a janela de corrida check-then-act que o split em duas chamadas do
login deixa aberta (uma lacuna já aceita e documentada lá; aqui nem existe,
por construção).
**Por que só IP, sem um segundo eixo de identidade.** Login tem limite por
e-mail *e* por IP porque credential stuffing mira uma conta a partir de
várias origens. Lead não tem um eixo equivalente antes da submissão — o
telefone é o payload sendo enviado, não uma identidade (um visitante real
pode legitimamente submeter o telefone de um familiar a partir do próprio
dispositivo) — então só IP é limitado.
**Reaproveitar `LOGIN_ATTEMPT_SALT`, não criar um segundo salt.** O hash do
IP usa o mesmo `sha256(salt:valor)` de `login-rate-limiter.ts`, lendo a
mesma variável `LOGIN_ATTEMPT_SALT` — nenhuma variável de ambiente nova foi
introduzida. **Consequência aceita conscientemente.** Rotacionar
`LOGIN_ATTEMPT_SALT` no futuro invalida os dois rate limiters ao mesmo
tempo, não só o de login (mesmo efeito que ADR-018 já registra pra
`login_attempts` isoladamente, agora compartilhado). A função de hash em si
não foi extraída pra um util compartilhado — duplicada como uma função
privada de 5 linhas em `supabase-lead-gateway.ts`, pra não acoplar o módulo
de leads ao de auth por tão pouco código; extrair vira a decisão certa se
um terceiro chamador aparecer.
**`representative_id`/`product_id` nunca vêm do corpo da requisição.**
`app/api/leads/route.ts` resolve o representante a partir do header `Host`
da própria requisição, reaproveitando `resolveRepresentativeActivation`
— a mesma função que `[productSlug]/page.tsx` já usa (ADR-031) — em vez de
confiar em IDs enviados pelo cliente. Sem isso, qualquer chamador direto da
rota poderia atribuir um lead a um representante arbitrário. `submit_lead`
ainda valida de novo, no banco, que existe uma `product_activations`
`published` ligando o par (defesa em profundidade, não confiança cega no
resultado da rota).
**Anti-enumeração no retorno.** `submit_lead` retorna `boolean` — `false`
tanto pra "rate limited" quanto pra "representante/produto inválido", sem
distinguir os dois casos, mesmo princípio já aplicado em ADR-018 e ADR-030.
Um par inválido também consome uma unidade do limite por IP (grava em
`lead_submission_attempts` mesmo quando rejeita por esse motivo), pra que
sondar pares válidos não seja um oráculo de tentativas ilimitadas.
**Honeypot reaproveitado do template original, não inventado.** O campo
oculto `empresa` (`aria-hidden`, `tabindex="-1"`,
`templates/commercial-pages/ConexaoGreen/index.html:165`) virou
`LEAD_HONEYPOT_FIELD` — se vier preenchido, a rota responde exatamente como
sucesso (`200 { ok: true }`), sem nunca chamar `submit_lead`, pra não dar
sinal a um bot de que foi pego.
**Threshold escolhido.** 5 submissões por IP a cada 60 minutos — janela mais
longa e limite mais apertado que o de login, porque preencher o mesmo
formulário várias vezes rápido é comportamento de spam, não o
compartilhamento de IP por CGNAT que motivou o limite de 30/15min do login
(ADR-012) — um lead não tem o mesmo risco de bloquear usuários legítimos
vizinhos. **Correção ao texto original, ver ADR-036.** Este parágrafo
originalmente apontava `LEAD_MAX_SUBMISSIONS_PER_IP`/`LEAD_RATE_LIMIT_WINDOW_MS`
(`modules/leads/domain/lead-rules.ts`) como a fonte desses dois números,
passados por `submit_lead` como parâmetros do chamador. `20260802000000_fix_submit_lead_rate_limit.sql`
removeu essa passagem — os dois números acima são hoje literais fixos dentro
da própria função, sem parâmetro nenhum governando-os; as duas constantes em
`lead-rules.ts` foram removidas. O valor do threshold não mudou, só onde ele
vive — ver ADR-036 para o porquê.
**Verificado manualmente contra o projeto de teste, não só com testes
automatizados.** Uma submissão real inseriu uma linha em `leads` (`ok:true`
— só alcançável depois do `insert` bem-sucedido dentro de `submit_lead`,
confirmado lendo a própria função); a 6ª submissão da mesma origem em menos
de uma hora voltou `429`; uma origem diferente não foi afetada pelo mesmo
limite; o honeypot preenchido voltou `200` sem inserir; um representante
inexistente voltou `404`. Rodado via `curl` com `Host` forjado, não pelo
navegador do sandbox de preview — esse não resolve subdomínios
`*.localhost`, limitação do ambiente de teste, não do código. **Essa
verificação, como ADR-036 documenta, provou o comportamento de `POST
/api/leads`, não de `submit_lead` chamado direto — a distinção importa, ver
ADR-036.**
**Alternativas rejeitadas.** Uma segunda variável de ambiente de salt
(`LEAD_SUBMISSION_SALT` ou similar) — rejeitada por criar um segundo
segredo pra rotacionar/vazar sem necessidade, quando reaproveitar
`LOGIN_ATTEMPT_SALT` cobre o mesmo objetivo (nunca guardar IP em texto
puro) sem esse custo. Separar `is_lead_blocked`/`record_lead_submission`
em duas chamadas, espelhando login literalmente — rejeitada porque lead não
tem a distinção sucesso/falha que motiva esse split em login (ver acima).
**Custo de reversão.** Baixo — uma função e uma tabela novas, sem tocar
`leads`/`login_attempts`; removível sem afetar nenhum outro fluxo.

### ADR-035 — Link de WhatsApp construído a partir de `representative.phone`, sem novo campo/formato
**Decisão.** `WhatsappCta`
(`src/modules/representatives/presentation/whatsapp-cta.tsx`) monta um link
`https://wa.me/<dígitos>?text=<mensagem>` a partir de
`representative.phone` — a mesma URL que todo template original já usava
(`https://wa.me/{{REP_WHATSAPP}}?text=...`,
`templates/commercial-pages/ConexaoGreen/index.html`), só trocando o
placeholder pelo dado real. Nenhuma coluna nova: `representatives.phone`
(`20260731000000_create_representative_domain.sql`) já existia e já era
lido por `LicenseeIdentificationBlock` (ADR-033).
**Por que normalizar os dígitos em vez de assumir um formato salvo.**
`representatives.phone` é `text` livre, sem constraint de formato — `wa.me`
exige só dígitos, com código do país, sem `+`/espaços/pontuação. Assume
Brasil (+55), mesma suposição que `formatPhoneToE164` já faz pro telefone
do formulário de lead (ADR-034) e que o resto do projeto já faz em outros
lugares (janela de CGNAT em ADR-012, copy só em português).
**Não depende do endpoint de leads.** É renderizado direto de
`representative.phone`, já disponível em `RepresentativeActivation`
(ADR-031) — nenhuma chamada de rede adicional, nenhuma dependência de
`submit_lead`/ADR-034.
**Consequência.** Se `representative.phone` for `null`, o componente não
renderiza nada (`if (!representative.phone) return null`) — uma página de
representante sem telefone cadastrado simplesmente não mostra o botão, em
vez de mostrar um link quebrado.
**Custo de reversão.** Baixo — um componente sem estado, sem tabela nova.

### ADR-036 — `submit_lead` parava de aplicar seu próprio rate limit para qualquer chamador direto do RPC; corrigido removendo os parâmetros, não flooram com `greatest()`
**Decisão.** `20260802000000_fix_submit_lead_rate_limit.sql` remove
`p_max_attempts_ip` e `p_window_seconds` da assinatura de `submit_lead`
(`supabase/migrations/20260801000000_add_lead_submission.sql`, ADR-034) — os
dois números (5 tentativas / 3600s) viram literais fixos dentro da própria
função, sem parâmetro nenhum governando-os. Adicionalmente, `submit_lead`
ganhou validação mínima de formato/tamanho (telefone, e-mail, nome) — ver
"Validação adicionada" abaixo. Nenhuma outra migration já aplicada foi
editada (regra do README, acima); esta é uma migration nova.
**A vulnerabilidade, e por que o texto original do ADR-034 não a pegou.**
ADR-034 documentou uma verificação manual real (curl, rate limit 429 na 6ª
tentativa) — mas contra `POST /api/leads`, que sempre chamava `submit_lead`
com `p_max_attempts_ip: LEAD_MAX_SUBMISSIONS_PER_IP` e `p_window_seconds:
LEAD_RATE_LIMIT_WINDOW_MS / 1000` fixos (`supabase-lead-gateway.ts`). Essa
verificação nunca testou o que acontece quando o CHAMADOR escolhe esses dois
valores — e `submit_lead` é `grant execute to anon`, então qualquer portador
da chave publicável (pública por natureza) pode chamar o RPC direto, sem
passar por `/api/leads`, sem o Zod de `leadSubmissionSchema`, sem o
honeypot. Mesma classe de bug que `20260729000000_fix_login_attempts_cleanup.sql`
já corrigiu em `record_login_failure` — um parâmetro controlado pelo
chamador governando um limite dentro de uma função `SECURITY DEFINER`
concedida a `anon` — mas aqui pior: `submit_lead` também faz o `insert` em
`leads`, então bypassar o rate limit aqui não é só "ler um estado errado", é
inserir dados de negócio ilimitadamente.
**Reproduzido contra o projeto de teste antes de escrever a correção**
(mesmo processo que `20260729000000` documenta no próprio cabeçalho, agora
repetido para este caso): chamando `submit_lead` direto via
`@supabase/supabase-js` com a chave anon, `p_window_seconds: 1,
p_max_attempts_ip: 999999` em toda chamada, de um `p_ip_hash` fixo, contra um
par (representative_id, product_id) real com ativação publicada — 8
chamadas seguidas, 8 `data: true` (linha inserida todas as vezes). O piso
`greatest(p_window_seconds, 1)`/`greatest(p_max_attempts_ip, 1)` que
`submit_lead` já tinha (espelhando `is_login_blocked`) não ajuda aqui: ele só
rejeita valor zero/negativo, e este ataque nunca precisou de um valor
degenerado, só de um valor grande — que `greatest()` não limita por cima.
Ver o cabeçalho da migration para o repro completo, incluindo o segundo
achado abaixo.
**Por que remover o parâmetro, não flooram com `greatest()` como
`is_login_blocked` (ADR-012/ADR-018).** `is_login_blocked` é só leitura — um
chamador direto pode, no máximo, ler "não bloqueado" para si mesmo com um
threshold inflado, um risco já aceito e documentado (ADR-012: "a defesa fina
continua sendo o rate limiter por e-mail"). `submit_lead` não é só leitura:
decide E grava, na mesma chamada, numa tabela de negócio (`leads`). Um
threshold inflado aqui não engana uma leitura, ele desliga a escrita
protegida. `auth-rules.ts` continua sendo a fonte de verdade pros
thresholds de login (leitura, ADR-012) — mas não existe justificativa
equivalente para `submit_lead` aceitar um threshold do chamador, já que
ninguém legítimo tem motivo pra querer escolher o próprio limite numa função
que insere em nome dele. `LEAD_MAX_SUBMISSIONS_PER_IP`/
`LEAD_RATE_LIMIT_WINDOW_MS` (`lead-rules.ts`) foram removidas no mesmo commit
— nada mais as lia depois que `supabase-lead-gateway.ts` parou de passar
esses dois parâmetros — deixar as constantes órfãs no lugar seria o mesmo
risco de duas-fontes-de-verdade que esta correção existe para fechar.
**Validação adicionada — segundo achado do mesmo repro, defesa em
profundidade.** Mesma sessão de teste: uma chamada direta com
`p_telefone_e164` = string de 200+ caracteres sem formato de telefone,
`p_nome`/`p_cidade` = 5000 caracteres, `p_email` sem `@`: `data: true`,
linha inserida como veio. `leadSubmissionSchema`
(`modules/leads/presentation/schemas/lead.schema.ts`) rejeitaria tudo isso,
mas um chamador direto do RPC nunca passa por ali. `submit_lead` ganhou
checagem de formato/tamanho própria — deliberadamente NÃO uma cópia dos
limites exatos do Zod (`LEAD_NAME_MIN_LENGTH`/`MAX_LENGTH`/
`LEAD_CITY_MAX_LENGTH`), pra não recriar a mesma duas-fontes-de-verdade que
acabou de ser fechada no rate limit: telefone precisa bater o formato E.164
em si (padrão externo, `^\+[1-9]\d{6,14}$`), e-mail precisa ter `@`/`.` e
caber no limite do RFC 5321 (320 caracteres, também um padrão externo), nome
não pode ser vazio e tem um teto largo de 500 caracteres — acima de qualquer
bound de negócio real, só pra barrar payload patológico, não pra duplicar
regra de negócio que já vive no Zod. Ver o cabeçalho da migration para o
raciocínio completo.
**Verificado de novo, depois da correção, contra o mesmo projeto de teste.**
As mesmas 8 chamadas do repro acima, agora contra a versão corrigida:
chamadas 1–5 retornaram `true`, chamadas 6–8 retornaram `false` — o limite de
5 é aplicado independente do que o chamador tentar passar (a assinatura nem
aceita mais `p_max_attempts_ip`/`p_window_seconds`; uma chamada usando o
formato antigo falha com erro de função inexistente, não silenciosamente
ignora os parâmetros extras). O payload malformado do segundo achado agora
retorna `false` sem inserir.
**Teste automatizado.** `tests/lead-submission.integration.test.ts` — não
existia teste nenhum pro módulo `leads` antes desta correção. Cobre: a
assinatura antiga falhando (não apenas ignorando os parâmetros removidos), o
limite de 5/hora sendo respeitado com um `ip_hash` fresco a cada chamada,
uma origem não afetar outra, o caminho feliz, e os três formatos malformados
(telefone/e-mail/nome) sendo rejeitados mesmo com um par
representative/product válido. Descobre um par (representative, product)
publicado em tempo de execução via as mesmas policies de SELECT público
(ADR-030) em vez de fixar IDs do projeto de teste no código — a chave anon
não tem como criar esse fixture (sem policy de INSERT em `representatives`/
`product_activations`), então os testes que precisam de um par real
pulam-se sozinhos (não falham) quando nenhum existe no projeto configurado.
**O que NÃO foi feito.** Uma segunda variável de ambiente ou segredo — não
precisava, nada aqui envolve salt/hash, só remoção de parâmetro e validação
adicional. Reintroduzir os parâmetros com `greatest()` como piso (o padrão
de `is_login_blocked`) — rejeitado pelo raciocínio acima: o piso não fecha o
ataque real, que usa um valor grande, não degenerado. Espelhar exatamente os
bounds do Zod na validação SQL — rejeitado para não recriar duas fontes de
verdade duplicadas sobre o mesmo número.
**Custo de reversão.** Baixo — mesma tabela e mesma função de antes, só a
assinatura e o corpo mudaram; nenhum outro chamador de `submit_lead` existe
além de `supabase-lead-gateway.ts`, já atualizado no mesmo commit.

### ADR-037 — Catálogo iGreen semeado por migration, com UUIDs literais fixos — não por script, não com `gen_random_uuid()`
**Decisão.** `supabase/migrations/20260803000000_seed_igreen_catalog.sql`
insere uma linha em `companies` (iGreen Energy, slug `igreen`) e as 7 de
`products` que `20260731000000_create_representative_domain.sql`
deliberadamente não semeou ("Schema only — no seed data", cabeçalho daquele
arquivo). Passo D1 de `docs/SPRINT_D_PLAN.md`. Nenhuma migration já aplicada
foi editada (regra do topo desta seção); esta é uma migration nova.
**Por que migration, não um script de seed.** Não é preferência de estilo:
`companies` e `products` não têm policy de INSERT nenhuma, e este projeto não
tem service role key (cabeçalho de `20260728000000`, reafirmado no
`supabase/README.md`). Um script Node precisaria de uma chave que ignore RLS
para escrever estas 8 linhas — reabrindo exatamente a superfície que o resto
do projeto foi construído para não ter. O SQL Editor conecta como dono das
tabelas e ignora RLS por construção, que é o caminho que o
`supabase/README.md` já documenta numerado para as outras seis migrations;
este seed entra como passo 7 da mesma lista, sem processo paralelo. Também
não há infra de seed para reaproveitar: a CLI do Supabase não é dependência
do `package.json` e `scripts/` tem um arquivo só
(`require-integration-env.mjs`). **Custo aceito, declarado:** trocar o `name`
de um produto depois vira uma migration nova (`update ... where slug = ...`).
Para um catálogo fixo de 7 linhas isso é barato; se o catálogo virar
editável, isso é superfície de administração (Stage 5), não um script.
**Por que UUIDs literais fixos.** Os 8 ids são literais
(`00000000-0000-4000-8000-000000000001` para a company,
`...011`–`...017` para os produtos, tabela completa no cabeçalho da
migration), não `gen_random_uuid()`: o mesmo produto tem o mesmo id em dev,
no projeto de teste e em produção, então (a) é óbvio, olhando qualquer linha
de `product_activations` ou `leads`, que o produto veio deste seed e não de
código de aplicação, e (b) uma migration futura pode referenciar um produto
por id sem depender de qual ambiente semeou primeiro. O formato é
deliberadamente não-aleatório para que um id semeado nunca seja confundido
com um gerado. **Consequência:** esses ids viram contrato no momento em que
esta migration for aplicada em qualquer ambiente — trocá-los depois exigiria
migrar toda `product_activations`/`leads` que já os referencie.
**Limite conhecido desse contrato, verificado antes de escrever este ADR.**
Ele só vale para linhas que a migration criou. Sondando o projeto de teste de
`.env.local` (read-only, chave publicável): **já existem lá a company `igreen`
e o produto `conexao-green`, ambos com id aleatório**, mais uma
`product_activations` publicada apontando para esse produto — o fixture que
`tests/lead-submission.integration.test.ts` descobre em tempo de execução.
Aplicar o seed naquele projeto não dá erro e não viola o guard de 7 produtos
(o `on conflict` preserva as duas linhas, os outros 6 produtos entram com os
ids literais), mas o resultado é um catálogo **misto**: 6 ids literais, 1 id
aleatório, e uma company com id aleatório. Preservar a linha existente é
deliberado — apagá-la quebraria a activation que a referencia. Alinhar aquele
ambiente exigiria um `update` de id arrastando todas as FKs
(`products.company_id`, `product_activations.product_id`, `leads.product_id`,
`representatives.company_id`), que é exatamente o custo descrito acima: é
decisão de ambiente, não da migration, e por isso ela não tenta fazer isso
sozinha. Em dev e em produção, ambos sem catálogo nenhum hoje, o contrato vale
integralmente.
**Idempotência.** `on conflict (slug) do nothing` na company e
`on conflict (company_id, slug) do nothing` nos produtos, apoiados nas UNIQUE
que `20260731000000` já criou: reaplicar é no-op, não erro. O árbitro é a
UNIQUE, não a primary key — numa reaplicação a linha conflita nela primeiro
e o insert nem é tentado; um conflito apenas de primary key (alguém já usou
um destes ids literais para outra coisa) erra alto de propósito, porque
significaria o contrato de ids quebrado por fora. Os produtos referenciam a
company por subselect no slug, nunca pelo UUID literal digitado de novo: se a
company já existir com outro id (semeada à mão antes), os produtos se ligam à
linha que existe de verdade.
**Verificação embutida.** O `where company.slug = 'igreen'` faz o insert de
produtos ser um no-op silencioso se a company não existir. Um bloco `do $$`
no fim da migration levanta exceção se a contagem final não for exatamente 7
— um seed parcial falha na hora, em vez de virar um catálogo vazio que só
seria notado quando uma página não resolvesse.
**De onde vêm slugs e nomes.** Os 7 slugs não são escolha desta migration:
são os do comentário sobre `products` em `20260731000000`, os mesmos que
`tests/route-collision-guard.test.ts` já parseia e que
`src/app/[productSlug]/page.tsx` resolve. Os nomes vêm do `<title>` de cada
template em `templates/commercial-pages/` (o README daquele diretório é a
fonte de verdade de cópia; nenhum arquivo dele foi tocado). Duas divergências
entre fontes foram decididas antes de semear, não silenciadas: `green-seguros`
virou **iGreen Seguros** (nome do produto no catálogo — `DOMAIN_MODEL.md:59` —
e não "iGreen Auto Mensal", que é uma oferta específica dentro dele, como diz
o `<title>` do template), e `telecom` virou **iGreen Telecom**, com a marca,
igual ao `<title>`. `products.name` é renderizado publicamente
(`src/app/[productSlug]/page.tsx:70,72`), então isto é cópia de face para o
cliente, não rótulo interno.
**Teste.** `tests/catalog-seed.test.ts` afirma igualdade de conjunto nos dois
sentidos entre os slugs inseridos pelo seed e os do comentário de
`20260731000000` — parseando os dois arquivos, nunca re-digitando a lista num
terceiro lugar, mesma técnica de `route-collision-guard.test.ts`. Também
afirma que os 7 ids literais são distintos (um duplicado por copy-paste não
seria pego pelo `on conflict (company_id, slug)`; só apareceria como violação
de primary key na hora de aplicar). O guard foi verificado negativamente
antes de ser dado como pronto: alterando `telecom` para `telecom-errado` no
seed, o teste falha apontando a diferença; revertido em seguida.
**Nota de compliance, não bloqueante.** `companies_select_public` é
`using (true)`, então "iGreen Energy" fica legível pela chave publicável a
partir daqui. Seguro hoje porque **nada no app lê `companies`** — nenhuma tela
exibe esse nome. Se algum dia exibir, é decisão de produto/compliance (seção
"Compliance" acima), não consequência automática deste seed:
`setnar.tenant.ts:53` registra que a marca de terceiro é omitida do site do
SETNAR de propósito.
**Custo de reversão.** Baixo enquanto nada referenciar os ids; médio depois
(ver "Consequência" acima).

### ADR-038 — Um representante não conseguia ler a própria linha; duas policies de SELECT por dono, sem tocar nas públicas
**Decisão.**
`supabase/migrations/20260804000000_add_own_row_select_policies.sql` cria
`representatives_select_own` (`using (profile_id = auth.uid())`) e
`product_activations_select_own` (`exists` escopado por
`representatives.profile_id = auth.uid()`). Só policies — nenhuma tabela,
coluna, função ou dado. Passo D2 de `docs/SPRINT_D_PLAN.md`.
**A lacuna, encontrada auditando o schema e não relatada por ninguém.** Todas
as policies que `20260731000000` criou nessas duas tabelas são de leitura
pública, feitas para o visitante anônimo de uma Commercial Page — e o efeito
disso é mais forte do que "faltou uma policy": `representatives_select_public`
(`20260731000000:257-267`) é a **única** policy de SELECT em
`representatives`, e exige `status = 'active'` **E** existir ao menos uma
`product_activations` com `status = 'published'`. Um representante
recém-criado não tem ativação nenhuma, logo não satisfaz a policy, logo
`select * from representatives` **com a sessão dele devolve zero linhas,
inclusive a dele mesmo**. Qualquer tela de `/app` que precise saber "quem sou
eu como representante" era impossível antes desta migration. O mesmo um nível
abaixo: `product_activations_select_published`
(`20260731000000:244-246`) expõe só `published`, enquanto a tela de ativação
precisa listar exatamente o que essa policy esconde (`draft`/`unpublished`).
**Por que adicionar não afraca a leitura pública.** Policies permissivas (o
padrão; nenhuma aqui é `as restrictive`) se somam com OR — uma linha é visível
se qualquer policy de SELECT permitir. As duas novas acrescentam um caminho
disjunto para o dono, sem alterar as públicas. E não abrem nada para o
anônimo: sem sessão `auth.uid()` é null, então `profile_id = auth.uid()` é
NULL (nunca true) e o `exists` não casa com linha nenhuma.
**Por que o formato de `leads_select_own`, copiado.** `product_activations`
não tem `profile_id` próprio, e não deve ter: duplicar a identidade ali
criaria uma segunda fonte de verdade sobre a quem a ativação pertence,
capaz de divergir de `representative_id`. A pergunta é idêntica à de
`leads_select_own` (`20260731000000:314-323`) e atravessa a mesma junção, então
a policy é a mesma forma, não uma invenção nova.
**Por que uma migration própria, antes de existir qualquer tela.** É adição
pura, revisável isoladamente, e vale independentemente de como o
Representative passa a ser criado — decisão do `docs/SPRINT_D_PLAN.md` §3
(fechada: onboarding explícito pós-login, passo D3, **ainda não
implementado**).
**Verificação manual obrigatória, as duas pontas.** Ver `supabase/README.md`,
passo 8: a primeira ponta prova que a policy funciona (representante sem
ativação publicada passa a ver a própria linha, onde antes via zero); a
segunda prova que ela não vazou (a sessão de um representante continua vendo
zero linhas do outro). A segunda é a que importa e é a que um teste de
caminho feliz não pegaria.
**Custo de reversão.** Baixo — duas policies, `drop policy` desfaz.
**Correção posterior.** O corpo de `product_activations_select_own` criado
aqui foi substituído por `20260805000000_fix_rls_policy_cycle.sql` — ver
ADR-039. Esta migration continua exatamente como foi aplicada; nada aqui foi
editado.

### ADR-039 — Ciclo de RLS entre `representatives` e `product_activations`; quebrado com `is_own_representative()` `SECURITY DEFINER`
**Decisão.** `supabase/migrations/20260805000000_fix_rls_policy_cycle.sql`
cria `is_own_representative(p_representative_id uuid)`, `security definer`,
`stable`, `set search_path = public` — encapsula exatamente o `exists`
(`representatives.profile_id = auth.uid()`) que estava inline em
`product_activations_select_own` (ADR-038) — e recria essa policy sobre a
função. Nenhuma migration já aplicada foi editada (regra do topo desta
seção); `20260804000000` permanece intacta.
**O bug, reproduzido nas duas pontas antes de qualquer linha desta migration
ser escrita.** Depois de `20260803000000` + `20260804000000` aplicadas,
consultas via PostgREST com a chave publicável (RLS de verdade — nunca o SQL
Editor, que conecta como dono e ignora RLS) devolveram `HTTP 500`,
`{"code":"42P17", "message":"infinite recursion detected in policy for
relation \"representatives\""}` em `GET /rest/v1/representatives` e o mesmo
código em `product_activations`. Reproduzido tanto **anônimo** (sem sessão,
só a chave publicável) quanto **autenticado** (JWT real de um usuário criado
pelo fluxo de signup) — os dois caminhos batem no mesmo 42P17; controles na
mesma sessão (`profiles`, `products`/`companies`) continuaram `200`, então o
erro é do ciclo, não da sessão nem da chave. `leads` também falhava, por
tabela vizinha: `leads_select_own` consulta `representatives`, que arrasta o
ciclo inteiro junto.
**O ciclo.** `representatives_select_public` (`20260731000000:257-267`) já
consultava `product_activations` dentro do seu `exists`;
`product_activations_select_own` (`20260804000000`) passou a consultar
`representatives` dentro do dela — cada tabela ganhou uma policy de SELECT
que depende da outra, e o Postgres aborta com `42P17` em vez de expandir
para sempre. `representatives_select_public` já estava em produção e
funcionava sozinha; `product_activations_select_own` é a metade nova, então é
ela que sai do caminho.
**Correção de documentação — `20260804000000` (ADR-038) estava errada num
ponto.** O comentário daquela migration (linhas 76-80) afirmava que "RLS não
se aplica dentro do `exists` de uma policy (a subconsulta roda com os
privilégios da própria policy)". Isso é falso — o próprio 42P17 é a prova
direta: a única forma de a expansão da policy de `representatives` alcançar a
de `product_activations` (e voltar) é RLS **sendo** aplicada dentro da
subconsulta. RLS se aplica a toda tabela referenciada na expressão de uma
policy, recursivamente, para qualquer papel sem `BYPASSRLS`. Consequência de
segunda ordem, registrada porque é real e não hipotética: `leads_select_own`
(`20260731000000:314-323`) nunca funcionou como aquele comentário supunha —
antes de `20260804000000`, um representante sem ativação publicada não
satisfazia `representatives_select_public` e por isso não conseguia ler os
próprios leads; `representatives_select_own` fechou essa lacuna de lado, por
acidente. Nada foi alterado em `leads` por causa disso — só registrado,
porque o comportamento resultante já é o desejado.
**Por que uma função `SECURITY DEFINER` quebra o ciclo.** `SECURITY DEFINER`
roda como o dono da função — o mesmo dono das tabelas — e o dono não está
sujeito a RLS (nenhuma tabela aqui usa `force row level security`). A
checagem em `representatives` deixa de ser uma referência a `representatives`
DENTRO da expressão da policy de `product_activations`: some do plano da
consulta, e com ela o ciclo. Mesmo mecanismo de ADR-011/ADR-012, usado
deliberadamente. Quebrar UM dos dois lados basta. `language plpgsql`
(não `sql`) segue a consistência já usada em `submit_lead`/`handle_new_user`
— deliberadamente sem apoiar essa escolha na alegação (falsa, verificada
contra este mesmo banco: `is_login_blocked` é `language sql` + `security
definer` sobre uma tabela com RLS e zero policies, e os testes de
ADR-017/ADR-018 provam que ela bloqueia) de que uma função `language sql`
seria inlined pelo planner e perderia o bypass — o planner recusa inline de
função `prosecdef`, então essa justificativa não se sustentaria de qualquer
forma.
**Regra operacional que sai daqui, e que vale para D4 em diante.** Nenhuma
policy nova pode ter `USING`/`WITH CHECK` que consulte uma tabela cujas
próprias policies consultem de volta a tabela original. Se a checagem
precisar atravessar essa aresta, encapsule em uma função `SECURITY DEFINER`
— nunca inline o `exists` cruzado direto na policy.
**Verificação.** `tests/rls-policy-cycle.integration.test.ts` — vermelho
antes desta migration, verde depois. Deliberadamente só o caminho anônimo
(42P17 é levantado na expansão do plano, antes de qualquer linha ser
casada — `auth.uid()` nulo não enfraquece a checagem), para não criar uma
linha descartável em `auth.users` a cada rodada de CI.
**Custo de reversão.** Baixo — uma função e uma policy recriada sobre ela;
o efeito pretendido por ADR-038 não muda.

### ADR-040 — `register_representative()`, primeira escrita self-service em `representatives`; grant só a `authenticated`, nunca a `anon`
**Decisão.** `supabase/migrations/20260806000000_add_register_representative.sql`
cria `register_representative(p_slug, p_display_name, p_license_id, p_phone,
p_city)`, `security definer`, `set search_path = public`, `language
plpgsql`, `returns table (status text, representative_id uuid)`, mais a
CHECK constraint `representatives_slug_not_reserved` sobre
`representatives.slug`. Passo D3.B.1 de `docs/SPRINT_D_PLAN.md`
(Opção B do §3, onboarding explícito pós-login, fechada em 2026-08-01).
Nenhuma migration já aplicada foi editada.
**A lacuna que fecha.** Até aqui, a única forma de criar uma linha em
`representatives` era o SQL Editor manual (`representatives`/
`product_activations` não têm policy de INSERT, e este projeto não tem
service role key). Esta função é o primeiro caminho de escrita self-service
do domínio do Representative — o passo que faz "criar conta" e "ter uma
página comercial" deixarem de exigir intervenção manual entre os dois.
**Por que `grant execute ... to authenticated`, nunca `anon` — ao contrário
de `submit_lead`.** `submit_lead` é `anon` porque o chamador real é um
visitante sem sessão. Aqui a lógica inteira depende de `auth.uid()` ser uma
identidade real: "este usuário já tem representante?" e "a quem pertence a
nova linha?" não fazem sentido sem uma. Concedida a `anon`, uma chamada sem
sessão teria `auth.uid()` nulo — a pré-checagem de "já registrado" nunca
casaria, e o INSERT bateria de frente na constraint `not null` de
`representatives.profile_id`, vazando um erro cru de Postgres pelo RPC em
vez de um resultado tipado. Não há caminho anônimo legítimo; a porta fica
fechada na concessão (`revoke ... from public` + `grant ... to
authenticated`), não numa checagem que poderia ter um furo.
**Dois desvios do plano original de `docs/SPRINT_D_PLAN.md` §4/D3.B.1,
registrados aqui porque são desvios, não uma leitura literal do plano:**
1. **`p_display_name` é um quinto parâmetro**, não previsto na assinatura
   original (`p_slug, p_license_id, p_phone, p_city`). O plano previa copiar
   `display_name` de `profiles.full_name` dentro da função — descartado
   porque `signUpSchema` só exige `NAME_MIN_LENGTH = 2` caracteres
   (`auth-rules.ts:10`, "João" passa no cadastro) e a política de uso da
   marca da iGreen exige "nome e sobrenome" no bloco de identificação
   (`licensee-identification-block.tsx:40`). A alternativa — copiar de
   `full_name` e rejeitar quando tiver menos de duas palavras — empurraria
   esse usuário para um beco sem saída: `docs/SPRINT_D_PLAN.md`'s D5b (tela
   de edição de perfil) nem lista `full_name` entre os campos que ganharão
   UI de escrita. `p_display_name` chega pré-preenchido no formulário de
   onboarding (D3.B.4) com `full_name`, mas é validado e gravado como o
   valor que o usuário efetivamente confirmou — que pode divergir do nome de
   cadastro. **Isto estende ADR-027**, não só o cita por analogia: aquele
   ADR justifica `display_name` viver numa coluna própria em vez de um join
   com `profiles.full_name`, mas assumia implicitamente que o valor seria
   uma CÓPIA; esta migration aceita também DIVERGÊNCIA DE CONTEÚDO entre os
   dois, uma extensão do precedente, não uma aplicação direta dele.
2. **A correção de TOCTOU no INSERT** (ver abaixo) não estava prevista na
   investigação original (Task 1, item 1.6, que listou a corrida como lacuna
   conhecida e não resolvida) — o Pedro pediu explicitamente para fechá-la
   nesta migration, não deixá-la para depois.
**TOCTOU fechado no INSERT, não só na pré-checagem.** A pré-checagem "já
tenho representante" e a pré-checagem de slug livre têm uma janela de
corrida real entre duas chamadas concorrentes da mesma conta (duplo clique,
retry de rede) — comum, não exótico. O INSERT roda dentro de um bloco
`begin/exception` que captura `unique_violation`, usa `get stacked
diagnostics ... constraint_name` para disambiguar QUAL das duas constraints
UNIQUE de `representatives` foi violada (`representatives_profile_id_key`
vs. `representatives_slug_key` — auto-geradas pelas duas colunas `unique`
inline, `20260731000000:160,162`), e traduz cada uma para o status tipado
correto (`already_registered` vs. `slug_taken`). Colapsar as duas num status
genérico estaria errado: uma corrida de slug entre duas contas diferentes
não é a mesma coisa que "você já tem representante", e reportar a causa
errada confundiria quem perdeu a corrida de slug. Qualquer outra
`unique_violation` (inesperada pelo schema atual) é relançada, nunca
escondida atrás de um status genérico — mesmo espírito de "nunca vazar
exceção não tratada" que `safeAuthCall`/ADR-020 já aplicam na camada de
Server Actions.
**Resultado tipado, não booleano.** Diferente de `submit_lead` (anti-
enumeração deliberada, ADR-018/ADR-030/ADR-036), aqui o chamador já precisa
estar autenticado — uma barra mais alta — e o dado mais sensível que uma
rejeição poderia vazar (que um slug já existe) tem destino público por
construção (regra 12, `DOMAIN_MODEL.md:565`; `representatives_select_public`
já expõe publicamente o slug de todo representante ativo com ativação
publicada). Vocabulário: `created`, `company_not_found`,
`already_registered`, `slug_invalid` (formato ou palavra reservada — uma
propriedade do INPUT), `slug_taken` (uma propriedade do ESTADO do banco),
`display_name_invalid`, `license_id_invalid`, `phone_invalid`,
`city_invalid`. `slug_invalid` e `slug_taken` são deliberadamente estados
diferentes, não colapsados — ver o cabeçalho da migration.
**Palavras reservadas — lista auditada, não a lista de exemplo do comentário
original.** `20260731000000:136-139` citava "www, api, app, admin" como
EXEMPLO. A lista real, auditada contra `src/app/*` e `setnar.tenant.ts`:
`www, app, api, auth, admin, entrar, criar-conta, esqueci-senha,
redefinir-senha, termos, privacidade, setnar, igreen`. Só `www` tem colisão
FUNCIONAL (`www.setnar.com` já é hostname literal do tenant SETNAR —
`extractRepresentativeSlug` nunca chegaria a resolver esse slug, então sem a
reserva o INSERT teria sucesso mesmo assim, deixando um registro
permanentemente inalcançável); o resto é prudência de marca/confusão
(`app`/`api`/`auth` são rotas reais do domínio raiz sem colisão técnica —
hosts diferentes —, mas confusas; `admin` não tem rota real hoje, reserva
preventiva alinhada ao Stage 5; `setnar`/`igreen` são a marca do tenant e da
Company semeada, e um representante com esses slugs resolveria em
`setnar.setnar.com`/`igreen.setnar.com`, nada bloqueia isso hoje na
resolução). Implementada como CHECK constraint (backstop de qualquer escrita
futura, inclusive SQL Editor manual) **e** checagem redundante dentro da
função — nunca como parâmetro do chamador (ADR-036). A função ADICIONALMENTE
checa `p_slug` contra `companies.slug` dinamicamente, mais ampla que o CHECK
(que não pode fazer subquery entre tabelas): cobre qualquer Company futura
do Stage 5 sem exigir uma migration nova só para atualizar a lista estática.
**`p_license_id` — BLOQUEADOR DE LANÇAMENTO, decisão do Pedro.** Validação
só de FORMATO (não vazio, teto de 100 caracteres, sem regex de
dígitos/checksum/prefixo) porque não existe, neste repositório, fonte
confirmada do formato real do ID de licenciado exigido pela política de uso
da marca da iGreen. Abrir cadastro público antes de confirmar esse formato
com a iGreen arrisca publicar "Licenciado Autorizado iGreen Energy · ID
{qualquer string}" sem garantia de correspondência a uma licença real — a
exata falha de compliance que a política existe para evitar. Registrado em
destaque no cabeçalho da migration; não resolvido, nem resolvível dentro de
uma função Postgres (não há registro externo da iGreen para confirmar
autenticidade).
**`p_phone`/`p_city` — validação de forma, formato já precedente na camada
SQL.** Telefone reaproveita o E.164 que `submit_lead` já valida
(`^\+[1-9]\d{6,14}$`), não `BR_PHONE_PATTERN` (`lead-rules.ts`, máscara de
input HTML, nunca antes aplicada a nível de banco) — escolhido por já ser o
padrão estabelecido nesta camada (funções SQL) para o mesmo conceito de
campo, em vez de inventar um terceiro formato.
`representatives.phone` continua `text` livre sem CHECK de coluna (ADR-035
é deliberado sobre isso); a validação vive só dentro da função. Cidade usa o
mesmo teto de 500 caracteres que `submit_lead` já usa para `p_cidade` — sem
formato externo, só um teto contra payload patológico. Ambos opcionais,
string vazia normalizada para `null`.
**Teste automatizado, e o que ele NÃO cobre.**
`tests/register-representative.integration.test.ts` automatiza só a
rejeição anônima — a função é autenticada por natureza, e sem service role
key não há forma de criar uma conta descartável por rodada de CI e depois
apagá-la (`representatives` não tem policy de DELETE). O caminho
autenticado é um roteiro manual (`supabase/README.md`, passo 10): caminho
feliz, colisão de slug entre duas contas reais, rejeição de palavra
reservada, "já registrado" numa segunda chamada da mesma conta, e uma
simulação (não uma prova real) de concorrência via `Promise.all` — o próprio
roteiro documenta que duas chamadas "quase juntas" no mesmo processo não
garantem sobreposição real de transações no Postgres; um teste de
concorrência de verdade fica fora do escopo do D3.B.1.
**Custo de reversão.** Baixo enquanto nenhum representante real existir —
`drop function` mais `alter table ... drop constraint` desfazem; médio
depois que houver linhas reais em `representatives` criadas por este
caminho (mesma classe de custo que ADR-037 já registra para os UUIDs
literais do catálogo).

### ADR-041 — `RepresentativeOnboardingGateway` é uma porta nova, não um método a mais em `RepresentativeRepository`
**Decisão.** D3.B.2: `register_representative()` (ADR-040) é consumido por
uma porta própria,
`src/modules/representatives/domain/representative-onboarding-gateway.ts`
(`RepresentativeOnboardingGateway.register()`), não por um método novo em
`RepresentativeRepository`. Adapter em
`infrastructure/supabase-representative-onboarding-gateway.ts`, mapeamento
puro do resultado do RPC em `infrastructure/map-register-representative-result.ts`
(mesmo formato de `map-supabase-auth-error.ts` — tipo estrutural estreito, sem
`server-only`, testável com objeto plano), factory em
`infrastructure/representative-onboarding-gateway-factory.ts` (cópia do
padrão de `getLeadGateway()`: `server-only`, cliente novo por chamada, nunca
cacheado).
**Por quê porta nova.** `RepresentativeRepository`'s próprio doc comment se
declara a porta de resolução PÚBLICA (leitura anônima, para a Commercial
Page) — mesmo raciocínio de "naturezas diferentes merecem portas
diferentes" que o ADR-031 já usou para não dobrar `RepresentativeRepository`
dentro de `TenantRepository`. Aqui o eixo é leitura-anônima vs.
escrita-autenticada, não tamanho-da-lista, mas o raciocínio é o mesmo.
Reforça uma convenção de nomenclatura que já existia sem estar documentada:
neste projeto, "Repository" é sempre porta de leitura
(`RepresentativeRepository`, `TenantRepository`) e "Gateway" é sempre porta
de escrita/ação (`AuthGateway`, `LeadGateway`) — estender
`RepresentativeRepository` com um método de escrita quebraria essa
convenção e forçaria `InMemoryRepresentativeRepository` (usado pelos testes
de resolução) a implementar um método de onboarding que nunca usa.
**Resultado tipado, não anti-enumeração.** `RegisterRepresentativeResult`
distingue `'created'` / `'rejected'` (com `reason`, os 8 literais exatos do
`status` SQL, reaproveitados verbatim — não uma segunda tabela de tradução
que pudesse divergir, mesma lição do ADR-036) / `'error'` (falha de
infraestrutura ou uma forma de resposta que o mapeador não reconhece).
Diferente de `SubmitLeadResult`, que colapsa toda rejeição de propósito —
aqui o chamador já é autenticado (barra mais alta) e a Tarefa 1 do D3.B.1 já
pediu a distinção entre os 8 motivos, então colapsá-los desfaria esse
trabalho.
**Teste.** `tests/map-register-representative-result.test.ts` cobre os 8
motivos de rejeição, o caminho de sucesso, `status` desconhecido → `error`
(nunca fabrica um resultado a partir de uma forma inesperada), e `data`
nulo/vazio ou `error` não-nulo → `error`, sem precisar de um Supabase real.
**Custo de reversão.** Baixo — dois arquivos de porta/adapter a mais;
`RepresentativeRepository` não foi tocado.

### ADR-042 — `/app` ramifica entre onboarding e hub por uma terceira porta, `RepresentativeAccountRepository`; sucesso do cadastro passa a navegar, não a renderizar
**Decisão.** D3.B.5: `src/modules/representatives/domain/representative-account-repository.ts`
(`findByProfileId(profileId): Promise<Representative | null>`), adapter
`infrastructure/supabase-representative-account-repository.ts` e factory
`infrastructure/representative-account-repository-factory.ts` (mesmo padrão
`server-only`/cliente-por-chamada das outras duas). `src/app/app/page.tsx`
usa o resultado para escolher entre `OnboardingForm` (null) e
`RepresentativeHubPlaceholder` (não-null) — o hub de verdade (produtos
ativados, link/QR Code, leads) é D5, e este componente é explicitamente um
marcador mínimo, não ele. Nenhuma migration nova: `representatives_select_own`
(`20260804000000:61-63`, ADR-038) já escopa essa leitura por
`profile_id = auth.uid()`.
**Por quê uma terceira porta, e não um método em `RepresentativeRepository`.**
Mesmo raciocínio de ADR-031 e ADR-041, aplicado uma terceira vez:
`RepresentativeRepository` se declara a porta de resolução PÚBLICA/anônima;
`findByProfileId` é leitura autenticada da própria linha. Dobrá-la ali
obrigaria `InMemoryRepresentativeRepository`
(usado por `resolve-representative.test.ts`) a implementar um método que
nunca usa — a mesma objeção que já valeu contra pendurar `register()` naquela
porta. A convenção do módulo se mantém: "Repository" para leitura, "Gateway"
para escrita.
**Sem filtro de `status`, ao contrário da porta pública.**
`findPublishedActivation` esconde representante não-`active` porque serve um
visitante anônimo; aqui é o dono lendo o próprio registro, e um `suspended`
é precisamente o que ele precisa enxergar — esconder seria mentir para o
dono sobre o próprio estado. `.maybeSingle()`, não `.single()`: zero linhas é
o resultado legítimo "ainda não se cadastrou", não um erro.
**`registerRepresentativeAction` passa a `redirect('/app')`.** Com os dois
estados existindo, sucesso tem para onde navegar — então segue a convenção
que toda Server Action de auth já estabelece (retorno normal = falha; sucesso
= navegação), com o `redirect()` DENTRO do callback do `safeOnboardingCall`
para o `NEXT_REDIRECT` ser relançado e não engolido (ADR-020). O branch
`'created'` de `OnboardingForm` morreu junto e foi removido, não deixado
inalcançável.
**Correção de tipo encontrada ao implementar isto, não antes.**
`safeOnboardingCall` declarava `Promise<T | RegisterRepresentativeResult>` —
unindo com o union INTEIRO, incluindo `'created'`. `safeAuthCall` só funciona
como estreitador porque une com `AuthFailure`, que é UMA variante de
`AuthResult`, não o union todo. Com o union inteiro, `'created'` voltava ao
tipo de retorno de qualquer chamador por mais que `T` estreitasse, impedindo
`registerRepresentativeAction` de declarar
`Promise<RegisterRepresentativeFailure>`. Corrigido para
`Promise<T | Extract<RegisterRepresentativeResult, { status: 'error' }>>` —
o shape que o `catch` de fato devolve. Pego pelo `npm run typecheck`, não em
revisão.
**Custo de reversão.** Baixo — uma porta/adapter/factory a mais e um branch
em `/app`; nada existente foi reescrito.

### ADR-043 — Caminho de escrita da ativação de produto por duas funções `SECURITY DEFINER`, não por policies de INSERT/UPDATE
**Decisão.** `supabase/migrations/20260807000000_add_product_activation_write_path.sql`
cria `activate_product(p_product_id uuid)` e
`set_activation_status(p_product_id uuid, p_status text)`, ambas
`security definer`, `set search_path = public`, `language plpgsql`,
`returns table (...)`, `revoke ... from public` + `grant ... to authenticated`
(nunca `anon`). Nenhuma policy nova, nenhuma tabela, nenhuma coluna. Passo D4
de `docs/SPRINT_D_PLAN.md`. Do lado do TypeScript: porta
`ProductActivationGateway`, mapeadores puros
(`map-product-activation-result.ts`), adapter e factory, mesmo formato do
ADR-041.
**A lacuna que fecha.** `product_activations` tinha RLS habilitado e SOMENTE
policies de SELECT — nenhum INSERT, UPDATE ou DELETE por caminho nenhum, e
este projeto não tem service role key. Sem isto, quem terminava o onboarding
(D3.B) não conseguia colocar página pública no ar por meio nenhum.
**Por que função e não policy — o argumento que decide.** O plano
(`SPRINT_D_PLAN.md:500-503`) inclinava pela policy "porque o caso não tem o
motivo que gerou as funções anteriores (acesso anônimo)". Isso é razão para a
função não ser obrigatória, não razão para a policy ser melhor. O que decide
é **quem nomeia o representante**: com policy, o cliente TEM que enviar
`representative_id` no corpo do INSERT e a correção depende inteiramente de o
`WITH CHECK` pegar um valor forjado; com função, a assinatura é
`activate_product(p_product_id)` e o representante é derivado de `auth.uid()`
por dentro — o chamador não tem como sequer nomear outro. Mesmo princípio do
`tenant_id` em `handle_new_user()` (ADR-011) e do `company_id` em
`register_representative()` (ADR-040). Três motivos secundários (policy não
expressa transição, porque `USING` vê a linha antiga e `WITH CHECK` a nova sem
que nenhuma veja as duas; policy não mantém `published_at` sem trigger; e ler
`representatives` de dentro de uma policy de `product_activations` é a forma
que a regra operacional do ADR-039 proíbe) estão detalhados no cabeçalho da
migration, junto da contagem de objetos que cada rota exigiria.
**Reconciliação registrada antes de desenhar qualquer checagem.**
`DOMAIN_MODEL.md` descreve dois ciclos que parecem concorrentes e o schema
materializa um só: §8.5 "Product Activation" (linha 357) tem
"Activated → Deactivated", enquanto Draft/Published/Unpublished é de §8.6
"Commercial Page" (linha 368) e §14.1. Ou seja, `product_activations.status`
materializa a máquina de estados da **Commercial Page** sobre a linha da
**Product Activation**: **neste código, uma Commercial Page É uma linha de
`product_activations` com `status = 'published'`** — não existe tabela
`commercial_pages`, e `findPublishedActivation` resolve a página direto de uma
linha. Consequência que economiza uma checagem: a precondição "ao menos um
Product ativado" (regra 10, `DOMAIN_MODEL.md:371`) é satisfeita por
construção, porque a linha publicada É a ativação. A leitura errada teria
produzido um `exists` inútil.
**Máquina de transições.** `activate_product` é o único caminho que cria
linha, sempre em `draft`; `set_activation_status` só aceita `published` ou
`unpublished` como alvo. `draft → published` e `unpublished → published`
passam pelo gate; `published → unpublished` é sempre permitida;
`draft → unpublished` é rejeitada (`invalid_transition`, seguindo
`DOMAIN_MODEL.md:649`); qualquer destino `draft` é rejeitado
(`invalid_status`). Mesmo-estado é **sucesso idempotente sem escrita**, não
erro — mesma razão do trabalho de TOCTOU do ADR-040: duplo clique e retry de
rede são comuns. `activate_product` é idempotente pela mesma lógica e, quando
a linha já existe, **não toca em `status`** — reativar um produto já
publicado não pode rebaixá-lo para `draft` e tirar a página do ar.
**Gate de publicação, granular e em ordem deliberada.** Três precondições,
verificadas nesta ordem, e a primeira que falhar é a reportada:
`representatives.status = 'active'` → `representative_not_active`;
`display_name` não vazio após trim → `display_name_required`; `phone` não
vazio após trim → `phone_required`. Razão própria por precondição, e não um
"não é possível publicar" genérico, porque a UI de D5.2 precisa saber
exatamente o que pedir ao representante para corrigir. A ordem importa: um
representante suspenso não deve receber "preencha seu telefone" como
orientação. `phone` é exigido porque sem ele `WhatsappCta` não renderiza
(ADR-035) e uma Commercial Page sem CTA não é uma Commercial Page.
**Dois desvios conscientes no gate**, registrados aqui e não descobertos
depois: `avatar_url` NÃO é exigido, desvio explícito da regra 7 — não existe
Storage, não existe upload e nada renderiza esse campo, então exigir uma foto
que ninguém consegue enviar tornaria a publicação impossível; e Subscription
ativa NÃO é checada (regra 21, `DOMAIN_MODEL.md:650`) — é D7, e publicar aqui
ignora cobrança por completo, que é o estado conhecido de hoje e não uma
regressão desta migration.
**Regra 4 (Retired Product) é inaplicável, não esquecida.**
`DOMAIN_MODEL.md:348` diz que um Product retirado não pode ser ativado, mas
`products` não tem coluna de status e `20260731000000:70-77` registra que esse
ciclo foi deliberadamente não modelado. `activate_product` não checa isso
porque não há o que checar; criar a coluna é decisão de outra migration.
**`published_at`: primeira publicação, nunca sobrescrito, nunca anulado.**
Setado no primeiro `→ published` (via `coalesce`); republicar não o atualiza;
despublicar não o anula. Sem precedente no projeto, então o raciocínio fica
registrado: isso torna `published_at is not null` um fato durável ("já foi
pública alguma vez"), que é exatamente o que a regra 12 (`DOMAIN_MODEL.md:565`,
o slug não deve mudar depois de publicado) precisa para algum dia ser
exequível, e nada mais no schema o registra. Sobrescrever destruiria
informação de forma irreversível; manter perde apenas um "no ar desde X", que
uma migration futura pode adicionar como coluna própria. Entre uma escolha
reversível e uma irreversível, sem consumidor para nenhuma das duas hoje, a
reversível ganha. Também é coerente com `activated_at` ao lado, que é carimbo
de criação e nunca é atualizado.
**Quarta porta do módulo, com o limiar declarado.**
`ProductActivationGateway` mora em `src/modules/representatives/` porque
`DOMAIN_MODEL.md` §7.3 (linhas 222-223) atribui Product Activation a
Representative Management — Catalog Management (§7.4) é dona de Catalog e
Product, não de Activation — e nenhum módulo `catalog` existe. A convenção do
módulo se mantém: "Repository" lê, "Gateway" escreve. Isso leva o módulo a
**quatro portas**, o que é aceitável agora (cada uma tem chamador e postura de
autenticação distintos), mas o limiar fica registrado: **se aparecer um módulo
`catalog` de verdade ou a superfície de administração do Stage 5, esta porta é
a primeira coisa a sair de `representatives/`.** A porta é deliberadamente só
de escrita — ler "minhas ativações" (que o D5 vai precisar) pertence a uma
porta de leitura, e `product_activations_select_own` já desbloqueia esse
acesso.
**Nota de implementação que não deve ser "limpa".** As duas funções são
`returns table (status text, ...)` e `status` também é nome de coluna em
`representatives` e em `product_activations`; o parâmetro OUT sombreia o nome,
e uma referência não qualificada levantaria "column reference is ambiguous"
**em tempo de execução**, não na criação. Por isso toda coluna aparece
qualificada por alias e todo retorno passa por `return query select`.
**Teste.** `tests/map-product-activation-result.test.ts` cobre os dois
mapeadores: sucesso, cada motivo de rejeição, `status` desconhecido → `error`,
`data` nulo/vazio → `error`, `error` não-nulo → `error`, e sucesso com id
ausente → `error` (nunca fabrica id). Também afirma que cada mapeador rejeita
o status de sucesso **do outro** — as duas strings mais plausíveis de vazarem
entre eles por copy-paste. As funções SQL em si não têm teste automatizado,
mesma lacuna aceita do ADR-040: verificação manual em `supabase/README.md`,
passo 11.
**Custo de reversão.** Baixo — `drop function` nas duas; nenhuma policy,
tabela ou coluna foi tocada, e nenhuma linha existente é migrada.

### ADR-044 — `RepresentativeCatalogRepository`, quinta porta do módulo: leitura cruzada do Catalog da Company com as próprias Product Activations (D5.1)
**Decisão.** `domain/representative-catalog-repository.ts` define
`RepresentativeCatalogRepository.listOwnCatalog(profileId)`, retornando
`RepresentativeCatalogEntry[]` — cada Product da Company do representante,
cruzado com o estado da própria ativação (`not_activated`/`draft`/
`published`/`unpublished`). O adapter `SupabaseRepresentativeCatalogRepository`
roda três leituras (representante próprio → `id`/`company_id`; produtos da
company; ativações próprias) e delega o cruzamento a uma função pura,
`mergeRepresentativeCatalog` (`infrastructure/merge-representative-catalog.ts`),
testável sem cliente Supabase — mesmo padrão dos mapeadores de RPC deste
módulo. Passo D5.1 de `docs/SPRINT_D_PLAN.md`.
**Nenhuma migration nova.** `products_select_public` (`using (true)`,
`20260731000000`) já cobre o catálogo; `product_activations_select_own`
(`20260804000000`/`20260805000000`) já cobre as próprias ativações em
qualquer status, incluindo `draft`/`unpublished`, que a policy pública
esconde. A auditoria que precedeu D5 confirmou isso antes de qualquer código
ser escrito.
**Quinta porta, não um método a mais.** Mesma "naturezas diferentes merecem
portas diferentes" já usada três vezes (ADR-031, ADR-041, ADR-042):
`RepresentativeAccountRepository.findByProfileId` responde "qual é minha
própria linha" (uma tabela, uma linha); `listOwnCatalog` responde "como está
meu Catalog" (duas tabelas, muitas linhas, cruzadas) — adapter e formato de
retorno diferentes o bastante para não caber na mesma implementação sem
forçar `SupabaseRepresentativeAccountRepository` a fazer algo que sua própria
função não pede.
**Teste.** `tests/merge-representative-catalog.test.ts` cobre o cruzamento
puro: produto sem ativação → `not_activated`; produto com ativação → status
repassado; mistura preservando ordem dos produtos; ativação "órfã" (produto
de outra company, que a regra 6 já impede na prática) ignorada; lista vazia;
`unpublished` tratado como qualquer outro status conhecido. As três queries
do adapter em si não têm teste automatizado — mesma lacuna aceita nos outros
adapters deste módulo, coberta por verificação manual (`supabase/README.md`).
**Custo de reversão.** Baixo — arquivo novo, nenhuma tabela/policy tocada;
remover a porta só afeta quem a chama (`src/app/app/page.tsx`,
`RepresentativeHub`).

### ADR-045 — Server Actions de ativação: `null` significa sucesso, e um wrapper genérico substitui um por família (D5.2)
**Decisão.** `activateProductAction`/`setActivationStatusAction`/
`updateRepresentativeProfileAction` (`presentation/actions.ts`) retornam
`Failure | null` — `null` para sucesso, o tipo de falha tipado
(`ActivateProductFailure`/`SetActivationStatusFailure`/
`UpdateRepresentativeProfileFailure`) para o resto — e chamam
`revalidatePath('/app')` em vez de `redirect()`. As três compartilham um
único wrapper, `safeRepresentativeWriteCall`
(`presentation/safe-representative-write-call.ts`), genérico sobre
`T extends { status: string }`.
**Por que `null`, não a convenção "retorno normal é sempre falha" que
`registerRepresentativeAction` usa.** Aquela convenção só funciona porque o
sucesso termina em `redirect()`, que lança — o corpo da função nunca de fato
retorna um valor de sucesso para o tipo checar contra. Ativar, publicar,
despublicar e editar perfil não navegam: o hub permanece na mesma tela,
atualizado por `revalidatePath`. Devolver um valor de sucesso "encolhido" de
uma função cujo tipo de retorno EXCLUI esse variant (por exemplo,
`{status:'activated', ...}` de uma função tipada `ActivateProductFailure`)
seria uma mentira de tipo — `null` é a forma honesta de dizer "funcionou" sem
alegar que a exclusão de tipo não existe.
**Por que um wrapper genérico, não um terceiro/quarto arquivo quase
idêntico.** `safeAuthCall` e `safeOnboardingCall` são dois wrappers quase
idênticos por uma razão real e documentada: `safeOnboardingCall` é
estreitado para `T extends RegisterRepresentativeResult` especificamente
pelo problema de narrowing que `registerRepresentativeAction` tem (ver o
comentário daquele arquivo). Nenhuma das três Server Actions de escrita deste
passo tem esse problema — nenhuma redireciona — então um terceiro/quarto
arquivo copiando a mesma estrutura seria duplicação sem diferença de
comportamento para justificá-la. `safeRepresentativeWriteCall` nasceu como
`safeActivationCall` (só para D5.2) e foi generalizado e renomeado no mesmo
passo, antes de D5b reutilizá-lo, exatamente para não repetir esse corpo uma
terceira vez.
**Custo de reversão.** Baixo — três Server Actions e um wrapper
compartilhado; nenhuma migration.

### ADR-046 — Hub real substitui `RepresentativeHubPlaceholder`; o link público compõe-se de `SITE_URL`, não de uma nova leitura de hostname (D5.3)
**Decisão.** `RepresentativeHub` (`presentation/representative-hub.tsx`)
substitui `RepresentativeHubPlaceholder` em `/app`. Para cada ativação
`published`, mostra `<slug>.<rootHost>/<productSlug>`, onde `rootHost` é
`new URL(SITE_URL).hostname` (`config/site.ts` — `setnar.com` por padrão, ou
`NEXT_PUBLIC_SITE_URL`). Sem QR Code, sem analytics — Stage 1 do ROADMAP,
fora deste elo, conforme o próprio plano.
**A lacuna que fecha.** O comentário do próprio
`RepresentativeHubPlaceholder` já registrava: nada em
`TenantClientView`/`useTenant()` expõe o hostname raiz. `/app` é sempre
visitado no domínio raiz — nunca no subdomínio do próprio representante —
então não existe `Host` de requisição para ler aqui, ao contrário de
`extractRepresentativeSlug` (que resolve a direção oposta, subdomínio →
slug, para uma página pública). A composição usa `SITE_URL` porque esse já é
o único lugar do projeto que define o domínio raiz canônico
(`buildTenantMetadata`/`config/seo.ts` já constroem `openGraph.url` a partir
da mesma constante) — nenhuma abstração nova em `tenancy/` foi criada só
para isto.
**Por que não adicionar um campo a `Tenant`.** Cogitado e descartado: um
`tenant.rootHostname` duplicaria `SITE_URL` como segunda fonte da mesma
informação, sem nenhum consumidor que precise dela por `Tenant`
especificamente — o único uso é este link, e ele já tem `SITE_URL`
disponível sem passar por `resolveTenant()`.
**Custo de reversão.** Baixo — a composição do link é uma linha dentro de
`RepresentativeHub`; removê-la não afeta o resto do hub.

### ADR-047 — `update_representative_profile`, função `SECURITY DEFINER`, não policy de UPDATE por coluna; `avatar_url` adiado (D5b)
**Decisão.**
`supabase/migrations/20260808000000_add_update_representative_profile.sql`
cria `update_representative_profile(p_phone, p_city, p_license_id)`,
`security definer`, `grant ... to authenticated` (nunca `anon`), validando os
três campos com a mesma forma que `register_representative` já usa.
`avatar_url` fica de fora — decisão do Pedro, tomada na auditoria D5/D5b
antes de qualquer código: nada no app renderiza esse campo hoje (mesmo
motivo já registrado no cabeçalho de `20260807000000` para excluí-lo do gate
de publicação).
**A escolha real, entre duas opções legítimas.** A auditoria levantou duas
formas válidas: `grant update (colunas)` + policy escopada (a receita que o
comentário de `20260728000000:31-40` já prescreve, ali para `profiles`) ou
uma função. Nenhum dos dois motivos que levaram D4 (ADR-043) a escolher
função por cima de policy se aplica aqui — não há máquina de estados, e
`representatives.updated_at` já é mantido por um trigger existente. A razão
real é outra: uma policy de UPDATE decide QUEM escreve, não VALIDA o que foi
escrito — um chamador direto do RPC conseguiria gravar `phone`/`license_id`
fora de forma através de uma policy, porque nenhuma das duas colunas tem
CHECK. `register_representative` já valida forma na escrita inicial; deixar
a edição sem a mesma validação reabriria exatamente esse furo. Decisão do
Pedro, confirmada explicitamente na auditoria que precedeu este passo.
**Sexta porta do módulo.** `RepresentativeProfileGateway`
(`domain/representative-profile-gateway.ts`), separada de
`RepresentativeOnboardingGateway` — mesmo raciocínio já usado quatro vezes:
`register()` é uma escrita única, antes de a linha existir, com 8 motivos de
rejeição; `update()` é uma escrita repetível contra uma linha que já existe,
com 4 motivos de rejeição, sem sobreposição.
**Substituição total, não merge parcial.** Os três parâmetros SUBSTITUEM o
valor atual — a UI (`RepresentativeProfileForm`) pré-preenche os três com os
valores vigentes, então "não editar um campo" e "reenviar o valor atual" são
a mesma coisa a partir da Server Action para baixo. `formatE164ToBRPhone`
(`domain/representative-rules.ts`), inversa de `formatPhoneToE164`, existe só
para esse pré-preenchimento — converte o E.164 salvo de volta para a máscara
BR que o input espera.
**Teste.** `tests/map-update-representative-profile-result.test.ts` cobre o
mapeador (mesmo formato dos outros três: sucesso, cada rejeição, status
desconhecido, `data`/`error` nulos, não aceita o status de sucesso de outra
RPC). `tests/representative-profile-schema.test.ts` cobre o Zod.
`tests/representative-rules.test.ts` ganha os casos de
`formatE164ToBRPhone`. A função SQL em si não tem teste automatizado — mesma
lacuna aceita nas outras três, verificação manual em `supabase/README.md`.
**Custo de reversão.** Baixo — `drop function`; nenhuma coluna, tabela ou
linha existente é tocada.

### ADR-048 — `anon` tinha EXECUTE nas quatro funções self-service; `revoke ... from public` nunca foi a causa, um `ALTER DEFAULT PRIVILEGES` era
**Achado, confirmado contra o projeto Supabase real por teste manual, não por
revisão de código.** `select routine_name, grantee, privilege_type from
information_schema.role_routine_grants where routine_name in
('activate_product', 'set_activation_status', 'register_representative',
'update_representative_profile', 'submit_lead')` mostrou `anon` com EXECUTE
nas cinco funções — incluindo as quatro que ADR-040/ADR-043/ADR-047 afirmam,
cada um, ser `grant ... to authenticated` **apenas**, nunca `anon`. Confirmado
de forma mais direta ainda: um RPC HTTP contra `activate_product`, com só o
header `apikey` e **sem** `Authorization` (nenhuma sessão), respondeu HTTP 200
com `{status: 'representative_not_found', ...}` — um resultado TIPADO da
função, não `42501`. Uma concessão correta teria barrado a chamada antes do
corpo da função rodar; aqui o corpo rodou.
**Os quatro ADRs anteriores estavam errados na prática, apesar do SQL parecer
certo à primeira vista.** ADR-040/ADR-043/ADR-047 (e as migrations
`20260806000000`/`20260807000000`/`20260808000000` que documentam) todos
incluem `revoke execute on function ... from public` seguido de `grant
execute ... to authenticated`. Esse padrão é o mesmo já usado, corretamente,
desde ADR-011 — mas aqui não teve efeito nenhum, porque revogava de um papel
(`public`) que nunca foi a origem da concessão vazada.
**Causa raiz.** O projeto tem um `ALTER DEFAULT PRIVILEGES` configurado no
schema `public`, concedendo EXECUTE em funções novas diretamente a `anon` no
momento da criação — uma concessão direta ao papel, não via `public`, e que
roda automaticamente toda vez que `create or replace function` cria uma
função nova. `revoke ... from public` nunca alcança essa concessão porque ela
nunca passou por `public`. Confirmável com `select nspname,
defaclrole::regrole, defaclobjtype, defaclacl from pg_default_acl join
pg_namespace on pg_namespace.oid = pg_default_acl.defaclnamespace where
nspname = 'public'` — um `defaclacl` com `anon=X/...` para
`defaclobjtype = 'f'` confirma.
**Decisão — dois passos, `20260809000000_revoke_anon_execute_leak.sql`.**
1. Revoga EXECUTE de `anon`, explicitamente, por assinatura exata, nas quatro
   funções já existentes — o `alter default privileges` do passo 2 não
   alcança funções já criadas, só as futuras, então este passo continua
   necessário sozinho. 2. `alter default privileges in schema public revoke
   execute on functions from anon` — fecha a causa raiz para qualquer função
   `SECURITY DEFINER` futura (D7/subscription, por exemplo), sem tocar
   `authenticated`.
**`submit_lead` não é tocado.** Seu `grant execute ... to anon` é proposital
(ADR-034). Um grant explícito posterior sobrepõe um default privilege
anterior — a mudança de default do passo 2 não desfaz esse grant explícito
já existente.
**Por que os roteiros manuais dos passos 10/11/12 não pegaram isto antes.**
Os roteiros de verificação de `activate_product`/`set_activation_status`
(passo 11) e `update_representative_profile` (passo 12) já têm, como
primeiro item, exatamente a checagem que teria revelado este furo — "sem
sessão nenhuma, a chamada deve falhar". Mas nenhum dos dois roteiros tinha
sido de fato executado contra um projeto real ainda (`supabase/README.md`
registrava as duas datas de confirmação em branco); a checagem existia no
papel, sem nunca ter rodado. `register_representative` (passo 10) tinha, sim,
verificação de rejeição anônima — mas via teste automatizado
(`tests/register-representative.integration.test.ts`), que exercita a função
via `supabase-js` com uma sessão anônima real, não via RPC HTTP puro sem
nenhum header de sessão — uma diferença que não deveria importar em teoria
(as duas formas passam pela mesma concessão do Postgres), mas que este achado
prova que importava na prática, contra este projeto específico. Novo roteiro
combinado em `supabase/README.md`, "passo 13", fecha as duas lacunas: reroda
o teste "sem sessão" das quatro funções via RPC HTTP direto, contra o projeto
real, depois de aplicar esta migration.
**Custo de reversão.** Baixo — `revoke`/`alter default privileges` na
migration nova; nenhuma tabela, coluna ou linha é tocada. Reverter a migration
reabriria o furo, não vice-versa.

### ADR-049 — QR Code renderizado no cliente, a partir da URL já resolvida; zero migration (QR1, `docs/QR_ANALYTICS_PLAN.md` §3.1)
**Decisão.** `QrCodeCard` (`src/modules/representatives/presentation/qr-code-card.tsx`),
um Client Component novo, renderiza o QR Code de cada ativação `published`
dentro de `RepresentativeHub`, chamando `toDataURL` da lib `qrcode` sobre a
mesma URL que o hub já compõe (`SITE_URL` + slug do representante + slug do
produto, `representative-hub.tsx:46,74` — nenhuma leitura de hostname nova).
"Baixar" e "copiar link" não precisam de nenhuma infraestrutura própria: o
`data:` URI retornado por `toDataURL` serve tanto de `src` da `<img>` quanto
de `href` de um `<a download>` (um `data:` URI é aceito diretamente pelo
atributo `download`); "copiar link" é `navigator.clipboard.writeText` sobre a
mesma string de URL já exibida na tela.
**Alternativas.** Geração server-side (rota ou Server Action gerando
PNG/SVG via a API Node da mesma lib) foi levantada e não escolhida — ver
`docs/QR_ANALYTICS_PLAN.md` §3.1 para o custo completo de cada opção. O fator
decisivo: o link atrás do QR é estável por construção (regra 12 do
`DOMAIN_MODEL.md` — não muda silenciosamente depois de publicado), então não
há evento de "geração" que precise ficar registrado no servidor no Stage 1;
a regra 11 do `DOMAIN_MODEL.md` ("regenerating creates a new QR Code and
invalidates the previous one") descreve um ciclo de vida que só passa a ter
efeito prático quando o Stage 2 introduzir Smart QR Code apontando para um
link de Campanha que pode mudar de alvo — não é ignorada aqui, só ainda não
tem nada para invalidar.
**Dependência nova.** `qrcode`/`@types/qrcode` — `docs/ENGINEERING_GUIDELINES.md`
pede para preferir API nativa antes de adicionar dependência; gerar QR Code
(correção de erro Reed-Solomon, matriz de módulos) não tem equivalente nativo
no browser nem no Node, então a dependência é justificada independente de
qual das duas opções acima fosse escolhida — a lib roda nos dois ambientes.
**Custo de reversão.** Baixo — nenhuma migration, nenhuma RLS, nenhuma
Server Action. Trocar para geração server-side depois é trocar o componente,
não desfazer schema.

### ADR-050 — `analytics_events`, tabela única de eventos crus com `ip_hash` embutido; zero função de escrita ainda (AN1, `docs/QR_ANALYTICS_PLAN.md` §3.4/§3.5)
**Decisão.** Nova migration
(`supabase/migrations/20260810000000_add_analytics_events.sql`) cria
`analytics_events` (`representative_id`, `product_id`, `event_type` check
`'visit'`/`'whatsapp_click'`, `referrer` nullable, `ip_hash`, `created_at`),
`RLS enabled`, zero policies de escrita, e uma policy de SELECT por dono
(`analytics_events_select_own`, via `is_own_representative()` do ADR-039).
Nenhuma função `SECURITY DEFINER` é criada — `record_page_visit`/
`record_whatsapp_click` são AN2/AN4, passos seguintes; até lá não existe
nenhum caminho de escrita, nem anônimo nem autenticado.
**`representative_id`/`product_id` são os dois NOT NULL — diferente de
`leads.product_id` (nullable).** A regra 13 do `DOMAIN_MODEL.md` exige que
todo Analytics/Visitor Event referencie exatamente uma Commercial Page ou
uma Campaign, nunca nenhuma. Como Commercial Page é o par Representative ×
Product (ADR-029) e Campaign ainda não existe (Stage 2), "exatamente uma
Commercial Page" só é satisfeito com os dois campos presentes — deixar
`product_id` nullable, espelhando `leads`, abriria uma linha sem Commercial
Page nenhuma, o que a regra 13 e a constraint 7 (`DOMAIN_MODEL.md` §17)
proíbem.
**`ip_hash` mora na própria tabela, não numa tabela irmã de rate-limit.**
Diferente de `leads`/`lead_submission_attempts`, aqui a mesma linha cumpre
as duas funções — é o dado reportável (o evento) e a chave de rate-limit da
futura `record_page_visit`/`record_whatsapp_click` — porque não há, para
analytics, o par "dado de negócio permanente" / "artefato descartável" que
justificou separar as duas tabelas do lead capture. A purga de `ip_hash`
(AN7, `docs/QR_ANALYTICS_PLAN.md` §4, ainda em aberto) decidirá depois se
anula só a coluna ou descarta a linha inteira — o schema não precisa mudar
para nenhuma das duas.
**Policy de SELECT reaproveita `is_own_representative()`** em vez de
inlinar pela terceira vez o `exists (select 1 from representatives r ...)`
que `leads_select_own` já usa. Não reabre o ciclo de RLS do ADR-039: aquele
ciclo precisava de duas arestas (`representatives_select_public` ⇄
`product_activations_select_own`); `analytics_events` só tem a aresta de
saída, sem nenhuma policy de `representatives`/`product_activations`
referenciando-a de volta.
**Teste.** `tests/analytics-events-select-policy.integration.test.ts` cobre
o lado anônimo (sem recursão/relação ausente, zero linhas para `anon`).
Isolamento real entre dois representantes e o exercício do `check` de
`event_type` por um chamador real **não são automatizáveis neste passo**:
sem AN2/AN4 não existe nenhum caminho de escrita (nem pela chave
publicável, nem por falta de service role key para semear dado direto) —
mesma limitação que `register-representative.integration.test.ts` já
documenta para outra tabela. O `check` de `event_type` é verificado
manualmente via SQL Editor (`supabase/README.md`, passo 14), que ignora RLS
mas nunca ignora CHECK/FK; o isolamento entre representantes fica para o
roteiro de AN2/AN4, quando houver linha real para testar contra.
**Custo de reversão.** Baixo — migration só de schema, nenhuma linha
existe ainda (a tabela não tem caminho de escrita nenhum).

### ADR-051 — `record_page_visit`/`record_whatsapp_click`, o caminho de escrita de `analytics_events`; resolvem por slug+slug, nunca por id (AN2 + AN4, `docs/QR_ANALYTICS_PLAN.md` §3.2/§3.6)
**Decisão.** Uma migration só
(`supabase/migrations/20260811000000_add_analytics_write_functions.sql`)
cria as duas funções `SECURITY DEFINER` que escrevem em `analytics_events`
(AN1) — `record_page_visit` (`event_type = 'visit'`) e
`record_whatsapp_click` (`event_type = 'whatsapp_click'`) — mesma forma de
`submit_lead`: retorno `boolean` anti-enumeration, limiares de rate limit
como literais fixos (nunca parâmetro do chamador — ADR-036), `revoke ...
from public` + `grant execute ... to anon, authenticated` explícito, nunca
dependendo de `ALTER DEFAULT PRIVILEGES` (ADR-048). Uma migration para as
duas, não duas: mesma forma exata, revisadas como uma unidade ("AN2 + AN4"),
compartilhando o helper de bot abaixo — diferente de
`submit_lead`/`20260802000000`, que são a MESMA função em dois momentos no
tempo (criação e correção), não duas funções irmãs nascendo juntas.
**Resolvem por slug+slug, nunca por id — diferente de `submit_lead`.**
`submit_lead` recebe ids porque seu chamador (`/api/leads/route.ts`) já
resolveu a ativação a partir do `Host` antes de chamar o RPC. Aqui a escolha
é `p_representative_slug`/`p_product_slug` — os dois textos públicos que
qualquer visitante já conhece só de estar na página (subdomínio =
`representatives.slug`, ADR-026; segmento de path = `products.slug`) — e a
função faz a resolução inteira sozinha. Não esconde nada que já não fosse
público (`representatives_select_public`/`product_activations_select_published`
já expõem esses ids a qualquer chave publicável); a vantagem é a checagem
ficar autocontida, sem herdar confiança de uma resolução feita em outro
lugar do código.
**Filtro de bot (§3.2) estendido às duas funções — mesma decisão, não uma
segunda.** `is_bot_user_agent(text)`, helper novo (`language sql immutable`,
não `security definer` — não lê tabela nenhuma), com a lista de substrings
do plano (`bot`, `crawler`, `spider`, `facebookexternalhit`, `whatsapp`)
mais três adicionadas aqui (`curl`, `python-requests`, `headlesschrome`).
Uma chamada filtrada retorna `true` sem inserir e sem consumir rate limit —
nunca `false` — mesmo anti-enumeration de `submit_lead`, ao contrário: um
retorno diferente de uma inserção real permitiria a um bot descobrir, por
tentativa, quais substrings a lista contém.
**Dois limiares, motivos distintos.** `record_page_visit`: 60/60s — evento
passivo, volume maior esperado, janela curta cobre navegação rápida
legítima entre produtos do mesmo representante sem esbarrar no limite.
`record_whatsapp_click`: 5/3600s — DELIBERADAMENTE o mesmo par de
`submit_lead` (`20260802000000`), não um número novo: `DOMAIN_MODEL.md`
(Lead Attribution Service) descreve um clique no WhatsApp como um
"conversion-intent Visitor Event", mesma classe de ação deliberada que já
justificou o limiar de leads. Cada limiar conta só dentro do próprio
`event_type`, então navegar bastante nunca consome o orçamento, bem mais
apertado, dos cliques.
**Par inválido não consome rate limit — divergência deliberada de
`submit_lead`, causa é o schema já fechado em AN1.**
`lead_submission_attempts` é uma tabela só de `(ip_hash, attempted_at)`,
sem referência a representative/product — pode registrar "uma tentativa"
sem sujeito válido. `analytics_events` acumula dado reportável E ledger de
rate limit numa peça só (§3.5, já aplicada); `representative_id`/
`product_id` são `not null` com FK, tornando estruturalmente impossível
inserir uma linha "tentativa" sem par já válido. Risco residual avaliado
como baixo: slug é informação pública (é a própria URL); nenhuma linha é
escrita nesse caminho, então não há como poluir dado de um representante
real por essa via — só round-trips rejeitados.
**Sem limpeza dentro destas funções — diferente de `submit_lead`, de
propósito.** `submit_lead` apaga suas próprias linhas de rate-limit >1 dia
porque aquela tabela não tem valor além disso. `analytics_events` É o dado
reportável; apagar aqui destruiria histórico real sob pretexto de limpar
rate limit. Retenção/purga é AN7, ainda em aberto.
**`p_referrer` truncado (`left(..., 2048)`), nunca rejeitado** — diferente
de `nome`/`cidade` em `submit_lead`: o evento (uma visita aconteceu) já é
verdadeiro e valioso independente do tamanho do referrer; descartar o
evento inteiro por um header HTTP atípico jogaria fora dado real por motivo
cosmético.
**`p_ip_hash` nulo/vazio rejeitado explicitamente**, defesa em profundidade:
sem essa checagem, `ip_hash = null` nunca bate na contagem de rate limit
(comparação com NULL nunca é verdadeira em SQL) e o INSERT falharia com um
erro cru de constraint em vez do `boolean` tipado que a função promete.
**Double-check do ADR-048 — obrigatório, feito nas duas funções.**
`select grantee, privilege_type from information_schema.role_routine_grants
where routine_name in ('record_page_visit', 'record_whatsapp_click')` e uma
chamada RPC HTTP crua, sem header `Authorization`, contra as duas —
resultados registrados em `supabase/README.md`, passo 15, quando a migration
for aplicada e o roteiro executado. Ao contrário do achado do ADR-048, aqui
`anon` DEVE aparecer — é o resultado esperado, não um vazamento.
**Teste.** `tests/analytics-write-functions.integration.test.ts`, mesma
forma de `tests/lead-submission.integration.test.ts`. Cobertura assimétrica
deliberada entre as duas funções: o limite de `record_whatsapp_click`
(5/3600s) é saturado de verdade (6 chamadas, mesmo custo de dado que o
teste de leads já aceita); o de `record_page_visit` (60/60s) não é saturado
— faria 60 linhas reais só para reprovar o mesmo mecanismo de corte por
`count(*)` já exercitado, num limiar menor, pela própria suíte de
`record_whatsapp_click` e por `lead-submission.integration.test.ts`. O
filtro de bot, que É específico destas duas funções, é testado a fundo (61
chamadas para visita, 6 para clique, todas retornando `true`) — sem custo de
dado nenhum, já que uma chamada filtrada nunca insere.
**Custo de reversão.** Baixo — duas funções novas, zero alteração em
`analytics_events` (AN1). Dropar as duas fecha o caminho de escrita sem
tocar no schema.

### ADR-052 — Correção ao ADR-051: `authenticated` tinha EXECUTE em `is_bot_user_agent`, apesar do comentário afirmar o contrário; `anon` estava correto
**O ADR-051 (acima) está errado na metade.** Ele afirma que
`is_bot_user_agent` "não é concedido a anon/authenticated". O double-check
de grants que o próprio AN2/AN4 exigia (`information_schema.role_routine_grants`)
mostrou `authenticated` com EXECUTE nessa função — só `anon` estava correto,
confirmado também por RPC HTTP cru sem `Authorization`
(`401 42501 permission denied`, o resultado certo). Mesmo padrão do ADR-039
corrigindo um comentário errado de `20260804000000`: a migration antiga
(`20260811000000`) não é editada (regra do README.md); esta entrada é a
correção registrada.
**Causa raiz — mesma classe do ADR-048, papel diferente.** `revoke ...
from public` funcionou (por isso `anon` estava certo — o
`alter default privileges ... revoke execute on functions from anon` do
ADR-048 fechou especificamente o default de `anon` deste projeto). Mas
aquela correção nunca tocou `authenticated`: este projeto Supabase tem (tinha)
um default privilege próprio concedendo EXECUTE a `authenticated` em toda
função nova — mesmo mecanismo do ADR-048 (`ALTER DEFAULT PRIVILEGES`, não um
`grant` explícito), só que para o papel que, para as quatro funções
originais do ADR-048, era o acesso CORRETO — por isso nunca foi fechado até
agora, quando uma função (`is_bot_user_agent`) que não deveria ter
`authenticated` nenhum expôs o gap.
**Risco real, avaliado como baixo.** `is_bot_user_agent` não lê tabela, não
muta nada, devolve só um `boolean` sobre o próprio parâmetro — nenhum dado
vaza por essa concessão. Corrigido mesmo assim porque a documentação
afirmava um comportamento que não era o real, e esse é exatamente o tipo de
divergência que o ADR-048 existe para não deixar passar.
**Correção.** Nova migration
(`20260812000000_revoke_authenticated_from_is_bot_user_agent.sql`):
`revoke execute on function public.is_bot_user_agent(text) from
authenticated`. `record_page_visit`/`record_whatsapp_click` não são tocadas
— `authenticated` nelas é o público pretendido (ADR-051), não um vazamento.
**Custo de reversão.** Baixo — um `revoke` a mais, nenhum dado tocado.

### ADR-053 — `record_page_visit`/`record_whatsapp_click` chamadas do app; `after()` para a visita, rota dedicada para o clique (AN3 + AN5, `docs/QR_ANALYTICS_PLAN.md` §4)

**O que muda.** As duas funções `SECURITY DEFINER` do ADR-051 existiam desde
`20260811000000` sem nenhum chamador no app. Este ADR fecha isso: `[productSlug]/page.tsx`
chama `record_page_visit` depois de resolver a ativação; `WhatsappCta` chama
`record_whatsapp_click` através de uma rota nova, `/api/track-click`. Zero
migration — só código de aplicação, mesmo como o plano já previa.

**Módulo novo, `analytics`, em vez de estender `leads`.** `AnalyticsGateway`
(`modules/analytics/domain/analytics-gateway.ts`) é uma porta com dois
métodos (`recordPageVisit`/`recordWhatsappClick`), implementada por
`SupabaseAnalyticsGateway` e resolvida por `getAnalyticsGateway()` — mesma
forma de `LeadGateway`/`getLeadGateway()`, não um método a mais ali. As duas
funções SQL sempre andam juntas (mesmo desenho, mesmo filtro de bot, mesma
migration — ADR-051), então uma porta com dois métodos, não duas portas,
espelha isso; mas o domínio é outro (analytics não é lead capture), então um
módulo próprio, não uma extensão de `leads` — mesmo raciocínio que já levou
a `RepresentativeOnboardingGateway` (ADR-041) a ser uma porta nova em vez de
inchar `RepresentativeRepository`.

**`p_ip_hash`: `LOGIN_ATTEMPT_SALT` reaproveitado, não um salt novo — resposta
concreta ao que §3.4 deixou em aberto.** O plano listava as duas opções sem
decidir qual; a implementação segue o mesmo salt que `login-rate-limiter.ts`
e `supabase-lead-gateway.ts` já leem, pela mesma razão que este último já
documenta: um segundo salt não isola nenhum domínio de retenção que já não
esteja isolado pelo próprio `ip_hash` morar em `analytics_events` (não numa
tabela de rate-limit irmã, decisão já fechada em AN1/ADR-050). `hash()` é
duplicada em `supabase-analytics-gateway.ts` em vez de importada de
`supabase-lead-gateway.ts`, mesma razão que este último já dá para não
importar de `login-rate-limiter.ts`: acoplar dois módulos de domínio por
quatro linhas de crypto não paga o preço.

**AN3 — `after()` (`next/server`), não um `await` bloqueando a renderização.**
O plano exige que uma falha ou lentidão no RPC nunca atrase a página real. Um
`await` dentro de um `try/catch` ainda atrasaria a resposta pelo tempo do
round-trip a Postgres, mesmo capturando o erro; `after()` agenda o callback
para rodar **depois** que a resposta já foi enviada, então nem uma exceção
nem uma latência alta dentro dele pode, por construção, chegar ao visitante.
`headers()`/`cookies()` continuam legíveis dentro do callback (garantia do
próprio Next.js para `after()`), o que é o que permite `getAnalyticsGateway()`
(que precisa de `cookies()` para montar o client Supabase) e `getClientIp()`
funcionarem ali sem reabrir o contexto da requisição por fora dele. Chamado
só depois do `if (!activation) notFound()` — mesma instrução do plano: não
tentar a chamada num caminho que a página já sabe que vai dar 404.

**AN5 — rota dedicada (`/api/track-click`), não uma Server Action.** Mesma
forma de `/api/leads/route.ts` (ADR-034): `productSlug` é o único dado
confiado do corpo, a rota resolve `representative`/`product` de novo a
partir do `Host` da própria requisição
(`resolveRepresentativeActivation`), nunca aceitando um id vindo do
cliente. Uma Server Action não serviria aqui: o disparo é `fetch(...,
{ keepalive: true })` de um `onClick` sem `preventDefault`, desenhado
exatamente para sobreviver ao unload da aba (§3.3 do plano, decisão já
fechada) — isso é o contrato de uma requisição HTTP comum, não o de uma
Server Action.

**`WhatsappCta` vira Client Component — única forma de interceptar o
clique**, confirmado em §2.3 do plano: não havia `onClick` nenhum antes.
`representative`/`product` continuam vindo como props do Server Component
pai (`[productSlug]/page.tsx`) — são dados simples (`string`/`string | null`),
sem nada que um Client Component não possa receber serializado.

**`/api/track-click` sempre responde `200`.** O cliente nunca lê nem espera
essa resposta (a navegação para `wa.me` já começou antes dela chegar), então
não há nenhum consumidor para um código de erro comunicar algo a. Toda falha
(corpo malformado, par inválido, erro no RPC) é capturada e logada,
nunca repassada — mesmo espírito best-effort do AN3, aplicado ao lado da
rota em vez de um `after()`, porque aqui o "atraso" que importa evitar é do
lado do cliente (o `fetch` já é `keepalive`, sem `await` no `onClick`), não
do lado do servidor.

**Não coberto por este ADR, de propósito:** AN6 (exibir as estatísticas no
hub) e AN7 (retenção/purga) — próximos passos do mesmo plano, ainda não
implementados.

**Custo de reversão.** Baixo — nenhuma migration, nenhum schema tocado; um
`AnalyticsGateway` a menos ou uma rota a menos não desfaz nada persistido.

### ADR-054 — Correção ao ADR-053: `ip_hash` de analytics passa a ter salt próprio (`ANALYTICS_IP_SALT`), não mais `LOGIN_ATTEMPT_SALT` reaproveitado

**O ADR-053 (acima) decidiu errado nesse ponto específico.** Ele reaproveitou
`LOGIN_ATTEMPT_SALT` para o `ip_hash` de `analytics_events`, apresentando
isso como "a decisão menor, mais consistente" — mas essa era exatamente uma
das duas opções que `docs/QR_ANALYTICS_PLAN.md` §3.4 tinha deixado
deliberadamente em aberto ("reaproveitar `LOGIN_ATTEMPT_SALT` ... ou um salt
novo ... ambas as opções existem, não decido qual aqui"), e foi escolhida
sem confirmação do Pedro. Mesma convenção de correção já usada para o gap do
`is_bot_user_agent` (ADR-052): a entrada original não é reescrita, esta é a
correção registrada.

**Por que reaproveitar o salt era o erro.** Nenhuma das tabelas
(`analytics_events`, `login_attempts`, `lead_submission_attempts`) guarda IP
em texto puro — mas com o **mesmo** salt, o mesmo IP produz o **mesmo**
`ip_hash` nas três. Isso torna possível correlacionar uma linha de
`analytics_events` (visita/clique, em princípio anônimo) com uma tentativa
de login ou um lead identificável (nome, telefone, e-mail) que compartilhe
o mesmo IP — exatamente o tipo de correlação que a postura conservadora de
LGPD já fechada em §3.4 existe para impedir ("Analytics data must never
expose personally identifying Visitor information", regra 14 do
`DOMAIN_MODEL.md`, citada pelo próprio ADR-050). Um salt compartilhado não
é neutro aqui: é a única coisa que tornaria essa correlação possível.

**Decisão.** `ANALYTICS_IP_SALT`, variável de ambiente nova, mesma forma de
`LOGIN_ATTEMPT_SALT` (server-only, string aleatória longa, nunca commitada —
ver `supabase/README.md` §5). `supabase-analytics-gateway.ts`'s `hash()` lê
`ANALYTICS_IP_SALT` em vez de `LOGIN_ATTEMPT_SALT`; a função de hash em si
não muda (`sha256(salt:ip)`, mesma forma das outras duas). Nenhuma migration:
`analytics_events.ip_hash` já era só `text`, sem CHECK de formato — trocar o
salt que a alimenta é puramente um detalhe do adapter.

**Por que agora é de graça, e por que essa janela fecha.** `analytics_events`
foi criada em `20260810000000` (AN1) e as funções que escrevem nela em
`20260811000000`/`20260812000000` (AN2/AN4) — o wiring do app (AN3/AN5,
ADR-053) é o primeiro código que de fato as invoca. Confirmado contra o
projeto real do Pedro antes desta troca: `select count(*) from
analytics_events` (chave anon, portanto sujeito à mesma policy own-row que
`analytics_events_select_own` já aplica) devolveu `0`. **Essa contagem não é
prova definitiva** — a chave anon nunca enxerga linha nenhuma dessa tabela
por RLS, com ou sem dado real presente, então uma leitura por essa via
sempre devolveria `0` mesmo que existissem linhas. O double-check
verdadeiramente conclusivo (`select count(*)` pelo SQL Editor, que ignora
RLS) fica pendente de confirmação do Pedro antes deste ADR ser considerado
totalmente fechado. Se alguma linha de verificação manual anterior já tiver
sido gravada com o salt antigo, ela fica órfã (hash calculado com um salt
que o app não lê mais) — aceitável, é dado de teste, não dado real, e não
há como re-hashear retroativamente (o IP original nunca foi persistido, por
design). A partir desta mudança, toda linha nova é gravada com
`ANALYTICS_IP_SALT`. Esta é a única janela em que a troca não tem custo:
uma vez que exista tráfego real, qualquer salt novo tornaria as linhas
antigas não-comparáveis entre si por IP (mesma consequência que já se aplica
a rotacionar `LOGIN_ATTEMPT_SALT`, documentada em `supabase/README.md` §5) —
mas aqui, ao contrário de uma rotação de manutenção, essa perda de
comparabilidade é precisamente o objetivo, não um efeito colateral aceito.

**Custo de reversão.** Baixo enquanto a tabela seguir vazia (que é o estado
confirmado, com a ressalva acima); alto depois que existir tráfego real —
outro motivo para fechar isto agora, antes do primeiro deploy com visitas de
verdade.

### ADR-055 — Aviso "Antes de contratar" por categoria de Produto, e o disclaimer "não é canal oficial" que faltava na Commercial Page

**Achado, confirmado por investigação, não hipotético.** A Commercial Page
real (`src/app/[productSlug]/page.tsx`) não tinha nenhum aviso obrigatório ao
consumidor — nem o "Antes de contratar" que os templates estáticos de
`templates/commercial-pages/` têm (só `ConexaoGreen/index.html` tinha algo
parecido; os outros seis templates, não), nem o disclaimer "não é canal
oficial" que o README já promete para SETNAR, na seção "Compliance" acima
("*A permanent legal notice sits in the footer* [...] *When commercial pages
ship, that per-page identification becomes a publication precondition, not a
template detail*"). Confirmado que esse segundo disclaimer não existia em
lugar nenhum do app fora do footer de `src/app/page.tsx`: `Footer`
(`shared/layout/footer.tsx`) só é renderizado ali, nunca em
`[productSlug]/page.tsx` — os dois usam portas de resolução completamente
diferentes (`resolveTenant`/`MarketingContent` vs. `RepresentativeRepository`,
ADR-031), então um nunca herdava o outro por acidente. Isso não era só falta
de polish visual (já documentado, deliberado, em `DESIGN_SYSTEM.md`) — é uma
exposição de compliance real: o Manual de Conduta da iGreen, item 19.3,
exige "prestar todas as informações ao consumidor antes da contratação".

**Decisão — conteúdo legal versionado como código, não uma coluna nova.**
`src/modules/representatives/domain/product-compliance-notice.ts` exporta
`PRODUCT_COMPLIANCE_NOTICE`, um `Record<slug, texto>` cobrindo os 7 slugs de
`20260803000000_seed_igreen_catalog.sql`, e uma função `getProductComplianceNotice`
que devolve `null` para qualquer slug fora do mapa (nunca um texto adivinhado).
Nenhuma coluna nova em `products`: mesmo raciocínio já registrado no cabeçalho
daquela migration para por que o catálogo é uma migration e não um script —
texto legal revisável por diff/PR, não editável em runtime. `ComplianceNotice`
(`src/modules/representatives/presentation/compliance-notice.tsx`) é o único
componente novo, renderizado em `[productSlug]/page.tsx` logo abaixo do
`LeadForm` — `Text variant="caption"` simples, sem `Card`, mesmo tratamento
visual que `Footer` já dá ao seu próprio `legalNotice` ("discreto, mas sempre
visível", não um banner de alerta).

**Uma categoria por texto, não um texto por produto.** Os 7 slugs agrupam em
3 bases regulatórias distintas, cada uma com sua própria fonte:
  - **Energia** (`conexao-green`, `conexao-solar`, `conexao-livre`,
    `conexao-placas`) — Manual de Conduta iGreen, item 19.3.
  - **Seguros** (`green-seguros`) — "Green Seguros.md", §9.3/§10.3: BP
    Seguradora S.A. como responsável pela apólice, regulada pela SUSEP,
    indenização por Tabela FIPE.
  - **Telecom/Club** (`telecom`, `conexao-club`) — **sem fonte específica no
    Manual de Conduta para nenhum dos dois.** Texto genérico baseado no CDC,
    aprovado pelo Pedro como placeholder provisório, **não revisado pelo
    jurídico da iGreen.** Tratar como o texto mais fraco dos três — o único
    sem base regulatória citável — e revisitar assim que houver fonte real.

**O disclaimer "não é canal oficial" é duplicado do `setnar.tenant.ts`, não
importado.** `NOT_OFFICIAL_CHANNEL_NOTICE` (mesmo arquivo) repete, ao pé da
letra, o texto que `FooterContent.legalNotice` já carrega para a página do
SETNAR — mesma razão pela qual `representative-rules.ts` já duplica
`BR_PHONE_PATTERN` em vez de importar de `leads`: a Commercial Page nunca
passa por `resolveTenant`/`MarketingContent`, e importar através dessa
fronteira por uma única string acoplaria `representatives` a
`marketing`/`tenancy` sem necessidade. Manter os dois em sincronia à mão se o
texto mudar.

**Teste — no mesmo nível dos testes já existentes no projeto, não um nível
novo.** Este projeto não tem infraestrutura de teste de renderização React
(sem `@testing-library/react`, sem `jsdom` — todo teste em `tests/` hoje é
`node:test`/`assert` contra função pura). `ComplianceNotice` é um render
incondicional do que as duas exportações acima devolvem, então o risco real —
o texto errado aparecendo para o produto errado — mora inteiramente no
mapeamento, não no JSX. `tests/product-compliance-notice.test.ts` testa
`PRODUCT_COMPLIANCE_NOTICE`/`getProductComplianceNotice` diretamente (os 4
casos: energia, seguros, telecom, club), no mesmo padrão de
`representative-rules.test.ts` — sem introduzir uma convenção de teste nova
para isto.

**Não implementado neste passo, de propósito.** Metadados por página
(`generateMetadata`/OG image) e o gap maior de visual on-brand/calculadora por
produto — o segundo precisa de investigação própria (mudança de schema,
decisão de produto sobre o design system) antes de qualquer código.

**Custo de reversão.** Baixo — um componente sem estado e um arquivo de
constantes; nenhuma tabela, coluna ou migration.

---

### ADR-056 — "No distractions" passa a significar CTA único, não zero conteúdo; conteúdo variável por Produto vive em código; Tabs de conteúdo do Conexão Club como prova de conceito (CP3)

**Contexto.** `docs/COMMERCIAL_PAGE_CONTENT_PLAN.md` investigou o gap entre a
Commercial Page mínima que ADR-055 deixou (identificação + CTA + lead form +
compliance) e o conteúdo rico que `templates/commercial-pages/` já tem pronto
como referência, nunca conectado a runtime. O documento levantou duas
decisões de produto que bloqueavam qualquer widget novo (§3.1, §3.2) sem
fechar nenhuma sozinho — este ADR registra as duas decisões e a primeira
implementação sobre elas.

**Decisão §3.1 — reabertura consciente do "No distractions" de `DESIGN_SYSTEM.md`.**
A seção "Commercial Page Components" ("No distractions. No unnecessary
navigation. The page exists to convert visitors into conversations.") está
inalterada desde o commit fundador do repositório, sem nenhum comentário
indicando que fosse regra só do MVP. Lida ao pé da letra, ela proibiria
qualquer conteúdo além do mínimo — mas o valor que ela protege não é
"zero conteúdo", é "um caminho só até a conversão": nenhuma navegação nova,
nenhum CTA concorrente, nenhuma saída da página. **Todo widget de conteúdo
novo deve terminar no mesmo CTA único que já existe** — `WhatsappCta` (ou
uma variação dele que só monta um texto de mensagem diferente, nunca uma URL
diferente) ou `LeadForm`. Isso não é uma reversão da regra original, é a
leitura que sobrevive ao ganho real de conteúdo mais rico sem abrir mão do
que "no distractions" de fato protegia.

**Decisão §3.2 — conteúdo variável por Produto em código, não em coluna.**
Mesmo raciocínio já registrado em ADR-055 para o aviso de compliance:
`products` continua só `id, company_id, slug, name`
(`20260731000000_create_representative_domain.sql`), sem policy de escrita
para `authenticated`/`anon` e sem superfície de admin de catálogo no roadmap
antes do Stage 5. Uma coluna nova hoje não compraria "editável sem deploy"
nenhuma — só trocaria uma revisão por diff/PR num arquivo `.ts` por uma
revisão por diff/PR numa migration, perdendo a tipagem forte do TypeScript
no caminho. Conteúdo por produto passa a viver em
`src/modules/representatives/domain/product-content/*.ts`, um arquivo por
Produto, mesmo padrão que `product-compliance-notice.ts` já estabeleceu.

**Implementação — CP3, prova de conceito com 1 produto só.**
`src/modules/representatives/domain/product-content/conexao-club.ts` exporta
`ProductContentTab` (`{ chave, rotulo, descricao }`) e `CONEXAO_CLUB_TABS`,
as 5 categorias extraídas literalmente de
`templates/commercial-pages/ConexaoClub/index.html`'s `CATEGORIAS`
(mercado/farmácia/viagem/lazer/combustível) — a mesma cópia já aprovada por
compliance que o template estático usa. Sem `mensagemWhatsapp` por aba:
confirmado no `<script>` do template que o CTA (`id="cat-cta"`) usa sempre o
mesmo texto fixo ao trocar de categoria, ao contrário de ConexaoPlacas/
GreenSeguros (CP4, não coberto por este passo). Uma função pura,
`getActiveTab(tabs, chave)`, resolve qual aba está ativa — `null` para uma
chave fora do array, nunca a primeira aba como fallback silencioso, mesmo
princípio de `getProductComplianceNotice`.

`src/modules/representatives/presentation/product-content-tabs.tsx` é o
Client Component novo: um grupo de botões (`role="tablist"`) que troca só o
parágrafo de descrição visível, compondo `Card`/`Text` do design system —
nenhuma peça visual nova. Zero chamada de rede, zero estado além de "qual
aba está selecionada". `src/app/[productSlug]/page.tsx` renderiza
`<ProductContentTabs tabs={CONEXAO_CLUB_TABS} />` entre `WhatsappCta` e o
`Card` do lead form, condicionado a `product.slug === 'conexao-club'` — os
outros 6 produtos não ganham esse bloco. **Zero mudança em
`WhatsappCta`/`LeadForm`/`ComplianceNotice`** — nenhuma das três precisa
saber que tabs existem.

**Teste — mesmo nível de `product-compliance-notice.test.ts`.**
`tests/product-content-tabs.test.ts` testa `CONEXAO_CLUB_TABS`/`getActiveTab`
diretamente (`node:test`/`assert`, sem infraestrutura de render React — o
mesmo limite que ADR-055 já documentou: o risco real, a descrição errada
aparecendo para a categoria errada, mora no lookup, não no JSX).

**Verificação.** `npm run typecheck`/`lint`/`test`/`build` passam limpos
(253/253 testes, incluindo os 6 novos deste passo). Verificação manual via
`curl -H "Host: teste-novo-a.setnar.com" localhost:3000/conexao-green`
confirma que o produto publicado existente renderiza idêntico a antes —
nenhum marcador de tabs (`role="tablist"`, `cat-tabs`) no HTML servido,
título do produto e aviso de compliance presentes como sempre.

**Limitação registrada, não resolvida neste passo.** Nenhum representante de
teste no banco atual tem `conexao-club` como Product Activation publicada
(só `conexao-green` está publicado, para `teste-novo-a`/`teste-a`) — sem uma
service-role key neste projeto (por design, ver ADR-037) e sem credenciais de
um usuário autenticado para chamar `activate_product`/`set_activation_status`
nesta sessão, não foi possível confirmar por HTTP real o HTML servido de
`/conexao-club` ponta a ponta. A prova disponível para este passo é indireta:
compilação real pelo bundler do Next (`next build`, zero erros, exercitando o
mesmo SWC/JSX que produção usa) e os testes de unidade da lógica de
resolução de aba — não uma captura de tela ou HTML servido do produto em si.
**Próximo passo de verificação, fora do escopo deste ADR:** publicar
`conexao-club` para um representante de teste e repetir o mesmo roteiro de
`curl` acima apontando para `/conexao-club`.

**Custo de reversão.** Baixo — um arquivo de conteúdo, um componente client
sem estado além de "aba selecionada", e uma condicional em `page.tsx`;
nenhuma migration, nenhuma tabela, nenhuma coluna.

**Não coberto por este passo, de propósito.** CP4 (rolar o mesmo padrão de
tabs para ConexaoPlacas/GreenSeguros/Telecom, que variam o texto do CTA por
aba além da descrição), CP5-CP8 (calculadora, quiz, FAQ), CP9 (paleta
on-brand da iGreen — depende de confirmação de marca própria, CP1) e CP10
(GA4/Meta Pixel) — cada um permanece como próximo passo isolado em
`docs/COMMERCIAL_PAGE_CONTENT_PLAN.md`.

---

### ADR-057 — Mecanismo de tokens de marca por vertical/Company, aplicado à Commercial Page da iGreen (CP9)

> **PROTÓTIPO NÃO APROVADO.** A Política de Uso da Marca da iGreen
> (`docs/COMMERCIAL_PAGE_CONTENT_PLAN.md` §3.3/CP1) continua pendente de
> confirmação. Este ADR registra um mecanismo técnico e um exemplo interno
> construído para pedir essa aprovação — não é uma decisão de marca fechada.
> Nada aqui deve ser tratado como "a iGreen aprovou" até CP1 responder "sim".

**Nota (04/08/2026).** Pedro decidiu prosseguir com CP9 sem aguardar
confirmação formal de CP1 — decisão de negócio, aceitando o risco descrito
acima. O mecanismo técnico e as ressalvas de contraste/`--palette-700`
continuam válidas como estão; só a precondição de aprovação deixou de
bloquear o merge.

**Contexto.** `docs/COMMERCIAL_PAGE_CONTENT_PLAN.md` §3.3 separou "conteúdo
mais rico" (ADR-056/CP3) de "visual on-brand com a iGreen" de propósito, e
registrou a segunda como a decisão mais sensível do documento — depende de
confirmação da Política de Uso da Marca (CP1), ainda pendente. Pedro decidiu
implementar mesmo assim, como protótipo interno para apresentar à iGreen e
pedir essa aprovação, não como algo a publicar. Uma investigação prévia
(Fases 1 e 2, aprovadas por Pedro e por esta revisão antes deste passo)
confirmou os fatos abaixo antes de qualquer código:

- `BrandTokensStyle` (`src/modules/tenancy/presentation/brand-tokens.tsx`)
  só emitia `:root{...}` — nenhum conceito de tema por vertical existia.
- `RepresentativeProduct` não carregava a Company do Product, embora o
  schema já tivesse `products.company_id → companies.slug` (seed confirma
  `igreen`) — dado presente, só não exposto no tipo de domínio nem na query.
- As 3 cores de marca (`--verde-profundo` #07311D, `--verde-vivo-escuro`
  #00893F, `--verde-vivo` #00B359) são idênticas, byte-a-byte, nos 7
  `templates/commercial-pages/*/style.css`.
- Cálculo real de contraste WCAG (fórmula de luminância relativa, não
  estimativa) mostrou que branco sobre `--verde-vivo` mede 2.77:1 —
  **falha AA (4.5:1 para texto normal)**. Isso já é um defeito no próprio
  `.btn-whats` dos 7 templates originais da iGreen (texto 16px/700, abaixo
  do limiar de "texto grande"), não uma regressão introduzida aqui.

**Mecanismo — escopo por atributo, não por `:root`.** `BrandTokensStyle`
ganhou um parâmetro `scope?: string`; quando presente, emite
`[data-vertical="${scope}"]{...}` em vez de `:root{...}`. Um elemento fora
dessa subárvore (o resto do app, `<html className="scroll-smooth">`, `.dark`)
continua vendo o `:root` do SETNAR normalmente — nenhum dos dois depende de
token algum. Dentro da subárvore, qualquer token que a regra escopada não
redeclare (`--palette-700`, e por extensão `--ring`, que deriva dele) segue
herdando do `:root` por cascata normal de custom property — decisão
deliberada, não uma omissão: os 3 tons da iGreen não produzem um 4º valor
intermediário, e inventar um sem aprovação seria fechar sozinho exatamente o
tipo de decisão de marca que este protótipo existe para não fechar.

**Mapeamento de cores.**
`src/modules/representatives/domain/company-brand/igreen.ts` exporta
`IGREEN_TOKENS` (RGB, mesmo formato de `setnarTenant.brand.tokens`):
`--palette-900` `7 49 29` (verde-profundo), `--palette-800` `0 137 63`
(verde-vivo-escuro), `--palette-500` `0 179 89` (verde-vivo — só acento,
nunca fundo com texto em cima), `--palette-200` `207 238 218` (borda),
`--palette-50` `245 250 246` (fundo). `--brand`/`--content` continuam
derivando de `--palette-900` (14.32:1 e 14.97:1 contra fundo/branco — folga
grande); `--brand-hover` deriva de `--palette-800`, branco em cima mede
**4.52:1 — passa AA raspando, margem de 0.02**, o mesmo tipo de margem
apertada que o comentário de `--content-subtle` em `globals.css` já
sinalizava como perigosa. Confirmado presente de verdade no protótipo: o
botão do `WhatsappCta`/`LeadForm` (`Button` variant `primary`, default) usa
`bg-brand hover:bg-brand-hover text-brand-contrast` — o estado de hover é
exatamente esse par de 4.52:1.

**Detecção da Company — slug real, não `if (true)`.** O select de
`SupabaseRepresentativeRepository.findPublishedActivation` passou a incluir
`company:companies!inner ( slug )` dentro do embed de `product` — join
aditivo, mesmo padrão já usado para `representative`/`product`, RLS de
`companies_select_public` já `using (true)`. `RepresentativeProduct` ganhou
`companySlug: string`; `SupabaseRepresentativeCatalogRepository` (a leitura
do hub D5.1) recebeu o mesmo join, trocando o cast cego anterior por um
mapeamento explícito, já que o tipo agora exige o campo de verdade.
`src/modules/representatives/domain/company-brand/resolve-company-vertical.ts`
expõe `resolveCompanyVertical(companySlug)`, que devolve `{ vertical,
tokens }` só para slugs presentes em `COMPANY_BRAND_TOKENS` (hoje só
`igreen`) — `undefined` para qualquer outra Company, o que
`[productSlug]/page.tsx` trata como "renderizar o tema genérico do SETNAR".
Crescer para uma segunda Company é adicionar uma entrada ao mapa, não mudar
a função. `page.tsx` renderiza `<main data-vertical={companyVertical?.vertical}>`
e, só quando resolvido, `<BrandTokensStyle tokens={...} scope={...} />` como
primeiro filho de `<main>` — não em `layout.tsx`, que continua intocado.

**Teste.** `tests/resolve-company-vertical.test.ts` cobre
`resolveCompanyVertical` (resolve `igreen` com os tokens certos; `undefined`
para qualquer slug fora do mapa, inclusive string vazia — o risco real, uma
Company não-iGreen herdando a paleta por engano) no mesmo nível de
`product-compliance-notice.test.ts`, sem infraestrutura de render React.

**Verificação.** `npm run typecheck`/`lint`/`test`/`test:integration`/`build`
passam limpos (256/256 testes). Verificação manual via
`curl -H "Host: teste-novo-a.setnar.com" localhost:3001/conexao-green`:

- HTML servido contém `<main id="conteudo" data-vertical="igreen">` seguido,
  como primeiro filho, de
  `<style>[data-vertical="igreen"]{--palette-900:7 49 29;--palette-800:0 137 63;--palette-500:0 179 89;--palette-200:207 238 218;--palette-50:245 250 246;}</style>`
  — valores RGB conferem byte-a-byte com os deste ADR.
- `curl` na home (`/`) e em `/entrar`, mesmo Host: nenhum `data-vertical` no
  HTML, `:root{--palette-900:20 33 61;...}` do SETNAR intacto — o azul-marinho
  original, não tocado.
- `/conexao-club` retornou **HTTP 404**: nenhum representante de teste no
  banco atual tem essa Product Activation publicada — mesma limitação já
  registrada em ADR-056, ainda não resolvida. O mecanismo de CP9 em si (join,
  `data-vertical`, `BrandTokensStyle` escopado) é idêntico para os 7
  produtos; a verificação ponta a ponta específica de `/conexao-club` fica
  como próximo passo, exatamente como ADR-056 já previa.
- FOUC: o `<style>` escopado chega dentro do HTML da própria resposta SSR
  (não injetado por script depois do mount), posicionado antes de qualquer
  conteúdo de `<main>` que leia esses tokens — estruturalmente não há uma
  janela de "flash azul depois verde". Não foi possível gravar o paint num
  navegador real: a resolução de Representative depende do header `Host` de
  um subdomínio (`teste-novo-a.setnar.com`), que a instância de browser deste
  ambiente não consegue enviar sem alterar o `hosts` do sistema — mesma
  restrição prática que já levou ADR-056 a verificar só por `curl`.
- Contraste branco-sobre-`--palette-800` (4.52:1): confirmado pela mesma
  fórmula WCAG usada na Fase 2 (luminância relativa), não por uma ferramenta
  de scan automatizado — nenhum Lighthouse CLI/axe CLI está disponível neste
  ambiente para uma segunda verificação independente desse número.

**Limitação registrada, não resolvida neste passo.** `/conexao-club`
continua sem Product Activation publicada em nenhum representante de teste
(mesma lacuna de ADR-056); a margem de 4.52:1 no hover do CTA primário
passa AA mas por pouco, e fica registrada aqui para revisão futura, não
corrigida silenciosamente trocando a cor sem aprovação da iGreen.

**Custo de reversão.** Baixo — um parâmetro opcional em `BrandTokensStyle`
(sem uso, vira no-op), um arquivo de tokens novo, um join aditivo (reversível
removendo a cláusula), um campo a mais em `RepresentativeProduct`, e uma
condicional em `page.tsx`. Nenhuma migration nova.

**Não coberto por este passo, de propósito.** As outras 6 páginas iGreen
(ConexaoSolar, ConexaoLivre, ConexaoPlacas, GreenSeguros, Telecom, e o
próprio Conexão Club quando publicado) não tiveram template/design tocado —
herdam o mesmo mecanismo automaticamente assim que tiverem uma Product
Activation publicada, sem código extra. Publicação pública deste protótipo
fora do representante de teste já usado em CP3, e resolução do valor de
`--palette-700`, continuam fora do escopo até CP1 responder e a iGreen
revisar o mapeamento de cores deste ADR.

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
