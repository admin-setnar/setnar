-- SET-84 D5 (docs/plans/SET-84_DIVULGACAO_LEAN_PLAN.md §2) — `origin`
-- (`analytics_events`, adicionada por
-- 20260908000000_add_origin_to_analytics_events.sql) nunca foi incluída na
-- grant de leitura por coluna de `authenticated`
-- (20260817000000_secure_analytics_and_public_access.sql:347-348). Essa
-- grant lista colunas explicitamente, de propósito — mesmo raciocínio já
-- documentado ali para excluir `ip_hash` — então uma coluna nova fica
-- invisível para `authenticated` até alguém reafirmar a grant
-- deliberadamente. D5 (breakdown de visitas/leads por origem, lido por
-- `listOwnBreakdownByOrigin`) precisa que o próprio representante consiga
-- ler `origin` das suas linhas; `ip_hash` continua excluído, sem mudança.
--
-- `grant select (origin)` é aditivo em Postgres — soma à grant por coluna já
-- existente, não a substitui; não precisa (e não deve) repetir a lista
-- inteira nem revogar antes.

grant select (origin)
  on table public.analytics_events to authenticated;
