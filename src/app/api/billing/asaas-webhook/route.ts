import { NextResponse } from 'next/server';

import { getBillingWebhookGateway } from '@/modules/billing/infrastructure/billing-webhook-gateway-factory';
import { asaasWebhookSchema } from '@/modules/billing/presentation/schemas/asaas-webhook.schema';
import { verifyAsaasWebhookToken } from '@/modules/billing/presentation/verify-asaas-webhook-token';

/**
 * POST /api/billing/asaas-webhook — SET-29/30. Recebe eventos financeiros do
 * Asaas (`PAYMENT_*`/`CHECKOUT_*`), autentica pelo header `asaas-access-token`
 * (`verify-asaas-webhook-token.ts`), valida o formato mínimo e delega toda a
 * lógica de deduplicação/casamento/transição a `apply_billing_event()` via
 * `BillingWebhookGateway` — esta rota nunca toca `subscriptions` diretamente.
 *
 * Códigos de resposta (Asaas só precisa de `200` para considerar entregue;
 * pausa a fila de eventos após 15 falhas consecutivas —
 * `docs.asaas.com/docs/webhook-errors`):
 * - `401`: token ausente ou incorreto.
 * - `400`: corpo que não bate o formato mínimo (`id`/`event` string).
 * - `200`: processado — aplicado, duplicado, ignorado ou sem casamento não
 *   são motivo de retry do Asaas.
 * - `500`: falha inesperada (ex.: banco fora do ar) — deixa o Asaas tentar
 *   de novo, critério de aceite do SET-29 ("falha transitória permite
 *   retry").
 */
export async function POST(request: Request) {
  const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!expectedToken) {
    console.error('asaas-webhook: ASAAS_WEBHOOK_TOKEN is not configured.');
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const receivedToken = request.headers.get('asaas-access-token');
  if (!verifyAsaasWebhookToken(receivedToken, expectedToken)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = asaasWebhookSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const { id, event, payment, checkout } = parsed.data;
  const checkoutSubscription = typeof checkout?.subscription === 'object' ? checkout.subscription : null;

  const asaasSubscriptionId =
    payment?.subscription ?? (typeof checkout?.subscription === 'string' ? checkout.subscription : checkoutSubscription?.id) ?? null;
  const asaasCustomerId = payment?.customer ?? checkout?.customer ?? null;
  const externalReference = payment?.externalReference ?? checkout?.externalReference ?? null;
  const nextDueDate = payment?.nextDueDate ?? checkoutSubscription?.nextDueDate ?? null;

  try {
    const gateway = await getBillingWebhookGateway();
    const result = await gateway.applyEvent({
      eventId: id,
      eventType: event,
      asaasSubscriptionId,
      asaasCustomerId,
      externalReference,
      nextDueDate,
      payload: parsed.data,
    });

    if (result.status === 'unmatched') {
      console.error(`asaas-webhook: event ${id} (${event}) could not be matched to a subscription.`);
    }
    if (result.status === 'error') {
      return NextResponse.json({ ok: false }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('asaas-webhook: unexpected exception applying event', error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
