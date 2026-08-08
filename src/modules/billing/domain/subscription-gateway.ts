/**
 * Os dois passos de escrita do checkout (SET-28), cada um mapeado 1:1 a uma
 * função `security definer` própria (`reserve_billing_checkout_slot`,
 * `record_billing_external_ids`) — nunca combinados numa função só, porque
 * a reserva precisa acontecer ANTES da chamada ao gateway de pagamento e o
 * registro dos ids externos só DEPOIS que ela responder (ver o comentário
 * da migration `20260824000000_add_billing_checkout_functions.sql`).
 * "Gateway" porque escreve/age — mesma convenção de
 * `RepresentativeOnboardingGateway`; `SubscriptionRepository` (arquivo
 * irmão) é o port de só-leitura.
 */

export type ReserveCheckoutSlotResult =
  | { readonly status: 'reserved'; readonly amountCents: number }
  | { readonly status: 'already_active' }
  | { readonly status: 'sold_out' }
  | { readonly status: 'representative_not_found' }
  | { readonly status: 'error' };

export type RecordExternalIdsResult =
  | { readonly status: 'updated' }
  | { readonly status: 'not_found' }
  | { readonly status: 'representative_not_found' }
  | { readonly status: 'error' };

export interface SubscriptionGateway {
  reserveCheckoutSlot(): Promise<ReserveCheckoutSlotResult>;
  recordExternalIds(externalCustomerId: string, externalSubscriptionId: string): Promise<RecordExternalIdsResult>;
}
