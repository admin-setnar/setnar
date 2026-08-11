### ADR-084 — `console.error`/`console.warn` nunca loga o objeto de erro cru; só `{ code, message }` (SET-72)
**Status.** Accepted. **Date.** 2026-08-11.

**Contexto.** A auditoria técnica de SET-44 (`docs/plans/archive/AUDIT_SET-44_privacidade.md`,
§1.8) não conseguiu descartar, só lendo os call sites, que algum log de erro que repassa o
objeto cru retornado pelo Supabase pudesse ecoar PII em texto livre — abriu SET-72 para
investigar. A investigação (não repetida aqui, ver o histórico de SET-72 no Linear) encontrou
que nenhum vazamento está ativo hoje: nenhuma RPC que toca dado pessoal (`submit_lead`,
`register_representative`, `update_representative_profile`) usa `raise exception` interpolando
um parâmetro, e nenhum `throw new Error()` no TypeScript interpola PII na mensagem. Mas achou um
padrão de risco real, não hipotético: vários call sites (`supabase-lead-gateway.ts`,
`auth-gateway-factory.ts`, os cinco wrappers `safe-*-call.ts`, a rota do webhook do Asaas)
logavam o objeto de erro inteiro em vez de extrair só os campos seguros — inconsistente com o
padrão já usado em `supabase-analytics-metrics-repository.ts`,
`supabase-feedback-gateway.ts` e os repositórios de `representatives`, que já só logam
`{ code, message }`.

Isso importa porque, no Postgres, o valor de fato que violou uma constraint (`unique`,
`check`, `not null`) vive no campo `DETAIL` do erro, nunca em `MESSAGE`
(ex.: `MESSAGE = "duplicate key value violates unique constraint..."`,
`DETAIL = "Key (phone)=(+5511999999999) already exists."`). O PostgrestError que o
`@supabase/supabase-js` devolve expõe `details`/`hint` como campos próprios — logar o objeto
cru, ou espalhá-lo (`...error`), captura esses campos junto. Hoje isso não vaza porque
`submit_lead` valida telefone/nome/e-mail em PL/pgSQL antes do insert e nunca deixa uma
violação de constraint da tabela `leads` chegar crua ao chamador — mas essa segurança depende
de esse pré-check nunca divergir da constraint real da tabela, e nada testa isso hoje.
Blindar o logging fecha o vetor independentemente dessa premissa continuar valendo.

**Decisão.** `src/shared/lib/safe-log-error.ts` exporta `toSafeLogError(error: unknown)`,
que devolve só `{ code?, message }` — nunca `details`, `hint`, nem o objeto original — para
qualquer formato de erro (`PostgrestError`, `AuthError`, `Error` nativo, ou algo não
reconhecido, que vira `{ message: 'Unknown error' }`). Todo `console.error`/`console.warn`
em código que toca dado pessoal — leads, auth, os cinco wrappers `safe-*-call.ts`
(auth/representatives write/onboarding/billing/feedback), e o webhook do Asaas — passou a
chamar esse helper em vez de logar `error`/`err` cru.

**Por que um helper compartilhado, e não inline em cada arquivo.** `isNextControlFlowError`
já é importado do mesmo jeito pelos cinco wrappers `safe-*-call.ts` — extrair
`toSafeLogError` para `shared/lib/` segue exatamente esse precedente. Isso **não** contradiz
a decisão documentada em cada wrapper de manter cada um como cópia estrutural própria (não
importar a lógica de controle de um módulo do outro): o que é compartilhado aqui é uma
função pura de formatação de erro, não a lógica do wrapper.

**Por que não decidir retenção nem minimizar `billing_events.payload` aqui.** Fora de
escopo de SET-72 por definição — essa é SET-71, que também nasceu da mesma auditoria e
continua aberta e não relacionada a como o *código de aplicação* loga no `console`.

**Fora de escopo, deliberadamente não tocado.** `src/shared/lib/supabase/middleware.ts`
(erros de configuração do Supabase, sem dado de usuário, e já tem sua própria lógica
warn-once documentada) e os três `resolve-*-eligibility.ts` de feedback (o `catch` ali só
recebe o `Error` genérico e já sanitizado que os gateways de `feedback`/`analytics`
relançam — nunca o erro cru do Supabase).

**Reversal cost.** Baixo — um arquivo novo (`toSafeLogError`, com teste próprio em
`tests/safe-log-error.test.ts`) e troca mecânica de argumento em ~14 call sites; nenhuma
mudança de schema, de RPC ou de assinatura pública.
