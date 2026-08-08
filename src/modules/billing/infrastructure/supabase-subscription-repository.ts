import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { SubscriptionStatus } from '@/modules/billing/domain/subscription';
import type { OwnSubscriptionView, SubscriptionRepository } from '@/modules/billing/domain/subscription-repository';

interface RawOwnSubscriptionRow {
  readonly status: string;
  readonly amount_cents: number | null;
  readonly currency: string;
  readonly current_period_end: string | null;
  readonly has_external_subscription: boolean;
}

export class SupabaseSubscriptionRepository implements SubscriptionRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async getOwnSubscription(): Promise<OwnSubscriptionView | null> {
    const { data, error } = await this.supabase.rpc('get_own_subscription_view');
    if (error) return null;

    const rows = data as ReadonlyArray<RawOwnSubscriptionRow> | null;
    const [row] = rows ?? [];
    if (!row) return null;

    return {
      status: row.status as SubscriptionStatus,
      amountCents: row.amount_cents,
      currency: row.currency,
      currentPeriodEnd: row.current_period_end,
      hasExternalSubscription: row.has_external_subscription,
    };
  }
}
