-- Sprint E, passo E2 (docs/plans/SPRINT_E_PLAN.md): fecha o lado de escrita
-- da Regra 21 sem duplicar a definição de Subscription ativa.
--
-- E1 (20260815000000) criou public.is_subscription_active(uuid) e passou a
-- usá-la na policy pública de leitura. Esta migration reutiliza exatamente a
-- mesma função no único caminho que pode promover uma Product Activation a
-- `published`. Assim, leitura e escrita deixam de discordar sobre o conceito
-- de assinatura ativa.
--
-- Ordem normativa do gate de publicação (a primeira falha é retornada):
--
--   1. representative_not_active
--   2. subscription_not_active
--   3. display_name_required
--   4. phone_required
--
-- `activate_product` não é redefinida: criar/manter uma ativação em `draft`
-- continua permitido sem Subscription ativa. Também permanecem fora do gate
-- a despublicação e o sucesso idempotente de mesmo estado; só as transições
-- `draft/unpublished -> published` exigem as quatro precondições.

create or replace function public.set_activation_status(
  p_product_id uuid,
  p_status     text
)
returns table (status text, activation_id uuid, published_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_representative_id uuid;
  v_rep_status        text;
  v_display_name      text;
  v_phone             text;
  v_activation_id     uuid;
  v_current_status    text;
  v_published_at      timestamptz;
  v_new_published_at  timestamptz;
begin
  if p_status is null or p_status not in ('published', 'unpublished') then
    return query select 'invalid_status'::text, null::uuid, null::timestamptz;
    return;
  end if;

  select r.id, r.status, r.display_name, r.phone
  into v_representative_id, v_rep_status, v_display_name, v_phone
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

    update public.product_activations
    set status = 'unpublished'
    where id = v_activation_id;

    return query select 'updated'::text, v_activation_id, v_published_at;
    return;
  end if;

  -- p_status = 'published', vindo de `draft` ou `unpublished`.
  if v_rep_status <> 'active' then
    return query select 'representative_not_active'::text, v_activation_id, v_published_at;
    return;
  end if;

  if not public.is_subscription_active(v_representative_id) then
    return query select 'subscription_not_active'::text, v_activation_id, v_published_at;
    return;
  end if;

  if v_display_name is null or length(trim(v_display_name)) = 0 then
    return query select 'display_name_required'::text, v_activation_id, v_published_at;
    return;
  end if;

  if v_phone is null or length(trim(v_phone)) = 0 then
    return query select 'phone_required'::text, v_activation_id, v_published_at;
    return;
  end if;

  v_new_published_at := coalesce(v_published_at, now());

  update public.product_activations
  set status = 'published',
      published_at = v_new_published_at
  where id = v_activation_id;

  return query select 'updated'::text, v_activation_id, v_new_published_at;
end;
$$;

-- `create or replace` preserva os grants existentes, mas as revogações
-- explícitas mantêm o contrato do ADR-048 verificável nesta migration.
revoke execute on function public.set_activation_status(uuid, text) from public;
revoke execute on function public.set_activation_status(uuid, text) from anon;
grant execute on function public.set_activation_status(uuid, text) to authenticated;
