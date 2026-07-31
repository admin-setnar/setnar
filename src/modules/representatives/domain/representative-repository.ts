import type { RepresentativeActivation } from '@/modules/representatives/domain/representative';

/**
 * Port. The domain states what it needs; infrastructure decides where
 * representatives actually live (in-memory fixture for tests, Supabase in
 * production) — same split as `TenantRepository`.
 *
 * KNOWN LIMITATION, explicitly out of scope for this step: this port does
 * NOT check whether the Representative's Subscription is Active
 * (DOMAIN_MODEL.md §8.14, Business Rule 21 — "a Commercial Page cannot
 * remain Published if its owner's Subscription is not Active"). The
 * `SECURITY DEFINER` function that would let that check run safely against
 * the anon/publishable key (sketched as `is_subscription_active(uuid)` in
 * the RLS design note atop
 * `supabase/migrations/20260731000000_create_representative_domain.sql`)
 * does not exist yet — `subscriptions` currently has zero RLS policies, so
 * nothing can read it through this key at all. A Representative whose
 * Subscription has lapsed still resolves here as long as their
 * `product_activations` row is `published`. Callers must not treat a
 * non-null result as "safe to render publicly" until that check is added.
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
