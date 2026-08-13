Status: Implemented — archived
Authority: Non-normative
Code baseline: develop @ 859545b, pre-fix
Last reviewed: 2026-08-11
Superseded by: n/a

# Auditoria SET-71 — Minimização do payload cru em `billing_events`

**Issue**: [SET-71](https://linear.app/setnar/issue/SET-71/minimizardefinir-retencao-do-payload-cru-em-billing-events) — **Done** (parte de minimização; retenção/purga permanece SET-46). Nascida da auditoria SET-44 (`docs/plans/archive/AUDIT_SET-44_privacidade.md`, §1.6).

## Pergunta

`billing_events.payload` guarda o corpo cru inteiro de cada webhook do Asaas. Por que foi mantido assim, essa razão ainda vale, e deve ser minimizado?

## Achados

1. **Por que foi mantido cru**: o comentário original (`20260827000000_add_billing_webhook_events.sql:22-26`) diz que o formato exato de alguns campos (`checkout.subscription`, `payment.customer`) não estava 100% confirmado na documentação pública do Asaas na época — guardar tudo cru era rede de segurança para reconciliação manual futura se a extração de campo estivesse incompleta.
2. **Nada lê `billing_events.payload` de volta.** Nem a aplicação, nem `scripts/reconcile-billing-subscription.ts` — que já grava seu próprio `apply_billing_event()` com um payload **sintético mínimo** (`{ source: 'reconciliation', actor, reason }`, `scripts/reconcile-billing-subscription.ts:152`), nunca o payload real do Asaas. O padrão minimizado já existe no próprio código; só não tinha sido aplicado ao caminho do webhook real.
3. **A incerteza de formato que motivou guardar tudo cru não é mais uma dúvida ativa.** A extração de campo (`asaasSubscriptionId`/`asaasCustomerId`/`externalReference`/`nextDueDate`) está madura e testada desde ADR-075.
4. **`asaas-webhook.schema.ts` usa `.passthrough()` em todo nível** — o corpo cru pode carregar qualquer campo que o Asaas decida enviar, sem controle da aplicação. Esse é exatamente o vetor que `billing_reconciliation_log` (mesmo sprint) já havia recusado, citando o risco de e-mail/telefone do customer.
5. `payment.customer`/`checkout.customer`/`subscription.customer` são, pelo schema, **IDs opacos do Asaas** (string), não objetos de customer com PII direta — o risco concreto vem do `.passthrough()`, não desses três campos específicos.

## Proposta e decisão

Minimizar: `src/app/api/billing/asaas-webhook/route.ts` monta `payload` só com os campos que a matching logic já extrai e confia (`id`, `event`, `paymentId`, `checkoutId`, `asaasSubscriptionId`, `asaasCustomerId`, `externalReference`, `nextDueDate`) — nunca mais `parsed.data`. Decisão registrada em [ADR-085](../../adr/ADR-085-billing-events-payload-minimizado-so-campos-ja-extraidos.md). Nenhuma migration de schema — só um `comment on table` novo (`20260903000000`), já que migration aplicada nunca é reescrita.

**Trade-off aceito, não escondido**: se a extração tiver um bug para um formato de evento não previsto, perde-se a possibilidade de inspecionar o payload cru manualmente depois — só os campos já extraídos ficam disponíveis para diagnóstico. Aceito porque a extração está estável há vários sprints e `outcome = 'unmatched'` já é logado separadamente.

**Fora de escopo, deliberadamente não decidido aqui**: retenção/purga de `billing_events` — isso é SET-46, ainda pendente de decisão do Product Owner.

## Status

Implementado nesta sessão, em branch (`admin/set-71-minimizar-payload-cru-billing-events`) com PR contra `develop` — não commitado direto em branch principal, seguindo a nova convenção adotada após a SET-72.
