import 'server-only';

import { cache } from 'react';

import type { RepresentativeActivation } from '@/modules/representatives/domain/representative';
import { getRepresentativeRepository } from '@/modules/representatives/infrastructure/representative-repository-factory';
import { resolveRepresentativeActivation } from '@/modules/representatives/application/resolve-representative';

/**
 * Wires `getRepresentativeRepository()` (infrastructure) and
 * `resolveRepresentativeActivation()` (application) together for a single
 * request — the composition `src/app/[productSlug]/page.tsx` already did
 * inline before this existed. Lives in `presentation/`, not next to either
 * layer it wires: `resolveRepresentativeActivation` takes its repository as
 * an explicit parameter specifically so it stays callable without a live
 * request context (see that file's own doc comment), and
 * `representative-repository-factory.ts` documents itself as a pure
 * composition root with no business logic of its own — importing
 * `resolveRepresentativeActivation` into either would invert the dependency
 * both already keep one-directional. The Server Component boundary is where
 * this wiring belongs.
 *
 * Named `resolveCommercialPresence`, not `resolveCommercialPageActivation`
 * (its name before the Company joined the public address): the public
 * address now identifies a Representative *and* the Company that authorizes
 * them together — `<representative>.<company>.setnar.com` — so the contract
 * exposed to callers is named for that business concept, Commercial
 * Presence (DOMAIN_MODEL.md's Commercial Page, contextualized by Company),
 * rather than reading as if the Company were only an incidental validation
 * detail. The mechanism underneath is unchanged: `resolveRepresentativeActivation`
 * still genuinely locates a Representative by slug first, which is exactly
 * what it does — only this outward-facing name changed.
 *
 * Wrapped in React's `cache()` — same fix, same shape, as `getCurrentUser`
 * in `auth-gateway-factory.ts`: `[productSlug]/page.tsx` now calls this from
 * both `generateMetadata` and the page body, and without `cache()` that
 * would hit Supabase twice per request instead of once.
 */
export const resolveCommercialPresence = cache(
  async (
    hostname: string | null,
    productSlug: string,
  ): Promise<RepresentativeActivation | null> => {
    const repository = await getRepresentativeRepository();
    return resolveRepresentativeActivation(repository, hostname, productSlug);
  },
);
