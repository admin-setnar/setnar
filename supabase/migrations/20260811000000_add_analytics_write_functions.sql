-- AN2 + AN4 (docs/QR_ANALYTICS_PLAN.md §4) — as duas funções SECURITY
-- DEFINER que escrevem em `analytics_events` (AN1,
-- `20260810000000_add_analytics_events.sql`): `record_page_visit` e
-- `record_whatsapp_click`. O wiring no app ([productSlug]/page.tsx e
-- WhatsappCta são AN3/AN5) NÃO está aqui de propósito — passos seguintes,
-- revisados separadamente. Migration nova; nenhuma já aplicada é editada
-- (regra do README.md).
--
-- Uma migration só para as duas funções, não duas: elas são a mesma forma
-- (mesmos parâmetros, mesma resolução, mesmo filtro de bot, mesmo desenho de
-- rate limit, só o `event_type` e o limiar mudam), foram pedidas e são
-- revisadas como uma unidade ("AN2 + AN4"), e compartilham o helper de bot
-- abaixo — não há benefício em separar o que sempre anda junto, ao contrário
-- de `submit_lead`/`20260802000000` (que são a MESMA função em dois momentos
-- no tempo — criação e correção —, não duas funções irmãs nascendo juntas).
--
-- ============================================================================
-- Forma geral: `submit_lead` é o precedente, não um modelo novo
-- ============================================================================
--
-- Mesma decisão de §3.6 do plano (não é uma escolha nova: o chamador de
-- ambas é sempre anônimo — o visitante de uma Commercial Page nunca está
-- logado —, e este projeto já resolveu essa categoria com função SECURITY
-- DEFINER, não policy de INSERT para `anon`, em `submit_lead`). Reaproveitado
-- daqui:
--   - Retorno `boolean`, sem distinguir rate-limited de inválido (mesmo
--     anti-enumeration de `submit_lead`).
--   - Limiares de rate limit como literais FIXOS dentro da função, nunca
--     parâmetro do chamador — a lição do ADR-036 (uma versão anterior de
--     `submit_lead` aceitava os limiares do chamador, e um RPC direto usava
--     isso para desativar o próprio rate limit).
--   - `revoke execute on function ... from public` seguido de `grant
--     execute ... to anon, authenticated` EXPLÍCITO nas duas funções — nunca
--     dependendo de `ALTER DEFAULT PRIVILEGES`. Releia o ADR-048 antes de
--     mexer nisto: o vazamento anterior não veio de um `grant` errado, veio
--     de um default privilege de schema que concedia a `anon` por fora de
--     qualquer `create or replace function`. O double-check daquele ADR
--     (`information_schema.role_routine_grants` + RPC HTTP cru sem
--     `Authorization`) é obrigatório para as duas funções abaixo antes deste
--     passo ser considerado concluído — ver `supabase/README.md`, passo 15.
--
-- ============================================================================
-- Diferença deliberada de `submit_lead`: resolve por slug+slug, nunca por id
-- ============================================================================
--
-- `submit_lead` recebe `p_representative_id`/`p_product_id` porque seu
-- chamador (`/api/leads/route.ts`) já resolveu a ativação a partir do `Host`
-- (`resolveRepresentativeActivation`) antes de chamar o RPC — os ids que ele
-- passa já vieram de uma resolução própria, e a função os revalida (mesma
-- ativação, `published`, representante `active`) como segunda checagem.
--
-- Aqui a escolha é diferente: `p_representative_slug`/`p_product_slug` — os
-- dois textos públicos que qualquer visitante de uma Commercial Page já
-- conhece só de estar na página (o subdomínio É `representatives.slug`,
-- ADR-026; o segmento de path É `products.slug`) — e a função faz a
-- resolução INTEIRA sozinha, sem receber nenhum id do chamador. A vantagem
-- não é esconder algo que já não seja público (`representatives_select_public`/
-- `product_activations_select_published` já expõem esses ids a qualquer
-- chave publicável, exatamente como
-- `tests/lead-submission.integration.test.ts`'s `findPublishedActivation`
-- já demonstra) — é que a checagem de segurança da função fica
-- autocontida: não herda confiança de uma resolução feita em outro lugar do
-- código (o Server Component, a rota de API), que poderia divergir no futuro
-- sem que ninguém percebesse. Um chamador de RPC direto, fora do app por
-- completo, não ganha nada por conhecer um uuid interno — precisaria já
-- saber exatamente o que a URL pública já entrega.
--
-- ============================================================================
-- Filtro de bot (§3.2, estendido às duas funções — mesma decisão, não uma
-- segunda)
-- ============================================================================
--
-- §3.2 do plano fechou "filtro por User-Agent" pensando em
-- `record_page_visit` (visitas são a superfície mais exposta a
-- crawlers/preview bots). A mesma decisão se estende a
-- `record_whatsapp_click` aqui: é o mesmo tipo de tráfego sintético batendo
-- na mesma rota pública, e diferenciar as duas funções nesse ponto criaria
-- uma inconsistência sem motivo — um crawler que finge visitar a página tem
-- exatamente a mesma chance de também disparar o clique, se algum dia esse
-- clique for simulado por uma automação de teste/preview.
--
-- `is_bot_user_agent(text)` é um helper novo, não duplicado nas duas
-- funções, pela mesma razão que `is_own_representative()` (20260805000000)
-- existe: uma pergunta, um lugar. Deliberadamente NÃO é `security definer` —
-- não lê tabela nenhuma, é só correspondência de string sobre o parâmetro
-- recebido — então não precisa bypassar RLS nem rodar como dono. `language
-- sql immutable` (não `plpgsql`): função pura do parâmetro, sem leitura de
-- estado, elegível para inline pelo planner sem nenhuma das ressalvas que
-- 20260805000000 registra sobre `security definer` + inline (que só se
-- aplicam quando o inline anularia um bypass de RLS — não é o caso aqui).
--
-- Lista de substrings, case-insensitive: os quatro que o plano já cita
-- (`bot`, `crawler`, `spider`, `facebookexternalhit`, `whatsapp`) mais três
-- adicionados aqui — `curl`, `python-requests`, `headlesschrome` — clientes
-- sintéticos comuns (teste manual, scraping, monitoramento) que não contêm
-- nenhuma das substrings já listadas. `bot` sozinho já cobre a maioria dos
-- crawlers nomeados (googlebot, bingbot, telegrambot, slackbot, discordbot,
-- semrushbot, ahrefsbot, mj12bot terminam em "bot"). **Não é controle de
-- segurança, é redução de ruído** (§3.2) — permanece incompleto de
-- propósito, documentado, não uma promessa de filtragem completa.
--
-- Um `p_user_agent` nulo ou vazio NÃO é tratado como bot: browsers de
-- verdade sempre enviam User-Agent; tratá-lo como suspeito penalizaria um
-- visitante real com um browser que omite ou reduz esse header por
-- privacidade — o objetivo aqui é reduzir ruído sintético conhecido, não
-- suspeitar do desconhecido.
--
-- Uma chamada filtrada por este helper retorna `true` sem inserir nada e
-- sem consumir o rate limit — nunca `false`. Mesmo raciocínio
-- anti-enumeration de `submit_lead`, aplicado ao contrário: se o retorno
-- fosse diferente de uma inserção real, um bot descobriria, testando
-- variações do próprio User-Agent, exatamente quais substrings a lista
-- contém. Com `true` sempre, não há oráculo nenhum.
--
-- ============================================================================
-- Rate limit — dois limiares distintos, cada um com seu próprio motivo
-- ============================================================================
--
-- `record_page_visit`: 60 tentativas por 60 segundos, por `ip_hash`. Visita
-- é evento PASSIVO (dispara sozinho a cada carregamento de página, nunca por
-- ação deliberada do visitante) e se espera em volume bem maior que leads —
-- a janela curta (60s) permite navegação legítima rápida entre vários
-- produtos do mesmo representante (cada produto é uma Commercial Page
-- distinta) sem esbarrar no limite, enquanto ainda contém um script
-- inundando a tabela a mais de 1 requisição por segundo sustentada.
--
-- `record_whatsapp_click`: 5 tentativas por 3600 segundos — DELIBERADAMENTE
-- o mesmo par (limiar, janela) de `submit_lead`
-- (`20260802000000_fix_submit_lead_rate_limit.sql`), não um número novo
-- inventado. Motivo: `DOMAIN_MODEL.md` (Lead Attribution Service, §12)
-- descreve um clique no WhatsApp como um "conversion-intent Visitor Event"
-- — a mesma classe de ação deliberada que já justificou o limiar de leads,
-- não um evento passivo como a visita. Reaproveitar um limiar já testado
-- contra este banco (`tests/lead-submission.integration.test.ts`) é mais
-- defensável do que inventar um terceiro número sem precedente.
--
-- Cada limiar conta só dentro do próprio `event_type` — a query filtra
-- `event_type = 'visit'` (ou `'whatsapp_click'`) além de `ip_hash`, então
-- navegar bastante nunca consome o orçamento, bem mais apertado, dos
-- cliques, e vice-versa.
--
-- ============================================================================
-- Par inválido: NÃO consome o rate limit — divergência deliberada de
-- `submit_lead`, motivo é a forma de schema já decidida em AN1 (§3.5)
-- ============================================================================
--
-- Em `submit_lead`, um par inválido AINDA consome o limite
-- (`lead_submission_attempts` é uma tabela só de `(ip_hash, attempted_at)`,
-- sem referência a representative/product nenhuma — ela pode registrar
-- "uma tentativa aconteceu" sem precisar de um sujeito válido). Aqui não há
-- tabela irmã: `analytics_events` acumula as duas funções (dado reportável
-- E ledger de rate limit) numa peça só (decisão já fechada e aplicada em
-- AN1, §3.5) — e sua FK/NOT NULL em `representative_id`/`product_id` torna
-- estruturalmente impossível inserir uma linha "tentativa" sem um par já
-- válido. Não se resolve isso aqui alterando `20260810000000` (já aplicada,
-- regra do README.md não permite).
--
-- Risco residual, avaliado como baixo: um chamador pode sondar slugs
-- inválidos sem nunca ser rate-limited NESTE contador — mas (a) slug de
-- representante/produto já é informação pública (é a própria URL), sondar
-- não descobre nada que `representatives_select_public`/
-- `product_activations_select_published` já não expusessem; (b) nenhuma
-- linha é escrita nesse caminho — não há como um par inválido poluir os
-- dados de analytics de um representante real, que é o dano que o rate
-- limit existe para conter. O custo de uma sondagem assim é só round-trips
-- de banco rejeitados, não dado forjado nem exaustão do orçamento de
-- ninguém.
--
-- ============================================================================
-- Sem limpeza/purga dentro destas funções — diferente de `submit_lead`, de
-- propósito
-- ============================================================================
--
-- `submit_lead` apaga, ao final, as próprias linhas de
-- `lead_submission_attempts` mais antigas que 1 dia — seguro porque aquela
-- tabela não tem valor nenhum além do rate limit. `analytics_events` É o
-- dado reportável (AN6 lê exatamente estas linhas); apagar aqui destruiria
-- histórico real de visitas/cliques sob o pretexto de limpar rate limit.
-- Retenção/purga de `analytics_events` é AN7 — deliberadamente ainda em
-- aberto (`docs/QR_ANALYTICS_PLAN.md` §4) — e não é resolvida por estas
-- duas funções.
--
-- ============================================================================
-- `p_referrer`: truncado, nunca rejeitado — diferente de `nome`/`cidade` em
-- `submit_lead`
-- ============================================================================
--
-- `submit_lead` rejeita (retorna `false`) um `p_nome`/`p_cidade` grande
-- demais, porque ali o campo é parte do que está sendo validado como o
-- payload inteiro de um Lead. Aqui, o evento em si (uma visita aconteceu) já
-- é verdadeiro e valioso independente do tamanho do referrer — descartar o
-- evento inteiro por causa de um header HTTP hostil/atípico jogaria fora um
-- dado real por um motivo cosmético. `left(p_referrer, 2048)` trunca em vez
-- de rejeitar; `2048` é um teto generoso que só corta payloads patológicos,
-- bem acima de qualquer `Referer` real.
--
-- ============================================================================
-- `p_ip_hash` nulo/vazio: rejeitado explicitamente, defesa em profundidade
-- ============================================================================
--
-- `analytics_events.ip_hash` é `not null` (AN1). Sem esta checagem, um
-- `p_ip_hash` nulo vindo de um chamador de RPC direto (nunca do app, que
-- sempre calcula o hash antes de chamar — mesmo padrão de
-- `supabase-lead-gateway.ts`) faria a contagem de rate limit
-- (`ip_hash = p_ip_hash`) comparar contra NULL — nunca verdadeiro em SQL —
-- e o INSERT falhar com um erro cru de constraint em vez do `boolean`
-- tipado que esta função promete devolver sempre. A checagem abaixo fecha
-- essa lacuna antes de chegar a qualquer uma das duas consultas.

