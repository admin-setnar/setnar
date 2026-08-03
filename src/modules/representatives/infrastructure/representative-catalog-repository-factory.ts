import 'server-only';

import type { RepresentativeCatalogRepository } from '@/modules/representatives/domain/representative-catalog-repository';
import { SupabaseRepresentativeCatalogRepository } from '@/modules/representatives/infrastructure/supabase-representative-catalog-repository';
import { createClient } from '@/shared/lib/supabase/server';

/**
 * Composition root for the D5.1 read — same shape as
 * `getRepresentativeAccountRepository()`
 * (`infrastructure/representative-account-repository-factory.ts`). A new
 * repository is built on every call, never cached: `createClient()` binds to
 * the current request's cookies, so a module-level singleton would leak one
 * user's session into another's request.
 */
export async function getRepresentativeCatalogRepository(): Promise<RepresentativeCatalogRepository> {
  const supabase = await createClient();
  return new SupabaseRepresentativeCatalogRepository(supabase);
}
