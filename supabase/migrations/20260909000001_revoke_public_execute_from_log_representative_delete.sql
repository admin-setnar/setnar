-- Follow-up to 20260909000000, found by testing the migration live against
-- the disposable `setnar-db-test` project before shipping it (same pattern
-- as 20260907000001 fixing 20260907000000's FK bug — a new migration, never
-- editing the one already applied): `get_advisors` flagged
-- `public.log_representative_delete()` as callable by `anon`/`authenticated`
-- via `/rest/v1/rpc/log_representative_delete` — every function in the
-- `public` schema is granted EXECUTE to PUBLIC by Postgres's default unless
-- explicitly revoked, and `20260909000000` never revoked it (every other
-- SECURITY DEFINER function in this project does, e.g. `register_representative`,
-- `handle_new_user`).
--
-- In practice this specific function cannot actually be invoked that way —
-- confirmed live: `select public.log_representative_delete();` fails with
-- `0A000: trigger functions can only be called as triggers`, a hard Postgres
-- restriction on any function declared `returns trigger`, not something
-- this migration relies on GRANT/REVOKE to enforce. The revoke below is
-- defense-in-depth and consistency with every other privileged function in
-- this codebase, not a fix for an exploitable gap.

revoke execute on function public.log_representative_delete() from public;
revoke execute on function public.log_representative_delete() from anon;
revoke execute on function public.log_representative_delete() from authenticated;
