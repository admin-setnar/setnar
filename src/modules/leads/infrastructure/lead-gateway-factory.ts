import 'server-only';

import type { LeadGateway } from '@/modules/leads/domain/lead-gateway';
import { createLeadWriteClient } from '@/modules/leads/infrastructure/lead-write-client';
import { SupabaseLeadGateway } from '@/modules/leads/infrastructure/supabase-lead-gateway';

/**
 * Composition root for trusted lead writes. The privileged credential stays
 * inside server-only lead infrastructure and is never used by ordinary
 * repositories or sent to the browser.
 */
export async function getLeadGateway(): Promise<LeadGateway> {
  return new SupabaseLeadGateway(createLeadWriteClient());
}
