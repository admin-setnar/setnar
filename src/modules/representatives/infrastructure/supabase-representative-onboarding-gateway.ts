import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  RegisterRepresentativeInput,
  RegisterRepresentativeResult,
  RepresentativeOnboardingGateway,
} from '@/modules/representatives/domain/representative-onboarding-gateway';
import { mapRegisterRepresentativeResult } from '@/modules/representatives/infrastructure/map-register-representative-result';

/**
 * Supabase adapter for `RepresentativeOnboardingGateway`. A fresh instance is
 * created per request by `getRepresentativeOnboardingGateway()` — it holds a
 * request-scoped Supabase client, so it must never be cached as a singleton
 * across requests.
 *
 * Calls `register_representative` (`supabase/migrations/20260806000000`),
 * which validates the input, resolves `company_id` server-side, and inserts
 * — all inside one `SECURITY DEFINER` function, atomically. All mapping from
 * the raw RPC response to the domain result lives in
 * `mapRegisterRepresentativeResult`, not here, so that logic stays testable
 * without a Supabase client.
 */
export class SupabaseRepresentativeOnboardingGateway implements RepresentativeOnboardingGateway {
  constructor(private readonly supabase: SupabaseClient) {}

  async register(input: RegisterRepresentativeInput): Promise<RegisterRepresentativeResult> {
    const { data, error } = await this.supabase.rpc('register_representative', {
      p_slug: input.slug,
      p_display_name: input.displayName,
      p_authorization_id: input.authorizationId,
      p_phone: input.phone,
      p_city: input.city,
    });

    return mapRegisterRepresentativeResult(data, error);
  }
}
