import type { PostgrestError } from '@supabase/supabase-js';

import type { ApplyBillingEventResult } from '@/modules/billing/domain/billing-webhook-gateway';

/**
 * Mapeamento puro da resposta crua do RPC para o resultado tipado do
 * domínio — testável sem cliente Supabase. `data` é sempre um array de uma
 * linha (`apply_billing_event` é `returns table (...)` de uma linha só) ou
 * `null`/vazio em caso de erro de rede/RPC.
 */
export function mapApplyBillingEventResult(
  data: ReadonlyArray<{ outcome: string; subscription_id: string | null }> | null,
  error: PostgrestError | null,
): ApplyBillingEventResult {
  const [row] = data ?? [];
  if (error || !row) return { status: 'error' };

  switch (row.outcome) {
    case 'applied':
      if (!row.subscription_id) return { status: 'error' };
      return { status: 'applied', subscriptionId: row.subscription_id };
    case 'duplicate':
      return { status: 'duplicate' };
    case 'ignored':
      return { status: 'ignored' };
    case 'unmatched':
      return { status: 'unmatched' };
    default:
      return { status: 'error' };
  }
}
