'use client';

import Link from 'next/link';
import { useState } from 'react';

import type { AnalyticsPeriodDays, ProductAnalyticsSummary } from '@/modules/analytics/domain/analytics-metrics-repository';
import type { CatalogActivationState } from '@/modules/representatives/domain/representative-catalog-repository';
import type { RepresentativeProduct } from '@/modules/representatives/domain/representative';
import { getActivationViewState } from '@/modules/representatives/presentation/activation-view-state';
import {
  activateErrorCopy,
  setActivationStatusErrorCopy,
  type ActivateProductFailure,
  type SetActivationStatusFailure,
} from '@/modules/representatives/presentation/activation-error-messages';
import { activateProductAction, setActivationStatusAction } from '@/modules/representatives/presentation/actions';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { FormAlert } from '@/shared/ui/form-alert';
import { Text } from '@/shared/ui/typography';

/**
 * ProductActivationCard — D5.2/D5.3, one row of the hub per Product.
 *
 * `state` arrives as a prop from `RepresentativeHub` (a Server Component
 * reading `RepresentativeCatalogRepository.listOwnCatalog()`) — this
 * component holds no state of its own about WHAT the activation is, only
 * whether a request is currently `pending` and what the last one failed
 * with. After a successful action, `revalidatePath('/app/paginas')`
 * (`presentation/actions.ts`) invalidates the route; Next.js re-renders the
 * Server Component tree and this component receives a new `state` prop with
 * the same identity (keyed by `product.id`) — the same "server owns the
 * data, client owns only pending/error" split `LogoutButton` already uses
 * for its own single action.
 *
 * Only one of the three controls below is ever rendered for a given `state`
 * — the hub never offers a transition `set_activation_status` would reject
 * (e.g. no "Despublicar" on a `draft`), so `SetActivationStatusRejectionReason`
 * values like `invalid_transition`/`not_activated` are unreachable from this
 * UI in normal use; the error copy for them still exists (`activation-error-messages.ts`)
 * for the direct-RPC-caller/stale-page case that isn't.
 */
export function ProductActivationCard({
  product,
  state,
  subscriptionActive,
  profileComplete,
  analytics,
  periodDays,
}: {
  product: RepresentativeProduct;
  state: CatalogActivationState;
  subscriptionActive: boolean;
  profileComplete: boolean;
  /**
   * SET-37 — AN6. Counts a best-effort read of what was actually recorded:
   * never implies a message was sent, a sale, or a financial conversion
   * (same caution ADR-065 documents for the write side). Zeroed by the
   * caller when the Product has no events/leads in `periodDays`.
   */
  analytics: ProductAnalyticsSummary;
  periodDays: AnalyticsPeriodDays;
}) {
  const [pending, setPending] = useState(false);
  // Tagged by which action produced it, not inferred from the failure's own
  // shape: `ActivateProductFailure`/`SetActivationStatusFailure` both carry a
  // `reason: 'representative_not_found'` variant, indistinguishable from each
  // other by value alone — the tag is what picks the right copy function,
  // not a guess from the payload.
  const [failure, setFailure] = useState<
    { kind: 'activate'; value: ActivateProductFailure } | { kind: 'setStatus'; value: SetActivationStatusFailure } | null
  >(null);

  async function handleActivate() {
    setPending(true);
    setFailure(null);
    try {
      const result = await activateProductAction(product.id);
      if (result) setFailure({ kind: 'activate', value: result });
    } finally {
      setPending(false);
    }
  }

  async function handleSetStatus(status: 'published' | 'unpublished') {
    setPending(true);
    setFailure(null);
    try {
      const result = await setActivationStatusAction(product.id, status);
      if (result) setFailure({ kind: 'setStatus', value: result });
    } finally {
      setPending(false);
    }
  }

  const viewState = getActivationViewState(state, subscriptionActive, profileComplete);
  const publicationBlockerId = viewState.profileBlocked
    ? 'professional-profile-blocker'
    : viewState.subscriptionBlocked
      ? `subscription-blocker-${product.id}`
      : undefined;
  const errorCopy = failure
    ? failure.kind === 'activate'
      ? activateErrorCopy(failure.value)
      : setActivationStatusErrorCopy(failure.value)
    : null;

  return (
    <Card variant="outlined" padding="md" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Text as="p" variant="body">
          <strong className="text-content">{product.name}</strong>
        </Text>
        <Badge variant={viewState.badge.variant}>{viewState.badge.label}</Badge>
      </div>

      {/* SET-37: same visibility condition as "Ver prévia" below — a Product
          with no activation row has no Commercial Page for these numbers to
          describe. Counts recorded activity only; never a message sent, a
          sale, or a financial conversion. */}
      {state !== 'not_activated' ? (
        <Text as="p" variant="caption">
          Últimos {periodDays} dias: {analytics.visits} {analytics.visits === 1 ? 'visita' : 'visitas'} · {analytics.whatsappClicks}{' '}
          {analytics.whatsappClicks === 1 ? 'clique' : 'cliques'} no WhatsApp · {analytics.leads}{' '}
          {analytics.leads === 1 ? 'lead' : 'leads'}
        </Text>
      ) : null}

      {errorCopy ? <FormAlert tone="error" {...errorCopy} /> : null}
      {viewState.subscriptionBlocked ? (
        <div className="space-y-2">
          <FormAlert
            id={`subscription-blocker-${product.id}`}
            tone="error"
            title="Regularize sua assinatura SETNAR"
            description="Ative ou regularize sua assinatura para disponibilizar esta página ao público."
          />
          {/* SET-58: o alerta acima já explica o motivo — falta o caminho
              direto para agir. Sem isso, o representante precisa saber por
              conta própria que a assinatura mora em /app/conta. */}
          <Button asChild size="sm" variant="secondary">
            <Link href="/app/conta">Regularizar assinatura</Link>
          </Button>
        </div>
      ) : null}

      <div className="flex gap-2">
        {state === 'not_activated' ? (
          <Button size="sm" variant="secondary" loading={pending} onClick={() => void handleActivate()}>
            Ativar
          </Button>
        ) : null}

        {state === 'draft' || state === 'unpublished' ? (
          <Button
            size="sm"
            variant="primary"
            loading={pending}
            disabled={!viewState.canPublish || pending}
            aria-describedby={!viewState.canPublish ? publicationBlockerId : undefined}
            onClick={() => void handleSetStatus('published')}
          >
            Publicar
          </Button>
        ) : null}

        {state === 'published' ? (
          <Button size="sm" variant="secondary" loading={pending} onClick={() => void handleSetStatus('unpublished')}>
            Despublicar
          </Button>
        ) : null}

        {/* SET-36: available for every activated state, published included —
            a representative may want to double-check the live page too, not
            only a draft. Never shown for `not_activated`: there is nothing
            for `findOwnActivation` to resolve yet. */}
        {state !== 'not_activated' ? (
          <Button asChild size="sm" variant="ghost">
            <Link href={`/pre-visualizacao/${product.slug}`}>Ver prévia</Link>
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
