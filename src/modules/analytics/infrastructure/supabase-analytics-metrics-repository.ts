import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  aggregateAnalyticsSummary,
  type AnalyticsEventRow,
  type LeadRow,
} from '@/modules/analytics/infrastructure/aggregate-analytics-summary';
import type {
  AnalyticsMetricsRepository,
  AnalyticsPeriodDays,
  ProductAnalyticsSummary,
} from '@/modules/analytics/domain/analytics-metrics-repository';

/**
 * Supabase adapter for AN6. Two queries, both scoped by the caller's own
 * request-scoped session (`shared/lib/supabase/server.ts`'s `createClient()`)
 * — the same session `analytics_events_select_own`/`leads_select_own` (RLS)
 * evaluate against, so isolation is enforced by Postgres, not by this class
 * filtering client-side. `analytics_events`'s column grant already excludes
 * `ip_hash` (`20260817000000_secure_analytics_and_public_access.sql:347-348`),
 * so this adapter never even receives it.
 *
 * The two queries run in parallel (`Promise.all`) — neither depends on the
 * other. The merge itself, `aggregateAnalyticsSummary`, is a pure function
 * kept in its own file so it is testable without a Supabase client.
 */
export class SupabaseAnalyticsMetricsRepository implements AnalyticsMetricsRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async listOwnSummaryByProduct(
    representativeId: string,
    periodDays: AnalyticsPeriodDays,
  ): Promise<readonly ProductAnalyticsSummary[]> {
    const cutoff = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString();

    const [eventsResult, leadsResult] = await Promise.all([
      this.supabase
        .from('analytics_events')
        .select('product_id, event_type')
        .eq('representative_id', representativeId)
        .gte('created_at', cutoff),
      this.supabase
        .from('leads')
        .select('product_id')
        .eq('representative_id', representativeId)
        .gte('created_at', cutoff),
    ]);

    if (eventsResult.error || leadsResult.error) {
      const error = eventsResult.error ?? leadsResult.error;
      console.error('Representative analytics summary read failed.', {
        code: error?.code,
        message: error?.message,
      });
      throw new Error('Representative analytics summary unavailable.');
    }

    return aggregateAnalyticsSummary(
      eventsResult.data as unknown as AnalyticsEventRow[],
      leadsResult.data as unknown as LeadRow[],
    );
  }
}
