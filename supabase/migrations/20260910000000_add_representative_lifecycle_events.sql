-- SET-116 — Integridade histórica mínima dos KPIs Stage 1, a partir de
-- `docs/plans/AUDIT_STAGE_1_KPI_HISTORICAL_INTEGRITY_2026-09-01.md` (R1/R3/R4:
-- KPIs "lifetime" são agregações sobre estado mutável; `product_activations`
-- não tem trilha de DELETE; `published_at` representa a publicação MAIS
-- RECENTE, não a primeira). Escopo mínimo, priorizado pelo próprio pedido:
-- `representative_registered`, `first_page_published`, `first_result` +
-- backfill determinístico. `trial_started`/`became_paying`/`canceled` são
-- deliberadamente NÃO duplicados aqui — ver o comentário "DEFERRED_AS_ALREADY_COVERED"
-- no final deste arquivo.
--
-- Deliberadamente NÃO é event sourcing: três tipos de evento fechados (CHECK
-- constraint), cada um com no máximo uma linha por representative (unique
-- constraint) — um marco histórico mínimo, não um barramento de eventos.
--
-- ============================================================================
-- representative_lifecycle_events
-- ============================================================================
--
-- Sem FK para `representatives` — decisão deliberada, mesma razão de
-- `representative_delete_audit_log` (`20260909000000`): o propósito inteiro
-- desta tabela é o marco sobreviver mesmo que a linha de origem
-- (`representatives`/`product_activations`) seja apagada depois. Uma FK
-- `NO ACTION` teria o efeito oposto do pretendido (bloquear o DELETE do pai
-- em vez de deixar o marco sobreviver a ele) ou, com `ON DELETE CASCADE`,
-- apagaria o próprio marco histórico junto — exatamente o bug que esta
-- tabela existe para fechar.
--
-- Idempotência por CONSTRAINT, não por disciplina de código: `unique
-- (representative_id, event_type)` garante no máximo uma linha por marco,
-- para qualquer chamador, mesmo sob retry/corrida — nenhum dos três eventos
-- desta tabela é, por definição de negócio, algo que acontece mais de uma
-- vez por representante (todos são "primeira vez que X aconteceu").
--
-- PII: nenhuma. `representative_id` é um identificador opaco (mesmo
-- raciocínio de `representative_delete_audit_log`); `metadata` guarda só
-- referências técnicas não-pessoais (qual `product_id`, qual tipo de
-- resultado) — nunca nome/telefone/cidade/e-mail/authorization_id.

create table public.representative_lifecycle_events (
  id                 bigint generated always as identity primary key,
  representative_id  uuid not null,
  event_type         text not null
                       check (event_type in (
                         'representative_registered',
                         'first_page_published',
                         'first_result'
                       )),
  occurred_at        timestamptz not null default now(),
  source             text not null,
  metadata           jsonb,
  unique (representative_id, event_type)
);

create index representative_lifecycle_events_representative_id_idx
  on public.representative_lifecycle_events (representative_id);

alter table public.representative_lifecycle_events enable row level security;
-- Deliberadamente zero policies — mesmo padrão de billing_events/
-- billing_reconciliation_log/representative_delete_audit_log: RLS habilitada
-- e sem nenhuma policy nega SELECT/INSERT/UPDATE/DELETE a qualquer role
-- sujeita a RLS (anon, authenticated — nenhum dos dois recebe grant nenhum
-- nesta tabela). Só service_role (BYPASSRLS) e uma sessão de
-- superusuário/table-owner via SQL Editor alcançam esta tabela diretamente;
-- todo INSERT legítimo acontece de dentro das funções SECURITY DEFINER
-- abaixo, nunca por um caminho de escrita exposto diretamente a
-- anon/authenticated.

comment on table public.representative_lifecycle_events is
  'Marcos históricos append-only do funil Stage 1 (SET-116, docs/plans/AUDIT_STAGE_1_KPI_HISTORICAL_INTEGRITY_2026-09-01.md) — no máximo uma linha por (representative_id, event_type), escrita pela primeira (e única) vez que o marco ocorre. Não é um event bus genérico: só os três tipos no CHECK constraint são válidos.';

