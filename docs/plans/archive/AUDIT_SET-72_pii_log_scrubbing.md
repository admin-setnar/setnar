Status: Implemented — archived
Authority: Non-normative
Code baseline: main @ 2026-08-11, pre-fix (last commit 302410b)
Last reviewed: 2026-08-11
Superseded by: n/a

# Auditoria SET-72 — Vazamento de PII em logs de erro (repasse de erro cru do Supabase)

**Issue**: [SET-72](https://linear.app/setnar/issue/SET-72/auditar-logs-de-erro-por-vazamento-de-pii-repasse-de-erro-cru-do) — **Done**. Nascida da auditoria SET-44 (`docs/plans/archive/AUDIT_SET-44_privacidade.md`, §1.8), que não conseguiu descartar, só lendo os call sites, que algum `console.error`/`console.warn` pudesse ecoar PII em texto livre.

## Pergunta

Algum dos ~30 call sites do repositório que fazem `console.error(...)`/`console.warn(...)` com um objeto de erro do Supabase (ou uma exceção não tratada) pode carregar PII (telefone, e-mail, CPF, nome) em texto livre?

## Como o Postgres/PostgREST expõe erro

A resposta depende de onde, exatamente, o Postgres coloca o valor que violou uma constraint:

- `MESSAGE`: nunca contém o valor — ex. `duplicate key value violates unique constraint "leads_pkey"`.
- `DETAIL`: contém o valor de fato — ex. `Key (phone)=(+5511999999999) already exists.` (unique) ou `Failing row contains (...)` (not-null/check).

O `PostgrestError` do `@supabase/supabase-js` expõe `DETAIL` como `.details` e `MESSAGE` como `.message`. **Logar o objeto de erro inteiro (ou espalhá-lo) captura `.details` junto** — logar só `.message`/`.code` não.

## Achados

1. **Nenhum vazamento confirmado hoje.** `grep` em `supabase/migrations/` não encontrou nenhum `raise exception` que interpole um parâmetro na mensagem, nas RPCs que tocam dado pessoal (`submit_lead`, `register_representative`, `update_representative_profile`, `submit_feedback_response`). `grep` em `src/modules/` não encontrou nenhum `throw new Error(...)` que interpole PII.
2. **`public.leads` não tem `CHECK` próprio** (só `not null` em `telefone_e164`/`representative_id`) — a validação de formato (regex de telefone, tamanho de nome, formato de e-mail) vive inteiramente em `submit_lead` (PL/pgSQL), que retorna `false` em vez de deixar uma violação de constraint chegar crua ao chamador. Isso hoje neutraliza o cenário mais óbvio de vazamento — mas é uma invariante entre RPC e schema, sem teste que a proteja de divergir (deriva de schema).
3. **Padrão de risco real, não hipotético**: apesar do achado 1, vários call sites logavam o objeto de erro cru em vez de `{ code, message }` — inconsistente com o padrão já usado em `supabase-analytics-metrics-repository.ts`, `supabase-feedback-gateway.ts`, `supabase-value-perception-signals-gateway.ts` e os repositórios de `representatives`, que já extraem só esses dois campos. Blindar esse padrão em todo lugar remove a dependência da invariante do achado 2, em vez de confiar nela indefinidamente.
4. Confirmados os dois locais citados no texto original de SET-72:
   - `supabase-lead-gateway.ts:63` — `console.error('submit_lead RPC failed', error)`, params incluem telefone/nome/cidade/e-mail do lead.
   - `auth-gateway-factory.ts` (5 sites) — `getCurrentTermsVersion` (2x) e `getCurrentUser` (2x, incluindo o erro de leitura de `profiles`) e o `createClient()` lançando.
5. Ampliado além do texto original de SET-72 (que citava só leads/auth/representatives/billing), por usarem exatamente o mesmo padrão vulnerável: os cinco wrappers `safe-*-call.ts` (`auth`, `representatives` write, `representatives` onboarding, `billing`, `feedback`) e a rota `app/api/billing/asaas-webhook/route.ts` (o catch de exceção inesperada — os outros dois `console.error` dessa rota já só logam IDs do Asaas, não PII).
6. **Não precisou de mudança**: `middleware.ts` (erros de configuração, sem dado de usuário, com sua própria lógica warn-once já documentada) e os três `resolve-*-eligibility.ts` de feedback — o `catch` ali só recebe o `Error` genérico e já sanitizado que os gateways de `feedback`/`analytics` relançam (`throw new Error('... unavailable.')`), nunca o erro cru do Supabase.

## Correção aplicada

`src/shared/lib/safe-log-error.ts` (`toSafeLogError`), testado em `tests/safe-log-error.test.ts`, aplicado nos ~14 call sites dos achados 4 e 5. Decisão registrada em [`ADR-084`](../../adr/ADR-084-console-error-nunca-loga-o-objeto-de-erro-cru-so-code-message.md).

## Status

Implementado nesta sessão: helper novo + troca dos call sites + testes existentes de `safe-auth-call`/`safe-onboarding-call` atualizados (esperavam a referência exata do `Error` cru — passaram a esperar `{ message }`). `npm run typecheck`, `npm run lint` e `npm run test` (575 testes, 0 falhas) passam. `npm run build`/`test:integration` não rodados nesta sessão (exigem projeto Supabase configurado). Nenhuma decisão de retenção foi tomada aqui — isso continua sendo SET-46/SET-71.
