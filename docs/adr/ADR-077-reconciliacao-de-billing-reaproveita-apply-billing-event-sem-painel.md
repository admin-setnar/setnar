### ADR-077 — Reconciliação de billing reaproveita `apply_billing_event()`, sem painel administrativo (SET-33)

**Status:** Accepted
**Date:** 2026-08-09
**Related:** Consome `apply_billing_event()` (ADR-075) sem alterá-la; a
posse de credenciais server-only como mecanismo de autorização segue o
mesmo raciocínio de "sem infraestrutura de job/admin" já registrado em
`docs/plans/SPRINT_E_PLAN.md` §2.4.

#### Contexto e problema

Webhooks são at-least-once, mas nada garante entrega — a fila do Asaas pode
pausar (já aconteceu nesta sessão, ver ADR-075), ou esgotar tentativas antes
de qualquer intervenção. Sem um mecanismo de reconciliação, um evento
perdido deixa `subscriptions` permanentemente fora de sincronia com o que o
Asaas realmente cobrou, sem nenhum caminho de recuperação além de uma
correção SQL manual e sem trilha.

SET-33 pede: consulta ao gateway via adapter, reprocessamento idempotente,
"comando/script protegido" (não painel administrativo completo, fora de
escopo), log de ator/motivo/resultado, e runbook.

#### Alternativas consideradas

1. **Job periódico que varre todas as Subscriptions e reconcilia
   proativamente.** Rejeitada: primeira infraestrutura de job do projeto,
   para resolver um cenário raro (webhook perdido) que uma ferramenta sob
   demanda já resolve — mesmo raciocínio de sempre
   (`SPRINT_E_PLAN.md` §2.4).
2. **Nova lógica de aplicação de estado específica para reconciliação.**
   Rejeitada: `apply_billing_event()` já é idempotente, já casa a linha
   certa, já tem as guardas anti-regressão (`greatest()` para
   `current_period_end`, `WHERE status = 'active'` para suspender). Uma
   segunda implementação da mesma máquina de estados é superfície para os
   dois divergirem silenciosamente. Escolhida: reconciliar é só uma fonte
   alternativa de eventos para o mesmo pipe — o evento sintético usa o
   `id` real do pagamento no Asaas como `asaas_event_id`, então um webhook
   atrasado que chegue depois é deduplicado pela mesma `unique constraint`
   de sempre, sem nenhum código de idempotência novo.
3. **Painel administrativo web para disparar reconciliação.** Explicitamente
   fora de escopo do SET-33. Escolhido um script Node
   (`scripts/reconcile-billing-subscription.ts`), rodado por quem já possui
   `SUPABASE_SERVICE_ROLE_KEY`+`ASAAS_API_KEY` — nenhuma das duas é exposta
   à aplicação nem a usuário autenticado nenhum. Este projeto não tem
   sistema de roles/admin; introduzir um só para autorizar reconciliação
   seria desproporcional ao problema.
4. **"Autorização" como um campo opcional/best-effort.** Rejeitada:
   critério de aceite explícito exige motivo. O script recusa rodar
   (`process.exit(1)`) sem `--representative-id`, `--reason` e `--actor` —
   os três, sempre, mesmo em uso interativo de um operador confiável.
5. **Guardar o payload cru do Asaas na trilha de auditoria** (mesmo padrão
   de `billing_events.payload`). Rejeitada especificamente para
   `billing_reconciliation_log`: o critério de aceite exige "sem dados
   sensíveis", e a resposta de `GET /v3/payments` inclui o `customer` do
   Asaas — só os campos já estruturados e necessários
   (`gateway_payment_id`, `gateway_payment_status`, `subscription_id`) são
   gravados, nunca o corpo cru da resposta.
6. **Modo de escrita direto, sem confirmação.** Rejeitada: o script roda em
   modo leitura por padrão (só imprime `outcome=would_apply`), exige
   `--apply` explícito para gravar qualquer coisa — mesmo princípio de
   confirmação explícita já aplicado ao cancelamento (ADR-076), adaptado
   para uma ferramenta de linha de comando em vez de um modal.

