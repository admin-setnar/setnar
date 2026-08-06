import type { RepresentativeProduct } from '@/modules/representatives/domain/representative';

/**
 * The state of one (Representative, Product) pair from the owner's own point
 * of view — a superset of `ProductActivationStatus`
 * (`domain/product-activation-gateway.ts`) with one extra value,
 * `'not_activated'`, for a Product that has no `product_activations` row at
 * all yet. `'draft'`/`'published'`/`'unpublished'` are the exact column
 * values `activate_product`/`set_activation_status`
 * (`supabase/migrations/20260807000000_add_product_activation_write_path.sql`)
 * already use — not renamed, same reasoning `ActivateProductRejectionReason`
 * already documents for reusing that vocabulary verbatim.
 */
export type CatalogActivationState = 'not_activated' | 'draft' | 'published' | 'unpublished';

/** One row of the D5.1 hub list: a Product the Representative's Company sells, and where it stands. */
export interface RepresentativeCatalogEntry {
  readonly product: RepresentativeProduct;
  readonly state: CatalogActivationState;
}

/**
 * Port for the D5.1 read: every Product in the signed-in Representative's own
 * Company, crossed with that Representative's own `product_activations` row
 * for each, if any.
 *
 * A fifth port in this module, not a method added to `RepresentativeAccountRepository`
 * — same "different natures deserve different ports" reasoning ADR-031/
 * ADR-041/ADR-042 already used three times. `RepresentativeAccountRepository`
 * answers "what is my own Representative row" (one table, one row);
 * this answers "what does my Company's Catalog look like to me" (two tables,
 * many rows, merged) — a different query shape with its own adapter, not a
 * second responsibility bolted onto the first port's implementation.
 *
 * No new migration backs this: `products_select_public` (`using (true)`,
 * `supabase/migrations/20260731000000_create_representative_domain.sql`)
 * already covers reading the Catalog, and `product_activations_select_own`
 * (`supabase/migrations/20260804000000_add_own_row_select_policies.sql`,
 * recreated in `20260805000000`) already covers reading the Representative's
 * own activations in every status, including `draft`/`unpublished` that the
 * public-facing policy hides.
 */
export interface RepresentativeCatalogRepository {
  /**
   * `profileId` is the caller's own `auth.uid()` (from `getCurrentUser()`),
   * same convention as `RepresentativeAccountRepository.findByProfileId`.
   *
   * Returns an empty array — never throws, never returns `null` — if the
   * signed-in User has no Representative row, or if either underlying query
   * fails. Callers only invoke this once `/app` has already confirmed a
   * Representative exists (D3.B.5's branch); an empty result here is
   * therefore either "the Catalog is genuinely empty" (cannot happen once D1
   * is seeded) or an infrastructure hiccup, and a hub rendering zero rows in
   * either case is the safe default — never a thrown exception from a
   * Server Component.
   */
  listOwnCatalog(profileId: string): Promise<readonly RepresentativeCatalogEntry[]>;

  /**
   * Reads the canonical E1 decision for the signed-in Representative. Errors
   * fail closed (`false`) so the hub never presents a page as public when its
   * availability could not be confirmed.
   */
  isSubscriptionActive(representativeId: string): Promise<boolean>;
}
