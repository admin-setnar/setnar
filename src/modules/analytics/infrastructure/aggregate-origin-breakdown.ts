import type { OriginId } from '@/modules/analytics/domain/origin';
import type { OriginBreakdownEntry } from '@/modules/analytics/domain/analytics-metrics-repository';

/** The slice of an `analytics_events` row this aggregation needs. */
export interface OriginAnalyticsEventRow {
  readonly event_type: 'visit' | 'whatsapp_click';
  readonly origin: string | null;
}

/** The slice of a `leads` row this aggregation needs. */
export interface OriginLeadRow {
  readonly origin: string | null;
}

/**
 * Pure aggregation for SET-84 D5, split out of
 * `SupabaseAnalyticsMetricsRepository` for the same reason
 * `aggregateAnalyticsSummary` already is — testable without a Supabase
 * client. Sibling to that function, not an extension of it: this groups by
 * `origin` instead of `product_id`, and only counts `visit` events (D5
 * deliberately drops `whatsapp_click` from this specific breakdown — see
 * `OriginBreakdownEntry`'s own doc comment).
 *
 * Both inputs are expected to already be scoped to one Representative and
 * one period by the caller's query (RLS + a `created_at` filter) — this
 * function does not re-check either.
 *
 * `origin` is read as plain `string | null` (the safe-column grant/RLS
 * layer, not this function, is what would reject a bogus value) and cast to
 * `OriginId | null` on the way out — the same trust boundary
 * `is_valid_origin` already draws at write time, not re-validated at read
 * time: a row that made it into `analytics_events`/`leads` already went
 * through that gate.
 */
export function aggregateOriginBreakdown(
  events: readonly OriginAnalyticsEventRow[],
  leads: readonly OriginLeadRow[],
): OriginBreakdownEntry[] {
  const breakdownByOrigin = new Map<string | null, { visits: number; leads: number }>();

  function entryFor(origin: string | null) {
    let entry = breakdownByOrigin.get(origin);
    if (!entry) {
      entry = { visits: 0, leads: 0 };
      breakdownByOrigin.set(origin, entry);
    }
    return entry;
  }

  for (const event of events) {
    if (event.event_type !== 'visit') continue;
    entryFor(event.origin).visits += 1;
  }

  for (const lead of leads) {
    entryFor(lead.origin).leads += 1;
  }

  return Array.from(breakdownByOrigin.entries()).map(([origin, entry]) => ({
    origin: origin as OriginId | null,
    ...entry,
  }));
}
