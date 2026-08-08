import type { PostgrestError } from '@supabase/supabase-js';

import type { RecordExternalIdsResult, ReserveCheckoutSlotResult } from '@/modules/billing/domain/subscription-gateway';

/**
 * Mapeamento puro da resposta crua do RPC para o resultado tipado do
 * domínio — testável sem cliente Supabase, mesmo split que
 * `map-register-representative-result.ts` já usa. `data` é sempre um array
 * de uma linha (as duas funções são `returns table (...)` de uma linha só)
 * ou `null`/vazio em caso de erro de rede/RPC.
 */
export function mapReserveCheckoutSlotResult(
  data: ReadonlyArray<{ status: string; amount_cents: number | null }> | null,
  error: PostgrestError | null,
): ReserveCheckoutSlotResult {
  const [row] = data ?? [];
  if (error || !row) return { status: 'error' };

  switch (row.status) {
    case 'reserved':
      if (row.amount_cents === null) return { status: 'error' };
      return { status: 'reserved', amountCents: row.amount_cents };
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

export function mapRecordExternalIdsResult(
  data: ReadonlyArray<{ status: string }> | null,
  error: PostgrestError | null,
): RecordExternalIdsResult {
  const [row] = data ?? [];
  if (error || !row) return { status: 'error' };

  switch (row.status) {
    case 'updated':
      return { status: 'updated' };
    case 'not_found':
      return { status: 'not_found' };
    case 'representative_not_found':
      return { status: 'representative_not_found' };
    default:
      return { status: 'error' };
  }
}
