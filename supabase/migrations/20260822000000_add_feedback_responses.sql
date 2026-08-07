-- SET-60: shared minimal infrastructure for the qualitative microfeedback
-- layer (SET-59). One table for every context (`first_publication` now;
-- `value_perception`/`cancellation`/`pmf` reserved for SET-62/63/64), not one
-- table per survey and not a dynamic-form engine — the smallest shape that
-- still lets every context be queried consistently.
--
-- Three independent timestamps, not a single status column, so the three
-- states that matter for analysis stay distinguishable without a state
-- machine. `shown_at` records a technical delivery fact only — the prompt
-- was presented/rendered to the client for (representative, context) — it
-- is NOT proof the representative read or noticed it, and must never be
-- read as such. `answered_at`/`dismissed_at` record a terminal outcome on
-- top of that: `shown_at` alone means presented, not yet resolved;
-- `+ dismissed_at` means presented and explicitly dismissed; `+ answered_at`
-- means presented and answered.
--
-- Whether a resolved row (answered or dismissed) means "never show this
-- context again" is a product decision each context's own eligibility rule
-- makes in application code — this table does not assert it universally.
-- SET-61's `first_publication` context treats both outcomes as permanent
-- (`modules/feedback/domain/first-publication-eligibility.ts`); a future
-- context is free to decide differently without a schema change.
--
-- No policy allows INSERT/UPDATE directly. Same reasoning ADR-047 already
-- used for update_representative_profile: a column-scoped write policy
-- decides WHO writes, never VALIDATES what is written (context membership,
-- response vocabulary, detail length, or the shown-before-resolved
-- invariant) — two SECURITY DEFINER RPCs own every write instead. The same
-- reasoning is why `response`'s vocabulary is validated inside
-- `resolve_feedback`, scoped to `p_context`, rather than as a single
-- column-wide CHECK: a CHECK cannot see `context`, so it can only be
-- either wrong for every context but one, or guess a taxonomy (`cancellation`)
-- that SET-63 has not approved yet.

