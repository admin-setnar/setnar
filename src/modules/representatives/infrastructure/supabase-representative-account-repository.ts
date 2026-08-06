import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Representative } from '@/modules/representatives/domain/representative';
import type { RepresentativeAccountRepository } from '@/modules/representatives/domain/representative-account-repository';

interface RepresentativeRow {
  id: string;
  slug: string;
  display_name: string;
  authorization_id: string;
  phone: string | null;
  city: string | null;
  avatar_url: string | null;
}

/**
 * Supabase adapter for `RepresentativeAccountRepository`. Queries with the
 * caller's own request-scoped session (`shared/lib/supabase/server.ts`'s
 * `createClient()`) — relies on `representatives_select_own`
 * (`supabase/migrations/20260804000000_add_own_row_select_policies.sql:61-63`)
 * to scope the row to `auth.uid()`; no `.eq('profile_id', ...)` filter would
 * be needed for correctness, since RLS already enforces it, but the filter
 * below is kept anyway as an explicit statement of intent, same posture
 * `SupabaseRepresentativeRepository` takes with its own defense-in-depth
 * checks after the RLS-scoped query.
 *
 * Unlike `SupabaseRepresentativeRepository.findPublishedActivation()`, this
 * does NOT filter by `status` — that port exists for a public visitor, who
 * must only ever see an `active` representative with something published;
 * this one is the owner reading their own row, so nothing should be hidden
 * from them, including a `suspended` status they need to see and understand.
 */
export class SupabaseRepresentativeAccountRepository implements RepresentativeAccountRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async findByProfileId(profileId: string): Promise<Representative | null> {
    const { data, error } = await this.supabase
      .from('representatives')
      .select('id, slug, display_name, authorization_id, phone, city, avatar_url')
      .eq('profile_id', profileId)
      .maybeSingle<RepresentativeRow>();

    if (error) {
      console.error('Representative account read failed.', { code: error.code, message: error.message });
      throw new Error('Representative account unavailable.');
    }
    if (!data) return null;

    return {
      id: data.id,
      slug: data.slug,
      name: data.display_name,
      authorizationId: data.authorization_id,
      phone: data.phone,
      city: data.city,
      avatarUrl: data.avatar_url,
    };
  }
}
