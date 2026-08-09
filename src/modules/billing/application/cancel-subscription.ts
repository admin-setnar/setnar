import type { PaymentGateway } from '@/modules/billing/domain/payment-gateway';
import type { SubscriptionGateway } from '@/modules/billing/domain/subscription-gateway';

export type CancelOwnSubscriptionResult =
  | { readonly status: 'canceled' }
  | { readonly status: 'already_canceled' }
  | { readonly status: 'not_found' }
  | { readonly status: 'error' };

/**
 * Orquestra o cancelamento da própria assinatura (SET-32), política
 * confirmada em `BILLING_DECISIONS_PLAN.md` §5.3: remove a assinatura no
 * Asaas imediatamente (nenhuma cobrança futura), mas o acesso local
 * continua até `current_period_end` — a mesma graça que
 * `is_subscription_active()` já concede desde o ADR-072, sem tocar nenhuma
 * data aqui.
 *
 * Três passos, nunca reordenados:
 * 1. `prepareCancellation()` — lê o id externo (se houver) e valida
 *    elegibilidade, sem escrever nada.
 * 2. Se houver `externalSubscriptionId`, cancela no Asaas. Uma linha
 *    `provider = 'manual'` (fixture, nunca passou pelo Asaas) não tem id
 *    nenhum — pula direto para o passo 3.
 * 3. `confirmCancellation()` — só é chamada depois que o passo 2 confirma
 *    sucesso (`'canceled'` ou `'not_found'`, ambos significam "não há mais
 *    cobrança futura no Asaas"). Uma falha no passo 2 nunca chega aqui —
 *    "falha externa não mostra sucesso falso", mesmo princípio já aplicado
 *    ao checkout (`start-checkout.ts`).
 */
export async function cancelSubscription(
  subscriptionGateway: SubscriptionGateway,
  paymentGateway: PaymentGateway,
): Promise<CancelOwnSubscriptionResult> {
  const prepared = await subscriptionGateway.prepareCancellation();

  if (prepared.status === 'already_canceled') return { status: 'already_canceled' };
  if (prepared.status !== 'cancelable') return { status: prepared.status };

  if (prepared.externalSubscriptionId) {
    const gatewayResult = await paymentGateway.cancelSubscription(prepared.externalSubscriptionId);
    if (gatewayResult.status === 'error') return { status: 'error' };
  }

  const confirmed = await subscriptionGateway.confirmCancellation();
  if (confirmed.status === 'error') return { status: 'error' };
  if (confirmed.status === 'not_found') return { status: 'not_found' };
  return { status: confirmed.status };
}
