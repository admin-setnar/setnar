import type {
  ActivateProductRejectionReason,
  ActivateProductResult,
  SetActivationStatusRejectionReason,
  SetActivationStatusResult,
} from '@/modules/representatives/domain/product-activation-gateway';

/**
 * The slice of an `activate_product` RPC row this maps. Both functions in
 * `20260807000000_add_product_activation_write_path.sql` are
 * `returns table (...)` — set-returning, so PostgREST/`supabase-js` hands
 * back an array of rows via `.rpc()`, never a single object, even though each
 * only ever produces one row per call.
 */
export interface ActivateProductRpcRow {
  readonly status: string;
  readonly activation_id: string | null;
}

/** The slice of a `set_activation_status` RPC row this maps. */
export interface SetActivationStatusRpcRow {
  readonly status: string;
  readonly activation_id: string | null;
  readonly published_at: string | null;
}

/**
 * The slice of a PostgREST/`supabase-js` error these functions read. Kept as
 * a narrow structural type — not imported from the SDK — so these stay pure
 * functions testable with plain objects, no live Supabase client required.
 * Same convention as `map-register-representative-result.ts` and
 * `modules/auth/infrastructure/map-supabase-auth-error.ts`.
 */
export interface ProductActivationRpcErrorLike {
  readonly message: string;
  readonly code?: string;
}

const ACTIVATE_REJECTION_REASONS: readonly ActivateProductRejectionReason[] = [
  'representative_not_found',
  'product_not_found',
  'product_not_in_catalog',
];

const SET_STATUS_REJECTION_REASONS: readonly SetActivationStatusRejectionReason[] = [
  'representative_not_found',
  'not_activated',
  'invalid_status',
  'invalid_transition',
  'representative_not_active',
  'subscription_not_active',
  'display_name_required',
  'phone_required',
];

function isActivateRejectionReason(status: string): status is ActivateProductRejectionReason {
  return (ACTIVATE_REJECTION_REASONS as readonly string[]).includes(status);
}

function isSetStatusRejectionReason(status: string): status is SetActivationStatusRejectionReason {
  return (SET_STATUS_REJECTION_REASONS as readonly string[]).includes(status);
}

/**
 * Translates the raw `{ data, error }` shape
 * `supabase.rpc('activate_product', ...)` returns into
 * `ActivateProductResult`.
 *
 * Safety rule, deliberately conservative and identical to
 * `mapRegisterRepresentativeResult`'s: any non-null `error`, a null/empty
 * `data`, a `status` this function doesn't recognise, or an `'activated'`
 * row with no `activation_id` all map to `{ status: 'error' }` — never
 * fabricate a success from an unexpected shape. A `status` added by a future
 * migration without updating this file is exactly the case where guessing
 * would be worse than surfacing a generic, loggable error.
 */
export function mapActivateProductResult(
  data: readonly ActivateProductRpcRow[] | null,
  error: ProductActivationRpcErrorLike | null,
): ActivateProductResult {
  if (error) {
    return { status: 'error' };
  }

  const row = data?.[0];
  if (!row) {
    return { status: 'error' };
  }

  if (row.status === 'activated') {
    if (!row.activation_id) {
      return { status: 'error' };
    }
    return { status: 'activated', activationId: row.activation_id };
  }

  if (isActivateRejectionReason(row.status)) {
    return { status: 'rejected', reason: row.status };
  }

  return { status: 'error' };
}

/**
 * Translates the raw `{ data, error }` shape
 * `supabase.rpc('set_activation_status', ...)` returns into
 * `SetActivationStatusResult`. Same safety rule as above.
 *
 * `published_at` is passed through as-is on success, including `null`: an
 * activation that just moved to `unpublished` without ever having been
 * published legitimately has none, and so does an activation whose
 * same-state call was a no-op on a `draft` row.
 */
export function mapSetActivationStatusResult(
  data: readonly SetActivationStatusRpcRow[] | null,
  error: ProductActivationRpcErrorLike | null,
): SetActivationStatusResult {
  if (error) {
    return { status: 'error' };
  }

  const row = data?.[0];
  if (!row) {
    return { status: 'error' };
  }

  if (row.status === 'updated') {
    if (!row.activation_id) {
      return { status: 'error' };
    }
    return {
      status: 'updated',
      activationId: row.activation_id,
      publishedAt: row.published_at,
    };
  }

  if (isSetStatusRejectionReason(row.status)) {
    return { status: 'rejected', reason: row.status };
  }

  return { status: 'error' };
}
