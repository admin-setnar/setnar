/**
 * A Representative is an independent sales professional authorized by one
 * Company to sell that Company's Products (DOMAIN_MODEL.md §8.2 / §3
 * "Representative"). This type carries only the minimum a public Commercial
 * Page needs to render — richer profile fields (social links, business
 * hours, ...) are added here only once a consumer actually needs them, not
 * speculatively.
 *
 * `name` comes from `representatives.display_name`, denormalized from
 * `profiles.full_name` at write time rather than read via join — see the
 * comment on that column in
 * `supabase/migrations/20260731000000_create_representative_domain.sql` for
 * why (profiles' RLS never allowed a public read of it).
 */
export interface Representative {
  readonly id: string;
  /** Subdomain label a Commercial Page resolves by, e.g. `joao-silva` (ADR-026). */
  readonly slug: string;
  readonly name: string;
  readonly licenseId: string;
  readonly phone: string | null;
  readonly city: string | null;
  readonly avatarUrl: string | null;
}

/** The slice of a Product (DOMAIN_MODEL.md §8.4) a Commercial Page needs. */
export interface RepresentativeProduct {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
}

/**
 * A resolved, published (Representative, Product) pair — DOMAIN_MODEL.md
 * §8.5's Product Activation, narrowed to what Commercial Page resolution
 * needs to know it can render.
 *
 * Resolving this pair does NOT confirm the Representative's Subscription is
 * Active (DOMAIN_MODEL.md §8.14, Business Rule 21). See the doc comment on
 * `RepresentativeRepository` for why that check is out of scope here.
 */
export interface RepresentativeActivation {
  readonly representative: Representative;
  readonly product: RepresentativeProduct;
}
