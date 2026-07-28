-- Sprint A: Supabase Auth adoption.
-- Creates: profiles, terms-of-service versioning, automatic profile
-- provisioning on sign-up, and Postgres-backed login rate limiting.
--
-- No service role key is used anywhere in this project. Every write that
-- needs to happen outside a user's own RLS-governed row (provisioning a new
-- profile, recording a login attempt before the user is authenticated) goes
-- through a narrowly-scoped SECURITY DEFINER function instead — see the
-- comments on each one below.

-- ============================================================================
-- profiles
-- ============================================================================

create table public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  full_name         text not null,
  tenant_id         text not null default 'setnar',
  terms_accepted_at timestamptz not null,
  terms_version     text not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- No insert/delete policy: rows are created only by handle_new_user() below
-- (SECURITY DEFINER, bypasses RLS) and deleted only by the auth.users cascade.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

-- ============================================================================
-- Terms of service version.
--
-- Single source of truth for which version of /termos and /privacidade is
-- currently in force. Deliberately NOT duplicated as a constant in
-- application code: the sign-up trigger and the legal pages both call this
-- function, so a consent record and the page a user actually saw can never
-- drift apart because of a value edited in only one of two places.
--
-- To publish a new version of the terms: update the literal below in a new
-- migration, and update the copy on /termos and /privacidade in the same PR.
-- ============================================================================

create or replace function public.current_terms_version()
returns text
language sql
immutable
as $$
  select '2026-07-28'::text;
$$;

revoke execute on function public.current_terms_version() from public;
grant execute on function public.current_terms_version() to anon, authenticated;

-- ============================================================================
-- Profile provisioning.
--
-- Runs inside the same transaction as the auth.users insert: if this fails,
-- Postgres rolls back the whole insert, so a broken profile can never leave
-- an orphaned auth user behind. This is why sign-up is a single atomic
-- operation without a service role key, instead of two sequential calls from
-- the application.
--
-- tenant_id, terms_accepted_at and terms_version are decided here, by the
-- database, and never read from the client-supplied signUp metadata — a
-- request crafted directly against the Supabase API (bypassing the app's UI
-- entirely) cannot forge which tenant it joined or when/which terms it
-- accepted. Only full_name, a non-sensitive display value, comes from
-- raw_user_meta_data.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, tenant_id, terms_accepted_at, terms_version)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'setnar',
    now(),
    public.current_terms_version()
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ============================================================================
-- Login rate limiting.
--
-- 5 failed attempts per 15 minutes (the actual limit/window are passed in as
-- parameters from LOGIN_MAX_FAILED_ATTEMPTS / LOGIN_RATE_LIMIT_WINDOW_MS in
-- auth-rules.ts on every call, so the business rule has one source of truth
-- in the domain layer, not a literal duplicated here), keyed independently by
-- e-mail and by IP so both a targeted attack on one account and a scan across
-- many accounts from one origin get caught.
--
-- email/ip arrive already hashed (sha256 + server-only salt, computed in
-- login-rate-limiter.ts) — this table never stores either in plain text, so
-- it never becomes an unintended new store of personal data.
--
-- No RLS policies are defined on purpose: the table is reachable only through
-- the SECURITY DEFINER functions below, the same pattern as
-- handle_new_user() above. That is what makes this work without a service
-- role key — an anonymous caller can invoke the function, never the table.
-- ============================================================================

create table public.login_attempts (
  id           bigint generated always as identity primary key,
  email_hash   text not null,
  ip_hash      text,
  attempted_at timestamptz not null default now()
);

create index login_attempts_email_hash_idx on public.login_attempts (email_hash, attempted_at desc);
create index login_attempts_ip_hash_idx on public.login_attempts (ip_hash, attempted_at desc);

alter table public.login_attempts enable row level security;
-- Deliberately zero policies — see comment above.

create or replace function public.is_login_blocked(
  p_email_hash text,
  p_ip_hash text,
  p_max_attempts int,
  p_window_seconds int
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select
    (
      select count(*) from public.login_attempts
      where email_hash = p_email_hash
        and attempted_at > now() - make_interval(secs => p_window_seconds)
    ) >= p_max_attempts
    or (
      p_ip_hash is not null and (
        select count(*) from public.login_attempts
        where ip_hash = p_ip_hash
          and attempted_at > now() - make_interval(secs => p_window_seconds)
      ) >= p_max_attempts
    );
$$;

create or replace function public.record_login_failure(
  p_email_hash text,
  p_ip_hash text,
  p_window_seconds int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.login_attempts (email_hash, ip_hash)
  values (p_email_hash, p_ip_hash);

  -- Opportunistic cleanup: this is the only write path into the table, so it
  -- is also the only point that needs to prune rows outside the window.
  -- No cron job, no service role, no unbounded growth.
  delete from public.login_attempts
  where attempted_at <= now() - make_interval(secs => p_window_seconds);
end;
$$;

create or replace function public.clear_login_attempts(p_email_hash text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.login_attempts where email_hash = p_email_hash;
$$;

revoke execute on function public.is_login_blocked(text, text, int, int) from public;
revoke execute on function public.record_login_failure(text, text, int) from public;
revoke execute on function public.clear_login_attempts(text) from public;

grant execute on function public.is_login_blocked(text, text, int, int) to anon, authenticated;
grant execute on function public.record_login_failure(text, text, int) to anon, authenticated;
grant execute on function public.clear_login_attempts(text) to anon, authenticated;
