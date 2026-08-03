import 'server-only';

import type { RepresentativeProfileGateway } from '@/modules/representatives/domain/representative-profile-gateway';
import { SupabaseRepresentativeProfileGateway } from '@/modules/representatives/infrastructure/supabase-representative-profile-gateway';
import { createClient } from '@/shared/lib/supabase/server';

/**
 * Composition root for the D5b write — same shape as the other write
 * factories in this module (`representative-onboarding-gateway-factory.ts`,
 * `product-activation-gateway-factory.ts`). A new gateway is built on every
 * call, never cached: `createClient()` binds to the current request's
 * cookies, so a module-level singleton would leak one user's session into
 * another's request.
 */
export async function getRepresentativeProfileGateway(): Promise<RepresentativeProfileGateway> {
  const supabase = await createClient();
  return new SupabaseRepresentativeProfileGateway(supabase);
}
