import Link from 'next/link';

import { SITE_URL } from '@/config/site';
import type { FirstPublicationResponse } from '@/modules/feedback/domain/feedback';
import {
  VALUE_PERCEPTION_DETAIL_LABEL,
  VALUE_PERCEPTION_FEEDBACK_OPTIONS,
  VALUE_PERCEPTION_FEEDBACK_QUESTION,
  VALUE_PERCEPTION_OPTIONS_WITH_DETAIL,
} from '@/modules/feedback/presentation/value-perception-feedback-options';
import type { Representative } from '@/modules/representatives/domain/representative';
import type { RepresentativeCatalogEntry } from '@/modules/representatives/domain/representative-catalog-repository';
import { isRepresentativeProfileComplete } from '@/modules/representatives/domain/representative-rules';
import { getActivationViewState } from '@/modules/representatives/presentation/activation-view-state';
import { ProductActivationCard } from '@/modules/representatives/presentation/product-activation-card';
import { QrCodeCard } from '@/modules/representatives/presentation/qr-code-card';
import { Card } from '@/shared/ui/card';
import { FeedbackPrompt, type FeedbackPromptOption } from '@/shared/ui/feedback-prompt';
import { FormAlert } from '@/shared/ui/form-alert';
import { Text } from '@/shared/ui/typography';

/**
 * RepresentativeHub — D5, replaces `RepresentativeHubPlaceholder`.
 *
 * Server Component: `catalog` is already resolved by the caller
 * (`/app/paginas`, via `RepresentativeCatalogRepository.listOwnCatalog()`,
 * D5.1) — this component only renders it and the per-product interactive
 * controls (`ProductActivationCard`, D5.2/D5.3), same split the rest of this
 * module already uses between a Server Component owning data and a small
 * `'use client'` island owning interaction.
 *
 * D5.3 — the public link. Composed from `SITE_URL`
 * (`config/site.ts`, `https://setnar.com` unless overridden by
 * `NEXT_PUBLIC_SITE_URL`), not from the current request's `Host` header:
 * `/app/paginas` is always visited on the root domain, never on a Representative's
 * own subdomain, so there is no request-scoped hostname to read here. This
 * is the gap `RepresentativeHubPlaceholder`'s own doc comment flagged
 * ("nothing in TenantClientView/useTenant() exposes the root hostname
 * today") — closed by reusing the config that already IS this project's
 * single source of truth for its own root domain (`buildTenantMetadata`,
 * `config/seo.ts`, builds `openGraph.url` from the same constant), instead
 * of adding a new one. Matches ADR-026's shape (`<slug>.<domain>`, no path
 * prefix) and only ever shown for a `published` entry — an unpublished or
 * draft activation has no reachable public page yet.
 *
 * Profile editing lives in `/app/conta`; this pages-only surface displays an
 * actionable link there whenever the central publication prerequisites are
 * incomplete.
 */

/**
 * Typed at this SET-61 call site, not inside `FeedbackPrompt` itself — the
 * shared component's `options`/`optionsWithDetail` stay plain `string` (it
 * has no business asserting every context's vocabulary is
 * `FirstPublicationResponse`), while this specific consumer keeps compile-time
 * protection against a typo drifting from `resolve_feedback`'s
 * `first_publication` allow-list. SET-62's own `value_perception` options
 * live in `modules/feedback/presentation/value-perception-feedback-options.ts`
 * instead of here, since `/app/conta` needs the exact same constants and
 * this file is not imported there.
 */
const FIRST_PUBLICATION_FEEDBACK_OPTIONS: ReadonlyArray<
  FeedbackPromptOption & { readonly value: FirstPublicationResponse }
> = [
  { value: 'easy', label: 'Fácil' },
  { value: 'reasonable', label: 'Razoável' },
  { value: 'difficult', label: 'Difícil' },
];
const FIRST_PUBLICATION_OPTIONS_WITH_DETAIL: readonly FirstPublicationResponse[] = ['difficult'];