-- ============================================================================
-- register_representative — redefinida, MESMA assinatura externa
-- (mesmo padrão de 20260813000000/20260901000000: create or replace com
-- assinatura idêntica preserva os grants já concedidos a `authenticated`).
-- Único trecho novo: o INSERT do marco `representative_registered`, na
-- MESMA transação do INSERT de `representatives`/`subscriptions` — nunca
-- uma escrita separada que pudesse deixar o marco ausente se falhasse
-- depois do representative já ter sido criado.
-- ============================================================================

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

  -- SET-116: marco lifetime, mesma transação — se o INSERT de
  -- representatives/subscriptions acima falhar, esta linha nunca é gravada
  -- (rollback do bloco inteiro); se a função inteira tiver sucesso, o marco
  -- sempre existe junto com o representative que ele descreve.
  insert into public.representative_lifecycle_events (representative_id, event_type, source)
  values (v_new_id, 'representative_registered', 'register_representative')
  on conflict (representative_id, event_type) do nothing;

  return query select 'created'::text, v_new_id;
end;
$$;

-- ============================================================================
-- set_activation_status — redefinida, MESMA assinatura externa.
--
-- `published_at` continua exatamente com o comportamento operacional atual
-- (nunca alterado por esta migration): `coalesce(v_published_at, now())` já
-- preservava, e continua preservando, o valor original de UMA LINHA de
-- `product_activations` através de ciclos unpublish→republish daquela
-- mesma linha — não é reescrito silenciosamente aqui. O que esta migration
-- adiciona é o marco `first_page_published`, no nível do REPRESENTANTE (não
-- da linha de activation), sobrevivendo mesmo que a linha de
-- `product_activations` específica seja apagada e recriada, ou que um
-- produto diferente seja o primeiro a publicar no futuro.
-- ============================================================================

create or replace function public.set_activation_status(p_product_id uuid, p_status text)
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

  -- SET-116: marco lifetime no nível do representante, mesma transação da
  -- publicação. `on conflict do nothing` é o que faz a Teste 4 do hardening
  -- (unpublish → republish, inclusive de um produto diferente) nunca gerar
  -- uma segunda linha nem mover o timestamp original.
  insert into public.representative_lifecycle_events (representative_id, event_type, source, metadata)
  values (v_representative_id, 'first_page_published', 'set_activation_status', jsonb_build_object('product_id', p_product_id))
  on conflict (representative_id, event_type) do nothing;

  return query select 'updated'::text, v_activation_id, v_new_published_at;
end;
$$;

-- ============================================================================
-- record_whatsapp_click — redefinida, MESMA assinatura externa (já inclui
-- p_origin desde 20260908000002).
-- ============================================================================

