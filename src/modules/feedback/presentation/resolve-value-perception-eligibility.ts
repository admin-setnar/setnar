import 'server-only';

import { isValuePerceptionFeedbackEligible } from '@/modules/feedback/domain/value-perception-eligibility';
import { getFeedbackGateway } from '@/modules/feedback/infrastructure/feedback-gateway-factory';
import { getValuePerceptionSignalsGateway } from '@/modules/feedback/infrastructure/value-perception-signals-gateway-factory';

/**
 * SET-62's eligibility check, shared by `/app/paginas` and `/app/conta` —
 * the only two screens the SET-62 trigger allows the prompt to appear on.
 * Extracted (unlike SET-61, which inlines its own check directly in
 * `/app/paginas`) because it has two real callers from the start, not one —
 * duplicating the same two-gateway composition in both pages would be the
 * "same question resolved twice" ADR-069 already warns against for
 * per-context state.
 *
 * Runs the signals read (`product_activations`/`analytics_events`) and the
 * resolved-state read (`feedback_responses`) in parallel, then applies the
 * pure domain rule. Neither query is skipped by a cheaper precondition the
 * way SET-61 skips `isResolved` for a never-published representative — both
 * of SET-62's own reads are already single indexed-row lookups, so there is
 * no equivalent cheap short-circuit worth adding.
 */
export async function resolveValuePerceptionFeedbackEligibility(): Promise<boolean> {
  const [signals, alreadyResolved] = await Promise.all([
    getValuePerceptionSignalsGateway().then((gateway) => gateway.getSignals()),
    getFeedbackGateway().then((gateway) => gateway.isResolved('value_perception')),
  ]);

  return isValuePerceptionFeedbackEligible(signals, alreadyResolved);
}
