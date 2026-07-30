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
available first. `supabase/README.md` §3 now names CAPTCHA
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
