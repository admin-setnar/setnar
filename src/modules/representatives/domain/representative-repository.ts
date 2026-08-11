import type { OwnCommercialPageActivation, RepresentativeActivation } from '@/modules/representatives/domain/representative';

/**
 * Port. The domain states what it needs; infrastructure decides where
 * representatives actually live (in-memory fixture for tests, Supabase in
 * production) — same split as `TenantRepository`.
 *
 * E1 (`20260815000000_add_subscription_enforcement.sql`) narrows the public
 * `product_activations` policy with `is_subscription_active`. A non-null pair
 * returned through the public Supabase adapter is therefore safe to render
 * with respect to Business Rule 21; the application predicates remain
 * defense in depth, while RLS owns the visibility decision.
 */
export interface RepresentativeRepository {
  /**
   * Resolves the (Representative, Product) pair for a public Commercial
   * Page, or `null` if the Representative doesn't exist, the Product
   * doesn't exist, or there is no `published` Product Activation linking
   * the two.
   */
  findPublishedActivation(
    representativeSlug: string,
    productSlug: string,
  ): Promise<RepresentativeActivation | null>;

  /**
   * SET-36: resolves the (Representative, Product) pair for the signed-in
   * caller's own private preview, regardless of the Product Activation's
   * `status` — `draft` and `unpublished` included, not just `published`.
   * `null` when the caller has no Representative row, the Product doesn't
   * exist, or there is no Product Activation of any status linking the two
   * (the `'not_activated'` case `CatalogActivationState` names).
   *
   * `profileId` is the caller's own `auth.uid()` (from `getCurrentUser()`),
   * same convention as `RepresentativeAccountRepository.findByProfileId` —
   * scoping by identity, never by a representative/product id supplied by
   * the caller. Unlike `findPublishedActivation`, this never re-checks
   * `representative.status !== 'active'`: that check exists there to keep a
   * suspended Representative's page out of PUBLIC view, not to hide a
   * Representative's own row from themselves — same reasoning
   * `SupabaseRepresentativeAccountRepository.findByProfileId` already gives
   * for not filtering by status.
   */
  findOwnActivation(profileId: string, productSlug: string): Promise<OwnCommercialPageActivation | null>;
}
