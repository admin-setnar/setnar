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
  readonly authorizationId: string;
  readonly phone: string | null;
  readonly city: string | null;
  readonly avatarUrl: string | null;
}

/** The slice of a Product (DOMAIN_MODEL.md §8.4) a Commercial Page needs. */
export interface RepresentativeProduct {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  /**
   * Slug of the Company (DOMAIN_MODEL.md §8.1) this Product's Catalog
   * belongs to — e.g. `igreen`. Exists so a Commercial Page can decide
   * whether to apply a Company-specific visual (CP9, prototype, not
   * approved by iGreen yet — README ADR-057) by checking this real value,
   * never by assuming any single Company.
   */
  readonly companySlug: string;
}

/**
 * A resolved, published (Representative, Product) pair — DOMAIN_MODEL.md
 * §8.5's Product Activation, narrowed to what Commercial Page resolution
 * needs to know it can render.
 *
 * Public resolution is narrowed by E1's RLS policy: the pair is returned only
 * while `is_subscription_active(representative.id)` is true. The type carries
 * no separate Subscription field because successful resolution already
 * includes that availability decision.
 */
export interface RepresentativeActivation {
  readonly representative: Representative;
  readonly product: RepresentativeProduct;
}

/**
 * SET-36: same pair as `RepresentativeActivation`, plus the raw
 * `product_activations.status` — irrelevant for the public path (always
 * `'published'` there, by construction of the query that produces it) but
 * required by the private preview to show the owner which state they are
 * looking at (`'draft'`/`'published'`/`'unpublished'` — never
 * `'not_activated'`, which `CatalogActivationState` uses for "no row at
 * all", a case `findOwnActivation` already reports as `null` instead).
 */
export interface OwnCommercialPageActivation extends RepresentativeActivation {
  readonly status: 'draft' | 'published' | 'unpublished';
}
