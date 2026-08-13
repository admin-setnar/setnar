-- SET-55: rehearsal object for the forward-only migration rollback drill
-- documented in docs/runbooks/BACKUP_RECOVERY.md. Deliberately trivial and
-- isolated — no application code references this table, it exists only to
-- prove the "a rollback is always a new forward migration, never an edit or
-- a DROP outside a migration" policy (supabase/README.md, "Rollback de
-- migration") for real, against the real linked project, timed. The very
-- next migration removes it.
create table public._set55_rollback_drill_marker (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table public._set55_rollback_drill_marker enable row level security;
