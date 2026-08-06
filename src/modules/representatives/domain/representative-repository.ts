import type { RepresentativeActivation } from '@/modules/representatives/domain/representative';

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
}
