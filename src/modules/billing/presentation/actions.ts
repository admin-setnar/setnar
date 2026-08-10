'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { cancelSubscription } from '@/modules/billing/application/cancel-subscription';
import { startCheckout } from '@/modules/billing/application/start-checkout';
import { getPaymentGateway } from '@/modules/billing/infrastructure/asaas-payment-gateway-factory';
import { getSubscriptionGateway } from '@/modules/billing/infrastructure/subscription-gateway-factory';
import type { CancelSubscriptionFailure } from '@/modules/billing/presentation/cancel-subscription-error-messages';
import type { StartCheckoutFailure } from '@/modules/billing/presentation/checkout-error-messages';
import { safeBillingCall } from '@/modules/billing/presentation/safe-billing-call';
import { checkoutSchema, type CheckoutFormValues } from '@/modules/billing/presentation/schemas/checkout.schema';
import { stripNonDigits } from '@/modules/billing/domain/billing-rules';
import { formatE164ToBRPhone } from '@/shared/domain/br-phone';
import { getCurrentUser } from '@/modules/auth/infrastructure/auth-gateway-factory';
import { getRepresentativeAccountRepository } from '@/modules/representatives/infrastructure/representative-account-repository-factory';

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
    // Telefone vem do perfil já cadastrado (onboarding), nunca do
    // formulário de checkout — ver checkout.schema.ts. Sem representante ou
    // sem telefone, não há como criar o customer no Asaas; mapeado para o
    // mesmo `{ status: 'error' }` genérico que qualquer outra falha
    // inesperada deste fluxo.
    const user = await getCurrentUser();
    const representative = user ? await (await getRepresentativeAccountRepository()).findByProfileId(user.id) : null;
    if (!representative?.phone) return { status: 'error' } as const;

    const [subscriptionGateway, paymentGateway] = await Promise.all([getSubscriptionGateway(), getPaymentGateway()]);
    const result = await startCheckout(subscriptionGateway, paymentGateway, {
      holderName: parsed.data.holderName,
      holderDocumentId: parsed.data.holderDocumentId,
      holderEmail: parsed.data.holderEmail,
      // `representative.phone` é E.164 (`+55DDNNNNNNNNN`, ver
      // `br-phone.ts`) — `stripNonDigits` sozinho deixaria o `55` do país
      // colado no número (achado em code review). `formatE164ToBRPhone`
      // primeiro reduz ao formato nacional que o customer do Asaas espera.
      holderPhone: stripNonDigits(formatE164ToBRPhone(representative.phone)),
      postalCode: parsed.data.postalCode,
      addressNumber: parsed.data.addressNumber,
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

/**
 * Cancela a própria assinatura (SET-32). `null` significa sucesso — mesma
 * convenção de `setActivationStatusAction`: esta ação nunca `redirect()`a,
 * `revalidatePath` refaz o Server Component com o novo estado
 * (`SubscriptionViewState` passa a `active_until`/`inactive`, o que já
 * derruba o próprio botão de cancelar do próximo render — ver
 * `subscription-view-state.ts`). `already_canceled` também conta como
 * sucesso — clicar de novo numa aba obsoleta não deve parecer um erro.
 *
 * Revalida `/app/paginas` também: perder entitlement muda `canPublish`/
 * `isPubliclyAvailable` no hub, não só o painel de `/app/conta`.
 */
export async function cancelSubscriptionAction(): Promise<CancelSubscriptionFailure | null> {
  const result = await safeBillingCall(async () => {
    const subscriptionGateway = await getSubscriptionGateway();
    return cancelSubscription(subscriptionGateway, getPaymentGateway);
  });

  if (result.status === 'canceled' || result.status === 'already_canceled') {
    revalidatePath('/app/conta');
    revalidatePath('/app/paginas');
    return null;
  }
  return result;
}
