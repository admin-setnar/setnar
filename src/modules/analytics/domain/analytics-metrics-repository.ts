/**
 * Port for AN6 (`docs/plans/QR_ANALYTICS_PLAN.md` §4) — the read side of
 * Analytics (Básico). AN1–AN5 already write `analytics_events` rows through
 * `record_page_visit`/`record_whatsapp_click`; this port answers the one
 * question the representative's own hub needs: how many visits, WhatsApp
 * clicks and leads did each of my Products get in a given period.
 *
 * Deliberately a sibling port in this module, not a method bolted onto
 * `AnalyticsGateway` — that port's shape (write, anonymous caller, boolean
 * return) has nothing in common with this one (read, authenticated caller,
 * aggregated numbers). Same "different natures deserve different ports"
 * reasoning `RepresentativeCatalogRepository`'s own doc comment cites.
 */
import type { OriginId } from '@/modules/analytics/domain/origin';

export type AnalyticsPeriodDays = 7 | 30;

export interface ProductAnalyticsSummary {
  readonly productId: string;
  readonly visits: number;
  readonly whatsappClicks: number;
  readonly leads: number;
}

/**
 * SET-84 D5 — "De onde vieram seus resultados": visitas e leads lado a
 * lado por origem, não uma breakdown por produto. `origin: null` is its own
 * row (never omitted) — every visit/lead from before this feature, or from
 * a link without `?src=`, still needs to be accounted for somewhere; a
 * missing row would make the sum of this breakdown silently disagree with
 * `ProductAnalyticsSummary`'s totals for the same window.
 *
 * Deliberately no `whatsappClicks` column here — the Issue's own acceptance
 * criteria only ask for visits and leads by origin (§0 of the plan); adding
 * a third number nobody asked for is exactly the "dashboard avançado" this
 * round explicitly stays away from.
 */
export interface OriginBreakdownEntry {
  readonly origin: OriginId | null;
  readonly visits: number;
  readonly leads: number;
}

export interface AnalyticsMetricsRepository {
  /**
   * `representativeId` is the caller's own Representative row id, resolved
   * server-side before this is called — never trusted from the client. Runs
   * against the signed-in Representative's own request-scoped session, so
   * `analytics_events_select_own`/`leads_select_own` (RLS) are what actually
   * enforce isolation; this port does not add a second enforcement layer.
   *
   * Returns one entry per Product that has at least one event or lead in the
   * window — a Product with none is simply absent, not a zeroed entry;
   * callers render the zero themselves for Products missing from the result.
   */
  listOwnSummaryByProduct(
    representativeId: string,
    periodDays: AnalyticsPeriodDays,
  ): Promise<readonly ProductAnalyticsSummary[]>;

  /**
   * SET-84 D5. Same caller-scoping contract as `listOwnSummaryByProduct`
   * (own Representative id, RLS-enforced, never a second isolation layer) —
   * a sibling read, not a variant of the per-product one, because it groups
   * the same two tables by `origin` instead of `product_id`.
   *
   * Returns one entry per origin (including `null`) with at least one visit
   * or lead in the window — an origin with none is simply absent, same
   * "caller renders the zero" contract `listOwnSummaryByProduct` already
   * documents.
   */
  listOwnBreakdownByOrigin(
    representativeId: string,
    periodDays: AnalyticsPeriodDays,
  ): Promise<readonly OriginBreakdownEntry[]>;
}
