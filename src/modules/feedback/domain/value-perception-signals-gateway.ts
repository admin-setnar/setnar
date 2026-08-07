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
 * `representativeId` IS a parameter here — unlike `FeedbackGateway`, which
 * omits it because that port backs writes where a caller-supplied id would
 * be a spoofing surface. This port is read-only and RLS
 * (`product_activations_select_own`, `analytics_events_select_own`) is
 * still the actual ownership boundary regardless of what id is passed — a
 * wrong id simply yields zero rows, never another representative's data.
 * The id exists purely so the adapter can filter explicitly instead of
 * relying only on a `SECURITY DEFINER` `plpgsql` RLS predicate
 * (`is_own_representative()`) to scope an unbounded, platform-wide table
 * (`analytics_events`) on every read — see the adapter's own doc comment.
 */
export interface ValuePerceptionSignalsGateway {
  getSignals(representativeId: string): Promise<ValuePerceptionSignals>;
}
