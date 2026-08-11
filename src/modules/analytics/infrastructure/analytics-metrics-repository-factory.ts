import 'server-only';

import type { AnalyticsMetricsRepository } from '@/modules/analytics/domain/analytics-metrics-repository';
import { SupabaseAnalyticsMetricsRepository } from '@/modules/analytics/infrastructure/supabase-analytics-metrics-repository';
import { createClient } from '@/shared/lib/supabase/server';

/**
 * Composition root for AN6 — same shape as
 * `getRepresentativeCatalogRepository()`
 * (`representatives/infrastructure/representative-catalog-repository-factory.ts`).
 * A new repository is built on every call, never cached: `createClient()`
 * binds to the current request's cookies, so a module-level singleton would
 * leak one user's session into another's request.
 */
export async function getAnalyticsMetricsRepository(): Promise<AnalyticsMetricsRepository> {
  const supabase = await createClient();
  return new SupabaseAnalyticsMetricsRepository(supabase);
}
