import type { CardDetails, CardHolderInfo, PaymentGateway } from '@/modules/billing/domain/payment-gateway';
import type { SubscriptionGateway } from '@/modules/billing/domain/subscription-gateway';

export interface StartCheckoutInput {
  readonly card: CardDetails;
  readonly cardHolder: CardHolderInfo;
}

export type StartCheckoutResult =
  | { readonly status: 'pending' }
  | { readonly status: 'already_active' }
  | { readonly status: 'sold_out' }
  | {
      readonly status: 'rejected';
      readonly reason: 'invalid_document' | 'duplicate_customer' | 'card_declined' | 'invalid_card' | 'invalid_holder_data';
    }
  | { readonly status: 'error' };

/**
 * Orquestra o checkout do plano único (SET-28):
 *
 * 1. Reserva a vaga/preço ANTES de tocar o gateway (nunca cobra sem uma
 *    linha local correspondente — ver a migration `20260824000000`).
 * 2. Cria o customer + a assinatura no Asaas com os dados do cartão.
 * 3. Grava os ids externos na linha já reservada.
 *
 * O sucesso devolve `'pending'`, nunca `'active'` — só o webhook (SET-29/30),
 * reagindo ao pagamento de verdade, concede entitlement
 * (`BILLING_DECISIONS_PLAN.md`, "redirect não concede entitlement").
 *
 * **Simplificação aceita para esta primeira versão:** um `createCustomer`
 * novo é chamado a cada tentativa, mesmo em retry — não reaproveita um
 * `external_customer_id` de uma tentativa anterior. Pode criar customers
 * duplicados no Asaas entre retries; não é um problema de dinheiro ou
 * segurança, só de limpeza operacional, e fica como polimento futuro, não
 * bloqueador.
 *
 * **Risco residual, coberto por SET-33 (reconciliação), não por aqui:** se
 * `recordExternalIds` falhar DEPOIS de `createSubscription` já ter sucesso
 * no Asaas, a linha local fica sem os ids externos enquanto uma assinatura
 * real existe no gateway — o webhook (SET-29/30) não vai conseguir casar o
 * evento a nenhuma linha até uma reconciliação manual religar os dois
 * lados. Uma janela rara (duas chamadas autenticadas ao próprio banco,
 * sequenciais, depois de uma chamada externa já confirmada), não vale a
 * complexidade de uma transação compensatória para o MVP.
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
    name: input.cardHolder.name,
    documentId: input.cardHolder.documentId,
    email: input.cardHolder.email,
  });

  if (customer.status === 'rejected') return { status: 'rejected', reason: customer.reason };
  if (customer.status !== 'created') return { status: 'error' };

  const subscription = await paymentGateway.createSubscription({
    externalCustomerId: customer.externalCustomerId,
    paymentMethod: 'credit_card',
    amount: { amountCents: reservation.amountCents, currency: 'BRL' },
    nextDueDate: new Date().toISOString().slice(0, 10),
    card: input.card,
    cardHolder: input.cardHolder,
  });

  if (subscription.status === 'rejected') return { status: 'rejected', reason: subscription.reason };
  if (subscription.status !== 'created') return { status: 'error' };

  const recorded = await subscriptionGateway.recordExternalIds(
    customer.externalCustomerId,
    subscription.externalSubscriptionId,
  );
  if (recorded.status !== 'updated') return { status: 'error' };

  return { status: 'pending' };
}
