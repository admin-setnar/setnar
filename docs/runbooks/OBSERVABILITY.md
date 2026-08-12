# Runbook — Observabilidade Mínima do MVP

**SET-54.** Documentação operacional, não normativa — mesmo contrato de
`BILLING_OPERATIONS.md`/`PILOT_METRICS.md`: não decide arquitetura, descreve
**o que existe, onde olhar, e quem age**. Escopo deliberadamente pequeno
(`docs/plans/SPRINT_E_PLAN.md` §2.4, "sem sistema de roles/admin"): nenhum
APM, nenhum serviço de alerta pago, nenhum tracing distribuído — logs
estruturados no `console` (capturados pela Vercel) mais um punhado de
consultas SQL, na mesma linha do resto do projeto.

**Achado escrevendo este runbook:** a disciplina de redaction (ADR-084,
`toSafeLogError`) já está correta em todos os ~25 call sites de
`console.error`/`console.warn` do projeto — nenhum vazamento de PII/segredo
encontrado. O gap real não era "os logs vazam dado", era "não existe um lugar
que diga o que checar, o que cada sinal significa, e quem age" — é isso que
este documento fecha, mais uma consulta nova (saúde do job de retenção) que
não existia em lugar nenhum.

---

## 1. Onde os logs vivem

`console.error`/`console.warn` do runtime de servidor (Server Actions, Route
Handlers, Server Components) aparecem em **Vercel → Project → Logs** (ou
`vercel logs` via CLI), filtráveis por rota/função e por texto. Não há
agregação nem alerta automático configurado — ver §5.

**Nunca** contêm senha, token, payload cru do Asaas, nem o objeto de erro
completo do Postgres/Supabase (que pode carregar o valor de uma constraint
violada, ex. um telefone) — só `{ code, message }` via
`src/shared/lib/safe-log-error.ts` (ADR-084). Os três `resolve-*-eligibility.ts`
de feedback são a única exceção documentada, e não são exceção de verdade:
o `catch` ali só recebe um `Error` genérico já saneado que o próprio gateway
relança (`supabase-value-perception-signals-gateway.ts` e afins já logam
`{code, message}` e lançam `new Error('... unavailable.')`, sem detalhe).

## 2. Catálogo de sinais — o que existe, onde olhar, quem age

| Área | Sinal de falha | Onde aparece | Responsável | Ação |
|---|---|---|---|---|
| **Billing/webhook** | Evento não casado, webhook parado, entitlement divergente | `billing_events` (`outcome`), logs `asaas-webhook:` | Pedro | `docs/runbooks/BILLING_OPERATIONS.md` §2–§5 tem diagnóstico e correção completos |
| **Retenção (purga)** | Job `pg_cron` atrasado ou com falha | `cron.job_run_details` (consulta nova, §3 abaixo) | Pedro | Reagendar/investigar antes que `leads`/`analytics_events` cresçam sem purga |
| **Leads** | `submit_lead` RPC falhou | log `submit_lead RPC failed` (`supabase-lead-gateway.ts`) | Pedro | Conferir `{code}` contra `ADR-034`/`ADR-036`; se recorrente, é rate limit ou constraint |
| **Analytics** | Visita/clique não gravado por IP não confiável | log `Analytics event skipped because no trusted client IP was available` (warn-once por processo) | Pedro | Esperado fora da Vercel (`getTrustedClientIp`); se aparecer em produção, `VERCEL`/cabeçalho está errado |
| **Analytics** | RPC de escrita falhou | log `record_page_visit RPC failed` / `record_whatsapp_click RPC failed` | Pedro | Conferir `{code}`; best-effort por desenho (nunca derruba a página pública) |
| **Auth** | Sessão/perfil ilegível, `createClient()` falhou | logs `getCurrentUser:`/`getCurrentTermsVersion:` (fail-open documentado, ADR-019) | Pedro | Confirmar env vars do Supabase antes de qualquer outra hipótese |
| **Onboarding/perfil/feedback** | Server Action lançou exceção inesperada | logs `safe*Call: unexpected exception...` (5 wrappers) | Pedro | `{code, message}` já indica a causa; raramente precisa de mais contexto |

Todo log de falha acima já carrega uma string identificando a função/rota de
origem — a "correlação técnica" deste projeto é isso: grep pelo prefixo
(`asaas-webhook:`, `submit_lead RPC failed`, etc.) nos logs da Vercel, não um
trace-id distribuído (fora de escopo, `SPRINT_E_PLAN.md` §2.4).

## 3. Saúde do job de retenção (novo — não existia consulta nenhuma para isso)

