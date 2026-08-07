-- SET-20: make the lead bucket identity a trusted server-side concern.
--
-- The previous signature accepted only fixed rate-limit thresholds, but the
-- function itself was still executable by browser roles and accepted
-- p_ip_hash. A direct caller could therefore choose a fresh hash per request
-- and obtain a fresh bucket. The application route already derives the raw IP
-- from Vercel's trusted edge and hashes it server-side; this migration makes
-- that route the only usable boundary by granting EXECUTE solely to
-- service_role.
--
-- The previous count-then-insert sequence also ran in one transaction but was
-- not concurrency-safe: concurrent transactions could all observe the same
-- count before any inserted its attempt. A transaction-scoped advisory lock
-- derived from p_ip_hash serializes only callers competing for the same
-- bucket. Hash collisions can cause extra serialization, never extra accepts.
-- Existing migrations remain untouched and no business row is rewritten.

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
  -- A trusted backend must always supply a non-empty bucket identity. Fail
  -- closed before acquiring a shared lock or persisting any row.
  if p_ip_hash is null or length(trim(p_ip_hash)) = 0 then
    return false;
  end if;

  -- Serialize the complete check-and-record decision for this bucket. The
  -- lock is released automatically when the surrounding RPC transaction ends.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_ip_hash, 0));

  select count(*) into v_attempts
  from public.lead_submission_attempts
  where ip_hash = p_ip_hash
    and attempted_at > now() - interval '3600 seconds';

  if v_attempts >= 5 then
    return false;
  end if;

  -- Defense-in-depth validation remains intentionally broader than the form's
  -- business bounds. Direct service callers still cannot persist pathological
  -- values if application validation regresses.
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

  -- Keep the exact representative/product rule from the existing function.
  -- SET-21, not SET-20, owns consolidation with the canonical public-access
  -- rule, so this security fix does not expand into that separate scope.
  if not exists (
    select 1
    from public.product_activations pa
    join public.representatives r on r.id = pa.representative_id
    where pa.representative_id = p_representative_id
      and pa.product_id = p_product_id
      and pa.status = 'published'
      and r.status = 'active'
  ) then
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

  delete from public.lead_submission_attempts
  where ip_hash = p_ip_hash
    and attempted_at <= now() - interval '1 day';

  return true;
end;
$$;

-- Revoke every browser-reachable role explicitly. Prior migrations showed
-- that project-level default privileges can grant anon/authenticated directly,
-- so revoking PUBLIC alone is insufficient.
revoke execute on function public.submit_lead(
  uuid, uuid, text, text, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.submit_lead(
  uuid, uuid, text, text, text, text, text, text, text
) to service_role;
