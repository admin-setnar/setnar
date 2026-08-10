-- SET-63: motivo de cancelamento da assinatura, usando a infraestrutura de
-- microfeedback do SET-60 (20260822000000_add_feedback_responses.sql) com
-- uma diferença estrutural que aquela migration já documentava e reservava:
-- `cancellation` é elegível POR EVENTO de cancelamento, não uma vez na vida
-- do representante (`feedback_responses`'s own header: "cancellation é por
-- cancellation event, not by representative for life"). As duas outras
-- contexts hoje ativas (`first_publication`, `value_perception`) são
-- verdadeiramente one-shot: uma vez respondida/dispensada, o
-- `FeedbackGateway.isResolved()` que olha só a linha mais recente por
-- (representative, context) nunca mais deveria mostrar o prompt de novo, e
-- a elegibilidade de cada uma garante que o componente nem chega a montar
-- outra vez. `cancellation` quebra essa premissa: um representante pode
-- cancelar, ser perguntado, responder, reativar (nova assinatura) e cancelar
-- de novo — e o critério de aceite do SET-63 exige que a pergunta apareça
-- de novo nesse segundo evento.
--
-- `record_feedback_shown()`, do jeito que o SET-60 escreveu, sempre reusa a
-- linha mais recente para (representative, context) — resolvida ou não. Isso
-- está correto para as duas contexts one-shot (nunca é chamado de novo
-- depois de resolvida, porque a elegibilidade já barra a montagem do
-- componente antes disso), mas seria o bug errado para `cancellation`: no
-- segundo cancelamento, reusaria a linha já respondida do PRIMEIRO
-- cancelamento, `resolve_feedback` rejeitaria como `already_resolved`, e o
-- representante nunca teria uma segunda chance real de responder.
--
-- A correção não vive em `record_feedback_shown` (ele só roda quando o
-- componente já montou no navegador — tarde demais: a elegibilidade do
-- servidor já teria decidido não montar nada, lendo a linha antiga e
-- resolvida do evento anterior). Vive em
-- `confirm_own_subscription_cancellation()`: o único lugar que sabe, com
-- certeza e no momento exato, que um NOVO evento de cancelamento acabou de
-- acontecer — exatamente a mesma transação que já grava `status =
-- 'canceled'`. Inserir ali uma linha fresca e não resolvida garante que,
-- assim que `/app/conta` re-renderiza (via `revalidatePath`, já existente no
-- Server Action de SET-32), a linha mais recente para `cancellation` já é a
-- deste evento — nunca a de um cancelamento anterior.

-- ============================================================================
-- 1. confirm_own_subscription_cancellation() também abre um evento de
--    feedback fresco, só na transição real para 'canceled'
-- ============================================================================

create or replace function public.confirm_own_subscription_cancellation(p_external_subscription_id text)
returns table (status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_representative_id uuid;
  v_current_status     text;
begin
  select r.id into v_representative_id
  from public.representatives r
  where r.profile_id = auth.uid();

  if v_representative_id is null then
    return query select 'not_found'::text;
    return;
  end if;

  select s.status into v_current_status
  from public.subscriptions s
  where s.representative_id = v_representative_id;

  if not found then
    return query select 'not_found'::text;
    return;
  end if;

  if v_current_status = 'canceled' then
    return query select 'already_canceled'::text;
    return;
  end if;

  if v_current_status not in ('active', 'suspended') then
    return query select 'not_found'::text;
    return;
  end if;

  update public.subscriptions
  set status = 'canceled'
  where representative_id = v_representative_id
    and external_subscription_id is not distinct from p_external_subscription_id;

  if not found then
    return query select 'changed'::text;
    return;
  end if;

  -- SET-63: uma linha nova por evento, nunca reusada entre cancelamentos —
  -- `shown_at` fica null até o prompt realmente montar no navegador
  -- (`record_feedback_shown` abaixo grava isso), então esta linha por si só
  -- não afirma "apresentado ao representante", só "o evento aconteceu".
  -- Sem essa distinção, `record_feedback_shown` marcaria como "mostrado"
  -- algo que o servidor só concluiu internamente.
  insert into public.feedback_responses (representative_id, context)
  values (v_representative_id, 'cancellation');

  return query select 'canceled'::text;
end;
$$;

revoke execute on function public.confirm_own_subscription_cancellation(text) from public;
revoke execute on function public.confirm_own_subscription_cancellation(text) from anon;
grant execute on function public.confirm_own_subscription_cancellation(text) to authenticated;

-- ============================================================================
-- 2. record_feedback_shown() grava shown_at ao reusar uma linha que ainda
--    não tinha sido marcada como mostrada
-- ============================================================================
--
-- Comportamento inalterado para first_publication/value_perception/pmf: a
-- única forma de uma linha existir para elas é esta própria função já ter
-- inserido com `shown_at = now()` — então `shown_at` nunca é null numa linha
-- que já existe para essas contexts, e o `coalesce` abaixo nunca tem efeito
-- prático nelas. Só `cancellation` agora pode chegar aqui com uma linha
-- pré-existente e `shown_at` ainda null (inserida por
-- `confirm_own_subscription_cancellation` acima).

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
    update public.feedback_responses
    set shown_at = coalesce(shown_at, now())
    where feedback_responses.id = v_id;

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

-- ============================================================================
-- 3. resolve_feedback() ganha o vocabulário de `cancellation` (SET-63)
-- ============================================================================
--
-- As 9 categorias do brief de produto (issue SET-63 § Escopo), cada uma um
-- valor estruturado e comparável — nunca texto livre como resposta
-- principal (`response_detail` continua sendo só o complemento opcional).

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
      or (p_context = 'cancellation' and p_response = any (array[
        'not_generating_results', 'not_using_enough', 'price', 'missing_feature',
        'hard_to_configure', 'no_longer_need', 'technical_problem',
        'expected_something_else', 'other'
      ]))
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
