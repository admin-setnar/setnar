import type {
  CatalogActivationState,
  RepresentativeCatalogEntry,
} from '@/modules/representatives/domain/representative-catalog-repository';
import type { RepresentativeProduct } from '@/modules/representatives/domain/representative';

/** The slice of a `product_activations` row this merge needs — one per own activation, any status. */
export interface OwnActivationRow {
  readonly product_id: string;
  readonly status: string;
}

/**
 * Pure merge of "every Product in my Company" with "my own activation of
 * each, if any" — the D5.1 read, split out of
 * `SupabaseRepresentativeCatalogRepository` so it is testable without a
 * Supabase client, same convention as `map-product-activation-result.ts`.
 *
 * `status` on the activation row is trusted as one of the three values the
 * `product_activations_status_check` CHECK constraint
 * (`supabase/migrations/20260731000000_create_representative_domain.sql`)
 * already enforces — same trust level `SupabaseRepresentativeAccountRepository`
 * already extends to `representatives.status`, not re-validated here.
 */
export function mergeRepresentativeCatalog(
  products: readonly RepresentativeProduct[],
  activations: readonly OwnActivationRow[],
): RepresentativeCatalogEntry[] {
  const stateByProductId = new Map<string, CatalogActivationState>(
    activations.map((activation) => [activation.product_id, activation.status as CatalogActivationState]),
  );

  return products.map((product) => ({
    product,
    state: stateByProductId.get(product.id) ?? 'not_activated',
  }));
}
