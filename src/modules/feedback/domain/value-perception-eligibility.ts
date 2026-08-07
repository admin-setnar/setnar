/**
 * SET-62's eligibility rule, isolated so it is testable without a database
 * (ARCHITECTURE.md § *Testability*, same discipline
 * `first-publication-eligibility.ts` already follows). Unlike SET-61, this
 * context needs a real elapsed-time comparison and a behavioral signal
 * (`analytics_events`), not just "has this catalog entry reached a state" —
 * so the input here is the two raw facts the caller already resolved
 * (`ValuePerceptionSignalsGateway`), not a catalog array.
 */
export const VALUE_PERCEPTION_ELIGIBILITY_DAYS = 14;

/**
 * The two facts SET-62's trigger (approved 2026-08-07) is built from:
 * `firstPublishedAt` is `MIN(product_activations.published_at)` across every
 * Product the representative has ever published — the same anchor SET-61
 * uses, never the signup or subscription date. `hasVisitEvent` is whether at
 * least one `analytics_events` row with `event_type = 'visit'` exists for
 * the representative, across any Product.
 */
export interface ValuePerceptionSignals {
  readonly firstPublishedAt: string | null;
  readonly hasVisitEvent: boolean;
}

/**
 * The full SET-62 gate: published at least 14 full days ago, AND at least
 * one real public visit was ever recorded, AND the `value_perception`
 * context is still unresolved.
 *
 * `hasVisitEvent: false` is a structural, permanent non-eligibility — not a
 * deferral. A representative who published 14+ days ago but never had a
 * visit stays ineligible indefinitely; nothing here re-checks after N more
 * days, because the condition that would flip it (a real visit happening) is
 * exactly the one this function is unable to predict, and re-deriving it on
 * every render (rather than caching a stale "not yet" decision) is precisely
 * what makes that indefinite wait correct instead of a bug — see the SET-62
 * issue body's explicit "não é um adiamento por N dias adicionais; é uma
 * condição estrutural, sem prazo".
 *
 * `alreadyResolved` is true for either an answer or an explicit dismissal —
 * same one-shot-forever posture `isFirstPublicationFeedbackEligible` already
 * uses for `first_publication`; SET-62 does not say otherwise.
 */
export function isValuePerceptionFeedbackEligible(
  signals: ValuePerceptionSignals,
  alreadyResolved: boolean,
  now: Date = new Date(),
): boolean {
  if (alreadyResolved) return false;
  if (!signals.hasVisitEvent) return false;
  if (!signals.firstPublishedAt) return false;

  const elapsedMs = now.getTime() - new Date(signals.firstPublishedAt).getTime();
  const thresholdMs = VALUE_PERCEPTION_ELIGIBILITY_DAYS * 24 * 60 * 60 * 1000;
  return elapsedMs >= thresholdMs;
}
