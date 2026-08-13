-- SET-73: implementa a purga automática decidida na SET-46
-- (docs/plans/DATA_RETENTION_DECISIONS_PLAN.md) para as duas categorias com
-- prazo fixo e sem rotina até agora: `leads` (24 meses) e `analytics_events`
-- (12 meses, fecha AN7 — pendente desde ADR-065/QR_ANALYTICS_PLAN.md).
-- Nenhuma outra tabela é tocada aqui: billing_events/
-- billing_reconciliation_log/subscriptions/feedback_responses não têm prazo
-- fixo decidido (mesma decisão), então ficam fora desta purga.
--
-- `leads` não tem coluna `updated_at` nem caminho de UPDATE nenhum hoje
-- (DOMAIN_MODEL.md §14.2: "Lead Pipeline is Conceptual in full: no Lead has
-- a status") — a linha é imutável desde o insert, então "última
-- atualização" (texto do plano de retenção) e `created_at` são a mesma
-- coisa na prática atual; se um dia existir um caminho de update de Lead,
-- este ponto precisa ser revisitado.
--
-- Mecanismo: `pg_cron`, não uma rotina de aplicação nem infraestrutura de
-- fila — `pg_cron` já está disponível como extensão neste projeto Supabase
-- (confirmado via `list_extensions`: listada, não instalada), então não
-- introduz a infraestrutura de job que
-- `docs/plans/SPRINT_E_PLAN.md` §2.4 registrou como deliberadamente ausente
-- do projeto. Diferente do padrão de "limpeza oportunista" já usado em
-- `login_attempts`/`lead_submission_attempts` (uma linha apagada a cada
-- nova tentativa, dentro do mesmo request, escopada à própria chave de
-- rate-limit) — aqui a varredura é sobre a tabela inteira, não escopada a
-- uma chave por request, então rodar dentro do caminho quente de escrita
-- (`submit_lead`/`record_page_visit`) adicionaria custo não-limitado a cada
-- requisição de usuário. Um job diário, fora do caminho de request, é o
-- desenho certo para este formato de purga. Ver ADR-086.

create extension if not exists pg_cron;

create or replace function public.purge_expired_retention_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.leads
  where created_at < now() - interval '24 months';

  delete from public.analytics_events
  where created_at < now() - interval '12 months';
end;
$$;

comment on function public.purge_expired_retention_data() is
  'Purga leads (24 meses) e analytics_events (12 meses) conforme docs/plans/DATA_RETENTION_DECISIONS_PLAN.md (SET-46). Agendada diariamente via pg_cron (job "purge-expired-retention-data"); também chamável sob demanda pelo service_role.';

-- Mesmo padrão de toda função SECURITY DEFINER de manutenção neste projeto
-- (ex.: apply_billing_event, submit_lead): revoga de público/anon/
-- authenticated e concede só a service_role — o job do pg_cron não passa
-- por este grant (roda a SQL diretamente, como o role que chamou
-- cron.schedule), a concessão aqui é só para permitir chamada sob demanda
-- pelo mesmo tipo de credencial server-only que scripts/reconcile-billing-
-- subscription.ts já usa.
revoke execute on function public.purge_expired_retention_data() from public;
revoke execute on function public.purge_expired_retention_data() from anon;
revoke execute on function public.purge_expired_retention_data() from authenticated;
grant execute on function public.purge_expired_retention_data() to service_role;

-- `cron.schedule` com um nome já existente atualiza o job em vez de
-- duplicar (pg_cron >= 1.4) — seguro reaplicar esta migration mais de uma
-- vez. 03:00 (fuso do servidor Postgres, tipicamente UTC no Supabase):
-- fora de qualquer janela de tráfego esperada para este produto.
select cron.schedule(
  'purge-expired-retention-data',
  '0 3 * * *',
  $$select public.purge_expired_retention_data();$$
);
