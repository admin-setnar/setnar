import type { CatalogActivationState } from '@/modules/representatives/domain/representative-catalog-repository';

export interface ActivationViewState {
  readonly badge: {
    readonly label: string;
    readonly variant: 'neutral' | 'warning' | 'success';
  };
  readonly canPublish: boolean;
  readonly isPubliclyAvailable: boolean;
  readonly subscriptionBlocked: boolean;
  readonly profileBlocked: boolean;
}

/** Exported for SET-36's preview banner, which needs the same label/tone vocabulary without the rest of the view-state decision. */
export const STATE_BADGE: Record<CatalogActivationState, ActivationViewState['badge']> = {
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
  profileComplete = true,
): ActivationViewState {
  // Profile completion is the primary blocker. Subscription feedback is
  // intentionally deferred until the professional profile is complete.
  const subscriptionBlocked = profileComplete && !subscriptionActive && state !== 'not_activated';

  if (state === 'published' && !profileComplete) {
    return {
      badge: { label: 'Indisponível — perfil incompleto', variant: 'warning' },
      canPublish: false,
      isPubliclyAvailable: false,
      subscriptionBlocked,
      profileBlocked: true,
    };
  }

  if (state === 'published' && !subscriptionActive) {
    return {
      badge: { label: 'Indisponível — assinatura inativa', variant: 'warning' },
      canPublish: false,
      isPubliclyAvailable: false,
      subscriptionBlocked: true,
      profileBlocked: !profileComplete,
    };
  }

  return {
    badge: STATE_BADGE[state],
    canPublish: profileComplete && subscriptionActive && (state === 'draft' || state === 'unpublished'),
    isPubliclyAvailable: profileComplete && subscriptionActive && state === 'published',
    subscriptionBlocked,
    profileBlocked: !profileComplete && state !== 'not_activated',
  };
}
