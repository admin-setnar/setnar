import 'server-only';

import type {
  CancelSubscriptionResult,
  CreateCheckoutInput,
  CreateCheckoutResult,
  CreateCustomerInput,
  CreateCustomerResult,
  GetLatestPaymentResult,
  PaymentGateway,
} from '@/modules/billing/domain/payment-gateway';
import type { PaymentMethod } from '@/modules/billing/domain/subscription';
import { fetchAsaasLatestPayment } from '@/modules/billing/infrastructure/fetch-asaas-latest-payment';
import {
  mapAsaasCheckoutError,
  mapAsaasCustomerError,
  type AsaasErrorResponseLike,
} from '@/modules/billing/infrastructure/map-asaas-error';

/**
 * Único valor legal hoje (SET-24) mapeia para o único `billingType` que o
 * Checkout Asaas recebe deste projeto. Ampliar — Pix Automático como um
 * segundo valor de `PaymentMethod` — é uma entrada nova aqui, não uma
 * reescrita da função nem do contrato do port.
 */
function mapPaymentMethodToAsaasBillingType(method: PaymentMethod): string {
  switch (method) {
    case 'credit_card':
      return 'CREDIT_CARD';
  }
}

/** Data corrida de hoje em UTC, formato `AAAA-MM-DD` — ver o comentário em `createCheckout`. */
function nextChargeDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Config lida uma única vez pela factory (`asaas-payment-gateway-factory.ts`)
 * e injetada aqui — o adapter nunca lê `process.env` diretamente.
 */
export interface AsaasConfig {
  readonly apiKey: string;
  readonly baseUrl: string;
}

/**
 * Adapter de infraestrutura para o Asaas (SET-27,
 * `docs/plans/BILLING_DECISIONS_PLAN.md` §2.3). Chama a REST API via
 * `fetch` diretamente — nenhuma chamada HTTP nem vocabulário do Asaas
 * escapa deste arquivo, o domínio só vê `PaymentGateway`.
 *
 * **Revisado no mesmo dia da primeira versão** para usar o Checkout Asaas
 * hospedado em vez de enviar dados de cartão inline — ver o comentário em
 * `domain/payment-gateway.ts` para o porquê (exposição a SAQ-D, PCI-DSS).
 *
 * Header de autenticação é `access_token` (confirmado contra
 * docs.asaas.com) — diferente do header `asaas-access-token` que o Asaas
 * usa para autenticar as requisições que ELE envia a nós (webhook, SET-29).
 */
export class AsaasPaymentGateway implements PaymentGateway {
  constructor(private readonly config: AsaasConfig) {}

  /**
   * `phone`/`postalCode`/`addressNumber` (SET-28 follow-up, achado testando
   * o checkout real): sem eles, `POST /v3/checkouts` com `chargeTypes:
   * ['RECURRENT']` rejeita com `invalid_object` — "O campo phone/address/
   * addressNumber/postalCode/province/city deve existir para o customer
   * informado." Enviando só `postalCode` + `addressNumber` aqui, o Asaas
   * resolve `address`/`province`/`city` sozinho a partir do CEP — não é
   * preciso enviar os três (confirmado contra `docs.asaas.com`).
   */
  async createCustomer(input: CreateCustomerInput): Promise<CreateCustomerResult> {
    const response = await this.post('/v3/customers', {
      name: input.name,
      cpfCnpj: input.documentId,
      email: input.email,
      phone: input.phone,
      postalCode: input.postalCode,
      addressNumber: input.addressNumber,
    });

    if (response.ok) {
      const body = (await response.json()) as { id?: string };
      if (!body.id) return { status: 'error' };
      return { status: 'created', externalCustomerId: body.id };
    }

    const errorBody = await this.readErrorBody(response);
    const reason = mapAsaasCustomerError(errorBody);
    if (reason) return { status: 'rejected', reason };
    return { status: 'error' };
  }

