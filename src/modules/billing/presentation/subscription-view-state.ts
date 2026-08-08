import type { OwnSubscriptionView } from '@/modules/billing/domain/subscription-repository';

/**
 * Vista mínima para `/app/conta` decidir entre mostrar o formulário de
 * checkout, um estado de espera, ou a assinatura ativa. Cobertura completa
 * dos estados nuançados (`past_due` exposto, distinção fina entre
 * "aguardando 1º pagamento" e "pagamento falhou") fica para SET-31, que
 * estende este mesmo arquivo em vez de reescrevê-lo — aqui só o essencial
 * que o próprio checkout (SET-28) precisa para não deixar quem já tem
 * assinatura ver o formulário de novo.
 */
export type SubscriptionViewState =
  | { readonly kind: 'none' }
  | { readonly kind: 'awaiting_payment' }
  | { readonly kind: 'checkout_incomplete' }
  | { readonly kind: 'active' }
  | { readonly kind: 'active_until'; readonly currentPeriodEnd: string }
  | { readonly kind: 'inactive' };

export function getSubscriptionViewState(view: OwnSubscriptionView | null): SubscriptionViewState {
  if (!view) return { kind: 'none' };

  if (view.status === 'active') return { kind: 'active' };

  if (view.status === 'canceled') {
    if (view.currentPeriodEnd && new Date(view.currentPeriodEnd) > new Date()) {
      return { kind: 'active_until', currentPeriodEnd: view.currentPeriodEnd };
    }
    return { kind: 'inactive' };
  }

  // status === 'suspended' (ou 'past_due', reservado e sem uso real — ver
  // migration 20260823000000).
  return view.hasExternalSubscription ? { kind: 'awaiting_payment' } : { kind: 'checkout_incomplete' };
}
