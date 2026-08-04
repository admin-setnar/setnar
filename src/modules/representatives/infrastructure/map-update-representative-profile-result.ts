import type {
  UpdateRepresentativeProfileRejectionReason,
  UpdateRepresentativeProfileResult,
} from '@/modules/representatives/domain/representative-profile-gateway';

/**
 * `update_representative_profile` is `returns table (status text)` —
 * set-returning, so `supabase-js` hands back an array of rows via `.rpc()`,
 * same shape note `ActivateProductRpcRow` already documents.
 */
export interface UpdateRepresentativeProfileRpcRow {
  readonly status: string;
}

/** Structural error shape, not imported from the SDK — same convention as `ProductActivationRpcErrorLike`. */
export interface UpdateRepresentativeProfileRpcErrorLike {
  readonly message: string;
  readonly code?: string;
}

const REJECTION_REASONS: readonly UpdateRepresentativeProfileRejectionReason[] = [
  'representative_not_found',
  'authorization_id_invalid',
  'phone_invalid',
  'city_invalid',
];

function isRejectionReason(status: string): status is UpdateRepresentativeProfileRejectionReason {
  return (REJECTION_REASONS as readonly string[]).includes(status);
}

/**
 * Translates the raw `{ data, error }` shape
 * `supabase.rpc('update_representative_profile', ...)` returns into
 * `UpdateRepresentativeProfileResult`. Same conservative safety rule as
 * `mapActivateProductResult`/`mapRegisterRepresentativeResult`: any non-null
 * `error`, a null/empty `data`, or a `status` this function doesn't
 * recognise all map to `{ status: 'error' }` — never fabricate a success
 * from an unexpected shape.
 */
export function mapUpdateRepresentativeProfileResult(
  data: readonly UpdateRepresentativeProfileRpcRow[] | null,
  error: UpdateRepresentativeProfileRpcErrorLike | null,
): UpdateRepresentativeProfileResult {
  if (error) {
    return { status: 'error' };
  }

  const row = data?.[0];
  if (!row) {
    return { status: 'error' };
  }

  if (row.status === 'updated') {
    return { status: 'updated' };
  }

  if (isRejectionReason(row.status)) {
    return { status: 'rejected', reason: row.status };
  }

  return { status: 'error' };
}