create table public.feedback_responses (
  id                uuid primary key default gen_random_uuid(),
  representative_id uuid not null references public.representatives (id),
  context           text not null
    check (context = any (array['first_publication', 'value_perception', 'cancellation', 'pmf'])),
  -- No enum CHECK here on purpose: valid `response` values depend on
  -- `context` (SET-61's `easy`/`reasonable`/`difficult` is not SET-62's or
  -- SET-64's vocabulary), and a column-scoped CHECK cannot see `context`.
  -- `resolve_feedback` below validates `response` against the allow-list for
  -- the `context` it was called with, extended forward-only as each
  -- context ships — not guessed in advance for `cancellation`.
  response          text,
  response_detail   text
    check (response_detail is null or char_length(response_detail) <= 140),
  shown_at          timestamptz,
  answered_at       timestamptz,
  dismissed_at      timestamptz,
  created_at        timestamptz not null default now()
);

-- No uniqueness constraint on (representative_id, context): `cancellation`
-- is by cancellation event, not by representative for life (SET-60's own
-- documented exception), so more than one row per (representative, context)
-- is a legitimate future shape. The RPCs below enforce "at most one
-- unresolved row per context" for the single-shot contexts by construction
-- (record_feedback_shown reuses an existing row instead of inserting a
-- second one whenever any row already exists for that pair).
create index feedback_responses_representative_context_idx
  on public.feedback_responses (representative_id, context);

alter table public.feedback_responses enable row level security;

-- Same shape as product_activations_select_own
-- (20260804000000_add_own_row_select_policies.sql): RLS does not apply
-- inside another policy's own subquery, so this does not depend on
-- representatives_select_own.
create policy "feedback_responses_select_own"
  on public.feedback_responses for select
  using (
    exists (
      select 1
      from public.representatives r
      where r.id = feedback_responses.representative_id
        and r.profile_id = auth.uid()
    )
  );

-- Marks a context as delivered to the browser for the signed-in
-- Representative. Idempotent: if a row already exists for
-- (representative, context) — shown, answered, or dismissed — it is
-- reused, never duplicated. Returns no row when the caller has no
-- Representative yet, the same "typed absence over exception" posture
-- other Representative RPCs use for a missing row.
create or replace function public.record_feedback_shown(p_context text)
returns table (id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_representative_id uuid;
  v_id uuid;
begin
  select r.id into v_representative_id
  from public.representatives r
  where r.profile_id = auth.uid();

  if v_representative_id is null then
    return;
  end if;

  select f.id into v_id
  from public.feedback_responses f
  where f.representative_id = v_representative_id
    and f.context = p_context
  order by f.created_at desc
  limit 1;

  if v_id is not null then
    return query select v_id;
    return;
  end if;

  insert into public.feedback_responses (representative_id, context, shown_at)
  values (v_representative_id, p_context, now())
  returning feedback_responses.id into v_id;

  return query select v_id;
end;
$$;

revoke execute on function public.record_feedback_shown(text) from public, anon;
grant execute on function public.record_feedback_shown(text) to authenticated;

-- Resolves the most recent unresolved row for (representative, context),
-- either recording an answer or an explicit dismissal. Rejects with a typed
-- status — never a raw exception — when there is nothing to resolve, the
-- row is already resolved, or (for `answered`) `response` is not in the
-- allow-list for `p_context` — matching every other Representative write
-- RPC's rejection-reason vocabulary. This is also where each context's
-- response vocabulary is enforced (see the table's own comment on why that
-- cannot live in a column CHECK); `cancellation` has no allow-list yet
-- because SET-63 has not approved one, so any `answered` call for it is
-- rejected as `invalid_response` until that taxonomy ships.
create or replace function public.resolve_feedback(
  p_context         text,
  p_outcome         text,
  p_response        text,
  p_response_detail text
)
returns table (status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_representative_id uuid;
  v_id                 uuid;
  v_already_resolved   boolean;
begin
  if p_outcome not in ('answered', 'dismissed') then
    return query select 'invalid_outcome'::text;
    return;
  end if;

  select r.id into v_representative_id
  from public.representatives r
  where r.profile_id = auth.uid();

  if v_representative_id is null then
    return query select 'representative_not_found'::text;
    return;
  end if;

  select f.id, (f.answered_at is not null or f.dismissed_at is not null)
  into v_id, v_already_resolved
  from public.feedback_responses f
  where f.representative_id = v_representative_id
    and f.context = p_context
  order by f.created_at desc
  limit 1;

  if v_id is null then
    return query select 'not_shown'::text;
    return;
  end if;

  if v_already_resolved then
    return query select 'already_resolved'::text;
    return;
  end if;

  if p_outcome = 'answered' then
    if p_response is null or length(trim(p_response)) = 0 then
      return query select 'response_required'::text;
      return;
    end if;

    -- Per-context response vocabulary — the correct place for it, since a
    -- table-wide CHECK cannot see p_context. Extend forward-only, one
    -- branch per context, only when that context is actually implemented.
    if not (
      (p_context = 'first_publication' and p_response = any (array['easy', 'reasonable', 'difficult']))
      or (p_context = 'value_perception' and p_response = any (array['yes', 'partly', 'no']))
      or (p_context = 'pmf' and p_response = any (
        array['very_disappointed', 'somewhat_disappointed', 'not_disappointed', 'no_longer_use']
      ))
    ) then
      return query select 'invalid_response'::text;
      return;
    end if;

    update public.feedback_responses
    set answered_at = now(),
        response = p_response,
        response_detail = nullif(trim(p_response_detail), '')
    where id = v_id;
  else
    update public.feedback_responses
    set dismissed_at = now()
    where id = v_id;
  end if;

  return query select 'updated'::text;
end;
$$;

revoke execute on function public.resolve_feedback(text, text, text, text) from public, anon;
grant execute on function public.resolve_feedback(text, text, text, text) to authenticated;
