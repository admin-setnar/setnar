import 'server-only';

import type {
  CancelSubscriptionResult,
  CreateCustomerInput,
  CreateCustomerResult,
  CreateSubscriptionInput,
  CreateSubscriptionResult,
  PaymentGateway,
} from '@/modules/billing/domain/payment-gateway';
import {
  mapAsaasCustomerError,
  mapAsaasSubscriptionError,
  type AsaasErrorResponseLike,
} from '@/modules/billing/infrastructure/map-asaas-error';

/**
 * Config lida uma única vez pela factory (`asaas-payment-gateway-factory.ts`)
 * e injetada aqui — o adapter nunca lê `process.env` diretamente, mesmo
 * padrão de todo outro adapter deste projeto que precisa de segredo.
 * `apiKey` nunca deve ser logado nem incluído em nenhum erro que cruze o
 * boundary do módulo.
 */
export interface AsaasConfig {
  readonly apiKey: string;
  readonly baseUrl: string;
}

/**
 * Adapter de infraestrutura para o Asaas (SET-27,
 * `docs/plans/BILLING_DECISIONS_PLAN.md` §2.3). Chama a REST API via
 * `fetch` diretamente — este projeto não depende do SDK do Asaas, então
 * "restringir o SDK à infraestrutura" (critério de aceite do SET-27)
 * significa simplesmente que nenhuma chamada HTTP nem vocabulário do Asaas
 * (`cpfCnpj`, `billingType`, `creditCardHolderInfo`, códigos `PAYMENT_*`)
 * escapa deste arquivo — o domínio só vê `PaymentGateway`.
 *
 * Header de autenticação é `access_token` (confirmado contra
 * docs.asaas.com em 2026-08-08) — **diferente** do header
 * `asaas-access-token` que o Asaas usa para autenticar as requisições que
 * ELE envia a nós (webhook, SET-29). Não confundir os dois.
 */
export class AsaasPaymentGateway implements PaymentGateway {
  constructor(private readonly config: AsaasConfig) {}

  async createCustomer(input: CreateCustomerInput): Promise<CreateCustomerResult> {
    const response = await this.post('/v3/customers', {
      name: input.name,
      cpfCnpj: input.documentId,
      email: input.email,
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

  async createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult> {
    const response = await this.post('/v3/subscriptions', {
      customer: input.externalCustomerId,
      billingType: 'CREDIT_CARD',
      value: input.amount.amountCents / 100,
      nextDueDate: input.nextDueDate,
      cycle: 'MONTHLY',
      creditCard: {
        holderName: input.card.holderName,
        number: input.card.number,
        expiryMonth: input.card.expiryMonth,
        expiryYear: input.card.expiryYear,
        ccv: input.card.ccv,
      },
      creditCardHolderInfo: {
        name: input.cardHolder.name,
        cpfCnpj: input.cardHolder.documentId,
        email: input.cardHolder.email,
        phone: input.cardHolder.phone,
        postalCode: input.cardHolder.postalCode,
        addressNumber: input.cardHolder.addressNumber,
      },
    });

    if (response.ok) {
      const body = (await response.json()) as { id?: string };
      if (!body.id) return { status: 'error' };
      return { status: 'created', externalSubscriptionId: body.id };
    }

    const errorBody = await this.readErrorBody(response);
    const reason = mapAsaasSubscriptionError(errorBody);
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
