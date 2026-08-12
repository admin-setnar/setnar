-- SET-48: trilha auditável de solicitações de direitos LGPD atendidas
-- manualmente — mesmo raciocínio de `billing_reconciliation_log` (SET-33,
-- 20260830000000): sem painel administrativo nem sistema de roles
-- (`docs/plans/SPRINT_E_PLAN.md` §2.4), a posse de
-- `SUPABASE_SERVICE_ROLE_KEY` é a própria autorização, e o "comando/script
-- protegido" é `scripts/execute-lgpd-request.ts`, nunca uma RPC exposta ao
-- cliente. Distinta de `billing_reconciliation_log`: audita operações sobre
-- dado pessoal de titulares (Representative ou Lead), não sobre o estado de
-- uma cobrança.
create table public.lgpd_request_log (
  id                     bigint generated always as identity primary key,
  actor                  text not null,
  reason                 text not null,
  -- Espelha os cinco direitos já prometidos em /privacidade §5. 'informacao'
  -- cobre tanto "confirmação de tratamento" quanto "com quem compartilhamos"
  -- — nenhuma das duas exige uma consulta própria, as duas são respondidas
  -- apontando para a política já publicada.
  right_exercised        text not null
                           check (right_exercised in (
                             'acesso', 'correcao', 'eliminacao', 'portabilidade', 'informacao'
                           )),
  subject_type           text not null check (subject_type in ('representative', 'lead')),
  representative_id      uuid references public.representatives (id),
  lead_id                uuid references public.leads (id),
  -- Como a identidade foi conferida antes de qualquer exposição/alteração
  -- (critério de aceite explícito da SET-48) — texto livre, nunca vazio:
  -- "e-mail da solicitação bate com auth.users.email" para Representative,
  -- ou o equivalente proporcional para Lead (ver LGPD_RIGHTS.md §3).
  identity_verification  text not null,
  -- Preenchido só quando uma exceção de retenção aprovada
  -- (DATA_RETENTION_DECISIONS_PLAN.md) impediu eliminar algo que o
  -- solicitante pediu — nunca um DROP/DELETE silencioso do que foi negado.
  retention_exception     text,
  outcome                text not null
                           check (outcome in (
                             'completed', 'partially_completed_retention_exception',
                             'no_data_found', 'denied_identity_unverified'
                           )),
  -- Só campos já estruturados (nunca o dado pessoal em si, mesmo padrão de
  -- billing_reconciliation_log.detail) — contagens, ids, nomes de coluna
  -- alterada, nunca o valor de um nome/telefone/e-mail.
  detail                 jsonb,
  created_at             timestamptz not null default now()
);

alter table public.lgpd_request_log enable row level security;
-- Deliberadamente zero policies — mesmo padrão de billing_reconciliation_log/
-- billing_events/analytics_events: só alcançável pelo service_role que o
-- script já usa para tudo; anon/authenticated nunca leem nem escrevem aqui.

comment on table public.lgpd_request_log is
  'Trilha auditável de solicitações de direitos LGPD atendidas manualmente via scripts/execute-lgpd-request.ts (SET-48) — quem executou, qual direito, como a identidade foi conferida, e o resultado.';
