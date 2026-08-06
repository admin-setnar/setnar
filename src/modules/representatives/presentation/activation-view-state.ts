import type { CatalogActivationState } from '@/modules/representatives/domain/representative-catalog-repository';

export interface ActivationViewState {
  readonly badge: {
    readonly label: string;
    readonly variant: 'neutral' | 'warning' | 'success';
  };
  readonly canPublish: boolean;
  readonly isPubliclyAvailable: boolean;
  readonly subscriptionBlocked: boolean;
}

const STATE_BADGE: Record<CatalogActivationState, ActivationViewState['badge']> = {
  not_activated: { label: 'Não ativado', variant: 'neutral' },
  draft: { label: 'Rascunho', variant: 'warning' },
  published: { label: 'Publicado', variant: 'success' },
  unpublished: { label: 'Despublicado', variant: 'neutral' },
};

/**
 * Combines stored activation state with the same Subscription decision used
 * by the database read/write gates. A stored `published` row is not presented
 * as publicly available while E1 hides it from visitors.
 */
export function getActivationViewState(
  state: CatalogActivationState,
  subscriptionActive: boolean,
): ActivationViewState {
  const subscriptionBlocked = !subscriptionActive && state !== 'not_activated';

  if (state === 'published' && !subscriptionActive) {
    return {
      badge: { label: 'Indisponível — assinatura inativa', variant: 'warning' },
      canPublish: false,
      isPubliclyAvailable: false,
      subscriptionBlocked: true,
    };
  }

  return {
    badge: STATE_BADGE[state],
    canPublish: subscriptionActive && (state === 'draft' || state === 'unpublished'),
    isPubliclyAvailable: subscriptionActive && state === 'published',
    subscriptionBlocked,
  };
}
