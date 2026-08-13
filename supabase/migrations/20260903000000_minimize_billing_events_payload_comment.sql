-- SET-71: só atualiza o `comment on table` de `billing_events` — nenhuma
-- mudança de schema, dado ou policy. A migration original
-- (`20260827000000_add_billing_webhook_events.sql`) não é editada (regra do
-- projeto: migration aplicada nunca é reescrita); este é um novo arquivo,
-- refletindo a decisão de ADR-085: `payload` deixou de guardar o corpo cru
-- do webhook (`.passthrough()` em todo nível, capaz de carregar campo não
-- previsto pelo schema) e passa a guardar só os campos que
-- `apply_billing_event()` já extrai e confia — mudança feita inteiramente em
-- `src/app/api/billing/asaas-webhook/route.ts`, sem novo argumento nem novo
-- tipo de coluna aqui.

comment on table public.billing_events is
  'Log append-only de eventos do webhook Asaas (SET-29/30). asaas_event_id é o mecanismo de deduplicação; payload guarda só os campos já extraídos/confiados (id, event, paymentId, checkoutId, asaasSubscriptionId, asaasCustomerId, externalReference, nextDueDate) — não mais o corpo cru do webhook, ver ADR-085.';
