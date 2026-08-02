/**
 * The two statuses `set_activation_status` accepts as a transition target.
 * `draft` is deliberately absent — it is only ever the initial state
 * `activate_product` creates, never an explicit destination (see
 * `supabase/migrations/20260807000000_add_product_activation_write_path.sql`'s
 * header for the full transition table).
 */
export type ProductActivationStatus = 'published' | 'unpublished';

/**
 * The typed rejection reasons `activate_product` can return, reused verbatim
 * from the `status` vocabulary documented in that migration's header — not
 * renamed, for the same reason `RegisterRepresentativeRejectionReason`
 * reuses its own (a second, differently-spelled copy is exactly the
 * two-sources-of-truth drift ADR-036 warns against).
 */
export type ActivateProductRejectionReason =
  | 'representative_not_found'
  | 'product_not_found'
  | 'product_not_in_catalog';

/**
 * `'activated'` covers BOTH "a new draft activation was created" and "this
 * pair was already activated" — `activate_product` is idempotent by design
 * and does not distinguish the two, because the postcondition is identical
 * and no caller can act differently on the difference. See that migration's
 * header for the full reasoning.
 *
 * `'error'` is a real infrastructure failure (network, database down, or an
 * RPC response this gateway doesn't recognise) and must never be presented
 * to the caller as if it were a business rejection — same three-level split
 * as `RegisterRepresentativeResult`.
 */
export type ActivateProductResult =
  | { readonly status: 'activated'; readonly activationId: string }
  | { readonly status: 'rejected'; readonly reason: ActivateProductRejectionReason }
  | { readonly status: 'error' };

/**
 * The typed rejection reasons `set_activation_status` can return, again
 * verbatim from the SQL.
 *
 * The last three are the publish gate, deliberately granular rather than one
 * generic "cannot publish": the activation UI needs to know exactly what to
 * ask the Representative to fix, and only the FIRST failing precondition is
 * reported (order: not-active, then display name, then phone — a suspended
 * Representative must not be told to fill in their phone).
 */
export type SetActivationStatusRejectionReason =
  | 'representative_not_found'
  | 'not_activated'
  | 'invalid_status'
  | 'invalid_transition'
  | 'representative_not_active'
  | 'display_name_required'
  | 'phone_required';

/**
 * `'updated'` covers both a real transition and an idempotent same-state
 * call. `publishedAt` is the ISO timestamp of the FIRST time this activation
 * went public, or `null` if it never has — never overwritten on republish,
 * never cleared on unpublish (see the migration header for why).
 */
export type SetActivationStatusResult =
  | {
      readonly status: 'updated';
      readonly activationId: string;
      readonly publishedAt: string | null;
    }
  | { readonly status: 'rejected'; readonly reason: SetActivationStatusRejectionReason }
  | { readonly status: 'error' };

/**
 * Port for the authenticated write path over `product_activations` — the D4
 * step that lets a Representative who finished onboarding actually put a
 * public page online.
 *
 * A fourth port in this module rather than a method on any of the existing
 * three, for the reason already established twice (ADR-031, ADR-041) and
 * once more here: `RepresentativeRepository` is public/anonymous resolution,
 * `RepresentativeAccountRepository` (ADR-042) is the owner's own-row read,
 * `RepresentativeOnboardingGateway` is the one-off account-creation write.
 * This one is a per-product write with its own state machine. The module's
 * naming convention holds: "Repository" reads, "Gateway" writes.
 *
 * It lives in `modules/representatives/` and not in a `catalog` module
 * because `DOMAIN_MODEL.md` §7.3 (lines 222-223) assigns Product Activation
 * to Representative Management — Catalog Management (§7.4) owns Catalog and
 * Product, not Activation — and no `catalog` module exists.
 *
 * Deliberately write-only: reading back "my activations" (which D5 will
 * need) belongs on a read port, not here. `product_activations_select_own`
 * (ADR-038/ADR-039) already unblocks that read whenever it is designed.
 */
export interface ProductActivationGateway {
  /**
   * Creates a `draft` activation of `productId` for the signed-in
   * Representative, or resolves successfully if one already exists. The
   * Representative is derived from the session inside the database function
   * — never named by the caller.
   *
   * Never changes the status of an activation that already exists:
   * re-activating an already-published product must not take its page
   * offline.
   */
  activate(productId: string): Promise<ActivateProductResult>;

  /**
   * Transitions an existing activation to `published` or `unpublished`.
   * Publishing runs the publish gate; unpublishing never does.
   */
  setStatus(productId: string, status: ProductActivationStatus): Promise<SetActivationStatusResult>;
}
