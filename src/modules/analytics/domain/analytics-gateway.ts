/**
 * Port for the two write paths `docs/QR_ANALYTICS_PLAN.md` (AN2/AN4) already
 * put behind `SECURITY DEFINER` functions in Postgres: `record_page_visit`
 * and `record_whatsapp_click`. Both resolve by slug+slug, never by id — see
 * `20260811000000_add_analytics_write_functions.sql`'s own header for why —
 * so this port takes the same shape, mirroring `LeadGateway`.
 *
 * Both calls return a plain `boolean`, same anti-enumeration shape as
 * `submit_lead`: `false` never distinguishes "rate limited" from "invalid
 * pair" from "bot filtered" (the last of those actually returns `true`,
 * meaning "handled, nothing written" — see the migration header). A caller
 * of this port that needs more than "did a row get written or not" is
 * asking the wrong layer.
 */
export interface RecordAnalyticsEventInput {
  readonly representativeSlug: string;
  readonly productSlug: string;
  readonly referrer: string | null;
  readonly ip: string | null;
  readonly userAgent: string | null;
}

export interface AnalyticsGateway {
  recordPageVisit(input: RecordAnalyticsEventInput): Promise<boolean>;
  recordWhatsappClick(input: RecordAnalyticsEventInput): Promise<boolean>;
}
