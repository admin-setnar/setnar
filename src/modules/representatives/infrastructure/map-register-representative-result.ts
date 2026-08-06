import type {
  RegisterRepresentativeRejectionReason,
  RegisterRepresentativeResult,
} from '@/modules/representatives/domain/representative-onboarding-gateway';

/**
 * The slice of a `register_representative` RPC row this function actually
 * reads. `register_representative` is `returns table (status text,
 * representative_id uuid)` — a set-returning function, so PostgREST/
 * `supabase-js` hands back an array of rows via `.rpc()`, never a single
 * object, even though this function only ever produces one row per call.
 */
export interface RegisterRepresentativeRpcRow {
  readonly status: string;
  readonly representative_id: string | null;
}

/**
 * The slice of a PostgREST/`supabase-js` error this function actually reads.
 * Kept as a narrow structural type — not imported from the SDK — so this
 * stays a pure function testable with a plain object, no live Supabase
 * client required. Same shape convention as
 * `modules/auth/infrastructure/map-supabase-auth-error.ts`'s
 * `SupabaseAuthErrorLike`.
 */
export interface RegisterRepresentativeRpcErrorLike {
  readonly message: string;
  readonly code?: string;
}

const REJECTION_REASONS: readonly RegisterRepresentativeRejectionReason[] = [
  'company_not_found',
  'already_registered',
  'slug_invalid',
  'slug_taken',
  'display_name_invalid',
  'authorization_id_invalid',
  'phone_required',
  'phone_invalid',
  'city_invalid',
];

function isKnownRejectionReason(status: string): status is RegisterRepresentativeRejectionReason {
  return (REJECTION_REASONS as readonly string[]).includes(status);
}

/**
 * Translates the raw `{ data, error }` shape `supabase.rpc('register_representative', ...)`
 * returns into `RegisterRepresentativeResult`.
 *
 * Safety rule, deliberately conservative: any non-null `error`, a null/empty
 * `data`, or a `status` string this function doesn't recognise all map to
 * `{ status: 'error' }` — never fabricate `'created'` from an unexpected
 * shape. A `status` this mapper doesn't know about (e.g. a 9th value added
 * by a future migration without updating this file) is exactly the case
 * where guessing would be worse than surfacing a generic, loggable error —
 * see `RegisterRepresentativeResult`'s own doc comment for why a business
 * rejection must never be presented as more specific than it actually is.
 */
export function mapRegisterRepresentativeResult(
  data: readonly RegisterRepresentativeRpcRow[] | null,
  error: RegisterRepresentativeRpcErrorLike | null,
): RegisterRepresentativeResult {
  if (error) {
    return { status: 'error' };
  }

  const row = data?.[0];
  if (!row) {
    return { status: 'error' };
  }

  if (row.status === 'created') {
    if (!row.representative_id) {
      return { status: 'error' };
    }
    return { status: 'created', representativeId: row.representative_id };
  }

  if (isKnownRejectionReason(row.status)) {
    return { status: 'rejected', reason: row.status };
  }

  return { status: 'error' };
}
