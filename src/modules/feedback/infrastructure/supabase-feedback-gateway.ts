import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { FeedbackContext, FeedbackOutcome } from '@/modules/feedback/domain/feedback';
import type {
  FeedbackGateway,
  RecordFeedbackShownResult,
  ResolveFeedbackResult,
} from '@/modules/feedback/domain/feedback-gateway';
import { mapResolveFeedbackResult } from '@/modules/feedback/infrastructure/map-resolve-feedback-result';

interface FeedbackResolutionRow {
  answered_at: string | null;
  dismissed_at: string | null;
}

/**
 * Supabase adapter for `FeedbackGateway`. `isResolved` reads directly through
 * the caller's own request-scoped session — relies on
 * `feedback_responses_select_own`
 * (`supabase/migrations/20260822000000_add_feedback_responses.sql`) to scope
 * the row to `auth.uid()`, same posture `SupabaseRepresentativeAccountRepository`
 * already takes for a plain owner-scoped read. `recordShown`/`resolve` call
 * the two `SECURITY DEFINER` RPCs — see that migration's header for why a
 * write policy would not be enough (ADR-047's reasoning, reused).
 */
export class SupabaseFeedbackGateway implements FeedbackGateway {
  constructor(private readonly supabase: SupabaseClient) {}

  async isResolved(context: FeedbackContext): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('feedback_responses')
      .select('answered_at, dismissed_at')
      .eq('context', context)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<FeedbackResolutionRow>();

    if (error) {
      console.error('Feedback resolution read failed.', { code: error.code, message: error.message });
      throw new Error('Feedback resolution unavailable.');
    }
    if (!data) return false;

    return data.answered_at !== null || data.dismissed_at !== null;
  }

  async recordShown(context: FeedbackContext): Promise<RecordFeedbackShownResult> {
    const { error } = await this.supabase.rpc('record_feedback_shown', { p_context: context });
    if (error) return { status: 'error' };
    return { status: 'shown' };
  }

  async resolve(
    context: FeedbackContext,
    outcome: FeedbackOutcome,
    response: string | null,
    responseDetail: string | null,
  ): Promise<ResolveFeedbackResult> {
    const { data, error } = await this.supabase.rpc('resolve_feedback', {
      p_context: context,
      p_outcome: outcome,
      p_response: response,
      p_response_detail: responseDetail,
    });

    return mapResolveFeedbackResult(data, error);
  }
}
