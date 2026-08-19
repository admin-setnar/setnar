import { SITE_URL } from '@/config/site';
import type { Representative, RepresentativeProduct } from '@/modules/representatives/domain/representative';

/**
 * The public URL of a (Representative, Product) Commercial Page —
 * `https://<representative-slug>.<company-slug>.<rootHost>/<productSlug>`.
 * Single source of truth for this string: QR Code (`qr-code-card.tsx`, via
 * `representative-hub.tsx`), the 21 marketing materials
 * (`marketing-materials/material-props.ts`), and the canonical/Open Graph
 * URL (`commercial-page-metadata.ts`) all compose their public link from
 * this one function — inlining it separately in any of them would have been
 * the same string duplicated three times.
 *
 * `product.companySlug` (already carried by `RepresentativeProduct`, ADR-057)
 * is the Company that authorizes this Product's Catalog — the same value
 * `resolveRepresentativeActivation`/`SupabaseRepresentativeRepository`
 * validate a request's Host against, never independently re-derived here.
 *
 * Built from `SITE_URL`, not a request's `Host` header — same reasoning
 * `representative-hub.tsx` already documented (D5.3): there is no
 * request-scoped hostname to read from every caller (`/app/paginas` never
 * runs on a Representative's own subdomain), so this stays the one
 * derivation every caller shares, request-scoped or not.
 */
export function buildCommercialPageUrl(
  representative: Pick<Representative, 'slug'>,
  product: Pick<RepresentativeProduct, 'slug' | 'companySlug'>,
): string {
  const rootHost = new URL(SITE_URL).hostname;
  return `https://${representative.slug}.${product.companySlug}.${rootHost}/${product.slug}`;
}
