-- Sprint C: Representative domain (Commercial Presence + Catalog + Company
-- Governance + Billing + Sales Operations, per docs/DOMAIN_MODEL.md §7).
-- Creates: companies, representatives, products, product_activations,
-- subscriptions, leads. Schema only — no seed data, no app code, no
-- Commercial Page/QR Code tables yet (those are a later Sprint C step per
-- ARCHITECTURE.md's "Multi-Tenant Strategy" section).
--
-- Reuses public.set_updated_at() from 20260728000000_create_profiles.sql for
-- every updated_at column below instead of redefining it.
--
-- ============================================================================
-- RLS design — read this before touching any policy below
-- ============================================================================
--
-- companies is NOT in the RLS instructions this migration was written
-- against (only representatives/products/product_activations/subscriptions/
-- leads were specified), but RLS is enabled on it anyway and is NOT
-- optional: a public-schema table exposed through PostgREST with RLS left
-- disabled is readable AND writable by anon with no restriction whatsoever
-- — strictly worse than any policy discussed below. Every table this
-- migration creates gets `enable row level security`, no exceptions.
-- companies gets a permissive anon/authenticated SELECT (name + slug are
-- the same non-sensitive branding text a Commercial Page will show next to
-- a Representative's name — "his iGreen affiliation" per DOMAIN_MODEL.md
-- §"Commercial Page" — there's nothing here scanning it exposes that isn't
-- already meant to be public), and no write policies (nothing writes to it
-- yet; seeding happens through the Supabase SQL editor, which connects as
-- the table owner and bypasses RLS entirely, same as every other table
-- below with no INSERT policy).
--
-- representatives / products / product_activations are the tables the
-- Next.js app will query with the anon/publishable key, with no session,
-- to render a public Commercial Page — so this is the real decision point.
-- Two shapes were on the table:
--   (a) full-table SELECT (`using (true)`) for anon — simplest, matches
--       what a "public page" naively suggests.
--   (b) SELECT scoped to rows that already satisfy a public-facing
--       condition (e.g. `status = 'published'`).
-- (b) was chosen, not (a), and not silently — here's the trade-off. Full
-- SELECT on `representatives` means a single unauthenticated
-- `GET /rest/v1/representatives?select=*` (the anon/publishable key is
-- public by design, same caveat already documented for `login_attempts` in
-- 20260728000000) dumps phone, city, license_id and status for every
-- representative in the table in one call, regardless of whether that
-- representative has ever gone live — a scrape of every rep's WhatsApp
-- number at once, the exact risk flagged when this migration was
-- commissioned. That risk does not buy anything: nothing in the product
-- requires enumerating representatives who have no live page, only
-- rendering the page of a representative someone is already visiting by
-- slug/subdomain (ADR-026, README.md). So `representatives_select_public`
-- below is scoped to rows that are both `status = 'active'` AND have at
-- least one `product_activations` row with `status = 'published'` — i.e.
-- exactly the representatives who actually have something public to show,
-- mirroring DOMAIN_MODEL.md's own rule that a Commercial Page is public
-- only once Published, which in this schema (no commercial_pages table
-- yet) is expressed through product_activations.status. A suspended
-- representative (status <> 'active') stops being selectable immediately,
-- even if an old activation row is still marked 'published' and nobody
-- has gotten around to unpublishing it — suspension should win without
-- depending on that cleanup happening first.
--
-- product_activations follows the same reasoning one level down:
-- `product_activations_select_published` only exposes rows with
-- `status = 'published'`, never `draft`/`unpublished` — a representative's
-- not-yet-launched product lineup is exactly the kind of thing that full
-- SELECT would leak (a competitor watching a rep's activations flip from
-- draft to published in real time) for no product benefit, since nothing
-- public should ever reference a draft activation anyway.
--
-- products has no such gate: `products_select_public` is `using (true)`.
-- It's the fixed 7-slug catalog (conexao-green, conexao-club, ...) — plain
-- names/slugs with no per-representative or per-visitor sensitivity, and
-- the app needs to resolve every slug regardless of which representatives
-- have activated it. There's no "draft product" concept in this table (no
-- status column was asked for here — Product's Draft/Active/Retired
-- lifecycle from DOMAIN_MODEL.md §8.4 is not modeled by this migration and
-- is deferred to whichever future migration actually introduces it).
--
-- subscriptions gets RLS enabled and ZERO policies — no SELECT, no INSERT,
-- no UPDATE, for anon or authenticated — exactly the `login_attempts`
-- pattern from 20260728000000: a table reachable only through a
-- SECURITY DEFINER function, not directly. That function does not exist
-- yet (subscription-status checking is explicitly out of scope for this
-- migration — "schema only"); until it's added, subscription status is
-- readable by nobody through the API, which is the safe default to fail
-- into, not a gap. This is deliberately how the Next.js app is meant to
-- check "is this representative's subscription active enough for their
-- page to resolve" without a service role key (this project has none —
-- see 20260728000000's header) and without exposing billing status to the
-- client: a future migration adds an `is_subscription_active(uuid)`-style
-- function, `grant execute`-only, the same shape as `is_login_blocked()`.
--
-- leads gets RLS enabled with a SELECT policy scoped to the owning
-- representative (via `profile_id = auth.uid()`, the same
-- `profiles_select_own` shape from 20260728000000) and NO insert policy.
-- Lead capture is explicitly a follow-up piece of work ("a captura vai
-- passar por uma API route com rate limiting, próximo prompt") — direct
-- browser INSERT against this table, by anon or by an authenticated
-- representative, is not how it's meant to work, so no policy grants it,
-- matching the "table has no write path except a function we haven't
-- written yet" shape used for subscriptions and (originally) for
-- login_attempts above.
-- ============================================================================

-- ============================================================================
-- companies
-- ============================================================================

create table public.companies (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.companies enable row level security;

create policy "companies_select_public"
  on public.companies for select
  using (true);

create trigger companies_set_updated_at
  before update on public.companies
  for each row
  execute function public.set_updated_at();

-- ============================================================================
-- representatives
--
-- `slug` is the subdomain label a Commercial Page resolves by
-- (`<slug>.setnar.com`, per ADR-026 in the root README.md) — never a path
-- segment. The check constraint below restricts it to lowercase
-- letters/digits/hyphens, no leading/trailing/consecutive hyphen, and no
-- dot, so it can never collide with how a `Host` header gets split into
-- subdomain labels later. It does NOT reserve product-meaningful words
-- (`www`, `api`, `app`, `admin`, ...) — that's a self-service-registration
-- concern (validate against a reserved-word list at the application layer
-- when that flow is built), not a shape concern this constraint can fix.
--
-- `status` is deliberately just `active`/`suspended` for now — the minimum
-- Sprint C needs to express "this representative's page can go public"
-- versus "it can't" (see representatives_select_public below, created
-- after product_activations exists). Nothing in DOMAIN_MODEL.md's
-- Representative lifecycle (Invited/Registered → Active → Suspended →
-- Deactivated) is modeled beyond these two values yet — a distinct
-- Deactivated/Invited state, if it needs its own row-level behaviour
-- rather than just being handled by `suspended`, is a future migration's
-- decision, not guessed at here.
--
-- The `representatives_select_public` policy for this table is NOT created
-- here — its USING clause needs to reference product_activations, which
-- does not exist yet at this point in the file. CREATE POLICY resolves the
-- relations in its USING clause immediately, at creation time, so it is
-- created further down, right after the product_activations table exists.
-- ============================================================================

create table public.representatives (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null unique references public.profiles (id),
  company_id   uuid not null references public.companies (id),
  slug         text not null unique
               constraint representatives_slug_format
               check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  -- Denormalized from profiles.full_name at write time, not read via join.
  -- profiles' only SELECT policy (profiles_select_own, 20260728000000) is
  -- `auth.uid() = id` — it never allowed public reads, and widening it would
  -- expose the whole profiles row (terms_accepted_at, terms_version, ...),
  -- not just the name. Every other public Representative field
  -- (phone/city/avatar_url/license_id) already lives directly on this table;
  -- full_name being fetched via join was the one exception, and it made the
  -- public Commercial Page path unreadable by the anon key, not just
  -- inconsistent. display_name closes that gap the same way those columns
  -- already do.
  display_name text not null,
  license_id   text not null,
  phone        text,
  city         text,
  avatar_url   text,
  status       text not null default 'active'
               check (status in ('active', 'suspended')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index representatives_company_id_idx on public.representatives (company_id);

alter table public.representatives enable row level security;
-- representatives_select_public is created after product_activations below.

create trigger representatives_set_updated_at
  before update on public.representatives
  for each row
  execute function public.set_updated_at();

-- ============================================================================
-- products
--
-- Company-scoped catalog. The 7 Stage 1 slugs (conexao-green, conexao-club,
-- conexao-livre, conexao-placas, conexao-solar, green-seguros, telecom) are
-- not seeded by this migration — schema only, per scope.
-- ============================================================================

create table public.products (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  slug       text not null,
  name       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, slug)
);

alter table public.products enable row level security;

create policy "products_select_public"
  on public.products for select
  using (true);

create trigger products_set_updated_at
  before update on public.products
  for each row
  execute function public.set_updated_at();

-- ============================================================================
-- product_activations
-- ============================================================================

create table public.product_activations (
  id                uuid primary key default gen_random_uuid(),
  representative_id uuid not null references public.representatives (id),
  product_id        uuid not null references public.products (id),
  status            text not null default 'draft'
                     check (status in ('draft', 'published', 'unpublished')),
  activated_at      timestamptz not null default now(),
  published_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (representative_id, product_id)
);

alter table public.product_activations enable row level security;

create policy "product_activations_select_published"
  on public.product_activations for select
  using (status = 'published');

create trigger product_activations_set_updated_at
  before update on public.product_activations
  for each row
  execute function public.set_updated_at();

-- representatives_select_public — deferred from the representatives block
-- above because its USING clause references product_activations, which
-- did not exist yet at that point in the file; see the comment on
-- representatives.status above for the full explanation.
create policy "representatives_select_public"
  on public.representatives for select
  using (
    status = 'active'
    and exists (
      select 1
      from public.product_activations pa
      where pa.representative_id = representatives.id
        and pa.status = 'published'
    )
  );

-- ============================================================================
-- subscriptions — zero policies, see the RLS design note at the top of
-- this file.
-- ============================================================================

create table public.subscriptions (
  id                        uuid primary key default gen_random_uuid(),
  representative_id         uuid not null unique references public.representatives (id),
  status                    text not null default 'active'
                             check (status in ('active', 'past_due', 'suspended', 'canceled')),
  provider                  text not null default 'manual',
  external_subscription_id  text,
  current_period_end        timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

alter table public.subscriptions enable row level security;
-- Deliberately zero policies — see the RLS design note at the top of this file.

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row
  execute function public.set_updated_at();

-- ============================================================================
-- leads — SELECT scoped to the owning representative, no INSERT policy.
-- See the RLS design note at the top of this file.
-- ============================================================================

create table public.leads (
  id                 uuid primary key default gen_random_uuid(),
  representative_id  uuid not null references public.representatives (id),
  product_id         uuid references public.products (id),
  telefone_e164      text not null,
  campos             jsonb not null default '{}',
  origem             text,
  referrer           text,
  created_at         timestamptz not null default now()
);

create index leads_representative_id_idx on public.leads (representative_id);

alter table public.leads enable row level security;

create policy "leads_select_own"
  on public.leads for select
  using (
    exists (
      select 1
      from public.representatives r
      where r.id = leads.representative_id
        and r.profile_id = auth.uid()
    )
  );
-- No insert/update/delete policy — see the RLS design note at the top of
-- this file.