#### Decisão

Migration `20260830000000_add_billing_reconciliation_log.sql`: tabela
`billing_reconciliation_log` (RLS habilitado, zero policies — mesmo padrão
de `billing_events`/`analytics_events`, só alcançável pelo `service_role`
que o script já usa para tudo). Nenhuma RPC nova para "aplicar" — o script
chama `apply_billing_event()` diretamente via `service_role`, exatamente
como a rota do webhook já faz.

`PaymentGateway` ganha `getLatestPayment()` (porto) e
`fetchAsaasLatestPayment()` (`src/modules/billing/infrastructure/fetch-asaas-latest-payment.ts`,
implementação real via `GET /v3/payments?subscription=...`, confirmado
contra `docs.asaas.com/reference/list-payments`). Esta função é
deliberadamente o único ponto de I/O do módulo de billing SEM
`import 'server-only'` — `AsaasPaymentGateway` (o adapter real usado pela
aplicação Next.js) continua marcado; a extração existe porque
`server-only` lança incondicionalmente fora do build do Next (confirmado
lendo `node_modules/server-only/index.js` — não é gated por `typeof
window`), então nenhum módulo que o importe pode ser usado pelo script
standalone. Mesmo padrão que `map-asaas-error.ts`/
`map-subscription-gateway-result.ts` já estabelecem: mapeadores/chamadas
puras ficam fora da fronteira `server-only`, só o adapter com a factory que
lê `process.env` fica marcado.

Status de pagamento do Asaas (`CONFIRMED`/`RECEIVED`/`OVERDUE`) mapeiam
1:1 para os `event_type`s que `apply_billing_event()` já trata
(`PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED`/`PAYMENT_OVERDUE`); todo outro
status documentado (`PENDING`, reembolsos, chargebacks) vira `'OTHER'` →
`outcome = 'ignored'`, sem escrita.

#### Verificação

`tests/map-asaas-payment-status.test.ts` (unitário, exaustivo sobre todos
os status documentados), `tests/billing-reconciliation-log.integration.test.ts`
(RLS/anon negado, outcomes legais, `actor`/`reason` obrigatórios — banco
real). Script ensaiado manualmente contra o banco de teste conectado E o
Asaas Sandbox real (ver `supabase/README.md` §9 para o registro completo):
representante sem Subscription, Subscription manual sem id externo, e um
`external_subscription_id` inexistente contra a API real (confirma
autenticação/parsing funcionando com tráfego real). `npm run verify`
completo (499 testes, build) limpo.

**Risco aceito**: o caminho "encontra um pagamento divergente e reconcilia
de verdade" não foi ensaiado — exigiria uma assinatura Sandbox real fora de
sincronia, que não existe neste momento. Mesma categoria de risco já aceita
para outras partes do billing (ADR-075, ADR-076): a primeira reconciliação
real deve ser observada de perto.

#### Consequências

- Evento perdido tem caminho de recuperação real, sem depender de UPDATE
  manual sem trilha nenhuma.
- `billing_reconciliation_log` audita a AÇÃO do operador (quem, por quê,
  resultado) — complementar a `billing_events`, que audita o evento
  financeiro em si.
- `fetch-asaas-latest-payment.ts` estabelece o padrão para qualquer futura
  chamada Asaas que precise ser chamável fora do bundle Next.js — próximas
  extrações seguem a mesma forma.
- SET-35 (documentar operação e incidentes de billing — rotação de
  segredo, contatos do gateway, comunicação ao cliente) continua sendo o
  runbook completo; `supabase/README.md` §9 cobre só o procedimento desta
  Issue.

#### Rollback conceitual

Reversão é aditiva-inversa: remover `scripts/reconcile-billing-subscription.ts`,
`fetch-asaas-latest-payment.ts`, o método `getLatestPayment` do port/adapter,
e a tabela `billing_reconciliation_log`. Nenhuma linha de `subscriptions`
precisa reverter — cada reconciliação já aplicada passou pelas mesmas
guardas anti-regressão de `apply_billing_event()`, que continuam corretas
independente deste script existir ou não.
