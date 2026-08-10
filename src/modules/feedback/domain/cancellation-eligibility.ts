/**
 * SET-63's eligibility rule, isolated so it is testable without a database
 * (ARCHITECTURE.md § *Testability*, same discipline every other context in
 * this module already follows).
 *
 * Unlike `first_publication`/`value_perception`, `alreadyResolved` here is
 * NOT a permanent "never again" — it reflects only the MOST RECENT
 * cancellation event, by construction:
 * `confirm_own_subscription_cancellation()`
 * (`supabase/migrations/20260902000000_add_cancellation_feedback_event.sql`)
 * opens a fresh, unresolved `feedback_responses` row every time an active or
 * suspended subscription actually transitions to `canceled` — never reusing
 * a prior event's row. So `alreadyResolved` naturally flips back to `false`
 * the moment a representative reactivates and cancels again — no special
 * "per event" bookkeeping needed on this side, the caller just always reads
 * the latest row (`FeedbackGateway.isResolved('cancellation')`), same as
 * every other context.
 *
 * `hasGraceCancellation` is `true` exactly for
 * `SubscriptionViewState.kind === 'active_until'`
 * (`modules/billing/presentation/subscription-view-state.ts`) — the state
 * whose banner already reads "Assinatura cancelada... até DD/MM", i.e. the
 * confirmation/success screen SET-63's own UX decision requires the prompt
 * to appear on, never before or during the cancellation action itself.
 */
export function isCancellationFeedbackEligible(hasGraceCancellation: boolean, alreadyResolved: boolean): boolean {
  return hasGraceCancellation && !alreadyResolved;
}
