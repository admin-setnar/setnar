import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { RepresentativeProduct } from '@/modules/representatives/domain/representative';
import type {
  RepresentativeCatalogEntry,
  RepresentativeCatalogRepository,
} from '@/modules/representatives/domain/representative-catalog-repository';
import {
  mergeRepresentativeCatalog,
  type OwnActivationRow,
} from '@/modules/representatives/infrastructure/merge-representative-catalog';

interface RepresentativeCompanyRow {
  id: string;
  company_id: string;
}

interface CatalogProductRow {
  id: string;
  slug: string;
  name: string;
  company: { slug: string } | null;
}

/**
 * Supabase adapter for `RepresentativeCatalogRepository`. Three queries, all
 * scoped by the caller's own request-scoped session
 * (`shared/lib/supabase/server.ts`'s `createClient()`):
 *
 *   1. `representatives` — resolves the caller's own `id`/`company_id`, via
 *      `representatives_select_own` (`20260804000000`). If this finds
 *      nothing, the signed-in User has no Representative row and this
 *      returns `[]` — see the doc comment on the port for why that is not an
 *      error here.
 *   2. `products` — every Product in that Company, via `products_select_public`
 *      (`using (true)`, `20260731000000`).
 *   3. `product_activations` — the caller's own rows for every status, via
 *      `product_activations_select_own` (`20260804000000`/`20260805000000`).
 *
 * Queries 2 and 3 run in parallel (`Promise.all`) — neither depends on the
 * other's result, only on query 1's `company_id`/`id`. The merge itself is
 * `mergeRepresentativeCatalog`, a pure function kept in its own file so it is
 * testable without a Supabase client.
 */
export class SupabaseRepresentativeCatalogRepository implements RepresentativeCatalogRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async listOwnCatalog(profileId: string): Promise<readonly RepresentativeCatalogEntry[]> {
    const { data: representative, error: representativeError } = await this.supabase
      .from('representatives')
      .select('id, company_id')
      .eq('profile_id', profileId)
      .maybeSingle<RepresentativeCompanyRow>();

    if (representativeError || !representative) return [];

    const [productsResult, activationsResult] = await Promise.all([
      this.supabase
        .from('products')
        .select('id, slug, name, company:companies!inner ( slug )')
        .eq('company_id', representative.company_id)
        .order('name'),
      this.supabase
        .from('product_activations')
        .select('product_id, status')
        .eq('representative_id', representative.id),
    ]);

    if (productsResult.error || !productsResult.data) return [];

    // A failed activations query is treated as "no activations known" rather
    // than aborting the whole read: the Catalog itself (query 2) is the part
    // a hub cannot render without, and degrading to "everything shows as not
    // activated" is safer than showing nothing at all for a transient hiccup
    // on the second query.
    const activations = activationsResult.error ? [] : (activationsResult.data as OwnActivationRow[]);

    const products: RepresentativeProduct[] = (productsResult.data as unknown as CatalogProductRow[])
      .filter((row) => row.company !== null)
      .map((row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        companySlug: row.company!.slug,
      }));

    return mergeRepresentativeCatalog(products, activations);
  }
}
