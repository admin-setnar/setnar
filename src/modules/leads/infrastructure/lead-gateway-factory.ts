import 'server-only';

import type { LeadGateway } from '@/modules/leads/domain/lead-gateway';
import { SupabaseLeadGateway } from '@/modules/leads/infrastructure/supabase-lead-gateway';
import { createClient } from '@/shared/lib/supabase/server';

/**
 * Composition root for lead capture — same shape as `getAuthGateway()`
 * (`modules/auth/infrastructure/auth-gateway-factory.ts`). A new gateway is
 * built on every call, never cached, since it wraps a request-scoped
 * Supabase client.
 */
export async function getLeadGateway(): Promise<LeadGateway> {
  const supabase = await createClient();
  return new SupabaseLeadGateway(supabase);
}
