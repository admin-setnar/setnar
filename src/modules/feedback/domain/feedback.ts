/**
 * The four microfeedback moments approved in SET-59 through SET-64. Only
 * `'first_publication'` (SET-61) is wired to a real prompt today —
 * `'value_perception'`/`'cancellation'`/`'pmf'` are reserved names, matching
 * `supabase/migrations/20260822000000_add_feedback_responses.sql`'s `context`
 * CHECK, kept here so a future Issue extends this union instead of guessing
 * a new string.
 */
export type FeedbackContext = 'first_publication' | 'value_perception' | 'cancellation' | 'pmf';

/**
 * SET-61's three one-click answers to "Como foi criar sua página?" — this
 * type, not a generic `FeedbackResponse`, is what SET-61's own call site
 * uses to stay strongly typed. `resolve_feedback` validates this same
 * vocabulary server-side, scoped to `context: 'first_publication'`; other
 * contexts have their own vocabulary and are not represented by this type.
 */
export type FirstPublicationResponse = 'easy' | 'reasonable' | 'difficult';

/**
 * SET-62's one-click answers to "A SETNAR está ajudando você a divulgar seu
 * trabalho?" — same role `FirstPublicationResponse` plays for SET-61,
 * validated server-side by `resolve_feedback` scoped to
 * `context: 'value_perception'`.
 */
export type ValuePerceptionResponse = 'yes' | 'partly' | 'no';

/**
 * SET-63's one-click answers to "Qual foi o motivo principal do
 * cancelamento?" — the 9 categories from the product brief, validated
 * server-side by `resolve_feedback` scoped to `context: 'cancellation'`
 * (`supabase/migrations/20260902000000_add_cancellation_feedback_event.sql`).
 * A structured, comparable value is always the primary answer; free text is
 * only ever the optional `response_detail` complement, never a substitute.
 */
export type CancellationResponse =
  | 'not_generating_results'
  | 'not_using_enough'
  | 'price'
  | 'missing_feature'
  | 'hard_to_configure'
  | 'no_longer_need'
  | 'technical_problem'
  | 'expected_something_else'
  | 'other';

/** Free-text complement to any response — same 140-character ceiling the migration's CHECK enforces. */
export const FEEDBACK_DETAIL_MAX_LENGTH = 140;

/** How a shown prompt was resolved — the two outcomes `resolve_feedback` accepts. */
export type FeedbackOutcome = 'answered' | 'dismissed';
