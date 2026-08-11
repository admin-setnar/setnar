### ADR-086 — Purga de retenção via `pg_cron`, não pelo caminho quente de escrita (SET-73)
**Status.** Accepted. **Date.** 2026-08-11.

**Contexto.** SET-46 (`docs/plans/DATA_RETENTION_DECISIONS_PLAN.md`) decidiu prazos fixos
para duas categorias sem rotina de purga: `leads` (24 meses) e `analytics_events` (12 meses,
fecha o item AN7, em aberto desde ADR-065/`QR_ANALYTICS_PLAN.md`). A própria SET-46 excluiu
de escopo "implementar jobs" — essa é a SET-73, resolvida por esta ADR.

**Por que `pg_cron`, e não o padrão de "limpeza oportunista" já usado em
`login_attempts`/`lead_submission_attempts`.** Essas duas tabelas já purgam sozinhas: cada
chamada de `submit_lead`/tentativa de login apaga, dentro do mesmo request, só as linhas da
própria chave de rate-limit mais antigas que a janela — um `delete` sempre pequeno e
escopado. `leads`/`analytics_events` não têm essa chave: a purga aqui é uma varredura sobre a
tabela inteira, que só cresce. Rodar esse `delete` dentro do caminho quente de escrita
(`submit_lead`/`record_page_visit`) adicionaria um custo não-limitado a cada requisição de
usuário — o request que por acaso disparasse a varredura pagaria por ela sozinho, e o custo
sobe com o tamanho da tabela, não com o tráfego. Um job fora do caminho de request é o desenho
certo para este formato.

`docs/plans/SPRINT_E_PLAN.md` §2.4 registrou que este projeto não tem infraestrutura de
job/fila própria, de propósito. `pg_cron` não contradiz isso: já está disponível como
extensão no projeto Supabase (confirmado via `list_extensions` — listada, não instalada) e
roda dentro do próprio Postgres, sem processo novo, sem credencial nova, sem infraestrutura
externa — o mesmo espírito de "sem job" que já levou a preferir webhooks a polling em
`BILLING_DECISIONS_PLAN.md` §1.

**Decisão.** `supabase/migrations/20260904000000_add_retention_purge_job.sql`: habilita
`pg_cron`, cria `purge_expired_retention_data()` (`security definer`, `set search_path =
public`, revogada de `public`/`anon`/`authenticated`, concedida só a `service_role` — mesmo
padrão de toda função de manutenção do projeto), e agenda via `cron.schedule(...)` para rodar
diariamente às 03:00. A função apaga `leads` com `created_at` anterior a 24 meses e
`analytics_events` com `created_at` anterior a 12 meses — nenhuma outra tabela.

**Por que `created_at`, não "última atualização" (texto literal do plano de retenção).**
`leads` não tem coluna `updated_at` nem caminho de `UPDATE` nenhum hoje —
`DOMAIN_MODEL.md` §14.2 já registra que "Lead Pipeline is Conceptual in full: no Lead has a
status". Uma linha de `leads` é imutável desde o insert, então "última atualização" e
`created_at` são a mesma coisa na prática atual. Se um dia existir edição de Lead (pipeline
real), este ponto precisa ser revisitado — não é uma divergência da decisão da SET-46, é a
mesma decisão aplicada ao schema como ele existe hoje.

**Verificação.** `tests/retention-purge.integration.test.ts` — insere uma linha antiga e uma
recente em cada tabela via `service_role` (que ignora RLS, mesmo padrão de todo teste de
integração deste projeto), chama a função, confirma que só a recente sobrevive, e confirma
separadamente que `anon` não tem `EXECUTE`. **Não pôde ser exercitado contra um projeto real
nesta sessão**: o projeto Supabase configurado em `.env.local`
(`smspbjmqhpjcjilzoexr`) é o mesmo que ADR-083 já registrou como `MIGRATIONS_FAILED` —
está sem sincronizar com `supabase/migrations/` há várias migrations (nem a
`20260903000000` da SET-71 chegou lá). O teste degrada graciosamente para essa realidade
(pula com uma mensagem clara em vez de falhar) em vez de assumir um ambiente que não existe —
mesma postura que `requirePair` já usa para fixture ausente. Isso não é regressão desta ADR,
é a mesma lacuna de infraestrutura que ADR-083 já deixou registrada, agora também visível
neste teste.

**Fora de escopo, deliberadamente não decidido aqui.** Aplicar esta migration ao projeto
Supabase real — depende de alguém com acesso corrigir o estado `MIGRATIONS_FAILED` primeiro
(mesma consequência operacional que ADR-083 já registrou, não fechada por esta ADR também).
Anonimizar em vez de apagar, ou qualquer mudança nos prazos — já decidido pela SET-46, esta
ADR só implementa.

**Reversal cost.** Baixo — `cron.unschedule('purge-expired-retention-data')` desliga o job
sem tocar nas tabelas; a função em si não muda nenhum schema, só apaga linhas dentro do
critério já decidido.
