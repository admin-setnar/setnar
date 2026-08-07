import type { FeedbackContext, FeedbackOutcome } from '@/modules/feedback/domain/feedback';

/**
 * `'error'` is a real infrastructure failure, never presented to the caller
 * as a business rejection — same three-level split every other typed result
 * in this codebase already uses (e.g. `UpdateRepresentativeProfileResult`).
 */
export type RecordFeedbackShownResult = { readonly status: 'shown' } | { readonly status: 'error' };

/**
 * Typed rejection reasons `resolve_feedback` can return, reused verbatim
 * from the `status` vocabulary the migration's header documents.
 */
export type ResolveFeedbackRejectionReason =
  | 'representative_not_found'
  | 'not_shown'
  | 'already_resolved'
  | 'response_required'
  | 'invalid_response'
  | 'invalid_outcome';

export type ResolveFeedbackResult =
  | { readonly status: 'updated' }
  | { readonly status: 'rejected'; readonly reason: ResolveFeedbackRejectionReason }
  | { readonly status: 'error' };

/**
 * Port for the SET-60 shared microfeedback infrastructure — one gateway for
 * every context (SET-61 today; SET-62/63/64 reuse it unchanged), not one
 * port per survey. `isResolved` backs the eligibility check every context's
 * presentation layer runs before rendering a prompt; `recordShown`/`resolve`
 * back the two RPCs a prompt calls over its lifetime.
 *
 * `representativeId` is never a parameter here, same principle
 * `RepresentativeProfileGateway`/`register_representative` already follow:
 * the RPCs derive it from `auth.uid()` server-side, never from a caller-
 * supplied value.
 */
export interface FeedbackGateway {
  /**
   * True once the row for (caller, context) carries `answered_at` or
   * `dismissed_at` — a raw fact about what is stored, not a product policy.
   * Whether "resolved" means "never show this context again" is decided by
   * each context's own eligibility rule (e.g.
   * `isFirstPublicationFeedbackEligible`, which treats both outcomes as
   * permanent for SET-61) — this gateway does not assert that universally,
   * and a future context is free to read `answered_at`/`dismissed_at`
   * differently.
   */
  isResolved(context: FeedbackContext): Promise<boolean>;

  recordShown(context: FeedbackContext): Promise<RecordFeedbackShownResult>;

  resolve(
    context: FeedbackContext,
    outcome: FeedbackOutcome,
    response: string | null,
    responseDetail: string | null,
  ): Promise<ResolveFeedbackResult>;
}
