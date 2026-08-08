import type { Metadata } from 'next';

import type { RepresentativeActivation } from '@/modules/representatives/domain/representative';
import { buildCommercialPageUrl } from '@/modules/representatives/presentation/commercial-page-url';

/**
 * `openGraph.siteName` for every Commercial Page — hardcoded rather than
 * read from `Tenant.brand.name` (`modules/tenancy`), on purpose: resolving a
 * Commercial Page never goes through `TenantRepository` (ADR-031 keeps
 * `RepresentativeRepository` a separate port precisely so this module stays
 * decoupled from tenancy), and pulling in `Tenant` here for one string would
 * reopen that coupling. Same trade-off `NOT_OFFICIAL_CHANNEL_NOTICE` in
 * `product-compliance-notice.ts` already made for the same reason — keep the
 * two in sync by hand if the brand name ever changes.
 */
const SITE_NAME = 'Setnar';

/**
 * `openGraph.locale` for every Commercial Page — mirrors `setnarTenant.locale`
 * (`pt-BR` → `pt_BR`) without importing `Tenant` to read it, same reasoning
 * as `SITE_NAME` above. The whole product has no i18n today; revisit this
 * constant, not add a parameter for it, if that ever changes.
 */
const OG_LOCALE = 'pt_BR';

/**
 * Resolves the `<head>` metadata for `src/app/[productSlug]/page.tsx`, for
 * both outcomes `resolveRepresentativeActivation` can produce.
 *
 * `activation: null` (bad host, unpublished, suspended, or a product that
 * doesn't exist) returns `{}` on purpose, not a hand-built "generic"
 * Metadata object: Next.js merges a page's `generateMetadata` result field
 * by field into what the parent layout already resolved (confirmed against
 * `node_modules/next/dist/lib/metadata/resolve-metadata.js`'s `mergeMetadata`
 * — it iterates only the keys actually present on the returned object), so
 * an empty object leaves `app/layout.tsx`'s own tenant metadata untouched.
 * That is the same generic response for every failure reason, the same
 * anti-enumeration principle ADR-030 already applies to the page body's
 * `notFound()` — applied here to metadata too, and for free: there is no
 * second "generic metadata" computation to keep in sync with the layout's.
 */
export function resolveCommercialPageMetadata(
  activation: RepresentativeActivation | null,
): Metadata {
  if (!activation) return {};

  const { representative, product } = activation;
  const url = buildCommercialPageUrl(representative, product);
  const title = `${product.name} — ${representative.name}`;
  const description = `Fale com ${representative.name}, representante autorizado, sobre ${product.name}.`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      locale: OG_LOCALE,
      url,
      siteName: SITE_NAME,
      title,
      description,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}
