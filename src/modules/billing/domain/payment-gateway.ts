import type { Money, PaymentMethod } from '@/modules/billing/domain/subscription';

/**
 * Dados do titular exigidos pelo gateway ao lado do cartão em si (CPF/CNPJ,
 * contato, endereço) — nome genérico de domínio, não o nome exato que o
 * Asaas usa (`creditCardHolderInfo`); a tradução 1:1 acontece só no adapter
 * (`infrastructure/asaas-payment-gateway.ts`), mesmo split que
 * `RegisterRepresentativeInput`/`SupabaseRepresentativeOnboardingGateway`
 * já usam.
 */
export interface CardHolderInfo {
  readonly name: string;
  readonly documentId: string;
  readonly email: string;
  readonly phone: string;
  readonly postalCode: string;
  readonly addressNumber: string;
}

/**
 * **Nota de PCI, registrada aqui de propósito.** A tokenização antecipada de
 * cartão do Asaas (`/v3/creditCard/tokenize`) precisa ser habilitada
 * manualmente pelo gerente de conta em produção — não está garantida no
 * lançamento (verificado durante SET-27, 2026-08-08). Por isso este port
 * aceita os dados crus do cartão na mesma chamada de `createSubscription`,
 * que é o único caminho sempre disponível. **Consequência real: os dados do
 * cartão passam pelo servidor do SETNAR antes de chegar ao Asaas** — nunca
 * devem ser logados, persistidos, ou deixar a função que os encaminha.
 * Quando a tokenização for habilitada na conta, este port pode ganhar um
 * segundo método (`tokenizeCard`) e `CreateSubscriptionInput` pode aceitar
 * um `cardToken` como alternativa aos campos crus — aditivo, não uma
 * reescrita. Acompanhar como um follow-up operacional, não bloqueador deste
 * plano.
 */
export interface CardDetails {
  readonly holderName: string;
  readonly number: string;
  readonly expiryMonth: string;
  readonly expiryYear: string;
  readonly ccv: string;
}

export interface CreateCustomerInput {
  readonly name: string;
  readonly documentId: string;
  readonly email: string;
}

export type CreateCustomerResult =
  | { readonly status: 'created'; readonly externalCustomerId: string }
  | { readonly status: 'rejected'; readonly reason: 'invalid_document' | 'duplicate_customer' }
  | { readonly status: 'error' };

export interface CreateSubscriptionInput {
  readonly externalCustomerId: string;
  readonly paymentMethod: PaymentMethod;
  readonly amount: Money;
  /** Formato `YYYY-MM-DD`. Resolvido pelo caso de uso, não pelo adapter — o port não decide política de datas. */
  readonly nextDueDate: string;
  readonly card: CardDetails;
  readonly cardHolder: CardHolderInfo;
}

export type CreateSubscriptionResult =
  | { readonly status: 'created'; readonly externalSubscriptionId: string }
  | { readonly status: 'rejected'; readonly reason: 'card_declined' | 'invalid_card' | 'invalid_holder_data' }
  | { readonly status: 'error' };

export type CancelSubscriptionResult =
  | { readonly status: 'canceled' }
  | { readonly status: 'not_found' }
  | { readonly status: 'error' };

/**
 * Port para o gateway de pagamento (SET-27) — Asaas hoje
 * (`docs/plans/BILLING_DECISIONS_PLAN.md` §2.3), mas o vocabulário é
 * genérico de propósito: `paymentMethod` existe desde já em
 * `CreateSubscriptionInput` mesmo só aceitando `'credit_card'`, para que Pix
 * Automático entre depois como um novo valor + um novo ramo no adapter, não
 * uma reescrita do contrato (§6.1). "Gateway" porque escreve/age — mesma
 * convenção de `AuthGateway`/`RepresentativeOnboardingGateway`;
 * `SubscriptionRepository` (arquivo irmão) é o port de só-leitura.
 */
export interface PaymentGateway {
  createCustomer(input: CreateCustomerInput): Promise<CreateCustomerResult>;
  createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult>;
  cancelSubscription(externalSubscriptionId: string): Promise<CancelSubscriptionResult>;
}
