import type { GetLatestPaymentResult, ReconcilablePaymentStatus } from '@/modules/billing/domain/payment-gateway';

export interface ReconcilableSubscription {
  readonly id: string;
  /** Sempre presente aqui — o chamador (`scripts/reconcile-billing-subscription.ts`) já filtrou uma linha sem id externo antes mesmo de consultar o Asaas, ver comentário lá. */
  readonly externalSubscriptionId: string;
  readonly externalCustomerId: string | null;
}

interface ReconciliationEventDetail {
  readonly subscriptionId: string;
  readonly paymentId: string;
  readonly paymentStatus: ReconcilablePaymentStatus;
  readonly eventType: string;
}

/**
 * O que `apply_billing_event()` esperaria receber para reconciliar este
 * pagamento — o mesmo formato de parâmetros que o webhook (SET-29/30) já
 * usa, nunca uma lógica de aplicação de estado nova (ADR-077).
 */
interface ReconciliationEvent {
  readonly eventId: string;
  readonly eventType: string;
  readonly asaasSubscriptionId: string;
  readonly asaasCustomerId: string | null;
  readonly nextDueDate: string | null;
}

export type ReconciliationPlan =
  | { readonly action: 'log'; readonly outcome: 'gateway_error'; readonly detail: { readonly subscriptionId: string } }
  | { readonly action: 'log'; readonly outcome: 'no_payment_found'; readonly detail: { readonly subscriptionId: string } }
  | {
      readonly action: 'log';
      readonly outcome: 'ignored';
      readonly detail: {
        readonly subscriptionId: string;
        readonly paymentId: string;
        readonly paymentStatus: 'OTHER';
        readonly note: string;
      };
    }
  | { readonly action: 'log'; readonly outcome: 'would_apply'; readonly detail: ReconciliationEventDetail }
  | { readonly action: 'apply'; readonly event: ReconciliationEvent; readonly detail: ReconciliationEventDetail };

const EVENT_TYPE_BY_PAYMENT_STATUS: Record<ReconcilablePaymentStatus, string> = {
  CONFIRMED: 'PAYMENT_CONFIRMED',
  RECEIVED: 'PAYMENT_RECEIVED',
  OVERDUE: 'PAYMENT_OVERDUE',
};

/**
 * Decide o que `scripts/reconcile-billing-subscription.ts` (SET-33) deve
 * fazer com o pagamento mais recente encontrado no Asaas — extraído de
 * dentro do script (que só sabia rodar como CLI, `main()` disparava sozinho
 * ao importar o arquivo) para ser testável sem bater no Asaas nem no banco
 * de verdade (SET-34). Puro: não decide SE deve aplicar (isso é `apply`,
 * decidido pelo `--apply` da CLI, já resolvido antes de chamar esta
 * função), só COMO mapear o pagamento encontrado para um evento de
 * `apply_billing_event()` ou para um log sem escrita.
 */
export function resolveReconciliationPlan(
  subscription: ReconcilableSubscription,
  latestPayment: GetLatestPaymentResult,
  apply: boolean,
): ReconciliationPlan {
  if (latestPayment.status === 'error') {
    return { action: 'log', outcome: 'gateway_error', detail: { subscriptionId: subscription.id } };
  }
  if (latestPayment.status === 'not_found') {
    return { action: 'log', outcome: 'no_payment_found', detail: { subscriptionId: subscription.id } };
  }
  if (latestPayment.paymentStatus === 'OTHER') {
    return {
      action: 'log',
      outcome: 'ignored',
      detail: {
        subscriptionId: subscription.id,
        paymentId: latestPayment.paymentId,
        paymentStatus: 'OTHER',
        note: 'status do Asaas sem transição de entitlement definida (SET-25) — nada a aplicar',
      },
    };
  }

  const eventType = EVENT_TYPE_BY_PAYMENT_STATUS[latestPayment.paymentStatus];
  const detail: ReconciliationEventDetail = {
    subscriptionId: subscription.id,
    paymentId: latestPayment.paymentId,
    paymentStatus: latestPayment.paymentStatus,
    eventType,
  };

  if (!apply) {
    return { action: 'log', outcome: 'would_apply', detail };
  }

  return {
    action: 'apply',
    event: {
      eventId: latestPayment.paymentId,
      eventType,
      asaasSubscriptionId: subscription.externalSubscriptionId,
      asaasCustomerId: latestPayment.customerId ?? subscription.externalCustomerId,
      nextDueDate: latestPayment.dueDate,
    },
    detail,
  };
}
