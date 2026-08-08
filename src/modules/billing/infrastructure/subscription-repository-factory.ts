import 'server-only';

import type { SubscriptionRepository } from '@/modules/billing/domain/subscription-repository';
import { SupabaseSubscriptionRepository } from '@/modules/billing/infrastructure/supabase-subscription-repository';
import { createClient } from '@/shared/lib/supabase/server';

export async function getSubscriptionRepository(): Promise<SubscriptionRepository> {
  const supabase = await createClient();
  return new SupabaseSubscriptionRepository(supabase);
}
