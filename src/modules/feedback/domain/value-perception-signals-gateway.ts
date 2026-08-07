import type { ValuePerceptionSignals } from '@/modules/feedback/domain/value-perception-eligibility';

/**
 * Port for the two read-only facts SET-62's eligibility rule needs and no
 * existing port exposes: the earliest `product_activations.published_at`
 * across every Product the representative has ever published, and whether
 * `analytics_events` has ever recorded a `'visit'` for them.
 *
 * A dedicated port, not a method bolted onto `RepresentativeCatalogRepository`
 * or `FeedbackGateway` — same "different natures deserve different ports"
 * reasoning ADR-031/041/042/044 already apply three times over: this reads
 * `product_activations` and `analytics_events` together, for one narrow
 * purpose (a single boolean gate), never the shape either of those two ports
 * already returns for their own callers. `FeedbackGateway` in particular
 * stays generic across every context (ADR-069) — it would stop being that if
 * a context-specific read were added to it here.
 *
 * `representativeId` is never a parameter, same convention `FeedbackGateway`
 * already documents: both underlying queries are scoped by RLS
 * (`product_activations_select_own`, `analytics_events_select_own`) against
 * the caller's own session, so there is nothing for a caller-supplied id to
 * add except a spoofing surface.
 */
export interface ValuePerceptionSignalsGateway {
  getSignals(): Promise<ValuePerceptionSignals>;
}