create or replace function public.record_whatsapp_click(
  p_representative_slug text,
  p_product_slug text,
  p_referrer text,
  p_ip_hash text,
  p_user_agent text,
  p_origin text default null::text
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
  v_origin text;
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

  v_origin := case when public.is_valid_origin(p_origin) then p_origin else null end;

  insert into public.analytics_events (representative_id, product_id, event_type, referrer, ip_hash, origin)
  values (v_representative_id, v_product_id, 'whatsapp_click', left(p_referrer, 2048), p_ip_hash, v_origin);

  -- SET-116: marco `first_result` — primeira vez, na vida deste
  -- representante, que um whatsapp_click OU um lead aconteceu. Não checa
  -- janela de 30 dias aqui (isso é uma leitura do KPI 9 no coletor,
  -- comparando este timestamp contra `first_page_published`) — é um fato
  -- incondicional "isto já aconteceu alguma vez", monotônico por
  -- construção (on conflict do nothing).
  insert into public.representative_lifecycle_events (representative_id, event_type, source, metadata)
  values (v_representative_id, 'first_result', 'record_whatsapp_click', jsonb_build_object('result_type', 'whatsapp_click'))
  on conflict (representative_id, event_type) do nothing;

  return true;
end;
$$;

-- ============================================================================
-- submit_lead — redefinida, MESMA assinatura externa (já inclui p_origin
-- desde 20260908000002).
-- ============================================================================

create or replace function public.submit_lead(
  p_representative_id uuid,
  p_product_id uuid,
  p_telefone_e164 text,
  p_nome text,
  p_cidade text,
  p_email text,
  p_origem text,
  p_referrer text,
  p_ip_hash text,
  p_origin text default null::text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempts int;
  v_origin text;
begin
  if p_ip_hash is null or length(trim(p_ip_hash)) = 0 then
    return false;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_ip_hash, 0));

  select count(*) into v_attempts
  from public.lead_submission_attempts
  where ip_hash = p_ip_hash
    and attempted_at > now() - interval '3600 seconds';

  if v_attempts >= 5 then
    return false;
  end if;

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

  if not private.is_page_publicly_accessible(p_representative_id, p_product_id) then
    insert into public.lead_submission_attempts (ip_hash) values (p_ip_hash);
    return false;
  end if;

  v_origin := case when public.is_valid_origin(p_origin) then p_origin else null end;

  insert into public.leads (representative_id, product_id, telefone_e164, campos, origem, referrer, origin)
  values (
    p_representative_id,
    p_product_id,
    p_telefone_e164,
    jsonb_strip_nulls(jsonb_build_object('nome', p_nome, 'cidade', p_cidade, 'email', p_email)),
    p_origem,
    p_referrer,
    v_origin
  );

  -- SET-116: mesmo marco `first_result` de record_whatsapp_click acima —
  -- lead e whatsapp_click são sinais paralelos que ambos satisfazem "já
  -- teve resultado alguma vez" (KPI 9, regra OR, nunca sequencial).
  insert into public.representative_lifecycle_events (representative_id, event_type, source, metadata)
  values (p_representative_id, 'first_result', 'submit_lead', jsonb_build_object('result_type', 'lead'))
  on conflict (representative_id, event_type) do nothing;

  insert into public.lead_submission_attempts (ip_hash) values (p_ip_hash);

  delete from public.lead_submission_attempts
  where ip_hash = p_ip_hash
    and attempted_at <= now() - interval '1 day';

  return true;
end;
$$;

-- ============================================================================
-- Backfill — determinístico, a partir de colunas já existentes, nunca
-- inventado. Classificação de cada bloco documentada no comentário acima
-- dele e em docs/plans/AUDIT_STAGE_1_KPI_HISTORICAL_INTEGRITY_2026-09-01.md.
-- Idempotente (`on conflict do nothing`) — seguro reaplicar.
-- ============================================================================

-- EXACT_BACKFILL — representative_registered: representatives.created_at é
-- o timestamp literal do INSERT (nunca sobrescrito por nenhum código deste
-- projeto; confirmado em produção, no audit anterior, que created_at =
-- updated_at para todos os representatives vivos).
insert into public.representative_lifecycle_events (representative_id, event_type, occurred_at, source)
select id, 'representative_registered', created_at, 'backfill_20260910'
from public.representatives
on conflict (representative_id, event_type) do nothing;

-- EXACT_BACKFILL, com ressalva explícita — first_page_published:
-- `min(published_at)` entre as ativações já `published`/`unpublished` do
-- representante. `published_at` já é preservado (coalesce) através de
-- ciclos unpublish→republish DENTRO da mesma linha de product_activations
-- desde que essa função existe (20260807000000) — este backfill lê esse
-- valor diretamente, sem fórmula/estimativa. A ressalva que o torna "com
-- ressalva" em vez de absoluto: assume que nenhuma linha de
-- product_activations relevante foi apagada e recriada antes desta
-- migration rodar — a mesma suposição que toda leitura de KPI 2/3/9 já
-- fazia implicitamente antes desta migration existir, agora só tornada
-- explícita.
insert into public.representative_lifecycle_events (representative_id, event_type, occurred_at, source, metadata)
select distinct on (pa.representative_id)
  pa.representative_id, 'first_page_published', pa.published_at, 'backfill_20260910',
  jsonb_build_object('product_id', pa.product_id)
