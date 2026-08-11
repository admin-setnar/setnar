### ADR-085 — `billing_events.payload` minimizado: só os campos já extraídos, nunca o corpo cru do webhook (SET-71)
**Status.** Accepted. **Date.** 2026-08-11.

**Contexto.** A auditoria SET-44 (`docs/plans/archive/AUDIT_SET-44_privacidade.md`, §1.6)
encontrou que `billing_events.payload` guarda o corpo cru inteiro de cada webhook do Asaas,
"para não perder nada" (`supabase/migrations/20260827000000_add_billing_webhook_events.sql:22-26`),
em contraste direto com `billing_reconciliation_log` (mesmo sprint), que evita
deliberadamente o mesmo padrão citando o risco de carregar e-mail/telefone do customer
(`20260830000000_add_billing_reconciliation_log.sql:49-51`). Isso virou SET-71.

**Por que o payload cru foi mantido, e por que essa razão não se sustenta mais.** O
comentário original diz que o desenho exato de alguns campos (`checkout.subscription`,
`payment.customer`) não estava 100% confirmado na documentação pública do Asaas — guardar
tudo cru era uma rede de segurança para reconciliação manual futura (SET-33) se a extração
de campo estivesse incompleta. Hoje: (1) nada no código lê `billing_events.payload` de
volta — nem a aplicação, nem `scripts/reconcile-billing-subscription.ts`, que grava seu
próprio `apply_billing_event()` com um payload sintético mínimo
(`{ source: 'reconciliation', actor, reason }`), nunca o payload real do Asaas; (2) a
extração de campo (`asaasSubscriptionId`/`asaasCustomerId`/`externalReference`/`nextDueDate`
em `route.ts`) já está madura e testada desde ADR-075 — a incerteza que motivou guardar tudo
cru não é mais uma dúvida ativa; (3) `asaas-webhook.schema.ts` usa `.passthrough()` em todo
nível, então o corpo cru pode carregar qualquer campo que o Asaas decida enviar, hoje ou no
futuro, sem controle nenhum do lado da aplicação — exatamente o vetor que
`billing_reconciliation_log` já havia recusado.

**Decisão.** `src/app/api/billing/asaas-webhook/route.ts` passa a montar `payload` a partir
só dos campos que a própria lógica de casamento do evento já extrai e confia — `id`, `event`,
`payment?.id`, `checkout?.id` (IDs opacos do Asaas, não PII), `asaasSubscriptionId`,
`asaasCustomerId` (também um ID do Asaas, não um objeto de customer), `externalReference`,
`nextDueDate` — nunca mais `parsed.data` (o corpo cru, passthrough). Nenhuma migration nova
de schema: `billing_events.payload` continua `jsonb not null`, só o valor que a aplicação
grava nele muda. Uma migration só de `comment on table` (`20260903000000`) documenta a nova
forma, sem reescrever a migration original (regra do projeto: migration aplicada nunca é
editada).

**Por que não decidir retenção/purga aqui.** Fora de escopo de SET-71 por definição — essa é
SET-46 (política de retenção do MVP), ainda não decidida pelo Product Owner. Esta ADR resolve
só a pergunta "quais campos", não "por quanto tempo".

**Trade-off aceito.** Se a lógica de extração em `route.ts` tiver um bug para um formato de
evento não previsto pelo schema atual, a rede de segurança de inspecionar o payload cru
manualmente deixa de existir — a partir de agora, um evento mal-casado (`outcome = 'unmatched'`)
só tem os campos já extraídos para diagnóstico, não o corpo completo. Aceito porque a
extração está estável há vários sprints e o outcome `'unmatched'` já é logado
separadamente (`asaas-webhook: event ${id} (${event}) could not be matched...`).

**Reversal cost.** Baixo — uma linha de código na rota e uma migration de comentário; nenhum
dado histórico é reescrito (eventos já persistidos antes desta mudança continuam com o
payload cru antigo, já que isto não é um backfill).
