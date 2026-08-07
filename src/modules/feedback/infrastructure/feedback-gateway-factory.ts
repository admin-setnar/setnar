import 'server-only';

import type { FeedbackGateway } from '@/modules/feedback/domain/feedback-gateway';
import { SupabaseFeedbackGateway } from '@/modules/feedback/infrastructure/supabase-feedback-gateway';
import { createClient } from '@/shared/lib/supabase/server';

/**
 * Composition root for the microfeedback gateway — same shape as
 * `getRepresentativeAccountRepository()`. A new gateway is built on every
 * call, never cached: `createClient()` binds to the current request's
 * cookies, so a module-level singleton would leak one user's session into
 * another's request.
 */
export async function getFeedbackGateway(): Promise<FeedbackGateway> {
  const supabase = await createClient();
  return new SupabaseFeedbackGateway(supabase);
}
