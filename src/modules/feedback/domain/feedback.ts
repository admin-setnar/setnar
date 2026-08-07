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

/** Free-text complement to any response — same 140-character ceiling the migration's CHECK enforces. */
export const FEEDBACK_DETAIL_MAX_LENGTH = 140;

/** How a shown prompt was resolved — the two outcomes `resolve_feedback` accepts. */
export type FeedbackOutcome = 'answered' | 'dismissed';
