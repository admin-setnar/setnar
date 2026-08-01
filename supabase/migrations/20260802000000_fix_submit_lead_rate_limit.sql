-- Fixes a vulnerability in submit_lead: the same class of bug already fixed
-- in 20260729000000_fix_login_attempts_cleanup.sql (a caller-supplied
-- parameter governing rate-limit enforcement inside a SECURITY DEFINER
-- function granted to anon) -- except worse here, because submit_lead also
-- performs the actual INSERT into `leads`, with no format/size validation of
-- its own at the SQL level (that only exists in `leadSubmissionSchema`, in
-- the application layer, which a direct RPC caller never goes through).
--
-- Reproduced against a disposable Supabase project before this migration was
-- written, the same way 20260729000000's header documents its own repro:
--
-- 1. Rate-limit bypass. Calling `submit_lead` directly via
--    @supabase/supabase-js with the anon key (no /api/leads, no Zod, no
--    honeypot), passing `p_window_seconds: 1, p_max_attempts_ip: 999999` on
--    every call, from one fixed `p_ip_hash`, against a real
--    (representative_id, product_id) pair with a published activation: 8
--    consecutive calls returned `data: true` (row inserted) 8/8 times -- the
--    documented 5-per-60-minutes limit (ADR-034, LEAD_MAX_SUBMISSIONS_PER_IP)
--    was never consulted, because the caller supplies the very numbers the
--    check compares against. The `greatest(p_window_seconds, 1)` /
--    `greatest(p_max_attempts_ip, 1)` flooring already present in this
--    function (added to mirror is_login_blocked) only rejects
--    zero/negative values -- it does nothing against a caller simply
--    supplying a very large threshold, which is all this attack needs.
-- 2. No SQL-level format/size validation. The same disposable project, one
--    direct `submit_lead` call, `p_telefone_e164` set to a 200+-char
--    non-phone string, `p_nome`/`p_cidade` set to 5000-char strings,
--    `p_email` set to a non-email string: `data: true`, row inserted as-is.
--    `leadSubmissionSchema` (`modules/leads/presentation/schemas/lead.schema.ts`)
--    would reject every one of these fields, but nothing enforces that
--    shape once a caller reaches the RPC directly with the anon key.
--
-- Fix, part 1 -- remove the parameters, don't floor them. Unlike
-- is_login_blocked (20260729000000), which kept its threshold parameters
-- because auth-rules.ts remains its intentional single source of truth for
-- a read-only check, submit_lead both decides AND writes: a caller-supplied
-- threshold here doesn't just mislead a read, it lets the caller opt itself
-- out of the write-side rate limit entirely. p_max_attempts_ip and
-- p_window_seconds are removed from the signature (not floored with
-- greatest()); the two literals below (5 attempts / 3600 seconds) are the
-- ONLY place this threshold now lives -- LEAD_MAX_SUBMISSIONS_PER_IP and
-- LEAD_RATE_LIMIT_WINDOW_MS (modules/leads/domain/lead-rules.ts) are removed
-- in the same change (see that file's diff) because nothing calls submit_lead
-- with them anymore and an unread constant next to this literal is exactly
-- the kind of silent-drift risk this fix exists to close. Keep the two
-- numbers in sync by hand if the business threshold ever changes; there is
-- no longer a shared symbol to do it for you.
--
-- Because the signature itself changes (11 params -> 9), `create or replace`
-- would coexist with the old function instead of replacing it -- Postgres
-- overload resolution is by parameter list, not by name -- so the old
-- signature is dropped explicitly first.
--
-- Fix, part 2 -- minimal format/size validation, as defense in depth, added
-- (not skipped) because a direct RPC caller bypasses leadSubmissionSchema
-- entirely, and this table backs a real business workflow (representatives
-- act on these rows) rather than being purely cosmetic. Deliberately NOT a
-- copy of leadSubmissionSchema's exact bounds (LEAD_NAME_MIN_LENGTH=2/
-- LEAD_NAME_MAX_LENGTH=80/LEAD_CITY_MAX_LENGTH=120) -- mirroring those exactly
-- would recreate the same two-source-of-truth drift risk this migration just
-- removed on the rate limit, and would make a future Zod-only bound change
-- silently break legitimate submissions here too. Instead:
--   - p_telefone_e164 must match E.164's own external, stable shape
--     (`^\+[1-9]\d{6,14}$` -- leading '+', non-zero first digit, 7-15 digits
--     total per the ITU-T E.164 spec) -- not this app's bound, the format's.
--   - p_email, if present, must contain '@' and a '.' after it, and be under
--     320 characters -- RFC 5321's own max mailbox length, not a
--     business-tunable number.
--   - p_nome must be non-empty after trimming; p_nome/p_cidade (when
--     present) are capped at 500 characters -- a generous ceiling that only
--     rejects pathological payloads, well above the Zod bounds, so a future
--     change to LEAD_NAME_MAX_LENGTH/LEAD_CITY_MAX_LENGTH in
--     lead-rules.ts never needs a matching migration here.
-- A payload failing this check is treated exactly like an invalid
-- (representative_id, product_id) pair: it still records an attempt (so
-- probing formats is not a free, unlimited oracle) and returns false,
-- indistinguishable from the other rejection reasons already documented in
-- this function (anti-enumeration, ADR-018/ADR-030).

