-- SET-84 D3 (docs/plans/SET-84_DIVULGACAO_LEAN_PLAN.md §1/§2) — terceira e
-- última migration da atribuição mínima de origem: o helper de validação e
-- as três funções SECURITY DEFINER que passam a aceitar `p_origin`.
-- Migration nova; nenhuma já aplicada é editada (regra do README.md).
--
-- ============================================================================
-- is_valid_origin: mesmo padrão de is_bot_user_agent
-- (20260811000000_add_analytics_write_functions.sql) — uma pergunta, uma
-- função pura, não duplicada nas três funções que a chamam
-- ============================================================================
--
-- `language sql immutable`, não `plpgsql`: função pura do parâmetro, sem
-- leitura de estado, mesmo raciocínio de `is_bot_user_agent` para não
-- precisar de nenhuma das ressalvas de `security definer` + inline que
-- 20260805000000_fix_rls_policy_cycle.sql registra (não se aplicam aqui —
-- não há bypass de RLS em jogo).
--
-- A allowlist abaixo é a MESMA lista de 5 valores de `ORIGIN_IDS`
-- (`src/modules/analytics/domain/origin.ts`) e das duas constraints já
-- aplicadas (`analytics_events_origin_check`, `leads_origin_check`,
-- 20260908000000/20260908000001). TypeScript é a fonte canônica (D3); esta
-- allowlist SQL é escrita à mão porque SQL não importa TS — sincronizada com
-- `ORIGIN_IDS` por `tests/origin-allowlist-sync.test.ts`, que falha se
-- divergirem. Qualquer origem nova exige editar as três (`ORIGIN_IDS`, esta
-- função, as duas constraints) e deixar o teste confirmar.
--
-- Retorna `false` para `null` e para qualquer valor fora da lista — nunca
-- lança erro. É assim que as três funções abaixo cumprem o requisito da
-- Issue "origem inválida deve degradar para null/direct, nunca quebrar a
-- página": um `?src=` forjado ou desconhecido vira `origin = null` no INSERT,
-- não uma exceção que derrubaria a visita/lead inteiros.
create or replace function public.is_valid_origin(p_origin text)
returns boolean
language sql
immutable
as $$
  select p_origin is not null
    and p_origin in ('instagram_post', 'instagram_story', 'whatsapp', 'qrcode', 'direct');
$$;

revoke execute on function public.is_valid_origin(text) from public;
-- Deliberadamente NÃO concedido a anon/authenticated/service_role: só é
-- chamado de dentro do corpo das três funções abaixo, que já rodam como dono
-- (security definer) e por isso não precisam de concessão própria para
-- chamar um helper que o dono já pode executar — mesmo raciocínio já
-- documentado para is_bot_user_agent.

-- ============================================================================
-- record_page_visit / record_whatsapp_click — ganham p_origin
-- ============================================================================
--
-- `p_origin text default null`: parâmetro NOVO ao final da assinatura, com
-- default. Isso preserva os dois requisitos que o plano (§1.2, "Ordem de
-- implementação") já separa em passos diferentes: esta migration (passo 2)
-- só muda schema/RPC; o wiring do `?src=` no app ([productSlug]/page.tsx →
-- WhatsappCta/CommercialLeadForm) é passo 4, ainda não escrito. Um default
-- garante que o caller atual (`SupabaseAnalyticsGateway.record`, que hoje não
-- envia `p_origin`) continua funcionando sem alteração até o passo 4 chegar —
-- requisito explícito da Issue: "Fluxos sem `src` continuam funcionando sem
-- regressão".
--
-- `drop function if exists` antes de recriar com a assinatura nova: mesmo
-- padrão que `20260802000000_fix_submit_lead_rate_limit.sql` já usa ao
-- adicionar/remover parâmetros de uma função. Necessário porque
-- `create or replace function` com uma lista de parâmetros diferente não
-- substitui a função existente — cria um SEGUNDO overload, que nasceria com
-- EXECUTE aberto a PUBLIC por padrão (a mesma classe de vazamento do
-- ADR-048) até um `revoke`/`grant` explícito, e ainda deixaria dois
-- overloads do mesmo nome coexistindo, o que o PostgREST não consegue
-- despachar sem ambiguidade quando os parâmetros novos têm default. Sem o
-- drop, restaria ambos: a 5-arg antiga E a 6-arg nova.
--
-- Todo o resto do corpo (resolução por slug+slug via
-- `private.is_page_publicly_accessible`, filtro de bot, rate limit, `insert`)
-- é copiado de `20260817000000_secure_analytics_and_public_access.sql` sem
-- alteração de comportamento — só a coluna `origin` é nova no INSERT.

drop function if exists public.record_page_visit(text, text, text, text, text);

create or replace function public.record_page_visit(
  p_representative_slug text,
  p_product_slug text,
  p_referrer text,
  p_ip_hash text,
  p_user_agent text,
  p_origin text default null
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
    and event_type = 'visit'
    and created_at > now() - interval '60 seconds';
  if v_attempts >= 60 then return false; end if;

  v_origin := case when public.is_valid_origin(p_origin) then p_origin else null end;

  insert into public.analytics_events (representative_id, product_id, event_type, referrer, ip_hash, origin)
  values (v_representative_id, v_product_id, 'visit', left(p_referrer, 2048), p_ip_hash, v_origin);
  return true;
end;
$$;

drop function if exists public.record_whatsapp_click(text, text, text, text, text);

create or replace function public.record_whatsapp_click(
  p_representative_slug text,
  p_product_slug text,
  p_referrer text,
  p_ip_hash text,
  p_user_agent text,
  p_origin text default null
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
  return true;
end;
$$;

revoke execute on function public.record_page_visit(text, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.record_whatsapp_click(text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.record_page_visit(text, text, text, text, text, text) to service_role;
grant execute on function public.record_whatsapp_click(text, text, text, text, text, text) to service_role;

-- ============================================================================
-- submit_lead — ganha p_origin
-- ============================================================================
--
-- Mesmo raciocínio de default + drop/recreate acima. `p_origin` entra ao
-- final da assinatura (depois de `p_ip_hash`, antes de nenhum outro
-- parâmetro — não existe `p_max_attempts_ip`/`p_window_seconds` desde
-- 20260802000000). Deliberadamente SEPARADO de `p_origem` (existente,
-- superfície de captura) — os dois parâmetros e as duas colunas convivem
-- sem se sobrescrever, exatamente como o plano (§0, §1) exige.
--
-- Resto do corpo copiado de
-- 20260821000000_apply_canonical_access_to_leads.sql (a versão atualmente
-- aplicada) sem alteração de comportamento — lock, rate limit, validação de
-- payload, `is_page_publicly_accessible`, anti-enumeration — só a coluna
-- `origin` é nova no INSERT.

drop function if exists public.submit_lead(uuid, uuid, text, text, text, text, text, text, text);

create or replace function public.submit_lead(
  p_representative_id uuid,
  p_product_id        uuid,
  p_telefone_e164     text,
  p_nome              text,
  p_cidade            text,
  p_email             text,
  p_origem            text,
  p_referrer          text,
  p_ip_hash           text,
  p_origin            text default null
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

  insert into public.lead_submission_attempts (ip_hash) values (p_ip_hash);

  delete from public.lead_submission_attempts
  where ip_hash = p_ip_hash
    and attempted_at <= now() - interval '1 day';

  return true;
end;
$$;

revoke execute on function public.submit_lead(
  uuid, uuid, text, text, text, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.submit_lead(
  uuid, uuid, text, text, text, text, text, text, text, text
) to service_role;
