import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { ReserveCheckoutSlotResult, SubscriptionGateway } from '@/modules/billing/domain/subscription-gateway';
import { mapReserveCheckoutSlotResult } from '@/modules/billing/infrastructure/map-subscription-gateway-result';

export class SupabaseSubscriptionGateway implements SubscriptionGateway {
  constructor(private readonly supabase: SupabaseClient) {}

  async reserveCheckoutSlot(): Promise<ReserveCheckoutSlotResult> {
    const { data, error } = await this.supabase.rpc('reserve_billing_checkout_slot');
    return mapReserveCheckoutSlotResult(data, error);
  }
}
