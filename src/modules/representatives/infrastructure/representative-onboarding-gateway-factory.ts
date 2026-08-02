import 'server-only';

import type { RepresentativeOnboardingGateway } from '@/modules/representatives/domain/representative-onboarding-gateway';
import { SupabaseRepresentativeOnboardingGateway } from '@/modules/representatives/infrastructure/supabase-representative-onboarding-gateway';
import { createClient } from '@/shared/lib/supabase/server';

/**
 * Composition root for Representative onboarding — same shape as
 * `getLeadGateway()` (`modules/leads/infrastructure/lead-gateway-factory.ts`)
 * and `getRepresentativeRepository()`
 * (`modules/representatives/infrastructure/representative-repository-factory.ts`).
 * A new gateway is built on every call, never cached, since it wraps a
 * request-scoped Supabase client.
 */
export async function getRepresentativeOnboardingGateway(): Promise<RepresentativeOnboardingGateway> {
  const supabase = await createClient();
  return new SupabaseRepresentativeOnboardingGateway(supabase);
}