drop function if exists public.submit_lead(
  uuid, uuid, text, text, text, text, text, text, text, int, int
);

create or replace function public.submit_lead(
  p_representative_id uuid,
  p_product_id        uuid,
  p_telefone_e164     text,
  p_nome              text,
  p_cidade            text,
  p_email             text,
  p_origem            text,
  p_referrer          text,
  p_ip_hash           text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempts int;
begin
  -- Rate limit check first, against fixed literals -- see file header for
  -- why these are no longer caller-supplied parameters. Already over the
  -- limit: return immediately, without touching lead_submission_attempts
  -- again for this call, same as before this fix.
  select count(*) into v_attempts
  from public.lead_submission_attempts
  where ip_hash = p_ip_hash
    and attempted_at > now() - interval '3600 seconds';

  if v_attempts >= 5 then
    return false;
  end if;

  -- Format/size validation, as defense in depth -- see file header for why
  -- these bounds are deliberately not a copy of leadSubmissionSchema's exact
  -- business bounds. A malformed payload still costs the caller one unit of
  -- rate-limit budget, same anti-enumeration reasoning as the invalid
  -- representative/product pair below.
  if p_telefone_e164 is null
    or p_telefone_e164 !~ '^\+[1-9]\d{6,14}$'
    or p_nome is null
    or length(trim(p_nome)) = 0
    or length(p_nome) > 500
    or (p_cidade is not null and length(p_cidade) > 500)
    or (p_email is not null and (length(p_email) > 320 or p_email !~ '^[^@]+@[^@]+\.[^@]+$'))
  then
    insert into public.lead_submission_attempts (ip_hash) values (p_ip_hash);
    return false;
  end if;

  -- Mirrors representatives_select_public / product_activations_select_published
  -- (20260731000000) instead of trusting the caller's IDs at face value:
  -- only ever insert a lead for a representative that is active AND has a
  -- published activation for that exact product.
  if not exists (
    select 1
    from public.product_activations pa
    join public.representatives r on r.id = pa.representative_id
    where pa.representative_id = p_representative_id
      and pa.product_id = p_product_id
      and pa.status = 'published'
      and r.status = 'active'
  ) then
    -- Still counts as an attempt: an invalid (representative_id, product_id)
    -- pair costs the caller one unit of their rate-limit budget too, so
    -- probing for valid pairs is bounded by the same limit as real
    -- submissions, not a free, unlimited oracle.
    insert into public.lead_submission_attempts (ip_hash) values (p_ip_hash);
    return false;
  end if;

  insert into public.leads (representative_id, product_id, telefone_e164, campos, origem, referrer)
  values (
    p_representative_id,
    p_product_id,
    p_telefone_e164,
    jsonb_strip_nulls(jsonb_build_object('nome', p_nome, 'cidade', p_cidade, 'email', p_email)),
    p_origem,
    p_referrer
  );

  insert into public.lead_submission_attempts (ip_hash) values (p_ip_hash);

  -- Same fixed-retention, identity-scoped cleanup as record_login_failure
  -- post-20260730000000_scope_login_attempts_cleanup_by_identity.sql -- not
  -- caller-controlled, never touches another identity's rows. Unrelated to
  -- the 3600-second rate-limit window above -- this is retention, not the
  -- business threshold, same distinction record_login_failure's own cleanup
  -- draws against is_login_blocked's window.
  delete from public.lead_submission_attempts
  where ip_hash = p_ip_hash
    and attempted_at <= now() - interval '1 day';

  return true;
end;
$$;

revoke execute on function public.submit_lead(
  uuid, uuid, text, text, text, text, text, text, text
) from public;
grant execute on function public.submit_lead(
  uuid, uuid, text, text, text, text, text, text, text
) to anon, authenticated;
