import 'server-only';

import type { AnalyticsGateway } from '@/modules/analytics/domain/analytics-gateway';
import { SupabaseAnalyticsGateway } from '@/modules/analytics/infrastructure/supabase-analytics-gateway';
import { createClient } from '@/shared/lib/supabase/server';

/**
 * Composition root for analytics writes — same shape as `getLeadGateway()`.
 * A new gateway is built on every call, never cached, since it wraps a
 * request-scoped Supabase client.
 */
export async function getAnalyticsGateway(): Promise<AnalyticsGateway> {
  const supabase = await createClient();
  return new SupabaseAnalyticsGateway(supabase);
}
