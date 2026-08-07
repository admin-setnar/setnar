import 'server-only';

import { hasPublishedAtLeastOnce, isFirstPublicationFeedbackEligible } from '@/modules/feedback/domain/first-publication-eligibility';
import { getFeedbackGateway } from '@/modules/feedback/infrastructure/feedback-gateway-factory';
import type { RepresentativeCatalogEntry } from '@/modules/representatives/domain/representative-catalog-repository';

/**
 * SET-61's eligibility check, extracted out of `/app/paginas` (where it used
 * to be inlined) so `/app/conta` can run the exact same rule too — not to
 * render SET-61's own prompt there (it stays `/app/paginas`-only), but to
 * know whether it is still pending, so `/app/conta` can withhold SET-62's
 * prompt while it is. Without this, the two contexts could both be shown to
 * the same representative in the same session — SET-61 on `/app/paginas`,
 * SET-62 on `/app/conta` — which ADR-070 documents as never allowed.
 *
 * Fails closed on an unexpected read error: a broken resolved-state read
 * must never crash a page whose actual content (product catalog, account
 * settings) does not depend on this optional prompt existing at all —
 * "not eligible" is always a safe wrong answer here, "crash the page" never
 * is.
 */
export async function resolveFirstPublicationFeedbackEligibility(
  catalog: readonly RepresentativeCatalogEntry[],
): Promise<boolean> {
  if (!hasPublishedAtLeastOnce(catalog)) return false;

  try {
    const resolved = await (await getFeedbackGateway()).isResolved('first_publication');
    return isFirstPublicationFeedbackEligible(catalog, resolved);
  } catch (error) {
    console.error('resolveFirstPublicationFeedbackEligibility: failed to read resolution state, failing closed.', error);
    return false;
  }
}
