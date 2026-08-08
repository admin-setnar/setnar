import type { CheckoutCallbackUrls, PaymentGateway } from '@/modules/billing/domain/payment-gateway';
import type { SubscriptionGateway } from '@/modules/billing/domain/subscription-gateway';

export interface StartCheckoutInput {
  readonly holderName: string;
  readonly holderDocumentId: string;
  readonly holderEmail: string;
  readonly callback: CheckoutCallbackUrls;
}

export type StartCheckoutResult =
  | { readonly status: 'redirect'; readonly checkoutUrl: string }
  | { readonly status: 'already_active' }
  | { readonly status: 'sold_out' }
  | { readonly status: 'rejected'; readonly reason: 'invalid_document' | 'duplicate_customer' | 'invalid_customer' }
  | { readonly status: 'error' };

/**
 * Orquestra o início do checkout do plano único (SET-28), via Checkout
 * Asaas hospedado:
 *
 * 1. Reserva a vaga/preço ANTES de tocar o gateway (nunca cria um checkout
 *    sem uma linha local correspondente — migration `20260824000000`).
 * 2. Cria o customer no Asaas (nome/documento/e-mail — nenhum dado de
 *    cartão nunca passa por aqui).
 * 3. Cria o checkout (`chargeTypes: ['RECURRENT']`), com o `id` local como
 *    `externalReference`.
 *
 * O sucesso devolve a URL do checkout hospedado para o chamador
 * redirecionar — nunca `'active'`. Só o webhook (SET-29/30), reagindo ao
 * evento `CHECKOUT_PAID` de verdade, concede entitlement
 * (`BILLING_DECISIONS_PLAN.md`, "redirect não concede entitlement"; aqui
 * nem existe uma confirmação síncrona de pagamento para conceder — o
 * cliente ainda nem chegou na página do Asaas neste ponto).
 */
export async function startCheckout(
  subscriptionGateway: SubscriptionGateway,
  paymentGateway: PaymentGateway,
  input: StartCheckoutInput,
): Promise<StartCheckoutResult> {
  const reservation = await subscriptionGateway.reserveCheckoutSlot();

  if (reservation.status === 'already_active') return { status: 'already_active' };
  if (reservation.status === 'sold_out') return { status: 'sold_out' };
  if (reservation.status !== 'reserved') return { status: 'error' };

  const customer = await paymentGateway.createCustomer({
    name: input.holderName,
    documentId: input.holderDocumentId,
    email: input.holderEmail,
  });

  if (customer.status === 'rejected') return { status: 'rejected', reason: customer.reason };
  if (customer.status !== 'created') return { status: 'error' };

  const checkout = await paymentGateway.createCheckout({
    externalCustomerId: customer.externalCustomerId,
    amount: { amountCents: reservation.amountCents, currency: 'BRL' },
    localSubscriptionId: reservation.localSubscriptionId,
    callback: input.callback,
  });

  if (checkout.status === 'rejected') return { status: 'rejected', reason: checkout.reason };
  if (checkout.status !== 'created') return { status: 'error' };

  return { status: 'redirect', checkoutUrl: checkout.checkoutUrl };
}
