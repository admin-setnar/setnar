-- SET-21: submit_lead consumes the canonical public-access rule instead of a
-- duplicated, weaker predicate.
--
-- Since ADR-065, private.is_page_publicly_accessible(rep, product) is the one
-- rule governing whether a (representative, product) page is publicly
-- reachable: activation published, same Company, representative active,
-- Subscription active and a valid professional profile (name, phone). Every
-- public surface consumes it — set_activation_status, the public read
-- policies, record_page_visit, record_whatsapp_click — except submit_lead,
-- which predates the consolidation (ADR-067) and still checks only
-- `product_activations.status = 'published' and representatives.status =
-- 'active'`. A page that is not publicly accessible for any other reason
-- (Subscription suspended, an incomplete legacy profile) could still accept
-- leads. This migration closes that gap by making submit_lead ask the same
-- question every other surface asks. Rate limiting, payload validation, the
-- advisory lock and the boolean anti-enumerating return are unchanged.

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

  -- SET-21: the single source of truth for "is this page publicly
  -- reachable", shared with set_activation_status, the public read policies
  -- and both Analytics RPCs. A page hidden for any reason (unpublished,
  -- crossed Company, suspended representative, suspended Subscription, an
  -- invalid legacy name/phone) can no longer accept leads either.
  if not private.is_page_publicly_accessible(p_representative_id, p_product_id) then
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

-- create or replace preserves existing grants, but re-asserting them keeps
-- this migration a self-contained statement of the intended privilege state,
-- matching 20260820000000.
revoke execute on function public.submit_lead(
  uuid, uuid, text, text, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.submit_lead(
  uuid, uuid, text, text, text, text, text, text, text
) to service_role;
