import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { ValuePerceptionSignals } from '@/modules/feedback/domain/value-perception-eligibility';
import type { ValuePerceptionSignalsGateway } from '@/modules/feedback/domain/value-perception-signals-gateway';

interface EarliestPublishedAtRow {
  published_at: string | null;
}

/**
 * Supabase adapter for `ValuePerceptionSignalsGateway`. Both queries run
 * through the caller's own request-scoped session — same posture
 * `SupabaseFeedbackGateway`/`SupabaseRepresentativeCatalogRepository` already
 * take — and rely entirely on RLS (`product_activations_select_own`,
 * `analytics_events_select_own`) to scope the rows to the signed-in
 * representative; neither query names a `representative_id`.
 *
 * The two reads are independent of each other, so they run in parallel.
 */
export class SupabaseValuePerceptionSignalsGateway implements ValuePerceptionSignalsGateway {
  constructor(private readonly supabase: SupabaseClient) {}

  async getSignals(): Promise<ValuePerceptionSignals> {
    const [publishedResult, visitResult] = await Promise.all([
      this.supabase
        .from('product_activations')
        .select('published_at')
        .not('published_at', 'is', null)
        .order('published_at', { ascending: true })
        .limit(1)
        .maybeSingle<EarliestPublishedAtRow>(),
      this.supabase.from('analytics_events').select('id').eq('event_type', 'visit').limit(1),
    ]);

    if (publishedResult.error) {
      console.error('Value-perception published_at read failed.', {
        code: publishedResult.error.code,
        message: publishedResult.error.message,
      });
      throw new Error('Value-perception signals unavailable.');
    }
    if (visitResult.error) {
      console.error('Value-perception visit-event read failed.', {
        code: visitResult.error.code,
        message: visitResult.error.message,
      });
      throw new Error('Value-perception signals unavailable.');
    }

    return {
      firstPublishedAt: publishedResult.data?.published_at ?? null,
      hasVisitEvent: (visitResult.data?.length ?? 0) > 0,
    };
  }
}
