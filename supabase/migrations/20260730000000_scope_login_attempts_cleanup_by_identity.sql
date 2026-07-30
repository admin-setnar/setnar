-- Hygiene follow-up to 20260729000000_fix_login_attempts_cleanup.sql, NOT a
-- vulnerability fix. That migration already closed the cross-identity
-- data-destruction bug (record_login_failure's cleanup no longer depends on
-- any caller-supplied value at all -- it now uses a fixed 1-day retention).
-- This migration only narrows WHICH rows that fixed retention prunes on each
-- call: previously every call's cleanup scanned/deleted across the whole
-- table (`where attempted_at <= now() - interval '1 day'`, no other
-- predicate); now each call's cleanup only touches rows for the identity
-- that call is actually about. A write for identity A can no longer touch a
-- row belonging to identity B, even a stale one -- there is no security
-- boundary this crosses today (the 1-day retention already stopped any
-- caller from reaching outside their own identity's rows in a way that
-- matters), but scanning the whole table on every single failed login is
-- unnecessary I/O, and "a write never touches another identity's row" is a
-- cheaper invariant to reason about than "a write only touches other rows
-- within a safe retention window".
--
-- Supporting indexes already exist, unchanged since the original migration:
-- login_attempts_email_hash_idx (email_hash, attempted_at desc) and
-- login_attempts_ip_hash_idx (ip_hash, attempted_at desc) --
-- 20260728000000_create_profiles.sql:153-154. Both predicates below (an
-- equality on the hash column + a range on attempted_at) match the leading
-- columns of those indexes, so no new index is added here.

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

  -- p_window_seconds is intentionally not used -- see 20260729000000's header.
  -- Each delete is scoped to the identity just written, so this call can
  -- never prune a row belonging to a different email_hash/ip_hash.
  delete from public.login_attempts
  where email_hash = p_email_hash
    and attempted_at <= now() - interval '1 day';

  if p_ip_hash is not null then
    delete from public.login_attempts
    where ip_hash = p_ip_hash
      and attempted_at <= now() - interval '1 day';
  end if;
end;
$$;
