import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  RecordExternalIdsResult,
  ReserveCheckoutSlotResult,
  SubscriptionGateway,
} from '@/modules/billing/domain/subscription-gateway';
import {
  mapRecordExternalIdsResult,
  mapReserveCheckoutSlotResult,
} from '@/modules/billing/infrastructure/map-subscription-gateway-result';

/**
 * Supabase adapter para `SubscriptionGateway` — mesma forma de
 * `SupabaseRepresentativeOnboardingGateway`: instância nova por requisição
 * (`subscription-gateway-factory.ts`), nunca cacheada como singleton.
 */
export class SupabaseSubscriptionGateway implements SubscriptionGateway {
  constructor(private readonly supabase: SupabaseClient) {}

  async reserveCheckoutSlot(): Promise<ReserveCheckoutSlotResult> {
    const { data, error } = await this.supabase.rpc('reserve_billing_checkout_slot');
    return mapReserveCheckoutSlotResult(data, error);
  }

  async recordExternalIds(externalCustomerId: string, externalSubscriptionId: string): Promise<RecordExternalIdsResult> {
    const { data, error } = await this.supabase.rpc('record_billing_external_ids', {
      p_external_customer_id: externalCustomerId,
      p_external_subscription_id: externalSubscriptionId,
    });
    return mapRecordExternalIdsResult(data, error);
  }
}
