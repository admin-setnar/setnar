-- SET-84 D3 (docs/plans/SET-84_DIVULGACAO_LEAN_PLAN.md §1/§2) — mesma coluna
-- `origin`, agora em `leads`. Migration nova; nenhuma já aplicada é editada
-- (regra do README.md).
--
-- Conceito deliberadamente separado de `leads.origem` (existente desde
-- 20260731000000_create_representative_domain.sql): `origem` identifica a
-- superfície de captura (`commercial_page`, escrito por
-- `commercial-lead-form.tsx`), `origin` identifica o canal de divulgação que
-- trouxe o visitante até essa visita — o próprio plano (§0) registra que o
-- Referer da submissão tende a ser a própria Commercial Page e não preserva
-- Instagram/WhatsApp/QR, daí a necessidade de um campo novo em vez de
-- reaproveitar `origem`.
--
-- Mesma forma/constraint de `analytics_events.origin`
-- (20260908000000_add_origin_to_analytics_events.sql): nullable, texto +
-- check contra a mesma allowlist de 5 valores, sincronizada com
-- `ORIGIN_IDS` (TypeScript) por `tests/origin-allowlist-sync.test.ts`.

alter table public.leads
  add column origin text;

alter table public.leads
  add constraint leads_origin_check
  check (origin is null or origin in ('instagram_post', 'instagram_story', 'whatsapp', 'qrcode', 'direct'));
