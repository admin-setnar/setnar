'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { startCheckout } from '@/modules/billing/application/start-checkout';
import { getPaymentGateway } from '@/modules/billing/infrastructure/asaas-payment-gateway-factory';
import { getSubscriptionGateway } from '@/modules/billing/infrastructure/subscription-gateway-factory';
import type { StartCheckoutFailure } from '@/modules/billing/presentation/checkout-error-messages';
import { safeBillingCall } from '@/modules/billing/presentation/safe-billing-call';
import { checkoutSchema, type CheckoutFormValues } from '@/modules/billing/presentation/schemas/checkout.schema';

/**
 * Inicia o checkout do plano único (SET-28) via Checkout Asaas hospedado.
 *
 * Sucesso `redirect()`a para o domínio do Asaas — chamado *dentro* do
 * callback de `safeBillingCall`, mesmo cuidado que
 * `registerRepresentativeAction` já toma para o `NEXT_REDIRECT` ser
 * reconhecido e relançado, não engolido (ver `safe-billing-call.ts` e
 * ADR-020). Um retorno normal desta função é sempre falha — mesma
 * convenção que toda Server Action deste projeto que termina em
 * `redirect()` já estabelece.
 */
export async function startCheckoutAction(values: CheckoutFormValues): Promise<StartCheckoutFailure | null> {
  const parsed = checkoutSchema.safeParse(values);
  if (!parsed.success) return { status: 'error' };

  const callbackBaseUrl = await resolveCallbackBaseUrl();
  const contaUrl = (checkout: 'success' | 'canceled' | 'expired') => `${callbackBaseUrl}/app/conta?checkout=${checkout}`;

  return safeBillingCall(async () => {
    const [subscriptionGateway, paymentGateway] = await Promise.all([getSubscriptionGateway(), getPaymentGateway()]);
    const result = await startCheckout(subscriptionGateway, paymentGateway, {
      holderName: parsed.data.holderName,
      holderDocumentId: parsed.data.holderDocumentId,
      holderEmail: parsed.data.holderEmail,
      callback: {
        successUrl: contaUrl('success'),
        cancelUrl: contaUrl('canceled'),
        expiredUrl: contaUrl('expired'),
      },
    });

    if (result.status === 'redirect') redirect(result.checkoutUrl);
    return result;
  });
}

/**
 * Mesma resolução de origem que `resolveResetCallbackUrl`
 * (`modules/auth/presentation/actions.ts`) — `x-forwarded-proto` é o que a
 * Vercel define em produção; sem ele (dev local), assume `http` para
 * `localhost`. Deliberadamente baseada no `Host` da requisição, não em
 * `SITE_URL`: um checkout iniciado a partir de uma preview deployment da
 * Vercel precisa redirecionar de volta para essa mesma preview, não para
 * produção (mesmo raciocínio documentado em `supabase/README.md` §3 para o
 * link de redefinição de senha).
 */
async function resolveCallbackBaseUrl(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get('host') ?? 'localhost:3000';
  const protocol = headerList.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${protocol}://${host}`;
}
