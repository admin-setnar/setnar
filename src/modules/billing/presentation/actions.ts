'use server';

import { revalidatePath } from 'next/cache';

import { startCheckout } from '@/modules/billing/application/start-checkout';
import { getPaymentGateway } from '@/modules/billing/infrastructure/asaas-payment-gateway-factory';
import { getSubscriptionGateway } from '@/modules/billing/infrastructure/subscription-gateway-factory';
import type { StartCheckoutFailure } from '@/modules/billing/presentation/checkout-error-messages';
import { safeBillingCall } from '@/modules/billing/presentation/safe-billing-call';
import { checkoutSchema, toStartCheckoutInput, type CheckoutFormValues } from '@/modules/billing/presentation/schemas/checkout.schema';

/**
 * Inicia o checkout do plano único (SET-28). Revalida com o mesmo schema
 * client-side, mesmo split de todo outro formulário deste projeto.
 *
 * `null`-means-success (mesma convenção de `activateProductAction`/
 * `updateRepresentativeProfileAction`): esta ação nunca `redirect()`, o
 * componente do formulário mostra o estado "pendente" em linha.
 * `revalidatePath('/app/conta')` para o hub refletir a Subscription recém
 * reservada assim que a página re-renderizar.
 */
export async function startCheckoutAction(values: CheckoutFormValues): Promise<StartCheckoutFailure | null> {
  const parsed = checkoutSchema.safeParse(values);
  if (!parsed.success) return { status: 'error' };

  const result = await safeBillingCall(async () => {
    const [subscriptionGateway, paymentGateway] = await Promise.all([getSubscriptionGateway(), getPaymentGateway()]);
    return startCheckout(subscriptionGateway, paymentGateway, toStartCheckoutInput(parsed.data));
  });

  if (result.status === 'pending') {
    revalidatePath('/app/conta');
    return null;
  }
  return result;
}
