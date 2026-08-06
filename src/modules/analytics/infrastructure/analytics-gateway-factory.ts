import 'server-only';

import type { AnalyticsGateway } from '@/modules/analytics/domain/analytics-gateway';
import { createAnalyticsWriteClient } from '@/modules/analytics/infrastructure/analytics-write-client';
import { SupabaseAnalyticsGateway } from '@/modules/analytics/infrastructure/supabase-analytics-gateway';

const reportedFailures = new Set<string>();

/** Log each operational Analytics failure once per process, without request data. */
export function reportAnalyticsFailure(context: string, error: unknown): void {
  if (reportedFailures.has(context)) return;
  reportedFailures.add(context);

  const safeError = error instanceof Error
    ? { name: error.name, message: error.message }
    : { name: 'UnknownError', message: 'Unknown Analytics failure.' };
  console.error(context, safeError);
}

/**
 * Composition root for trusted Analytics writes. The credential is kept in
 * the server-only Analytics infrastructure and is never used by ordinary
 * repositories or sent to the browser.
 */
export async function getAnalyticsGateway(): Promise<AnalyticsGateway> {
  return new SupabaseAnalyticsGateway(createAnalyticsWriteClient());
}
