-- SET-84 D3 (docs/plans/SET-84_DIVULGACAO_LEAN_PLAN.md §1/§2) — atribuição
-- mínima de origem: coluna `origin` em `analytics_events`. Migration nova;
-- nenhuma já aplicada é editada (regra do README.md).
--
-- Nullable, mesma forma de `event_type` (texto + check), não um tipo `ENUM`
-- do Postgres — decisão D3 do plano: a lista canônica vive em TypeScript
-- (`src/modules/analytics/domain/origin.ts`, `ORIGIN_IDS`); a constraint
-- abaixo é barreira de integridade sincronizada com aquela lista por
-- `tests/origin-allowlist-sync.test.ts`, não uma segunda fonte de verdade.
-- Nullable também garante o requisito explícito da Issue: um fluxo sem
-- `?src=` continua funcionando sem regressão, gravando `origin = null`.
--
-- `origin` descreve o mecanismo de entrada da visita atual (por qual
-- link/QR a pessoa entrou) — não um modelo de campanha/attribution nem
-- `referrer` (§1.1 do plano; os dois conceitos não são reaproveitados um
-- pelo outro). Validação real (allowlist server-side + degradação de valor
-- inválido para `null`, nunca rejeição) é responsabilidade de
-- `is_valid_origin`/`record_page_visit`/`record_whatsapp_click`
-- (`20260908000002_add_origin_write_functions.sql`, próxima migration desta
-- sequência) — a constraint aqui é só a última barreira contra um INSERT
-- direto malformado, não o mecanismo de validação em si.

alter table public.analytics_events
  add column origin text;

alter table public.analytics_events
  add constraint analytics_events_origin_check
  check (origin is null or origin in ('instagram_post', 'instagram_story', 'whatsapp', 'qrcode', 'direct'));