from public.product_activations pa
where pa.status in ('published', 'unpublished') and pa.published_at is not null
order by pa.representative_id, pa.published_at asc
on conflict (representative_id, event_type) do nothing;

-- EXACT_BACKFILL, mesma ressalva — first_result: `min(created_at)` entre
-- whatsapp_click (analytics_events) e leads do representante. Mesma
-- suposição de integridade (nenhuma linha relevante apagada antes desta
-- migration) — verificado, no audit de KPI, que o dado real de produção
-- hoje está inteiramente dentro da janela de retenção (12/24 meses), então
-- a purga automática não é uma explicação alternativa plausível para o
-- estado atual.
insert into public.representative_lifecycle_events (representative_id, event_type, occurred_at, source, metadata)
select distinct on (combined.representative_id)
  combined.representative_id, 'first_result', combined.occurred_at, 'backfill_20260910',
  jsonb_build_object('result_type', combined.result_type)
from (
  select representative_id, created_at as occurred_at, 'whatsapp_click' as result_type
  from public.analytics_events
  where event_type = 'whatsapp_click'
  union all
  select representative_id, created_at as occurred_at, 'lead' as result_type
  from public.leads
) combined
order by combined.representative_id, combined.occurred_at asc
on conflict (representative_id, event_type) do nothing;

-- ============================================================================
-- DEFERRED_AS_ALREADY_COVERED — trial_started / became_paying / canceled
-- ============================================================================
--
-- Não duplicados nesta tabela, por decisão explícita (§29 do pedido:
-- "Marcos de billing podem continuar usando billing_events se esse modelo
-- já for suficiente"):
--
-- trial_started: `subscriptions.created_at` já é o timestamp exato e
-- imutável do início do trial — `register_representative()` cria a linha
-- de `subscriptions` atomicamente com o representative (20260901000000);
-- nenhum código deste projeto jamais faz um segundo INSERT em
-- `subscriptions` para o mesmo representative (unique constraint em
-- `representative_id`, e o próprio teste de integração
-- `trial-lifecycle.integration.test.ts` prova que uma segunda chamada não
-- concede um segundo trial); nenhum código faz DELETE em `subscriptions`.
-- Duplicar este fato aqui não adicionaria nenhuma garantia que
-- `subscriptions.created_at` já não desse.
--
-- became_paying: `billing_events` (20260827000000) é append-only de
-- verdade (nenhum UPDATE/DELETE em nenhum código lido) — `min(created_at)
-- where subscription_id = X and outcome = 'applied' and event_type in
-- (CHECKOUT_PAID/PAYMENT_CONFIRMED/PAYMENT_RECEIVED)` já responde "quando
-- este representante se tornou pagante pela primeira vez" com a mesma
-- garantia de imutabilidade que esta migration daria a um evento próprio.
--
-- canceled: parcialmente coberto. `confirm_own_subscription_cancellation()`
-- (20260902000000) já grava uma linha de `feedback_responses` na MESMA
-- transação que `status = 'canceled'` — mas `feedback_responses` PODE ser
-- apagada (eliminação LGPD de um representative apaga todas as suas
-- linhas) e PODE ser atualizada (shown_at → answered_at). Isso já é uma
-- limitação conhecida e aceita (KPI 12, D4 — cancelamento nativo do Asaas
-- ainda não é reconhecido por apply_billing_event(), P1 follow-up já
-- registrado, não desta tarefa). Persistir um `canceled` imutável aqui
-- resolveria só a mutabilidade de `feedback_responses`, não a lacuna maior
-- (cancelamento fora do fluxo do app) — fora do escopo mínimo priorizado
-- por este pedido (§29: só representative_registered, first_page_published,
-- first_result, coletor). Registrado como dívida consciente, não esquecida.