create or replace function public.is_bot_user_agent(p_user_agent text)
returns boolean
language sql
immutable
as $$
  select p_user_agent is not null
    and lower(p_user_agent) ~ '(bot|crawler|spider|facebookexternalhit|whatsapp|curl|python-requests|headlesschrome)';
$$;

revoke execute on function public.is_bot_user_agent(text) from public;
-- Deliberadamente NÃO concedido a anon/authenticated: só é chamado de dentro
-- do corpo de record_page_visit/record_whatsapp_click, que rodam como dono
-- (security definer) e por isso não precisam de concessão própria para
-- chamar um helper que o dono já pode executar.

create or replace function public.record_page_visit(
  p_representative_slug text,
  p_product_slug        text,
  p_referrer             text,
  p_ip_hash              text,
  p_user_agent           text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_representative_id uuid;
  v_product_id        uuid;
  v_attempts           int;
begin
  if p_ip_hash is null or length(trim(p_ip_hash)) = 0 then
    return false;
  end if;

  if public.is_bot_user_agent(p_user_agent) then
    return true;
  end if;

  select count(*) into v_attempts
  from public.analytics_events
  where ip_hash = p_ip_hash
    and event_type = 'visit'
    and created_at > now() - interval '60 seconds';

  if v_attempts >= 60 then
    return false;
  end if;

  select r.id, p.id
  into v_representative_id, v_product_id
  from public.representatives r
  join public.product_activations pa on pa.representative_id = r.id
  join public.products p on p.id = pa.product_id
  where r.slug = p_representative_slug
    and p.slug = p_product_slug
    and pa.status = 'published'
    and r.status = 'active';

  if v_representative_id is null then
    return false;
  end if;

  insert into public.analytics_events (representative_id, product_id, event_type, referrer, ip_hash)
  values (v_representative_id, v_product_id, 'visit', left(p_referrer, 2048), p_ip_hash);

  return true;
end;
$$;

revoke execute on function public.record_page_visit(text, text, text, text, text) from public;
grant execute on function public.record_page_visit(text, text, text, text, text) to anon, authenticated;

create or replace function public.record_whatsapp_click(
  p_representative_slug text,
  p_product_slug        text,
  p_referrer             text,
  p_ip_hash              text,
  p_user_agent           text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_representative_id uuid;
  v_product_id        uuid;
  v_attempts           int;
begin
  if p_ip_hash is null or length(trim(p_ip_hash)) = 0 then
    return false;
  end if;

  if public.is_bot_user_agent(p_user_agent) then
    return true;
  end if;

  select count(*) into v_attempts
  from public.analytics_events
  where ip_hash = p_ip_hash
    and event_type = 'whatsapp_click'
    and created_at > now() - interval '3600 seconds';

  if v_attempts >= 5 then
    return false;
  end if;

  select r.id, p.id
  into v_representative_id, v_product_id
  from public.representatives r
  join public.product_activations pa on pa.representative_id = r.id
  join public.products p on p.id = pa.product_id
  where r.slug = p_representative_slug
    and p.slug = p_product_slug
    and pa.status = 'published'
    and r.status = 'active';

  if v_representative_id is null then
    return false;
  end if;

  insert into public.analytics_events (representative_id, product_id, event_type, referrer, ip_hash)
  values (v_representative_id, v_product_id, 'whatsapp_click', left(p_referrer, 2048), p_ip_hash);

  return true;
end;
$$;

revoke execute on function public.record_whatsapp_click(text, text, text, text, text) from public;
grant execute on function public.record_whatsapp_click(text, text, text, text, text) to anon, authenticated;
