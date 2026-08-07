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
 * take — and RLS (`product_activations_select_own`,
 * `analytics_events_select_own`) remains the real ownership boundary.
 *
 * Both queries ALSO filter explicitly by `representative_id`, unlike
 * `SupabaseFeedbackGateway.isResolved` (which relies on RLS alone). This is
 * a performance choice, not a security one: `analytics_events`'s RLS policy
 * resolves through `is_own_representative()`
 * (`supabase/migrations/20260805000000_fix_rls_policy_cycle.sql`), a
 * `security definer` **`plpgsql`** function — Postgres cannot inline a
 * `plpgsql` function into the query plan the way it can a `sql` one (see
 * that same migration's own comment on `is_own_representative`), so a
 * `select ... where event_type = 'visit'` with no other predicate has
 * nothing to seek on and degrades to scanning every row of a table that
 * grows with every visit/click platform-wide, not just this
 * representative's. Filtering by `representative_id` explicitly lets the
 * planner use `analytics_events_rep_product_type_idx`
 * (`(representative_id, product_id, event_type)`,
 * `20260810000000_add_analytics_events.sql`) — RLS still applies underneath
 * as defense in depth, so a wrong id here could only ever yield zero rows,
 * never another representative's.
 *
 * The two reads are independent of each other, so they run in parallel.
 */
export class SupabaseValuePerceptionSignalsGateway implements ValuePerceptionSignalsGateway {
  constructor(private readonly supabase: SupabaseClient) {}

  async getSignals(representativeId: string): Promise<ValuePerceptionSignals> {
    const [publishedResult, visitResult] = await Promise.all([
      this.supabase
        .from('product_activations')
        .select('published_at')
        .eq('representative_id', representativeId)
        .not('published_at', 'is', null)
        .order('published_at', { ascending: true })
        .limit(1)
        .maybeSingle<EarliestPublishedAtRow>(),
      this.supabase
        .from('analytics_events')
        .select('id')
        .eq('representative_id', representativeId)
        .eq('event_type', 'visit')
        .limit(1),
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
