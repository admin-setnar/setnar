/**
 * Input for the professional-profile edit. The public display name, phone,
 * and authorization id are required; only city remains optional.
 * Field names 1:1 with `update_representative_profile`'s `p_`-prefixed
 * parameters (`supabase/migrations/20260808000000_add_update_representative_profile.sql`),
 * same split `RegisterRepresentativeInput`/`SupabaseRepresentativeOnboardingGateway`
 * already use.
 *
 * These values are a FULL REPLACE, not a merge with the current row — same
 * semantics the SQL function documents. The presentation layer (D5b's form)
 * is responsible for pre-filling both with the Representative's current
 * values, so "not editing a field" and "submitting its current value" are the
 * same thing from here down.
 */
export interface UpdateRepresentativeProfileInput {
  readonly displayName: string;
  readonly phone: string;
  readonly city: string | null;
  readonly authorizationId: string;
}

/**
 * The typed rejection reasons `update_representative_profile` can return,
 * reused verbatim from the `status` vocabulary documented in that
 * migration's header — same "don't rename a second, driftable copy"
 * reasoning `ActivateProductRejectionReason` already documents.
 */
export type UpdateRepresentativeProfileRejectionReason =
  | 'representative_not_found'
  | 'display_name_invalid'
  | 'authorization_id_invalid'
  | 'phone_required'
  | 'phone_invalid'
  | 'city_invalid';

/**
 * `'error'` is a real infrastructure failure (network, database down, or an
 * RPC response this gateway doesn't recognise), never presented to the
 * caller as if it were a business rejection — same three-level split every
 * other typed result in this module already uses.
 */
export type UpdateRepresentativeProfileResult =
  | { readonly status: 'updated' }
  | { readonly status: 'rejected'; readonly reason: UpdateRepresentativeProfileRejectionReason }
  | { readonly status: 'error' };

/**
 * Port for the D5b write — a sixth port in this module, not a method added
 * to `RepresentativeOnboardingGateway`: same "different natures deserve
 * different ports" reasoning ADR-031/ADR-041/ADR-042/(D5.1's
 * `RepresentativeCatalogRepository`) already used four times.
 * `RepresentativeOnboardingGateway.register()` is a one-time write, called
 * exactly once per account, before a Representative row exists; `update()`
 * below is a repeatable write against a row that already exists — different
 * enough preconditions and error vocabularies that folding one into the
 * other would force every
 * caller to handle rejection reasons that can never apply to it.
 *
 * See ADR-044 (`README.md`) for why this is a `SECURITY DEFINER` function
 * behind this Gateway, not a column-scoped UPDATE policy.
 */
export interface RepresentativeProfileGateway {
  update(input: UpdateRepresentativeProfileInput): Promise<UpdateRepresentativeProfileResult>;
}
