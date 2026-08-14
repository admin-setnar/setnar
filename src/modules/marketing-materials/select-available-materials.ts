import { getActivationViewState } from '@/modules/representatives/presentation/activation-view-state';
import type { RepresentativeCatalogEntry } from '@/modules/representatives/domain/representative-catalog-repository';
import { hasMaterialsForProduct } from '@/modules/marketing-materials/material-catalog';

/**
 * A material only shows for a (representative, product) pair the same
 * `isPubliclyAvailable` rule `/app/paginas` already enforces would let
 * through to the public Commercial Page — never a bespoke `isActive` flag
 * (`MARKETING_MATERIALS_PLAN.md` §2.6). Composed with `hasMaterialsForProduct`
 * (`material-catalog.ts`, no component imports) rather than the full
 * component registry — this only needs to know a slot *exists*.
 *
 * Deliberately its own file, not colocated with `materials-page.tsx`: that
 * file also imports `ProductMaterialsCard`, which transitively imports the
 * 21 real pieces and their `./fonts` CSS imports — `node --test` has no CSS
 * loader, so anything importing that chain crashes at require time. Keeping
 * this pure decision importable on its own is what makes it directly
 * testable without rendering React or hitting a database
 * (`ENGINEERING_GUIDELINES.md`: business rules must be testable without
 * infrastructure).
 */
export function selectAvailableProductsWithMaterials(
  catalog: readonly RepresentativeCatalogEntry[],
  subscriptionActive: boolean,
  profileComplete: boolean,
): readonly RepresentativeCatalogEntry[] {
  return catalog
    .filter((entry) => getActivationViewState(entry.state, subscriptionActive, profileComplete).isPubliclyAvailable)
    .filter((entry) => hasMaterialsForProduct(entry.product.slug));
}
