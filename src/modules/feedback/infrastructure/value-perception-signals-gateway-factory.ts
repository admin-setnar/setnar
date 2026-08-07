import 'server-only';

import type { ValuePerceptionSignalsGateway } from '@/modules/feedback/domain/value-perception-signals-gateway';
import { SupabaseValuePerceptionSignalsGateway } from '@/modules/feedback/infrastructure/supabase-value-perception-signals-gateway';
import { createClient } from '@/shared/lib/supabase/server';

/**
 * Composition root for the SET-62 signals gateway — same shape as
 * `getFeedbackGateway()`. A new gateway is built on every call, never
 * cached: `createClient()` binds to the current request's cookies.
 */
export async function getValuePerceptionSignalsGateway(): Promise<ValuePerceptionSignalsGateway> {
  const supabase = await createClient();
  return new SupabaseValuePerceptionSignalsGateway(supabase);
}
