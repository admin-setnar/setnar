import type { PostgrestError } from '@supabase/supabase-js';

import type {
  ConfirmCancellationResult,
  PrepareCancellationResult,
  ReserveCheckoutSlotResult,
} from '@/modules/billing/domain/subscription-gateway';

/**
 * Mapeamento puro da resposta crua do RPC para o resultado tipado do
 * domínio — testável sem cliente Supabase. `data` é sempre um array de uma
 * linha (`reserve_billing_checkout_slot` é `returns table (...)` de uma
 * linha só) ou `null`/vazio em caso de erro de rede/RPC.
 */
export function mapReserveCheckoutSlotResult(
  data: ReadonlyArray<{ id: string | null; status: string; amount_cents: number | null }> | null,
  error: PostgrestError | null,
): ReserveCheckoutSlotResult {
  const [row] = data ?? [];
  if (error || !row) return { status: 'error' };

  switch (row.status) {
    case 'reserved':
      if (row.amount_cents === null || row.id === null) return { status: 'error' };
      return { status: 'reserved', localSubscriptionId: row.id, amountCents: row.amount_cents };
    case 'already_active':
      return { status: 'already_active' };
    case 'sold_out':
      return { status: 'sold_out' };
    case 'representative_not_found':
      return { status: 'representative_not_found' };
    default:
      return { status: 'error' };
  }
}

export function mapPrepareCancellationResult(
  data: ReadonlyArray<{ status: string; external_subscription_id: string | null }> | null,
  error: PostgrestError | null,
): PrepareCancellationResult {
  const [row] = data ?? [];
  if (error || !row) return { status: 'error' };

  switch (row.status) {
    case 'cancelable':
      return { status: 'cancelable', externalSubscriptionId: row.external_subscription_id };
    case 'already_canceled':
      return { status: 'already_canceled' };
    case 'not_found':
      return { status: 'not_found' };
    default:
      return { status: 'error' };
  }
}

export function mapConfirmCancellationResult(
  data: ReadonlyArray<{ status: string }> | null,
  error: PostgrestError | null,
): ConfirmCancellationResult {
  const [row] = data ?? [];
  if (error || !row) return { status: 'error' };

  switch (row.status) {
    case 'canceled':
      return { status: 'canceled' };
    case 'already_canceled':
      return { status: 'already_canceled' };
    case 'not_found':
      return { status: 'not_found' };
    default:
      return { status: 'error' };
  }
}
