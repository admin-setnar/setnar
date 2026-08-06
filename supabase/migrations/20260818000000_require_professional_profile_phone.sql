-- Stage 1 consolidation, part 2: professional-profile invariants.
-- Legacy null/invalid phones are diagnosed and preserved. New representatives
-- must have a valid E.164 commercial phone, and an existing phone cannot be
-- cleared. NOT NULL remains deliberately deferred until the legacy count is 0.

do $$
declare
  v_missing_phone bigint;
  v_invalid_phone bigint;
begin
  select count(*) into v_missing_phone
  from public.representatives
  where phone is null or trim(phone) = '';

  select count(*) into v_invalid_phone
  from public.representatives
  where phone is not null
    and trim(phone) <> ''
    and phone !~ '^\+[1-9]\d{6,14}$';

  raise notice 'Professional profile diagnostic: missing_phone=%, invalid_phone=%',
    v_missing_phone, v_invalid_phone;
end;
$$;

alter table public.representatives
  add constraint representatives_phone_e164
  check (phone is null or phone ~ '^\+[1-9]\d{6,14}$')
  not valid;

create or replace function private.enforce_representative_phone_on_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.phone is distinct from old.phone then
    if new.phone is null or trim(new.phone) = '' then
      raise exception using
        errcode = '23514',
        message = 'representatives.phone is required for new phone writes';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function private.enforce_representative_phone_on_write() from public, anon, authenticated;

drop trigger if exists representatives_require_phone_on_write on public.representatives;
create trigger representatives_require_phone_on_write
  before insert or update of phone on public.representatives
  for each row
  execute function private.enforce_representative_phone_on_write();

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

  return query select 'created'::text, v_new_id;
end;
$$;

revoke execute on function public.register_representative(text, text, text, text, text)
  from public, anon;
grant execute on function public.register_representative(text, text, text, text, text)
  to authenticated;

revoke execute on function public.update_representative_profile(text, text, text)
  from public, anon, authenticated;
drop function public.update_representative_profile(text, text, text);

create function public.update_representative_profile(
  p_display_name      text,
  p_authorization_id  text,
  p_phone             text,
  p_city              text
)
returns table (status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_display_name     text;
  v_authorization_id text;
  v_phone            text;
  v_city             text;
  v_id               uuid;
begin
  v_display_name := trim(p_display_name);
  v_authorization_id := trim(p_authorization_id);
  v_phone := nullif(trim(p_phone), '');
  v_city := nullif(trim(p_city), '');

  if v_display_name is null
    or length(v_display_name) = 0
    or length(v_display_name) > 80
    or array_length(regexp_split_to_array(v_display_name, '\s+'), 1) < 2
  then
    return query select 'display_name_invalid'::text;
    return;
  end if;

  if v_authorization_id is null or length(v_authorization_id) = 0 or length(v_authorization_id) > 100 then
    return query select 'authorization_id_invalid'::text;
    return;
  end if;

  if v_phone is null then
    return query select 'phone_required'::text;
    return;
  end if;

  if v_phone !~ '^\+[1-9]\d{6,14}$' then
    return query select 'phone_invalid'::text;
    return;
  end if;

  if v_city is not null and length(v_city) > 500 then
    return query select 'city_invalid'::text;
    return;
  end if;

  update public.representatives
  set display_name = v_display_name,
      authorization_id = v_authorization_id,
      phone = v_phone,
      city = v_city
  where profile_id = auth.uid()
  returning id into v_id;

  if v_id is null then
    return query select 'representative_not_found'::text;
    return;
  end if;

  return query select 'updated'::text;
end;
$$;

revoke execute on function public.update_representative_profile(text, text, text, text)
  from public, anon;
grant execute on function public.update_representative_profile(text, text, text, text)
  to authenticated;
