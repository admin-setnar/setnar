import 'server-only';

import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { AnalyticsGateway, RecordAnalyticsEventInput } from '@/modules/analytics/domain/analytics-gateway';

/**
 * Same `sha256(salt:value)` scheme as `login-rate-limiter.ts`'s `hash()` and
 * `supabase-lead-gateway.ts`'s own copy, but reading its own salt,
 * `ANALYTICS_IP_SALT` — deliberately a THIRD salt, not `LOGIN_ATTEMPT_SALT`
 * reused. See ADR-054 in the README for why this reverses the original
 * decision: reusing the login/lead salt would make an analytics `ip_hash`
 * and a lead/login `ip_hash` computed from the same IP identical, which is
 * exactly the cross-table correlation `docs/QR_ANALYTICS_PLAN.md` §3.4's
 * conservative LGPD posture forbids. Duplicated here rather than imported,
 * same reasoning `supabase-lead-gateway.ts` already gives for its own copy.
 */
function hash(value: string): string {
  const salt = process.env.ANALYTICS_IP_SALT;
  if (!salt) {
    throw new Error('ANALYTICS_IP_SALT is not configured.');
  }
  return createHash('sha256').update(`${salt}:${value}`).digest('hex');
}

let missingIpWarningLogged = false;
const loggedRpcFailures = new Set<string>();

/**
 * Supabase adapter for `AnalyticsGateway`. A fresh instance is created per
 * request by `getAnalyticsGateway()` around the Analytics-only privileged
 * client; the browser never receives that credential or this RPC payload.
 *
 * Calls `record_page_visit`/`record_whatsapp_click`
 * (`supabase/migrations/20260811000000_add_analytics_write_functions.sql`),
 * which do their own resolution, public-access validation, bot filtering and
 * rate limiting inside Postgres. The adapter computes the IP hash before the
 * raw address leaves the server process.
 */
export class SupabaseAnalyticsGateway implements AnalyticsGateway {
  constructor(private readonly supabase: SupabaseClient) {}

  async recordPageVisit(input: RecordAnalyticsEventInput): Promise<boolean> {
    return this.record('record_page_visit', input);
  }

  async recordWhatsappClick(input: RecordAnalyticsEventInput): Promise<boolean> {
    return this.record('record_whatsapp_click', input);
  }

  private async record(
    fn: 'record_page_visit' | 'record_whatsapp_click',
    input: RecordAnalyticsEventInput,
  ): Promise<boolean> {
    if (!input.ip) {
      if (!missingIpWarningLogged) {
        console.warn('Analytics event skipped because no trusted client IP was available.');
        missingIpWarningLogged = true;
      }
      return false;
    }

    const { data, error } = await this.supabase.rpc(fn, {
      p_representative_slug: input.representativeSlug,
      p_product_slug: input.productSlug,
      p_referrer: input.referrer,
      p_ip_hash: hash(input.ip),
      p_user_agent: input.userAgent,
      p_origin: input.origin,
    });

    if (error) {
      if (!loggedRpcFailures.has(fn)) {
        loggedRpcFailures.add(fn);
        console.error(`${fn} RPC failed`, { code: error.code, message: error.message });
      }
      return false;
    }
    return data === true;
  }
}
