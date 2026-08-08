import { SITE_URL } from '@/config/site';
import type { Representative, RepresentativeProduct } from '@/modules/representatives/domain/representative';

/**
 * The public URL of a (Representative, Product) Commercial Page —
 * `https://<slug>.<rootHost>/<productSlug>` (ADR-026). Single source of
 * truth for this string: before this function existed it was inlined twice
 * in `representative-hub.tsx` (link text + QR code) and would have been a
 * third time in `commercial-page-metadata.ts`'s canonical/Open Graph URLs.
 *
 * Built from `SITE_URL`, not a request's `Host` header — same reasoning
 * `representative-hub.tsx` already documented (D5.3): there is no
 * request-scoped hostname to read from every caller (`/app/paginas` never
 * runs on a Representative's own subdomain), so this stays the one
 * derivation both callers share, request-scoped or not.
 */
export function buildCommercialPageUrl(
  representative: Pick<Representative, 'slug'>,
  product: Pick<RepresentativeProduct, 'slug'>,
): string {
  const rootHost = new URL(SITE_URL).hostname;
  return `https://${representative.slug}.${rootHost}/${product.slug}`;
}
