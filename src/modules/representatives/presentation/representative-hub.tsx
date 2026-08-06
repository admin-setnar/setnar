import { SITE_URL } from '@/config/site';
import type { Representative } from '@/modules/representatives/domain/representative';
import type { RepresentativeCatalogEntry } from '@/modules/representatives/domain/representative-catalog-repository';
import { getActivationViewState } from '@/modules/representatives/presentation/activation-view-state';
import { ProductActivationCard } from '@/modules/representatives/presentation/product-activation-card';
import { QrCodeCard } from '@/modules/representatives/presentation/qr-code-card';
import { RepresentativeProfileForm } from '@/modules/representatives/presentation/representative-profile-form';
import { Card } from '@/shared/ui/card';
import { Text } from '@/shared/ui/typography';

/**
 * RepresentativeHub — D5, replaces `RepresentativeHubPlaceholder`.
 *
 * Server Component: `catalog` is already resolved by the caller
 * (`/app`'s page, via `RepresentativeCatalogRepository.listOwnCatalog()`,
 * D5.1) — this component only renders it and the per-product interactive
 * controls (`ProductActivationCard`, D5.2/D5.3), same split the rest of this
 * module already uses between a Server Component owning data and a small
 * `'use client'` island owning interaction.
 *
 * D5.3 — the public link. Composed from `SITE_URL`
 * (`config/site.ts`, `https://setnar.com` unless overridden by
 * `NEXT_PUBLIC_SITE_URL`), not from the current request's `Host` header:
 * `/app` is always visited on the root domain, never on a Representative's
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
 * D5b — `RepresentativeProfileForm` renders between the identification card
 * and the product list: editing contact info is a precondition for
 * publishing (`phone_required` in `set_activation_status`'s gate,
 * `20260807000000`), so it reads naturally before the controls that need it
 * satisfied, not after.
 */
export function RepresentativeHub({
  representative,
  catalog,
  subscriptionActive,
}: {
  representative: Representative;
  catalog: readonly RepresentativeCatalogEntry[];
  subscriptionActive: boolean;
}) {
  const rootHost = new URL(SITE_URL).hostname;

  return (
    <div className="mt-8 space-y-6">
      <Card variant="raised" padding="lg" className="space-y-1">
        <Text as="h2" variant="title">
          {representative.name}
        </Text>
        <Text as="p" variant="body">
          Sua página: <strong className="text-content">{representative.slug}</strong>
        </Text>
      </Card>

      <Card variant="outlined" padding="lg" className="space-y-4">
        <Text as="h2" variant="title">
          Editar perfil
        </Text>
        <RepresentativeProfileForm representative={representative} />
      </Card>

      <div className="space-y-3">
        {catalog.map((entry) => {
          const viewState = getActivationViewState(entry.state, subscriptionActive);

          return (
          <div key={entry.product.id} className="space-y-2">
            <ProductActivationCard
              product={entry.product}
              state={entry.state}
              subscriptionActive={subscriptionActive}
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
