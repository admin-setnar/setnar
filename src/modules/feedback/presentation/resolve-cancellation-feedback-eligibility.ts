import 'server-only';

import { isCancellationFeedbackEligible } from '@/modules/feedback/domain/cancellation-eligibility';
import { getFeedbackGateway } from '@/modules/feedback/infrastructure/feedback-gateway-factory';

/**
 * SET-63's eligibility check for `/app/conta`'s cancellation confirmation
 * screen — the only place this prompt is allowed to appear (unlike
 * `first_publication`/`value_perception`, there is no second screen: a
 * cancellation only ever has one confirmation surface).
 *
 * `hasGraceCancellation` is the caller's own read of
 * `SubscriptionViewState.kind === 'active_until'`
 * (`modules/billing/presentation/subscription-view-state.ts`) — passed in
 * rather than resolved here, same reasoning `resolveFirstPublicationFeedbackEligibility`
 * already gives for taking `catalog` as a parameter: the account page
 * already computes the subscription view state for its own banner, so this
 * function reads it instead of a second, divergent source of truth.
 *
 * Fails closed on an unexpected read error — same posture as every other
 * `resolve*FeedbackEligibility` in this module: `/app/conta`'s core content
 * (profile, billing panel, logout) has no dependency on this optional
 * prompt, so a `feedback_responses` read hiccup must never take the page
 * down over it.
 */
export async function resolveCancellationFeedbackEligibility(hasGraceCancellation: boolean): Promise<boolean> {
  if (!hasGraceCancellation) return false;

  try {
    const resolved = await (await getFeedbackGateway()).isResolved('cancellation');
    return isCancellationFeedbackEligible(hasGraceCancellation, resolved);
  } catch (error) {
    console.error('resolveCancellationFeedbackEligibility: failed to read resolution state, failing closed.', error);
    return false;
  }
}
