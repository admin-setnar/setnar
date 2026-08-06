-- Stage 1 consolidation, part 1: one public-access rule and a trusted-only
-- Analytics write boundary. This migration intentionally changes no business
-- row: legacy activations remain `published`, but cease to be publicly
-- readable while any current eligibility precondition is false.

-- Fatal preflight before any DDL/grant/policy change. Keeping this first makes
-- the known data-integrity failure safe even under a statement-wise runner.
do $$
declare
  v_invalid_pairs bigint;
begin
  select count(*) into v_invalid_pairs
  from public.analytics_events ae
  left join public.product_activations pa
    on pa.representative_id = ae.representative_id
   and pa.product_id = ae.product_id
  where pa.id is null;

  if v_invalid_pairs > 0 then
    raise exception 'analytics_events has % representative/product pair(s) without a matching activation; migration aborted without changing business data', v_invalid_pairs;
  end if;
end;
$$;

-- Internal policy helpers live outside PostgREST's exposed `public` schema.
-- RLS evaluates them as anon/authenticated, so those roles need USAGE and the
-- two boolean EXECUTEs; that does not make the private schema an RPC surface.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

-- Aggregate-only legacy diagnostic. It deliberately logs counts, never slugs,
-- names, phones or ids, and performs no correction.
do $$
declare
  v_invalid_phone_representatives bigint;
  v_incomplete_published_pages bigint;
begin
  select count(*) into v_invalid_phone_representatives
  from public.representatives r
  where r.phone is null
     or trim(r.phone) = ''
     or trim(r.phone) !~ '^\+[1-9]\d{6,14}$';

  select count(*) into v_incomplete_published_pages
  from public.product_activations pa
  join public.representatives r on r.id = pa.representative_id
  where pa.status = 'published'
    and (
      r.phone is null
      or trim(r.phone) !~ '^\+[1-9]\d{6,14}$'
      or length(trim(r.display_name)) = 0
      or length(trim(r.display_name)) > 80
      or array_length(regexp_split_to_array(trim(r.display_name), '\s+'), 1) < 2
    );

  raise notice 'Stage 1 public-access diagnostic: invalid_phone_representatives=%, incomplete_published_pages=%',
    v_invalid_phone_representatives, v_incomplete_published_pages;
end;
$$;

-- A blocker (rather than four duplicated predicates) preserves the typed,
-- first-failure contract of set_activation_status while also serving the
-- boolean public read/write checks below.
create or replace function private.page_publication_blocker(
  p_representative_id uuid,
  p_product_id uuid
)
returns text
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_status text;
  v_display_name text;
  v_phone text;
begin
  select r.status, r.display_name, r.phone
  into v_status, v_display_name, v_phone
  from public.representatives r
  join public.products p on p.id = p_product_id
                         and p.company_id = r.company_id
  join public.product_activations pa
    on pa.representative_id = r.id
   and pa.product_id = p.id
  where r.id = p_representative_id;

  if not found then
    return 'not_activated';
  end if;

  if v_status <> 'active' then
    return 'representative_not_active';
  end if;

  if not public.is_subscription_active(p_representative_id) then
    return 'subscription_not_active';
  end if;

  -- Match the canonical onboarding constraints, not merely non-emptiness.
  if v_display_name is null
     or length(trim(v_display_name)) = 0
     or length(trim(v_display_name)) > 80
     or array_length(regexp_split_to_array(trim(v_display_name), '\s+'), 1) < 2 then
    return 'display_name_required';
  end if;

  -- A public CTA needs a usable E.164 destination. Invalid legacy values are
  -- hidden safely and can be corrected through the existing profile flow.
  if v_phone is null or trim(v_phone) !~ '^\+[1-9]\d{6,14}$' then
    return 'phone_required';
  end if;

  return null;
end;
$$;

revoke execute on function private.page_publication_blocker(uuid, uuid) from public, anon, authenticated;

create or replace function private.is_page_publicly_accessible(
  p_representative_id uuid,
  p_product_id uuid
)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select private.page_publication_blocker(p_representative_id, p_product_id) is null
    and exists (
      select 1
      from public.product_activations pa
      where pa.representative_id = p_representative_id
        and pa.product_id = p_product_id
        and pa.status = 'published'
    );
$$;

revoke execute on function private.is_page_publicly_accessible(uuid, uuid) from public;
grant execute on function private.is_page_publicly_accessible(uuid, uuid) to anon, authenticated;

create or replace function private.has_publicly_accessible_page(p_representative_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.product_activations pa
    where pa.representative_id = p_representative_id
      and private.is_page_publicly_accessible(pa.representative_id, pa.product_id)
  );
$$;

revoke execute on function private.has_publicly_accessible_page(uuid) from public;
grant execute on function private.has_publicly_accessible_page(uuid) to anon, authenticated;

drop policy if exists "product_activations_select_published" on public.product_activations;
create policy "product_activations_select_published"
  on public.product_activations for select
  using (private.is_page_publicly_accessible(representative_id, product_id));

drop policy if exists "representatives_select_public" on public.representatives;
create policy "representatives_select_public"
  on public.representatives for select
  using (private.has_publicly_accessible_page(id));

