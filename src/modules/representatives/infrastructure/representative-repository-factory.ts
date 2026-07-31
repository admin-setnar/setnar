import 'server-only';

import type { RepresentativeRepository } from '@/modules/representatives/domain/representative-repository';
import { SupabaseRepresentativeRepository } from '@/modules/representatives/infrastructure/supabase-representative-repository';
import { createClient } from '@/shared/lib/supabase/server';

/**
 * Composition root for representative resolution.
 *
 * Unlike `getTenantRepository()`, this always returns the Supabase adapter —
 * there is no in-memory production path for representatives. A new client is
 * built per call, never cached: `createClient()` binds to the current
 * request's cookies (see `shared/lib/supabase/server.ts`), so a module-level
 * singleton would leak across requests. No session is required for the
 * queries this adapter runs — see its own doc comment for what to read
 * before trusting it against a real database.
 */
export async function getRepresentativeRepository(): Promise<RepresentativeRepository> {
  const supabase = await createClient();
  return new SupabaseRepresentativeRepository(supabase);
}
