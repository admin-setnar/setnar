import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  ConfirmCancellationResult,
  PrepareCancellationResult,
  ReserveCheckoutSlotResult,
  SubscriptionGateway,
} from '@/modules/billing/domain/subscription-gateway';
import {
  mapConfirmCancellationResult,
  mapPrepareCancellationResult,
  mapReserveCheckoutSlotResult,
} from '@/modules/billing/infrastructure/map-subscription-gateway-result';

export class SupabaseSubscriptionGateway implements SubscriptionGateway {
  constructor(private readonly supabase: SupabaseClient) {}

  async reserveCheckoutSlot(): Promise<ReserveCheckoutSlotResult> {
    const { data, error } = await this.supabase.rpc('reserve_billing_checkout_slot');
    return mapReserveCheckoutSlotResult(data, error);
  }

  async prepareCancellation(): Promise<PrepareCancellationResult> {
    const { data, error } = await this.supabase.rpc('prepare_own_subscription_cancellation');
    return mapPrepareCancellationResult(data, error);
  }

  async confirmCancellation(externalSubscriptionId: string | null): Promise<ConfirmCancellationResult> {
    const { data, error } = await this.supabase.rpc('confirm_own_subscription_cancellation', {
      p_external_subscription_id: externalSubscriptionId,
    });
    return mapConfirmCancellationResult(data, error);
  }
}