-- Publication now consumes the same blocker used by public reads and event
-- persistence. Same-state and unpublication behavior remain unchanged.
create or replace function public.set_activation_status(
  p_product_id uuid,
  p_status text
)
returns table (status text, activation_id uuid, published_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_representative_id uuid;
  v_activation_id uuid;
  v_current_status text;
  v_published_at timestamptz;
  v_new_published_at timestamptz;
  v_blocker text;
begin
  if p_status is null or p_status not in ('published', 'unpublished') then
    return query select 'invalid_status'::text, null::uuid, null::timestamptz;
    return;
  end if;

  select r.id into v_representative_id
  from public.representatives r
  where r.profile_id = auth.uid();

  if v_representative_id is null then
    return query select 'representative_not_found'::text, null::uuid, null::timestamptz;
    return;
  end if;

  select pa.id, pa.status, pa.published_at
  into v_activation_id, v_current_status, v_published_at
  from public.product_activations pa
  where pa.representative_id = v_representative_id
    and pa.product_id = p_product_id
  for update;

  if v_activation_id is null then
    return query select 'not_activated'::text, null::uuid, null::timestamptz;
    return;
  end if;

  if v_current_status = p_status then
    return query select 'updated'::text, v_activation_id, v_published_at;
    return;
  end if;

  if p_status = 'unpublished' then
    if v_current_status = 'draft' then
      return query select 'invalid_transition'::text, v_activation_id, v_published_at;
      return;
    end if;

    update public.product_activations set status = 'unpublished' where id = v_activation_id;
    return query select 'updated'::text, v_activation_id, v_published_at;
    return;
  end if;

  v_blocker := private.page_publication_blocker(v_representative_id, p_product_id);
  if v_blocker is not null then
    return query select v_blocker, v_activation_id, v_published_at;
    return;
  end if;

  v_new_published_at := coalesce(v_published_at, now());
  update public.product_activations
  set status = 'published', published_at = v_new_published_at
  where id = v_activation_id;

  return query select 'updated'::text, v_activation_id, v_new_published_at;
end;
$$;

revoke execute on function public.set_activation_status(uuid, text) from public, anon;
grant execute on function public.set_activation_status(uuid, text) to authenticated;

-- Both event functions remain SECURITY DEFINER for table writes, but only the
-- server's service-role client may invoke them. They re-resolve slugs and
-- call the exact public-access rule before accepting an event.
create or replace function public.record_page_visit(
  p_representative_slug text,
  p_product_slug text,
  p_referrer text,
  p_ip_hash text,
  p_user_agent text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_representative_id uuid;
  v_product_id uuid;
  v_attempts int;
begin
  if p_ip_hash is null or length(trim(p_ip_hash)) = 0 then return false; end if;
  if public.is_bot_user_agent(p_user_agent) then return true; end if;

  select r.id, p.id into v_representative_id, v_product_id
  from public.representatives r
  join public.products p on p.company_id = r.company_id
  where r.slug = p_representative_slug
    and p.slug = p_product_slug
    and private.is_page_publicly_accessible(r.id, p.id);

  if v_representative_id is null then return false; end if;

  select count(*) into v_attempts
  from public.analytics_events
  where ip_hash = p_ip_hash
    and event_type = 'visit'
    and created_at > now() - interval '60 seconds';
  if v_attempts >= 60 then return false; end if;

  insert into public.analytics_events (representative_id, product_id, event_type, referrer, ip_hash)
  values (v_representative_id, v_product_id, 'visit', left(p_referrer, 2048), p_ip_hash);
  return true;
end;
$$;

create or replace function public.record_whatsapp_click(
  p_representative_slug text,
  p_product_slug text,
  p_referrer text,
  p_ip_hash text,
  p_user_agent text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_representative_id uuid;
  v_product_id uuid;
  v_attempts int;
begin
  if p_ip_hash is null or length(trim(p_ip_hash)) = 0 then return false; end if;
  if public.is_bot_user_agent(p_user_agent) then return true; end if;

  select r.id, p.id into v_representative_id, v_product_id
  from public.representatives r
  join public.products p on p.company_id = r.company_id
  where r.slug = p_representative_slug
    and p.slug = p_product_slug
    and private.is_page_publicly_accessible(r.id, p.id);

  if v_representative_id is null then return false; end if;

  select count(*) into v_attempts
  from public.analytics_events
  where ip_hash = p_ip_hash
    and event_type = 'whatsapp_click'
    and created_at > now() - interval '3600 seconds';
  if v_attempts >= 5 then return false; end if;

  insert into public.analytics_events (representative_id, product_id, event_type, referrer, ip_hash)
  values (v_representative_id, v_product_id, 'whatsapp_click', left(p_referrer, 2048), p_ip_hash);
  return true;
end;
$$;

revoke execute on function public.record_page_visit(text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.record_whatsapp_click(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.record_page_visit(text, text, text, text, text) to service_role;
grant execute on function public.record_whatsapp_click(text, text, text, text, text) to service_role;

-- RLS still scopes a representative's safe Analytics read model, while SQL
-- privileges make ip_hash unreadable even for the row owner.
revoke select on table public.analytics_events from anon, authenticated;
grant select (id, representative_id, product_id, event_type, referrer, created_at)
  on table public.analytics_events to authenticated;
revoke insert, update, delete, truncate, references, trigger
  on table public.analytics_events from anon, authenticated;

alter table public.analytics_events
  add constraint analytics_events_activation_pair_fkey
  foreign key (representative_id, product_id)
  references public.product_activations (representative_id, product_id)
  not valid;

alter table public.analytics_events validate constraint analytics_events_activation_pair_fkey;

-- Period-first representative reports need this ordering; the prior
-- (representative, product, event_type) and rate-limit indexes remain useful.
create index analytics_events_representative_created_at_idx
  on public.analytics_events (representative_id, created_at desc);
