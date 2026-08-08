import { ImageResponse } from 'next/og';
import { headers } from 'next/headers';

import { TenantOpenGraphCard } from '@/config/opengraph-card';
import { resolveTenant } from '@/modules/tenancy/application/resolve-tenant';

/**
 * Social sharing card, generated at request time from the resolved tenant.
 *
 * Generated rather than designed as a static asset for one reason: every tenant
 * needs its own card, and nobody should have to open a design tool to add one.
 * Deliberately typographic — no photography, no claims, nothing that would need
 * a compliance review each time the copy changes.
 *
 * Layout lives in `config/opengraph-card.tsx` (SET-11) — shared with
 * `[productSlug]/opengraph-image.tsx`'s fallback for a `null` resolution.
 */
export const alt = 'Setnar';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpenGraphImage() {
  const tenant = await resolveTenant((await headers()).get('host'));

  return new ImageResponse(<TenantOpenGraphCard tenant={tenant} />, size);
}