export function RepresentativeHub({
  representative,
  catalog,
  subscriptionActive,
  showFirstPublicationFeedback = false,
  showValuePerceptionFeedback = false,
}: {
  representative: Representative;
  catalog: readonly RepresentativeCatalogEntry[];
  subscriptionActive: boolean;
  /** SET-61 — set by `/app/paginas` once eligibility (published before, context unresolved) is known server-side. */
  showFirstPublicationFeedback?: boolean;
  /**
   * SET-62 — set by `/app/paginas` once eligibility (14+ days since first
   * publication, at least one real visit, context unresolved) is known
   * server-side. The caller is responsible for never passing this `true` at
   * the same time as `showFirstPublicationFeedback` — the two contexts must
   * never overlap on screen.
   */
  showValuePerceptionFeedback?: boolean;
}) {
  const rootHost = new URL(SITE_URL).hostname;
  const profileComplete = isRepresentativeProfileComplete(representative);

  return (
    <div className="space-y-6">
      <Card variant="raised" padding="lg" className="space-y-1">
        <Text as="h2" variant="title">
          {representative.name}
        </Text>
        <Text as="p" variant="body">
          Sua página: <strong className="text-content">{representative.slug}</strong>
        </Text>
      </Card>

      {showFirstPublicationFeedback ? (
        <FeedbackPrompt
          context="first_publication"
          question="Como foi criar sua página?"
          options={FIRST_PUBLICATION_FEEDBACK_OPTIONS}
          optionsWithDetail={FIRST_PUBLICATION_OPTIONS_WITH_DETAIL}
          detailLabel="O que mais dificultou? (opcional)"
        />
      ) : showValuePerceptionFeedback ? (
        <FeedbackPrompt
          context="value_perception"
          question={VALUE_PERCEPTION_FEEDBACK_QUESTION}
          options={VALUE_PERCEPTION_FEEDBACK_OPTIONS}
          optionsWithDetail={VALUE_PERCEPTION_OPTIONS_WITH_DETAIL}
          detailLabel={VALUE_PERCEPTION_DETAIL_LABEL}
        />
      ) : null}

      {!profileComplete ? (
        <div id="professional-profile-blocker" className="space-y-3">
          <FormAlert
            tone="error"
            title="Complete seu perfil para publicar"
            description="Informe seu nome público e telefone comercial para disponibilizar suas páginas."
          />
          <Link
            href="/app/conta#perfil-profissional"
            className="inline-flex min-h-11 items-center font-medium text-brand underline underline-offset-4"
          >
            Completar perfil profissional
          </Link>
        </div>
      ) : null}

      <div className="space-y-3">
        {catalog.length === 0 ? (
          <Card variant="outlined" padding="lg" className="space-y-2">
            <Text as="h2" variant="title">Nenhum produto disponível</Text>
            <Text as="p" variant="body">O catálogo da sua organização ainda não possui produtos.</Text>
          </Card>
        ) : null}
        {catalog.map((entry) => {
          const viewState = getActivationViewState(entry.state, subscriptionActive, profileComplete);

          return (
          <div key={entry.product.id} className="space-y-2">
            <ProductActivationCard
              product={entry.product}
              state={entry.state}
              subscriptionActive={subscriptionActive}
              profileComplete={profileComplete}
            />
            {viewState.isPubliclyAvailable ? (
              <>
                <Text as="p" variant="caption" className="pl-1">
                  Página no ar:{' '}
                  <a
                    href={`https://${representative.slug}.${rootHost}/${entry.product.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand underline underline-offset-2"
                  >
                    {representative.slug}.{rootHost}/{entry.product.slug}
                  </a>
                </Text>
                <QrCodeCard
                  url={`https://${representative.slug}.${rootHost}/${entry.product.slug}`}
                  fileName={`${representative.slug}-${entry.product.slug}.png`}
                />
              </>
            ) : null}
          </div>
          );
        })}
      </div>
    </div>
  );
}
