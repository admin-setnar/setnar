import type { ProductAnalyticsSummary } from '@/modules/analytics/domain/analytics-metrics-repository';

/** The slice of an `analytics_events` row this aggregation needs. */
export interface AnalyticsEventRow {
  readonly product_id: string;
  readonly event_type: 'visit' | 'whatsapp_click';
}

/** The slice of a `leads` row this aggregation needs. */
export interface LeadRow {
  readonly product_id: string | null;
}

/**
 * Pure aggregation for AN6 — `docs/plans/QR_ANALYTICS_PLAN.md` §3.5 already
 * decided raw events over counters specifically so aggregation happens at
 * read time; this is that step, split out of
 * `SupabaseAnalyticsMetricsRepository` so it is testable without a Supabase
 * client, same convention `mergeRepresentativeCatalog` already uses.
 *
 * Both inputs are expected to already be scoped to one Representative and
 * one period by the caller's query (RLS + a `created_at` filter) — this
 * function does not re-check either; it only groups by `product_id`.
 *
 * `leads.product_id` is nullable in the schema (unlike `analytics_events`),
 * though every lead capture surface today always resolves one — rows with a
 * null `product_id` are skipped rather than thrown, so a future capture path
 * without a Product does not crash this read.
 */
export function aggregateAnalyticsSummary(
  events: readonly AnalyticsEventRow[],
  leads: readonly LeadRow[],
): ProductAnalyticsSummary[] {
  const summaryByProductId = new Map<string, { visits: number; whatsappClicks: number; leads: number }>();

  function entryFor(productId: string) {
    let entry = summaryByProductId.get(productId);
    if (!entry) {
      entry = { visits: 0, whatsappClicks: 0, leads: 0 };
      summaryByProductId.set(productId, entry);
    }
    return entry;
  }

  for (const event of events) {
    const entry = entryFor(event.product_id);
    if (event.event_type === 'visit') entry.visits += 1;
    else entry.whatsappClicks += 1;
  }

  for (const lead of leads) {
    if (lead.product_id === null) continue;
    entryFor(lead.product_id).leads += 1;
  }

  return Array.from(summaryByProductId.entries()).map(([productId, entry]) => ({
    productId,
    ...entry,
  }));
}
