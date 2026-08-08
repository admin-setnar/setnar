import 'server-only';

import type { PaymentGateway } from '@/modules/billing/domain/payment-gateway';
import { AsaasPaymentGateway } from '@/modules/billing/infrastructure/asaas-payment-gateway';

/**
 * Composition root do gateway de pagamento — mesma forma de
 * `getRepresentativeOnboardingGateway()`
 * (`modules/representatives/infrastructure/representative-onboarding-gateway-factory.ts`):
 * lê configuração server-only e devolve o adapter, sem cache entre chamadas
 * (o adapter aqui não carrega estado de requisição como o cliente Supabase
 * carrega, mas o padrão do módulo é este e não há razão para divergir).
 *
 * `ASAAS_API_KEY` e `ASAAS_BASE_URL` nunca são lidos fora deste arquivo —
 * é o único lugar do módulo que toca `process.env` para o Asaas. Lança se a
 * chave estiver ausente: um gateway de billing sem credencial não deve
 * degradar silenciosamente, deve falhar alto no boot do caminho que o usa.
 */
export function getPaymentGateway(): PaymentGateway {
  const apiKey = process.env.ASAAS_API_KEY;
  const baseUrl = process.env.ASAAS_BASE_URL;

  if (!apiKey) {
    throw new Error('ASAAS_API_KEY is not configured.');
  }
  if (!baseUrl) {
    throw new Error('ASAAS_BASE_URL is not configured.');
  }

  return new AsaasPaymentGateway({ apiKey, baseUrl });
}