`purge_expired_retention_data()` (SET-73/ADR-086) roda via `pg_cron`
diariamente às 03:00 UTC, sem nenhum caminho de aplicação que a chame — a
única forma de saber se ela está rodando é consultar o próprio `pg_cron`:

```sql
select
  j.jobname,
  j.active,
  j.schedule,
  last_run.status as ultimo_status,
  last_run.start_time as ultima_execucao,
  (now() - last_run.start_time) > interval '25 hours' as atrasado
from cron.job j
left join lateral (
  select status, start_time
  from cron.job_run_details
  where jobid = j.jobid
  order by start_time desc
  limit 1
) last_run on true
where j.jobname = 'purge-expired-retention-data';
```

`atrasado = true` (mais de 25h desde a última execução — 1h de folga sobre o
ciclo diário) ou `ultimo_status <> 'succeeded'` é o sinal de que algo parou.

**Ensaiado de verdade em 2026-08-12** contra o projeto conectado: `active =
true`, uma execução registrada em `2026-08-12 03:00:00 UTC`, `status =
'succeeded'`, `return_message = '1 row'` — o job existe, está agendado e a
última execução real teve sucesso.

## 4. "Cenário de falha gera sinal observável" — evidência já coletada

Não fabricado para este runbook — achado organicamente depurando a suíte E2E
(SET-52) no mesmo dia: rodando `next dev` localmente (fora da Vercel,
`VERCEL` não setado), toda visita à página pública gerou

```
Analytics event skipped because no trusted client IP was available.
```

exatamente o comportamento esperado de `getTrustedClientIp`
(`shared/lib/trusted-client-ip.ts`) fail-closed fora de um runtime Vercel
verificado — prova, com uma falha real (não simulada), que o sinal aparece
onde o catálogo do §2 diz que aparece.

## 5. Alertas — o que é automático e o que não é

**Nada aqui é automático.** Este projeto não tem serviço de alerta
configurado (Sentry, PagerDuty, Vercel Monitoring pago) — mesma postura que
`BILLING_OPERATIONS.md` §7 já registra para contatos operacionais: inventar
um alerta automático que não existe seria pior que deixar explícito que a
checagem é manual. Até o piloto justificar o custo de um serviço de alerta:

- **Checagem recomendada:** revisar o catálogo do §2 e rodar a consulta do
  §3 periodicamente (ex.: no início de cada dia útil durante o piloto) —
  registrado aqui, não automatizado em lugar nenhum.
- **Responsável único:** Pedro, para todo item deste runbook — mesmo padrão
  de `BILLING_OPERATIONS.md`.
- **Ação em caso de sinal:** cada linha do catálogo do §2 já aponta a ação;
  para o job de retenção (§3), reagendar via `cron.schedule(...)` (mesmo
  nome de job, mesma função) ou investigar `return_message` do último `run`.

## 6. Retenção de logs — decisão aprovada por Pedro em 2026-08-12

Isso é diferente da retenção de **dado** (`leads`/`analytics_events`,
SET-46/73, já decidida e implementada) — este item é sobre quanto tempo o
*log operacional* (`console.error`/`console.warn` de Function) fica
disponível para investigar um incidente passado, não sobre dado de negócio.

Retenção de Runtime Logs é definida pelo plano da Vercel, não configurável à
parte ([Runtime Logs](https://vercel.com/docs/logs/runtime),
[Account Plans](https://vercel.com/docs/plans)):

| Plano | Retenção de Runtime Logs |
|---|---|
| **Hobby** (atual) | 1 hora |
| **Pro** (após validação + primeiros pagamentos) | 1 dia |
| Observability Plus (add-on Pro/Enterprise) | até 14 dias dentro de uma janela de 30 |

**Decisão:** aceitar a janela de 1 hora do plano Hobby durante a fase de
validação — mesma lógica de "não pagar por infraestrutura antes de o produto
provar que vale a pena" que já guiou a escolha do gateway de pagamento
(`BILLING_DECISIONS_PLAN.md`) e a ausência de scheduler próprio
(`SPRINT_E_PLAN.md` §2.4). Migrar para o plano Pro assim que houver os
primeiros pagamentos reais amplia a janela para 1 dia automaticamente, sem
mudança de código — revisitar Observability Plus só se um incidente real
precisar investigar algo mais antigo que isso.

**Risco aceito enquanto no Hobby:** um incidente notado mais de 1 hora depois
de acontecer perde o log operacional do momento exato da falha — as
consultas SQL deste runbook (§2/§3) continuam disponíveis independente da
janela de log da Vercel, já que vivem no Postgres, não no log de Function.
