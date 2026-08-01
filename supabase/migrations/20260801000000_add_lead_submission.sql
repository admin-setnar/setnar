-- Lead capture: `submit_lead`, the SECURITY DEFINER function
-- `20260731000000_create_representative_domain.sql`'s own RLS design note
-- already promised ("Lead capture is explicitly a follow-up piece of work
-- ... a captura vai passar por uma API route com rate limiting") — this is
-- that follow-up, not a new idea, and it does not touch that migration
-- (already applied — README.md's migration rule).
--
-- Same three-part pattern as login rate limiting
-- (20260728000000_create_profiles.sql's "Login rate limiting" section,
-- ADR-012 in README.md): a table reachable only through a SECURITY DEFINER
-- function (RLS enabled, zero policies), keyed by a salted hash computed
-- outside Postgres, never a plaintext identifier. `LOGIN_ATTEMPT_SALT` is
-- reused as-is for the hash below — not a second salt/env var — see the
-- ADR in README.md for why introducing a second one was rejected.
--
-- Two deliberate differences from the login pattern:
--
-- 1. One function, not three. Login separates `is_login_blocked` (read)
--    from `record_login_failure` (write) because only FAILED attempts count
--    against the limit — a successful sign-in must not be throttled. A lead
--    submission has no such distinction: every submission attempt (accepted
--    or rejected as invalid) is the event being rate-limited, so checking
--    and recording happen atomically inside `submit_lead`, closing the
--    check-then-act race the login pattern's two-call split leaves open (an
--    accepted, already-documented gap there — this does not need to fix it
--    for login too, a single SQL function just doesn't have that window).
-- 2. IP only, no second identity. Login has both an e-mail and an IP
--    threshold because credential stuffing targets one account from many
--    IPs. A lead has no equivalent second axis to key a limit by before
--    submission — the phone number is the payload being submitted, not an
--    identity (a real visitor can legitimately submit a lead with a family
--    member's phone number from their own device) — so only IP is rate
--    limited here.

create table public.lead_submission_attempts (
  id           bigint generated always as identity primary key,
  ip_hash      text not null,
  attempted_at timestamptz not null default now()
);

create index lead_submission_attempts_ip_hash_idx
  on public.lead_submission_attempts (ip_hash, attempted_at desc);

alter table public.lead_submission_attempts enable row level security;
-- Deliberately zero policies — same pattern as login_attempts.

-- Returns true when the lead was actually inserted, false when the
-- submission was rejected (rate limited, or no published activation for
-- that representative/product pair) — the two rejection reasons are not
-- distinguished in the return value on purpose, same anti-enumeration
-- principle already applied to this app's other public surfaces
-- (representatives_select_public/product_activations_select_published in
-- 20260731000000, ADR-018, ADR-030): a caller should not be able to tell
-- "you are rate limited" apart from "this representative/product pair is
-- not valid" from the response alone.
create or replace function public.submit_lead(
  p_representative_id uuid,
  p_product_id        uuid,
  p_telefone_e164     text,
  p_nome              text,
  p_cidade            text,
  p_email             text,
  p_origem            text,
  p_referrer          text,
  p_ip_hash           text,
  p_max_attempts_ip   int,
  p_window_seconds    int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempts int;
begin
  -- Rate limit check first. Floored at 1 the same way is_login_blocked is
  -- (20260729000000_fix_login_attempts_cleanup.sql), so a caller cannot
  -- pass a 0/negative window or threshold to defeat the check. Already
  -- over the limit: return immediately, without touching
  -- lead_submission_attempts again for this call — mirrors is_login_blocked
  -- never itself recording an attempt.
  select count(*) into v_attempts
  from public.lead_submission_attempts
  where ip_hash = p_ip_hash
    and attempted_at > now() - make_interval(secs => greatest(p_window_seconds, 1));

  if v_attempts >= greatest(p_max_attempts_ip, 1) then
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
  -- post-20260730000000_scope_login_attempts_cleanup_by_identity.sql — not
  -- caller-controlled, never touches another identity's rows.
  delete from public.lead_submission_attempts
  where ip_hash = p_ip_hash
    and attempted_at <= now() - interval '1 day';

  return true;
end;
$$;

revoke execute on function public.submit_lead(
  uuid, uuid, text, text, text, text, text, text, text, int, int
) from public;
grant execute on function public.submit_lead(
  uuid, uuid, text, text, text, text, text, text, text, int, int
) to anon, authenticated;
