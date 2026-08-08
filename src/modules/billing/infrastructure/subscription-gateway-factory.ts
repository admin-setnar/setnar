import 'server-only';

import type { SubscriptionGateway } from '@/modules/billing/domain/subscription-gateway';
import { SupabaseSubscriptionGateway } from '@/modules/billing/infrastructure/supabase-subscription-gateway';
import { createClient } from '@/shared/lib/supabase/server';

export async function getSubscriptionGateway(): Promise<SubscriptionGateway> {
  const supabase = await createClient();
  return new SupabaseSubscriptionGateway(supabase);
}
