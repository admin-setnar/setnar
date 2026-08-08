import { ImageResponse } from 'next/og';
import { headers } from 'next/headers';

import { OpenGraphCardFrame, TenantOpenGraphCard } from '@/config/opengraph-card';
import { resolveCommercialPageActivation } from '@/modules/representatives/presentation/resolve-commercial-page-activation';
import { resolveTenant } from '@/modules/tenancy/application/resolve-tenant';

/**
 * Product-specific social card for a Representative's Commercial Page
 * (SET-11) — same `OpenGraphCardFrame` the root `/opengraph-image` uses,
 * different copy: `product.name` / `representative.name` in place of the
 * tenant's own marketing headline.
 *
 * Colocating this file at `[productSlug]/` (rather than adding `images` to
 * `resolveCommercialPageMetadata`'s return value by hand) is what makes
 * Next.js inject it automatically — confirmed against
 * `node_modules/next/dist/lib/metadata/resolve-metadata.js`'s
 * `mergeStaticMetadata`: a route segment's own `opengraph-image` file
 * backfills `openGraph.images` (and, via `postProcessMetadata`'s Twitter
 * auto-fill, `twitter.images` too) whenever that segment's own metadata
 * doesn't already set `images` itself — which `resolveCommercialPageMetadata`
 * deliberately doesn't. Without this file, the page's own `openGraph`
 * object (title/url/description) would still fully replace the generic
 * image this route inherited from `app/opengraph-image.tsx` — Next merges
 * `openGraph` as one object per segment, not field by field — leaving every
 * Commercial Page with no image at all.
 *
 * A `null` resolution (bad host, unpublished, suspended) falls back to the
 * exact same `TenantOpenGraphCard` every other unresolvable page already
 * renders — same anti-enumeration reasoning as `resolveCommercialPageMetadata`
 * returning `{}` for the same case (ADR-030, applied to the image too).
 */
export const alt = 'Setnar';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function CommercialPageOpenGraphImage({
  params,
}: {
  params: Promise<{ productSlug: string }>;
}) {
  const [{ productSlug }, requestHeaders] = await Promise.all([params, headers()]);
  const hostname = requestHeaders.get('host');
  const activation = await resolveCommercialPageActivation(hostname, productSlug);

  if (!activation) {
    const tenant = await resolveTenant(hostname);
    return new ImageResponse(<TenantOpenGraphCard tenant={tenant} />, size);
  }

  const { representative, product } = activation;

  return new ImageResponse(
    (
      <OpenGraphCardFrame
        brandName="Setnar"
        headline={product.name}
        headlineAccent={representative.name}
        caption="Representante autorizado"
      />
    ),
    size,
  );
}
