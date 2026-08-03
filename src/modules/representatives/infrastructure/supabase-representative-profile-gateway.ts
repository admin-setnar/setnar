import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  RepresentativeProfileGateway,
  UpdateRepresentativeProfileInput,
  UpdateRepresentativeProfileResult,
} from '@/modules/representatives/domain/representative-profile-gateway';
import { mapUpdateRepresentativeProfileResult } from '@/modules/representatives/infrastructure/map-update-representative-profile-result';

/**
 * Supabase adapter for `RepresentativeProfileGateway`. Calls
 * `update_representative_profile`
 * (`supabase/migrations/20260808000000_add_update_representative_profile.sql`),
 * `SECURITY DEFINER`, granted to `authenticated` only. Note what is NOT sent:
 * no `representative_id` — it is derived inside the function from
 * `auth.uid()`, never by this adapter (same ADR-036/ADR-040 principle every
 * other write gateway in this module already follows).
 *
 * All mapping from the raw RPC response to the domain result lives in
 * `map-update-representative-profile-result.ts`, not here, so that logic
 * stays testable without a Supabase client.
 */
export class SupabaseRepresentativeProfileGateway implements RepresentativeProfileGateway {
  constructor(private readonly supabase: SupabaseClient) {}

  async update(input: UpdateRepresentativeProfileInput): Promise<UpdateRepresentativeProfileResult> {
    const { data, error } = await this.supabase.rpc('update_representative_profile', {
      p_phone: input.phone,
      p_city: input.city,
      p_license_id: input.licenseId,
    });

    return mapUpdateRepresentativeProfileResult(data, error);
  }
}
