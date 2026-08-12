import 'server-only';

import type { LeadInboxRepository } from '@/modules/leads/domain/lead-inbox-repository';
import { SupabaseLeadInboxRepository } from '@/modules/leads/infrastructure/supabase-lead-inbox-repository';
import { createClient } from '@/shared/lib/supabase/server';

/** A fresh repository per request prevents one user's cookie session leaking into another. */
export async function getLeadInboxRepository(): Promise<LeadInboxRepository> {
  return new SupabaseLeadInboxRepository(await createClient());
}
