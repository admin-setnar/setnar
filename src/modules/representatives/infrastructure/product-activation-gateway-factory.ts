import 'server-only';

import type { ProductActivationGateway } from '@/modules/representatives/domain/product-activation-gateway';
import { SupabaseProductActivationGateway } from '@/modules/representatives/infrastructure/supabase-product-activation-gateway';
import { createClient } from '@/shared/lib/supabase/server';

/**
 * Composition root for the product-activation write path — same shape as the
 * other three factories in this module (`representative-repository-factory.ts`,
 * `representative-onboarding-gateway-factory.ts`,
 * `representative-account-repository-factory.ts`). A new gateway is built on
 * every call, never cached: `createClient()` binds to the current request's
 * cookies, so a module-level singleton would leak one user's session into
 * another's request.
 */
export async function getProductActivationGateway(): Promise<ProductActivationGateway> {
  const supabase = await createClient();
  return new SupabaseProductActivationGateway(supabase);
}
