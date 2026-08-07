import type { CatalogActivationState } from '@/modules/representatives/domain/representative-catalog-repository';

/**
 * SET-61's eligibility rule, isolated so it is testable without a database
 * (ARCHITECTURE.md § *Testability*: "business rules must be testable
 * without infrastructure"). `'unpublished'` still counts as "has published
 * before" — `published_at` is never cleared by unpublishing (ADR-043), so an
 * activation that was published and later taken down must not make the
 * representative newly ineligible.
 */
export function hasPublishedAtLeastOnce(
  catalog: readonly { readonly state: CatalogActivationState }[],
): boolean {
  return catalog.some((entry) => entry.state === 'published' || entry.state === 'unpublished');
}

/**
 * The full SET-61 gate: the representative must have published at least
 * once, AND the `first_publication` context must still be unresolved
 * (`alreadyResolved` — read from `FeedbackGateway.isResolved()`, a real
 * database call the caller is responsible for skipping when
 * `hasPublishedAtLeastOnce` is already false, same short-circuit
 * `src/app/app/paginas/page.tsx` applies).
 *
 * `alreadyResolved` is true for either an answer or an explicit dismissal —
 * this is SET-61's own product decision that dismissing is as final as
 * answering ("não incomodar novamente"), made here in this context-specific
 * function, not by `feedback_responses`/`FeedbackGateway` themselves. A
 * future context (SET-62/63/64) is free to define its own eligibility
 * function with a different reading of `answered_at`/`dismissed_at`.
 */
export function isFirstPublicationFeedbackEligible(
  catalog: readonly { readonly state: CatalogActivationState }[],
  alreadyResolved: boolean,
): boolean {
  return hasPublishedAtLeastOnce(catalog) && !alreadyResolved;
}
