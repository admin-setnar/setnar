import 'server-only';

import type { RepresentativeAccountRepository } from '@/modules/representatives/domain/representative-account-repository';
import { SupabaseRepresentativeAccountRepository } from '@/modules/representatives/infrastructure/supabase-representative-account-repository';
import { createClient } from '@/shared/lib/supabase/server';

/**
 * Composition root for reading the signed-in User's own Representative row —
 * same shape as `getRepresentativeRepository()`
 * (`infrastructure/representative-repository-factory.ts`) and
 * `getRepresentativeOnboardingGateway()`
 * (`infrastructure/representative-onboarding-gateway-factory.ts`). A new
 * repository is built on every call, never cached: `createClient()` binds to
 * the current request's cookies, so a module-level singleton would leak one
 * user's session into another's request.
 */
export async function getRepresentativeAccountRepository(): Promise<RepresentativeAccountRepository> {
  const supabase = await createClient();
  return new SupabaseRepresentativeAccountRepository(supabase);
}
