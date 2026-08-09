import type { Money, PaymentMethod } from '@/modules/billing/domain/subscription';

export interface CreateCustomerInput {
  readonly name: string;
  readonly documentId: string;
  readonly email: string;
  /** Telefone comercial já cadastrado no onboarding do representante — nunca coletado de novo no checkout. */
  readonly phone: string;
  readonly postalCode: string;
  readonly addressNumber: string;
}

export type CreateCustomerResult =
  | { readonly status: 'created'; readonly externalCustomerId: string }
  | { readonly status: 'rejected'; readonly reason: 'invalid_document' | 'duplicate_customer' }
  | { readonly status: 'error' };

/**
 * As três URLs de callback exigidas pela criação de um Checkout Asaas —
 * nenhuma delas concede entitlement por si só (a página de retorno só lê o
 * estado já gravado, nunca escreve `active`; ver `start-checkout.ts` e
 * `BILLING_DECISIONS_PLAN.md`, "redirect não concede entitlement").
 */
export interface CheckoutCallbackUrls {
  readonly successUrl: string;
  readonly cancelUrl: string;
  readonly expiredUrl: string;
}

export interface CreateCheckoutInput {
  readonly externalCustomerId: string;
  readonly paymentMethod: PaymentMethod;
  readonly amount: Money;
  /**
   * O `id` da própria linha em `subscriptions` (já reservada por
   * `reserve_billing_checkout_slot`), enviado como `externalReference` na
   * criação do checkout — é assim que o webhook (SET-29/30) casa o evento
   * `CHECKOUT_PAID` de volta à linha certa, já que os ids do Asaas só
   * existem depois que o cliente paga na página hospedada, não no momento
   * desta chamada.
   */
  readonly localSubscriptionId: string;
  readonly callback: CheckoutCallbackUrls;
}

export type CreateCheckoutResult =
  | { readonly status: 'created'; readonly checkoutUrl: string; readonly externalCheckoutId: string }
  | { readonly status: 'rejected'; readonly reason: 'invalid_customer' }
  | { readonly status: 'error' };

export type CancelSubscriptionResult =
  | { readonly status: 'canceled' }
  | { readonly status: 'not_found' }
  | { readonly status: 'error' };

/**
 * Port para o gateway de pagamento (SET-27) — Asaas hoje
 * (`docs/plans/BILLING_DECISIONS_PLAN.md` §2.3).
 *
 * **Revisado no mesmo dia da primeira versão:** a versão original tinha um
 * `createSubscription` que recebia os dados crus do cartão
 * (`CardDetails`/`CardHolderInfo`) e os enviava para o Asaas a partir do
 * nosso servidor. A documentação do Asaas (docs.asaas.com/docs/pci-dss-1)
 * deixa explícito que eles não oferecem tokenização client-side e
 * recomendam certificação SAQ-D — o nível mais alto do PCI-DSS — para quem
 * segue esse caminho. Substituído por `createCheckout`: o cartão é digitado
 * na página hospedada do próprio Asaas, nunca no nosso servidor. Nenhum
 * campo de cartão (número, CVV, validade) existe em lugar nenhum deste
 * módulo agora — não é uma omissão, é a correção.
 *
 * `CreateCheckoutInput.paymentMethod` existe desde já — mesmo só aceitando
 * `'credit_card'` hoje — porque o Asaas Checkout também aceita `PIX`/`BOLETO`
 * em `billingTypes`; quando Pix Automático entrar (SET-24, decisão em
 * aberto), é um novo valor de `PaymentMethod` mapeado no adapter, não uma
 * reescrita do contrato (`BILLING_DECISIONS_PLAN.md` §6.1).
 */
export interface PaymentGateway {
  createCustomer(input: CreateCustomerInput): Promise<CreateCustomerResult>;
  createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult>;
  cancelSubscription(externalSubscriptionId: string): Promise<CancelSubscriptionResult>;
}