  /**
   * `chargeTypes: ['RECURRENT']` + o objeto `subscription` fazem o Asaas
   * criar, assim que o cliente pagar na página hospedada, uma assinatura
   * normal com cobrança mensal automática — a partir daí ela se comporta
   * como qualquer `subscription` do Asaas, gerando os eventos `PAYMENT_*`
   * de sempre. `externalReference` é o `id` local (`localSubscriptionId`),
   * devolvido dentro do payload do webhook `CHECKOUT_PAID` (SET-29/30) —
   * é assim que a linha local é encontrada, já que nenhum id do Asaas
   * existe ainda neste momento.
   */
  async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    const response = await this.post('/v3/checkouts', {
      billingTypes: [mapPaymentMethodToAsaasBillingType(input.paymentMethod)],
      chargeTypes: ['RECURRENT'],
      externalReference: input.localSubscriptionId,
      callback: {
        successUrl: input.callback.successUrl,
        cancelUrl: input.callback.cancelUrl,
        expiredUrl: input.callback.expiredUrl,
      },
      items: [
        {
          name: 'Assinatura SETNAR',
          description: 'Assinatura mensal da plataforma SETNAR',
          value: input.amount.amountCents / 100,
          // Obrigatório pela API do Asaas mesmo para um item de assinatura
          // único (sem noção de "quantidade" no nosso domínio) — omitir
          // gera `parser_error`/"O campo 'quantity' precisa ser informado."
          // Achado testando checkout real contra o Sandbox.
          quantity: 1,
        },
      ],
      customer: input.externalCustomerId,
      subscription: {
        cycle: 'MONTHLY',
        // Obrigatório pela API do Asaas ("O campo nextDueDate deve ser
        // informado.", achado testando checkout real contra o Sandbox) —
        // a data da primeira cobrança do ciclo recorrente. Hoje: o cliente
        // é cobrado assim que conclui o pagamento na página hospedada, não
        // depois. Data corrida em UTC (`toISOString`) — o runtime não tem
        // fuso de Brasília garantido; na pior janela (fim do dia em
        // Brasília) a primeira cobrança fica marcada para o dia UTC
        // seguinte, no máximo poucas horas de folga, nunca atraso real.
        nextDueDate: nextChargeDate(),
      },
    });

    if (response.ok) {
      const body = (await response.json()) as { id?: string; link?: string };
      if (!body.id || !body.link) return { status: 'error' };
      return { status: 'created', checkoutUrl: body.link, externalCheckoutId: body.id };
    }

    const errorBody = await this.readErrorBody(response);
    const reason = mapAsaasCheckoutError(errorBody);
    if (reason) return { status: 'rejected', reason };
    return { status: 'error' };
  }

  async cancelSubscription(externalSubscriptionId: string): Promise<CancelSubscriptionResult> {
    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl}/v3/subscriptions/${externalSubscriptionId}`, {
        method: 'DELETE',
        headers: { access_token: this.config.apiKey },
      });
    } catch {
      return { status: 'error' };
    }

    if (response.status === 404) return { status: 'not_found' };
    if (!response.ok) return { status: 'error' };
    return { status: 'canceled' };
  }

  /** SET-33 — ver `fetch-asaas-latest-payment.ts`; extraída para fora deste arquivo para ser chamável de `scripts/reconcile-billing-subscription.ts`, que roda fora do bundle Next.js (`server-only` lança incondicionalmente fora dele). */
  async getLatestPayment(externalSubscriptionId: string): Promise<GetLatestPaymentResult> {
    return fetchAsaasLatestPayment(this.config, externalSubscriptionId);
  }

  private async post(path: string, body: unknown): Promise<Response> {
    try {
      return await fetch(`${this.config.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          access_token: this.config.apiKey,
        },
        body: JSON.stringify(body),
      });
    } catch {
      // Falha de rede vira uma Response sintética 'error'-shaped só para o
      // caller comum (`response.ok` falso) tratar no mesmo lugar — nunca
      // propagada como exceção não tratada para fora do adapter.
      return new Response(null, { status: 599 });
    }
  }

  private async readErrorBody(response: Response): Promise<AsaasErrorResponseLike> {
    try {
      return (await response.json()) as AsaasErrorResponseLike;
    } catch {
      return {};
    }
  }
}
