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
  | {
      readonly status: 'reserved';
      readonly localSubscriptionId: string;
      readonly amountCents: number;
      /**
       * Id da assinatura Asaas abandonada quando esta reserva reaproveita uma
       * linha suspensa/cancelada (retentativa de checkout) — `null` para
       * cliente novo ou linha que nunca teve id externo. `startCheckout`
       * cancela este id no Asaas antes de criar o novo checkout, para nunca
       * deixar duas assinaturas cobrando em paralelo (SET-34 follow-up).
       */
      readonly staleExternalSubscriptionId: string | null;
    }
  | { readonly status: 'already_active' }
  | { readonly status: 'sold_out' }
  | { readonly status: 'representative_not_found' }
  | { readonly status: 'error' };

/**
 * Cancelamento (SET-32) — dois passos, não um, porque a chamada ao Asaas
 * (rede, feita pela camada de aplicação) precisa acontecer ENTRE a leitura
 * do `external_subscription_id` e a escrita de `status = 'canceled'`; ver o
 * comentário no topo de `20260829000000_add_subscription_cancellation.sql`.
 */
export type PrepareCancellationResult =
  | { readonly status: 'cancelable'; readonly externalSubscriptionId: string | null }
  | { readonly status: 'already_canceled' }
  | { readonly status: 'not_found' }
  | { readonly status: 'error' };

export type ConfirmCancellationResult =
  | { readonly status: 'canceled' }
  | { readonly status: 'already_canceled' }
  | { readonly status: 'not_found' }
  /**
   * `external_subscription_id` da linha não bate mais com o id lido por
   * `prepareCancellation()` (ex.: um webhook reescreveu o campo na janela
   * entre os dois passos) — nenhuma escrita aconteceu, mesmo "falha externa
   * não mostra sucesso falso" agora para "estado mudou por baixo".
   */
  | { readonly status: 'changed' }
  | { readonly status: 'error' };

export interface SubscriptionGateway {
  reserveCheckoutSlot(): Promise<ReserveCheckoutSlotResult>;
  /** Lê o id externo a cancelar (se houver) e valida elegibilidade — nunca escreve. */
  prepareCancellation(): Promise<PrepareCancellationResult>;
  /**
   * Só deve ser chamada depois que o gateway de pagamento confirma o
   * cancelamento externo. `externalSubscriptionId` é o mesmo valor que
   * `prepareCancellation()` devolveu — a RPC só escreve se a linha ainda
   * tiver esse id.
   */
  confirmCancellation(externalSubscriptionId: string | null): Promise<ConfirmCancellationResult>;
}
