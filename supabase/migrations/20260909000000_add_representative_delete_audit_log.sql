-- Hardening B (docs/plans/AUDIT_PROFILE_REPRESENTATIVE_INTEGRITY_2026-09-01.md
-- §14/§16-§21): a physical DELETE of a `representatives` row today leaves no
-- trace anywhere in the application-visible schema — the audit's own
-- systemic check confirmed zero orphaned rows in every child table for the
-- population that vanished, which is exactly what a correct, silent,
-- out-of-band DELETE looks like. This migration does not make that DELETE
-- easier or more likely (no FK is loosened — see the bottom of this file),
-- it only guarantees that if one ever succeeds, from ANY caller (a
-- privileged `service_role` script, or a direct SQL Editor/Table Editor
-- session — both are, today, the only ways a `representatives` row can be
-- removed at all, since no RLS policy grants DELETE to `anon`/`authenticated`
-- and no application code ever issues one), a minimal forensic record
-- survives independently of the row itself.
--
-- Deliberately NOT event sourcing, NOT a general audit framework, NOT CDC —
-- one table, one trigger, one event: `DELETE FROM representatives`.
--
-- ============================================================================
-- PII minimization — what is, and is NOT, persisted here, and why
-- ============================================================================
--
-- `execute-lgpd-request.ts`'s `eliminacao` path already establishes, for
-- this exact table, which of its columns are personal-identification data:
-- `display_name`, `phone`, `city`, `avatar_url` (redacted to a sentinel/NULL
-- on LGPD erasure) and `authorization_id` (the iGreen licensee id, tied to a
-- real professional identity). None of those five columns are copied into
-- this audit log. What IS kept is the minimum needed to (a) identify which
-- entity was removed, (b) relate it back to the still-existing `profile`,
-- and (c) investigate the technical circumstances of the removal:
-- `representative_id`/`profile_id` (opaque UUIDs, not personal data by
-- themselves), `company_id` (a fixed catalog id, 'igreen' today),
-- `slug` (already PUBLIC by design — it is the subdomain of the
-- Commercial Page, exposed to any anonymous visitor by
-- `representatives_select_public`, `20260731000000:257-267` — logging it
-- here adds no new exposure), `status` and `created_at` (lifecycle facts,
-- not personal data), and technical actor/transaction context. This keeps
-- the log useful for exactly the questions
-- `AUDIT_PROFILE_REPRESENTATIVE_INTEGRITY_2026-09-01.md` §16 asks it to
-- answer, without becoming a second, unredacted copy of the PII the LGPD
-- runbook already has a dedicated, audited process for erasing.
--
-- ============================================================================
-- Actor/transaction context — three signals, not one, because none of them
-- alone is reliable for every caller
-- ============================================================================
--
-- `deleted_by_current_user`: `current_user` evaluated INSIDE this trigger.
-- Because the trigger function is `SECURITY DEFINER` (see below for why),
-- `current_user` inside it is always the FUNCTION OWNER, never the role
-- that actually ran the DELETE — recorded anyway, labeled honestly here,
-- because a change of function owner would itself be a signal worth having.
--
-- `deleted_by_session_user`: `session_user`, unaffected by `SECURITY
-- DEFINER` — this is the role that actually opened the database session
-- and issued the DELETE. For a `service_role`-keyed script/PostgREST call
-- this is `authenticator` (Supabase's PostgREST connection role, which
-- switches `current_user`/effective role per request via `SET LOCAL ROLE`
-- without changing `session_user`); for a direct SQL Editor/psql session
-- this is `postgres` (or whichever login role connected). This is the most
-- reliable single "who connected" signal available.
--
-- `deleted_by_jwt_role`/`deleted_by_jwt_sub`: `auth.jwt() ->> 'role'`/`->>
-- 'sub'`, Supabase's standard helper (confirmed present in this project,
-- returns NULL outside of a PostgREST request context — verified directly
-- against the database rather than assumed). This is the only signal that
-- can distinguish `service_role` from `anon`/`authenticated` when the
-- DELETE came through PostgREST, and captures the calling user's `sub`
-- claim on the rare chance a non-`service_role` JWT ever reaches this far
-- (it cannot today — `representatives` has no DELETE policy for anyone but
-- `service_role`/superuser, both of which bypass RLS and therefore JWT
-- claims entirely; this column will read NULL for a SQL Editor session, and
-- typically 'service_role'/NULL sub for a script, and is kept purely as a
-- forward-looking forensic signal, not because a gap in policy already
-- lets it happen).
--
-- `pg_txid`: `txid_current()` — lets this row be correlated against
-- Postgres server-side logs (if/when query logging is enabled for
-- production; `AUDIT_PROFILE_REPRESENTATIVE_INTEGRITY_2026-09-01.md` §16
-- flags that this investigation had no access to confirm whether it is)
-- without this migration taking on log retention/configuration, which is
-- infrastructure, not schema.
--
-- ============================================================================
-- Trigger table
-- ============================================================================

create table public.representative_delete_audit_log (
  id                         bigint generated always as identity primary key,
  representative_id          uuid not null,
  profile_id                 uuid not null,
  company_id                 uuid,
  slug                       text,
  status                     text,
  representative_created_at  timestamptz,
  deleted_at                 timestamptz not null default now(),
  deleted_by_current_user    text not null,
  deleted_by_session_user    text not null,
  deleted_by_jwt_role        text,
  deleted_by_jwt_sub         uuid,
  pg_txid                    bigint not null
);

