-- AN1 (docs/QR_ANALYTICS_PLAN.md §4) — a tabela de eventos de Analytics
-- (Básico): visitas e cliques no WhatsApp. Só o schema; as funções
-- SECURITY DEFINER que escrevem nela (`record_page_visit`/
-- `record_whatsapp_click`, AN2/AN4) e o wiring no app (AN3/AN5) são passos
-- seguintes, revisados separadamente — nada disso está aqui de propósito.
-- Migration nova; nenhuma já aplicada é editada (regra do README.md).
--
-- ============================================================================
-- As duas decisões que já estavam fechadas antes desta migration ser escrita
-- (docs/QR_ANALYTICS_PLAN.md §3.4/§3.5 — leia lá primeiro, esta migration só
-- executa o que já foi decidido)
-- ============================================================================
--
-- §3.5 — tabela de eventos crus, não contadores agregados: uma linha por
-- visita/clique, agregação calculada em tempo de leitura por AN6. É a única
-- forma que não precisa ser refeita quando o Stage 2 pedir breakdown por
-- dia/referrer/device.
--
-- §3.4 — abordagem conservadora de LGPD: sem cookie, sem fingerprint, IP
-- hasheado, contagem sempre agregada na leitura (nunca por visitante
-- identificável). O `ip_hash` mora NESTA tabela (não numa tabela irmã de
-- rate-limit, ao contrário de `lead_submission_attempts`/`login_attempts`)
-- porque aqui a linha cumpre as duas funções ao mesmo tempo: é o dado
-- reportável (o evento em si) E a chave que a futura `record_page_visit`/
-- `record_whatsapp_click` vai usar para o próprio rate limit — não existe,
-- para analytics, o par "dado de negócio permanente" / "artefato de rate
-- limit descartável" que justificou separar `leads` de
-- `lead_submission_attempts`. A consequência fica registrada, não resolvida
-- aqui: a purga de `ip_hash` (AN7, ainda em aberto) vai precisar decidir se
-- anula só a coluna depois de uma janela curta (mantendo a linha agregável)
-- ou se descarta a linha inteira — qualquer uma das duas é feita sobre o
-- schema abaixo sem precisar alterá-lo de novo.
--
-- ============================================================================
-- Confirmado antes de nomear a tabela: sem colisão
-- ============================================================================
--
-- Nem `analytics_events` nem `page_visits` (as duas opções que §3.5 cogitava)
-- existem em nenhuma migration já aplicada nem em `src/`. Nome escolhido:
-- `analytics_events` — `event_type` cobre `'visit'` E `'whatsapp_click'`;
-- `page_visits` nomearia só metade do que a tabela guarda.
--
-- ============================================================================
-- representative_id / product_id: os dois NOT NULL — diferente de
-- `leads.product_id` (nullable), de propósito
-- ============================================================================
--
-- A regra 13 do DOMAIN_MODEL.md exige que todo Analytics/Visitor Event
-- referencie exatamente uma Commercial Page ou exatamente uma Campaign —
-- nunca nenhuma, nunca as duas. Não existe tabela própria de "Commercial
-- Page" neste schema (ADR-029: uma Commercial Page é o par Representative ×
-- Product) e Campaign ainda não existe (Stage 2) — logo, no Stage 1, "exatamente
-- uma Commercial Page" só pode significar "representative_id E product_id
-- presentes", nunca um dos dois faltando. Deixar `product_id` nullable aqui,
-- espelhando `leads.product_id`, abriria uma linha sem Commercial Page
-- nenhuma associada — exatamente o que a regra 13 e a constraint 7 (Section
-- 17) proíbem. Nenhuma superfície de captura hoje
-- (`[productSlug]/page.tsx`, e o `WhatsappCta` dentro dela) é alcançável sem
-- um `productSlug` resolvido, então não há hoje nenhum caso de uso que
-- precise de `product_id` nulo aqui — se um dia existir uma página de
-- representante sem produto, aquele é o momento de decidir se este campo
-- vira nullable, não este.
--
-- Nenhuma FK composta contra `product_activations (representative_id,
-- product_id)` (que tem esse par como UNIQUE) — mesma escolha que `leads` já
-- fez: as FKs apontam para `representatives`/`products` isoladamente, e
-- confirmar que o par tem uma ativação `published` é responsabilidade da
-- futura função SECURITY DEFINER no momento da escrita (mesmo papel que
-- `submit_lead` já cumpre para `leads`), não uma constraint deste schema.
--
-- ============================================================================
-- Sem updated_at, sem trigger — de propósito
-- ============================================================================
--
-- A regra 14 do DOMAIN_MODEL.md ("Analytics data must never expose personally
-- identifying Visitor information") e a invariante do Metric Aggregate
-- ("Analytics data is append-only from the business perspective") descrevem
-- uma tabela que nunca é editada depois de escrita — mesmo formato de
-- `login_attempts`/`lead_submission_attempts` (sem updated_at, sem
-- `set_updated_at` trigger), não o de `representatives`/`product_activations`
-- (mutáveis, com trigger).
--
-- ============================================================================
-- Índices — um para AN6 (leitura agregada), um para AN2/AN4 (rate limit)
-- ============================================================================
--
-- `(representative_id, product_id, event_type)`: é o que a leitura agregada
-- de AN6 vai filtrar por primeiro (own-row, por ativação) e depois agrupar
-- por (`count(*) group by event_type`) — `event_type` compõe o índice para
-- que um filtro futuro por tipo (ex.: "só cliques") também use o mesmo
-- índice, não só o prefixo (representative_id, product_id).
--
-- `(ip_hash, created_at desc)`: mesma forma de
-- `lead_submission_attempts_ip_hash_idx`/`login_attempts_ip_hash_idx` —
-- adicionado agora, na criação da tabela, embora a função que faz a checagem
-- de rate limit (AN2/AN4) ainda não exista. O padrão de consulta
-- (`count(*) where ip_hash = ? and created_at > ...`) já é conhecido — é o
-- mesmo das outras duas tabelas de rate limit deste projeto — e criar o
-- índice agora, com a tabela vazia, é mais barato do que uma segunda
-- migration só para isso quando AN2 chegar.
--
-- ============================================================================
-- RLS: enabled, zero policies de escrita — só uma de leitura própria
-- ============================================================================
--
-- Mesmo padrão de `lead_submission_attempts`/`login_attempts`: a tabela só é
-- alcançável, para escrita, por uma função SECURITY DEFINER — que ainda não
-- existe (AN2/AN4). Nenhuma policy de INSERT é criada aqui, nem para `anon`
-- nem para `authenticated`.
--
-- A policy de SELECT reaproveita `is_own_representative()`
-- (`20260805000000_fix_rls_policy_cycle.sql`) em vez de repetir inline o
-- `exists (select 1 from representatives r where ...)` que `leads_select_own`
-- usa — mesma pergunta ("esta linha pertence ao representante da sessão
-- atual?"), já resolvida uma vez, sem duplicar pela terceira vez no projeto.
-- Nenhum ciclo de RLS é reintroduzido aqui: o ciclo que
-- 20260805000000_fix_rls_policy_cycle.sql corrigiu exigia DUAS arestas
-- (`representatives_select_public` consultando `product_activations` E
-- `product_activations_select_own` consultando `representatives` de volta);
-- `analytics_events` só tem a aresta de saída (consulta `representatives`
-- via `is_own_representative`) — nenhuma policy de `representatives` ou de
-- `product_activations` consulta `analytics_events` de volta, então não há
-- aresta de retorno para fechar um ciclo. `is_own_representative` já é
-- SECURITY DEFINER de qualquer forma, o que por si só remove `representatives`
-- do plano de execução da policy (mesmo mecanismo que 20260805000000
-- documenta).

create table public.analytics_events (
  id                 bigint generated always as identity primary key,
  representative_id  uuid not null references public.representatives (id),
  product_id         uuid not null references public.products (id),
  event_type         text not null check (event_type in ('visit', 'whatsapp_click')),
  referrer           text,
  ip_hash            text not null,
  created_at         timestamptz not null default now()
);

create index analytics_events_rep_product_type_idx
  on public.analytics_events (representative_id, product_id, event_type);

create index analytics_events_ip_hash_idx
  on public.analytics_events (ip_hash, created_at desc);

alter table public.analytics_events enable row level security;
-- Deliberadamente zero policies de escrita — só alcançável, para INSERT, por
-- uma função SECURITY DEFINER futura (AN2/AN4).

create policy "analytics_events_select_own"
  on public.analytics_events for select
  using (public.is_own_representative(analytics_events.representative_id));
