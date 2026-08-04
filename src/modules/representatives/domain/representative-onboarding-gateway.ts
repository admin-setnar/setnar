/**
 * Input for registering a new Representative — camelCase in the domain,
 * translated to `register_representative`'s `p_`-prefixed snake_case
 * parameters only at the adapter boundary
 * (`infrastructure/supabase-representative-onboarding-gateway.ts`), same
 * split `SubmitLeadInput`/`SupabaseLeadGateway` already use. Field names are
 * a 1:1 match to the SQL signature
 * (`supabase/migrations/20260806000000_add_register_representative.sql`),
 * deliberately not renamed on this side without the other.
 */
export interface RegisterRepresentativeInput {
  readonly slug: string;
  readonly displayName: string;
  readonly authorizationId: string;
  readonly phone: string | null;
  readonly city: string | null;
}

/**
 * The 8 typed rejection reasons `register_representative` can return,
 * reused verbatim (not renamed) from the `status` vocabulary documented in
 * that migration's header and in ADR-040 — a second, differently-spelled
 * copy here would be exactly the two-sources-of-truth drift risk ADR-036
 * already warns against.
 */
export type RegisterRepresentativeRejectionReason =
  | 'company_not_found'
  | 'already_registered'
  | 'slug_invalid'
  | 'slug_taken'
  | 'display_name_invalid'
  | 'authorization_id_invalid'
  | 'phone_invalid'
  | 'city_invalid';

/**
 * `'rejected'` carries a typed `reason` — unlike `SubmitLeadResult`
 * (`modules/leads/domain/lead-gateway.ts`), which deliberately collapses
 * every rejection into one anti-enumeration-safe outcome, this result must
 * NOT collapse the 8 reasons above: an onboarding form needs to tell "this
 * slug can never work" (`slug_invalid`) apart from "someone already has it"
 * (`slug_taken`), and the caller here is always authenticated (a higher bar
 * than `submit_lead`'s anonymous RPC caller) — see the D3.B.1 investigation
 * and ADR-040 for why that anti-enumeration concern does not transfer.
 * `'error'` is a real infrastructure failure (network, database down, or an
 * RPC response this gateway doesn't recognise) and must never be presented
 * to the caller as if it were a business rejection.
 */
export type RegisterRepresentativeResult =
  | { readonly status: 'created'; readonly representativeId: string }
  | { readonly status: 'rejected'; readonly reason: RegisterRepresentativeRejectionReason }
  | { readonly status: 'error' };

/**
 * Port for authenticated Representative onboarding — deliberately separate
 * from `RepresentativeRepository` (`domain/representative-repository.ts`),
 * not an extra method on it.
 *
 * `RepresentativeRepository`'s own doc comment frames it as the PUBLIC
 * resolution port: anonymous reads, no session, for rendering a Commercial
 * Page. `register()` below is the opposite in every dimension that matters —
 * authenticated, a write, one call per account rather than one per page
 * view — the same "different natures deserve different ports" reasoning
 * ADR-031 already used to justify `RepresentativeRepository` as its own port
 * instead of folding Representative resolution into `TenantRepository`.
 * It also keeps this module's existing naming convention intact:
 * "Repository" ports in this codebase are read-only (`RepresentativeRepository`,
 * `TenantRepository`); write/action ports are "Gateway" (`AuthGateway`,
 * `LeadGateway`) — extending `RepresentativeRepository` with a write method
 * would have broken that convention and forced every read-side mock
 * (`InMemoryRepresentativeRepository`) to implement a method it never needs.
 *
 * See ADR-040 (`README.md`) for the SQL side of this contract.
 */
export interface RepresentativeOnboardingGateway {
  register(input: RegisterRepresentativeInput): Promise<RegisterRepresentativeResult>;
}
