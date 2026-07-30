-- Fixes a vulnerability in record_login_failure's cleanup step, and hardens
-- is_login_blocked against the same class of caller-supplied-value abuse.
--
-- Reproduced against a disposable Supabase project before this migration
-- was written: record_login_failure's cleanup DELETE used
-- "now() - make_interval(secs => p_window_seconds)" as its cutoff, taken
-- directly from the caller. Calling the RPC with p_window_seconds = 0 (or
-- any negative value) collapses that cutoff to "now()" (or later), so the
-- DELETE removes every row in public.login_attempts regardless of
-- email_hash/ip_hash. Because the function is `grant execute to anon`, any
-- holder of the publishable key -- not just an attacker acting on their own
-- account -- can reset the rate limiter for every user with a single
-- unauthenticated call. Confirmed: an "attacker" identity with no relation
-- to a "victim" identity wiped the victim's already-recorded attempts by
-- calling record_login_failure with p_window_seconds = 0 (and again with a
-- negative value).
--
-- record_login_failure keeps its existing signature -- p_window_seconds is
-- still accepted, so no grant/revoke and no call site elsewhere needs to
-- change -- but the parameter is no longer used for cleanup. Retention is
-- now a fixed literal, independent of any caller input. This is
-- deliberately NOT the business rate-limit window from auth-rules.ts (see
-- ADR-012, README.md) -- it only bounds how long rows are kept before
-- pruning, set generously above the current 15-minute business window so a
-- future change to that window does not need a matching migration here.
--
-- is_login_blocked keeps all of its parameters too -- auth-rules.ts remains
-- the single source of truth for the business thresholds, per ADR-012 --
-- but now floors them at 1 with greatest() before use, so a direct caller
-- cannot pass a 0/negative window or threshold (which would otherwise let
-- the count query or the comparison degenerate -- e.g. a 0-second window
-- always reads "no attempts in range"). The floor is deliberately just 1,
-- not a larger minimum: an earlier draft floored p_window_seconds at 60 and
-- broke the legitimate 1-second window this file's own
-- "releases the block once the window expires" test uses, which is exactly
-- the kind of silent behaviour change on a legitimate value this migration
-- must not cause. This does not fully close the bypass ADR-012 already
-- documents (a direct caller can still supply a large, still-valid
-- threshold to read "not blocked" for itself); it only removes the
-- destructive/degenerate extremes.

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

  -- p_window_seconds is intentionally not used below -- see file header.
  delete from public.login_attempts
  where attempted_at <= now() - interval '1 day';
end;
$$;

create or replace function public.is_login_blocked(
  p_email_hash text,
  p_ip_hash text,
  p_max_attempts_email int,
  p_max_attempts_ip int,
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
        and attempted_at > now() - make_interval(secs => greatest(p_window_seconds, 1))
    ) >= greatest(p_max_attempts_email, 1)
    or (
      p_ip_hash is not null and (
        select count(*) from public.login_attempts
        where ip_hash = p_ip_hash
          and attempted_at > now() - make_interval(secs => greatest(p_window_seconds, 1))
      ) >= greatest(p_max_attempts_ip, 1)
    );
$$;
