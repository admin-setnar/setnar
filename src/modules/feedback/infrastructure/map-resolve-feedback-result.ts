import type { ResolveFeedbackRejectionReason, ResolveFeedbackResult } from '@/modules/feedback/domain/feedback-gateway';

/** `resolve_feedback` is `returns table (status text)` — set-returning, same shape note `UpdateRepresentativeProfileRpcRow` already documents. */
export interface ResolveFeedbackRpcRow {
  readonly status: string;
}

/** Structural error shape, not imported from the SDK — same convention as `UpdateRepresentativeProfileRpcErrorLike`. */
export interface ResolveFeedbackRpcErrorLike {
  readonly message: string;
  readonly code?: string;
}

const REJECTION_REASONS: readonly ResolveFeedbackRejectionReason[] = [
  'representative_not_found',
  'not_shown',
  'already_resolved',
  'response_required',
  'invalid_response',
  'invalid_outcome',
];

function isRejectionReason(status: string): status is ResolveFeedbackRejectionReason {
  return (REJECTION_REASONS as readonly string[]).includes(status);
}

/**
 * Translates the raw `{ data, error }` shape `supabase.rpc('resolve_feedback', ...)`
 * returns into `ResolveFeedbackResult`. Same conservative safety rule as
 * `mapUpdateRepresentativeProfileResult`: any non-null `error`, a null/empty
 * `data`, or a `status` this function doesn't recognise all map to
 * `{ status: 'error' }` — never fabricate a success from an unexpected shape.
 */
export function mapResolveFeedbackResult(
  data: readonly ResolveFeedbackRpcRow[] | null,
  error: ResolveFeedbackRpcErrorLike | null,
): ResolveFeedbackResult {
  if (error) {
    return { status: 'error' };
  }

  const row = data?.[0];
  if (!row) {
    return { status: 'error' };
  }

  if (row.status === 'updated') {
    return { status: 'updated' };
  }

  if (isRejectionReason(row.status)) {
    return { status: 'rejected', reason: row.status };
  }

  return { status: 'error' };
}