create index representative_delete_audit_log_representative_id_idx
  on public.representative_delete_audit_log (representative_id);

alter table public.representative_delete_audit_log enable row level security;
-- Deliberately zero policies — same pattern as billing_reconciliation_log
-- (20260830000000) and lgpd_request_log (20260907000000): with RLS enabled
-- and no policy for any command, Postgres denies SELECT/INSERT/UPDATE/DELETE
-- outright to every role subject to RLS (anon, authenticated — neither is
-- granted anything on this table either, same as those two tables). Only
-- service_role (BYPASSRLS) and a superuser/table-owner SQL Editor session
-- can read or write it — which is also, today, the entire set of roles
-- capable of deleting a representatives row in the first place.

comment on table public.representative_delete_audit_log is
  'Forensic trail for DELETE FROM representatives (SET-115/hardening after AUDIT_PROFILE_REPRESENTATIVE_INTEGRITY_2026-09-01.md) — one row per representative actually removed, written by an AFTER DELETE trigger so it fires for every caller (service_role script or direct SQL Editor/Table Editor), not just application code. Never grant anon/authenticated any access to this table.';

-- ============================================================================
-- Trigger function
-- ============================================================================
--
-- SECURITY DEFINER: the two real-world callers capable of deleting a
-- representatives row (service_role, and a superuser SQL Editor session)
-- already have implicit access to insert anywhere in the public schema
-- (service_role has blanket public-schema privileges by Supabase default —
-- confirmed by every other zero-grant audit table in this project already
-- being writable by the scripts that use it, e.g. lgpd_request_log/
-- billing_reconciliation_log, neither of which has an explicit `grant
-- insert ... to service_role`; a superuser bypasses grant checks entirely).
-- SECURITY DEFINER is still used here, matching every other privileged
-- function in this project (handle_new_user, register_representative, ...),
-- as defense-in-depth: if a future migration ever grants DELETE on
-- representatives to some other role without separately granting INSERT on
-- this audit table, the trigger keeps working regardless. `set search_path
-- = public` for the same injection-hardening reason every other
-- SECURITY DEFINER function in this project already sets it.
--
-- AFTER DELETE FOR EACH ROW, not BEFORE: semantically this logs a deletion
-- that happened, not one about to be vetoed (a BEFORE trigger that could
-- return NULL to cancel is not this trigger's job — it always returns OLD
-- unchanged). Both timings share the same safety property against a
-- FK-rejected delete (see below) because that property comes from
-- Postgres's statement-level atomicity, not from trigger timing: AFTER is
-- chosen for the more natural semantics, not because BEFORE would be
-- unsafe.
--
-- Why an FK-rejected DELETE never leaves a row here (verified empirically,
-- not just reasoned about, against the disposable `setnar-db-test` project
-- during development of this migration): `representatives`'s six child
-- tables all have `NO ACTION` FKs (never loosened by this migration — see
-- the closing comment below). Postgres implements `NO ACTION` as an
-- internal, NOT DEFERRABLE INITIALLY IMMEDIATE constraint trigger that is
-- checked at the end of the SQL statement, in the same transaction as this
-- trigger's own INSERT. A single `DELETE FROM representatives WHERE id =
-- ...;` (never wrapped by an explicit multi-statement transaction anywhere
-- in this codebase's write paths) is one implicit transaction: if the
-- end-of-statement FK check raises `foreign_key_violation`, the ENTIRE
-- statement — the DELETE and this trigger's INSERT alike — is rolled back
-- together. No explicit SAVEPOINT/autonomous transaction is used inside
-- this trigger (and none should ever be added), which is what keeps that
-- guarantee true.

create or replace function public.log_representative_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jwt jsonb;
begin
  v_jwt := auth.jwt();

  insert into public.representative_delete_audit_log (
    representative_id,
    profile_id,
    company_id,
    slug,
    status,
    representative_created_at,
    deleted_by_current_user,
    deleted_by_session_user,
    deleted_by_jwt_role,
    deleted_by_jwt_sub,
    pg_txid
  )
  values (
    old.id,
    old.profile_id,
    old.company_id,
    old.slug,
    old.status,
    old.created_at,
    current_user,
    session_user,
    v_jwt ->> 'role',
    nullif(v_jwt ->> 'sub', '')::uuid,
    txid_current()
  );

  return old;
end;
$$;

create trigger representatives_log_delete
  after delete on public.representatives
  for each row
  execute function public.log_representative_delete();

-- ============================================================================
-- Explicitly NOT touched by this migration
-- ============================================================================
--
-- No FK on representatives' six child tables (subscriptions,
-- product_activations, analytics_events, leads, feedback_responses,
-- billing_reconciliation_log) is changed from NO ACTION to CASCADE or
-- anything else — those FKs are the protection that makes an accidental
-- DELETE fail loudly today, and this migration's entire job is to record
-- when a DELETE succeeds, never to help one succeed. lgpd_request_log's FK
-- (already ON DELETE SET NULL since 20260907000001, for an unrelated
-- reason — its own audit trail must not block the deletion it documents)
-- is likewise untouched.
