import 'server-only';

import { isValuePerceptionFeedbackEligible } from '@/modules/feedback/domain/value-perception-eligibility';
import { getFeedbackGateway } from '@/modules/feedback/infrastructure/feedback-gateway-factory';
import { getValuePerceptionSignalsGateway } from '@/modules/feedback/infrastructure/value-perception-signals-gateway-factory';

/**
 * SET-62's eligibility check, shared by `/app/paginas` and `/app/conta` —
 * the only two screens the SET-62 trigger allows the prompt to appear on.
 * Extracted (unlike SET-61, which used to inline its own check directly in
 * `/app/paginas` — now factored out too, see
 * `resolve-first-publication-eligibility.ts`) because it has two real
 * callers from the start, not one — duplicating the same two-gateway
 * composition in both pages would be the "same question resolved twice"
 * ADR-069 already warns against for per-context state.
 *
 * Deliberately does NOT know about `first_publication` here — the two
 * contexts stay decoupled at this layer; the caller combines this result
 * with `resolveFirstPublicationFeedbackEligibility`'s own to enforce mutual
 * exclusion (see both `/app/paginas` and `/app/conta`), so this function
 * answers one question only: "is `value_perception` itself eligible?".
 *
 * Runs the signals read (`product_activations`/`analytics_events`) and the
 * resolved-state read (`feedback_responses`) in parallel, then applies the
 * pure domain rule. Neither query is skipped by a cheaper precondition the
 * way SET-61 skips `isResolved` for a never-published representative — both
 * of SET-62's own reads are already single indexed-row lookups, so there is
 * no equivalent cheap short-circuit worth adding.
 *
 * Fails closed on an unexpected read error: `/app/conta`'s core content
 * (account settings, profile form, logout) has no dependency on
 * `product_activations`/`analytics_events` at all, and `/app/paginas`'s own
 * core content (the catalog) does not depend on this optional prompt either
 * — a signals-read hiccup must never take either page down over a
 * decorative microfeedback card.
 */
export async function resolveValuePerceptionFeedbackEligibility(representativeId: string): Promise<boolean> {
  try {
    const [signals, alreadyResolved] = await Promise.all([
      getValuePerceptionSignalsGateway().then((gateway) => gateway.getSignals(representativeId)),
      getFeedbackGateway().then((gateway) => gateway.isResolved('value_perception')),
    ]);

    return isValuePerceptionFeedbackEligible(signals, alreadyResolved);
  } catch (error) {
    console.error('resolveValuePerceptionFeedbackEligibility: failed to read signals/resolution state, failing closed.', error);
    return false;
  }
}
