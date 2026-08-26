import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  OwnCommercialPageActivation,
  Representative,
  RepresentativeActivation,
  RepresentativeProduct,
} from '@/modules/representatives/domain/representative';
import type { RepresentativeRepository } from '@/modules/representatives/domain/representative-repository';

interface RepresentativeRow {
  id: string;
  slug: string;
  display_name: string;
  authorization_id: string;
  phone: string | null;
  city: string | null;
  avatar_url: string | null;
  status: string;
}

interface ProductRow {
  id: string;
  slug: string;
  name: string;
  company: { slug: string } | null;
}

interface ProductActivationRow {
  status: string;
  representative: RepresentativeRow | null;
  product: ProductRow | null;
}

/**
 * Supabase adapter for `RepresentativeRepository`. Queries with the
 * anon/publishable key (`shared/lib/supabase/server.ts`'s `createClient()`),
 * no session required — this is meant to run for anonymous visitors of a
 * public Commercial Page.
 *
 * NOT YET VERIFIED AGAINST A REAL SUPABASE PROJECT (same caveat as
 * `supabase/README.md`'s other flows) — the migration this queries against
 * has not been applied anywhere yet.
 */
export class SupabaseRepresentativeRepository implements RepresentativeRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async findPublishedActivation(
    representativeSlug: string,
    companySlug: string,
    productSlug: string,
  ): Promise<RepresentativeActivation | null> {
    // Queried from product_activations, not representatives, so that
    // `product_activations_select_published`'s RLS scoping (status =
    // 'published') applies directly to the table being filtered, and so
    // `.eq('status', 'published')` below overlaps with — rather than
    // substitutes for — that policy. `representatives_select_public` and
    // `products_select_public` apply the same way to the embedded rows:
    // Postgres RLS is enforced per table regardless of how PostgREST joins
    // them. The `.eq(...)` calls below are NOT re-implementing that
    // filtering; they are this adapter's own defense against trusting a
    // returned row's shape blindly (see the checks after the query).
    const { data, error } = await this.supabase
      .from('product_activations')
      .select(
        `
        status,
        representative:representatives!inner (
          id, slug, display_name, authorization_id, phone, city, avatar_url, status
        ),
        product:products!inner ( id, slug, name, company:companies!inner ( slug ) )
      `,
      )
      .eq('status', 'published')
      .eq('representative.slug', representativeSlug)
      .eq('product.slug', productSlug)
      .maybeSingle<ProductActivationRow>();

    if (error || !data) return null;

    const { representative: representativeRow, product: productRow } = data;
    if (!representativeRow || !productRow || !productRow.company) return null;

    // Defense-in-depth, not a duplicate of the RLS filter above: this does
    // not trust that the embedded rows this specific query returned still
    // match what the policies intend (e.g. a future schema change, or a
    // status this code doesn't otherwise reject).
    if (data.status !== 'published') return null;
    if (representativeRow.status !== 'active') return null;

    // Company membership — a security requirement, not defense-in-depth on
    // top of RLS: RLS has no concept of "the Company the Host claims", only
    // this comparison does. `productRow.company.slug` is the Company the
    // Representative's own Product Activation actually belongs to (Business
    // Rule 6 guarantees a Product Activation can never reference a Product
    // outside the Representative's own Company's Catalog, so this is
    // equivalent to checking the Representative's own Company, using data
    // the query above already loaded — no second query). A mismatch means
    // the Host's Company label doesn't match reality — e.g.
    // `pedro.ademicom.setnar.com` when Pedro only belongs to iGreen — and
    // returns the same `null` as any other unresolvable host, never a
    // differentiated response (ADR-030).
    if (productRow.company.slug !== companySlug) return null;

    const representative: Representative = {
      id: representativeRow.id,
      slug: representativeRow.slug,
      name: representativeRow.display_name,
      authorizationId: representativeRow.authorization_id,
      phone: representativeRow.phone,
      city: representativeRow.city,
      avatarUrl: representativeRow.avatar_url,
    };

    const product: RepresentativeProduct = {
      id: productRow.id,
      slug: productRow.slug,
      name: productRow.name,
      companySlug: productRow.company.slug,
    };

    return { representative, product };
  }

  async findOwnActivation(profileId: string, productSlug: string): Promise<OwnCommercialPageActivation | null> {
    // No `.eq('status', ...)` — `product_activations_select_own`
    // (`supabase/migrations/20260805000000_fix_rls_policy_cycle.sql:180-184`)
    // already scopes this to the caller's own representative, in every
    // status. `.eq('representative.profile_id', profileId)` is this
    // adapter's own defense-in-depth statement of intent, same posture as
    // `findPublishedActivation`'s `.eq(...)` calls above and
    // `SupabaseRepresentativeAccountRepository.findByProfileId`'s own filter
    // — RLS is the real boundary, not this clause.
    const { data, error } = await this.supabase
      .from('product_activations')
      .select(
        `
        status,
        representative:representatives!inner (
          id, slug, display_name, authorization_id, phone, city, avatar_url, status
        ),
        product:products!inner ( id, slug, name, company:companies!inner ( slug ) )
      `,
      )
      .eq('representative.profile_id', profileId)
      .eq('product.slug', productSlug)
      .maybeSingle<ProductActivationRow>();

    if (error || !data) return null;

    const { representative: representativeRow, product: productRow } = data;
    if (!representativeRow || !productRow || !productRow.company) return null;

    const representative: Representative = {
      id: representativeRow.id,
      slug: representativeRow.slug,
      name: representativeRow.display_name,
      authorizationId: representativeRow.authorization_id,
      phone: representativeRow.phone,
      city: representativeRow.city,
      avatarUrl: representativeRow.avatar_url,
    };

    const product: RepresentativeProduct = {
      id: productRow.id,
      slug: productRow.slug,
      name: productRow.name,
      companySlug: productRow.company.slug,
    };

    // Defense-in-depth narrowing, not a duplicate of the CHECK constraint
    // (`product_activations` — `20260731000000:234`): this does not trust
    // that `data.status` still matches the vocabulary this code expects if
    // the constraint ever changes underneath it.
    if (data.status !== 'draft' && data.status !== 'published' && data.status !== 'unpublished') return null;

    return { representative, product, status: data.status };
  }

  async isViewerOwner(representativeId: string): Promise<boolean> {
    // Reuses `is_own_representative` (`supabase/migrations/20260805000000_fix_rls_policy_cycle.sql`),
    // the same SECURITY DEFINER helper the RLS policies on
    // product_activations/analytics_events already call — one question, one
    // place, not a second implementation of "does auth.uid() own this row?".
    // `this.supabase` is bound to the current request's cookies
    // (`shared/lib/supabase/server.ts`), so `auth.uid()` inside the function
    // reflects the actual visitor, not a service-role bypass.
    const { data, error } = await this.supabase.rpc('is_own_representative', {
      p_representative_id: representativeId,
    });

    // Fail closed toward "treat as an external visitor" — an error here must
    // never suppress a real visit/click from being recorded.
    if (error) return false;
    return data === true;
  }
}
