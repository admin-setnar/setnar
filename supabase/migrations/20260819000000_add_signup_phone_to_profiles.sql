-- Stage 1 consolidation, part 2: initial commercial phone for onboarding.
-- profiles.phone is a nullable signup snapshot for the account owner. Once a
-- Representative exists, representatives.phone is the only canonical source
-- for professional settings and public pages. Legacy profiles remain NULL.

alter table public.profiles
  add column phone text;

alter table public.profiles
  add constraint profiles_phone_br_e164
  check (phone is null or phone ~ '^\+55\d{10,11}$')
  not valid;

comment on column public.profiles.phone is
  'Initial commercial phone captured at signup for onboarding prefill; representatives.phone is canonical after onboarding.';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_signup_phone text;
begin
  v_signup_phone := new.raw_user_meta_data ->> 'phone';

  -- Metadata is only the atomic carrier from Auth signup into the private
  -- owner-readable profile. Invalid values are never copied into profiles.
  if v_signup_phone !~ '^\+55\d{10,11}$' then
    v_signup_phone := null;
  end if;

  insert into public.profiles (
    id, full_name, phone, tenant_id, terms_accepted_at, terms_version
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    v_signup_phone,
    'setnar',
    now(),
    public.current_terms_version()
  );
  return new;
end;
$$;
