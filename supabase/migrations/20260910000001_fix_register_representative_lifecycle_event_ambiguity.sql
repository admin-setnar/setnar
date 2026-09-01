-- Follow-up to 20260910000000, found by testing the migration live against
-- the disposable `setnar-db-test` project before shipping it (same pattern
-- as 20260907000001/20260909000001 fixing bugs found by live testing — a
-- new migration, never editing the one already applied):
--
-- `register_representative()`'s `RETURNS TABLE (status text,
-- representative_id uuid)` declares an implicit PL/pgSQL variable named
-- `representative_id` — the exact same name as the column list in
-- `on conflict (representative_id, event_type) do nothing` on the new
-- `representative_lifecycle_events` insert. Confirmed live: this raises
-- `42702: column reference "representative_id" is ambiguous` on every call,
-- breaking registration entirely. `set_activation_status`/
-- `record_whatsapp_click`/`submit_lead` don't have this problem — none of
-- their return types declare a column literally named `representative_id`.
--
-- Fix: reference the unique constraint by name (`on conflict on
-- constraint ...`) instead of by column list — this syntax has no column
-- list for plpgsql to (mis)parse against a same-named variable.

create or replace function public.register_representative(
  p_slug              text,
  p_display_name      text,
  p_authorization_id  text,
  p_phone             text,
  p_city              text
)
returns table (status text, representative_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id       uuid;
  v_display_name     text;
  v_authorization_id text;
  v_phone            text;
  v_city             text;
  v_new_id           uuid;
  v_constraint       text;
begin
  v_phone := nullif(trim(p_phone), '');
  v_city := nullif(trim(p_city), '');

  if p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    return query select 'slug_invalid'::text, null::uuid;
    return;
  end if;

  if p_slug = any (array[
    'www', 'app', 'api', 'auth', 'admin',
    'entrar', 'criar-conta', 'esqueci-senha', 'redefinir-senha',
    'termos', 'privacidade', 'setnar', 'igreen'
  ]) then
    return query select 'slug_invalid'::text, null::uuid;
    return;
  end if;

  v_display_name := trim(p_display_name);
  if v_display_name is null
    or length(v_display_name) = 0
    or length(v_display_name) > 80
    or array_length(regexp_split_to_array(v_display_name, '\s+'), 1) < 2
  then
    return query select 'display_name_invalid'::text, null::uuid;
    return;
  end if;

  v_authorization_id := trim(p_authorization_id);
  if v_authorization_id is null or length(v_authorization_id) = 0 or length(v_authorization_id) > 100 then
    return query select 'authorization_id_invalid'::text, null::uuid;
    return;
  end if;

  if v_phone is null then
    return query select 'phone_required'::text, null::uuid;
    return;
  end if;

  if v_phone !~ '^\+[1-9]\d{6,14}$' then
    return query select 'phone_invalid'::text, null::uuid;
    return;
  end if;

  if v_city is not null and length(v_city) > 500 then
    return query select 'city_invalid'::text, null::uuid;
    return;
  end if;

  select id into v_company_id from public.companies where slug = 'igreen';
  if v_company_id is null then
    return query select 'company_not_found'::text, null::uuid;
    return;
  end if;

  if exists (select 1 from public.companies where slug = p_slug) then
    return query select 'slug_invalid'::text, null::uuid;
    return;
  end if;

  if exists (select 1 from public.representatives where profile_id = auth.uid()) then
    return query select 'already_registered'::text, null::uuid;
    return;
  end if;

  if exists (select 1 from public.representatives where slug = p_slug) then
    return query select 'slug_taken'::text, null::uuid;
    return;
  end if;

  begin
    insert into public.representatives (
      profile_id, company_id, slug, display_name, authorization_id, phone, city
    )
    values (auth.uid(), v_company_id, p_slug, v_display_name, v_authorization_id, v_phone, v_city)
    returning id into v_new_id;
  exception
    when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'representatives_profile_id_key' then
        return query select 'already_registered'::text, null::uuid;
        return;
      elsif v_constraint = 'representatives_slug_key' then
        return query select 'slug_taken'::text, null::uuid;
        return;
      else
        raise;
      end if;
  end;

  insert into public.subscriptions (representative_id, status, provider, current_period_end)
  values (v_new_id, 'trialing', 'trial', now() + interval '30 days');

  -- Fix: `on conflict on constraint`, not `on conflict (representative_id, event_type)`
  -- — see the header of this migration.
  insert into public.representative_lifecycle_events (representative_id, event_type, source)
  values (v_new_id, 'representative_registered', 'register_representative')
  on conflict on constraint representative_lifecycle_event_representative_id_event_type_key do nothing;

  return query select 'created'::text, v_new_id;
end;
$$;
