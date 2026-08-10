import type { CheckoutCallbackUrls, PaymentGateway } from '@/modules/billing/domain/payment-gateway';
import type { SubscriptionGateway } from '@/modules/billing/domain/subscription-gateway';

export interface StartCheckoutInput {
  readonly holderName: string;
  readonly holderDocumentId: string;
  readonly holderEmail: string;
  /** Telefone comercial do representante (perfil já cadastrado), não um campo do formulário de checkout. */
  readonly holderPhone: string;
  readonly postalCode: string;
  readonly addressNumber: string;
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
 *    Numa retentativa (linha reaproveitada), a reserva também devolve o
 *    `staleExternalSubscriptionId` abandonado — cancelado no Asaas aqui
 *    mesmo, antes do passo 2, para nunca haver duas assinaturas cobrando em
 *    paralelo (SET-34 follow-up; migration `20260831000000`). Melhor
 *    esforço: uma falha nesse cancelamento é logada, nunca bloqueia o
 *    representante de tentar assinar de novo — a mesma linha já foi
 *    reaproveitada e o Asaas eventualmente encerra sozinho uma assinatura
 *    cujos pagamentos continuam falhando.
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

  if (reservation.staleExternalSubscriptionId) {
    const canceled = await paymentGateway.cancelSubscription(reservation.staleExternalSubscriptionId);
    if (canceled.status === 'error') {
      console.error(
        'startCheckout: failed to cancel the stale Asaas subscription on retry',
        reservation.staleExternalSubscriptionId,
      );
    }
  }

  const customer = await paymentGateway.createCustomer({
    name: input.holderName,
    documentId: input.holderDocumentId,
    email: input.holderEmail,
    phone: input.holderPhone,
    postalCode: input.postalCode,
    addressNumber: input.addressNumber,
  });

  if (customer.status === 'rejected') return { status: 'rejected', reason: customer.reason };
  if (customer.status !== 'created') return { status: 'error' };

  const checkout = await paymentGateway.createCheckout({
    externalCustomerId: customer.externalCustomerId,
    paymentMethod: 'credit_card',
    amount: { amountCents: reservation.amountCents, currency: 'BRL' },
    localSubscriptionId: reservation.localSubscriptionId,
    callback: input.callback,
  });

  if (checkout.status === 'rejected') return { status: 'rejected', reason: checkout.reason };
  if (checkout.status !== 'created') return { status: 'error' };

  return { status: 'redirect', checkoutUrl: checkout.checkoutUrl };
}
