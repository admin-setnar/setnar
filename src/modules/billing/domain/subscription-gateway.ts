/**
 * Escrita local do checkout (SET-28), mapeada a `reserve_billing_checkout_slot()`
 * — a reserva precisa acontecer ANTES da chamada ao gateway de pagamento
 * (ver o comentário da migration `20260824000000_add_billing_checkout_functions.sql`).
 * "Gateway" porque escreve/age — mesma convenção de
 * `RepresentativeOnboardingGateway`; `SubscriptionRepository` (arquivo
 * irmão) é o port de só-leitura.
 *
 * **Revisado no mesmo dia da primeira versão:** não existe mais
 * `recordExternalIds` aqui. No fluxo de Checkout Asaas hospedado, os ids
 * externos só existem depois que o cliente paga na página do Asaas — quem
 * grava eles é o webhook (SET-29/30), casando pelo `id` local que
 * `reserveCheckoutSlot` devolve e que vira `externalReference` na criação
 * do checkout, nunca uma chamada autenticada síncrona logo após o checkout
 * ser criado.
 */

export type ReserveCheckoutSlotResult =
  | { readonly status: 'reserved'; readonly localSubscriptionId: string; readonly amountCents: number }
  | { readonly status: 'already_active' }
  | { readonly status: 'sold_out' }
  | { readonly status: 'representative_not_found' }
  | { readonly status: 'error' };

export interface SubscriptionGateway {
  reserveCheckoutSlot(): Promise<ReserveCheckoutSlotResult>;
}
