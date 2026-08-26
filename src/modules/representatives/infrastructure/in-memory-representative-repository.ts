import type {
  OwnCommercialPageActivation,
  Representative,
  RepresentativeActivation,
  RepresentativeProduct,
} from '@/modules/representatives/domain/representative';
import type { RepresentativeRepository } from '@/modules/representatives/domain/representative-repository';

type ActivationStatus = 'draft' | 'published' | 'unpublished';

/**
 * Mirrors `representatives`' own columns (`displayName` ~ `display_name`),
 * not the `Representative` domain type directly — this row shape is what a
 * real query returns, `status` included, before `toRepresentative()` below
 * narrows it to the public view. Kept distinct from `Representative` (rather
 * than extending it) specifically so nothing here reads as if `name` still
 * came from a `profiles` join; it never does, as of `display_name` being
 * added directly to `representatives`.
 */
interface FixtureRepresentativeRow {
  readonly id: string;
  readonly profileId: string;
  readonly slug: string;
  readonly displayName: string;
  readonly authorizationId: string;
  readonly phone: string | null;
  readonly city: string | null;
  readonly avatarUrl: string | null;
  readonly status: 'active' | 'suspended';
}

interface FixtureRow {
  readonly representative: FixtureRepresentativeRow;
  readonly activations: readonly {
    readonly product: RepresentativeProduct;
    readonly status: ActivationStatus;
  }[];
}

const CONEXAO_GREEN: RepresentativeProduct = {
  id: 'product-conexao-green',
  slug: 'conexao-green',
  name: 'Conexão Green',
  companySlug: 'igreen',
};

const CONEXAO_SOLAR: RepresentativeProduct = {
  id: 'product-conexao-solar',
  slug: 'conexao-solar',
  name: 'Conexão Solar',
  companySlug: 'igreen',
};

/**
 * Fixture rows for tests. Not wired into any factory — production always
 * resolves against Supabase (`SupabaseRepresentativeRepository`, obtained
 * from `representative-repository-factory.ts`); tests construct this
 * adapter directly, same spirit as `InMemoryTenantRepository` but scoped to
 * unit tests only, since there is no in-memory production path here yet.
 */
const DEFAULT_ROWS: readonly FixtureRow[] = [
  {
    representative: {
      id: 'rep-joao-silva',
      profileId: 'profile-joao-silva',
      slug: 'joao-silva',
      displayName: 'João Silva',
      authorizationId: 'IGREEN-001',
      phone: '+5511999999999',
      city: 'São Paulo',
      avatarUrl: null,
      status: 'active',
    },
    activations: [
      { product: CONEXAO_GREEN, status: 'published' },
      // Activated but not yet published — must never resolve.
      { product: CONEXAO_SOLAR, status: 'draft' },
    ],
  },
  {
    representative: {
      id: 'rep-maria-suspensa',
      profileId: 'profile-maria-suspensa',
      slug: 'maria-suspensa',
      displayName: 'Maria Suspensa',
      authorizationId: 'IGREEN-002',
      phone: null,
      city: null,
      avatarUrl: null,
      status: 'suspended',
    },
    // Published activation, but the representative itself is suspended —
    // must never resolve either (mirrors representatives_select_public's
    // "suspension wins" rule in the migration).
    activations: [{ product: CONEXAO_GREEN, status: 'published' }],
  },
];

export class InMemoryRepresentativeRepository implements RepresentativeRepository {
  /**
   * `viewerProfileId` simulates the current request's session for
   * `isViewerOwner` — there is no real cookie/JWT to read in a fixture.
   * Defaults to `null` (unauthenticated), matching how an anonymous visitor
   * behaves in production.
   */
  constructor(
    private readonly rows: readonly FixtureRow[] = DEFAULT_ROWS,
    private readonly viewerProfileId: string | null = null,
  ) {}

  async findPublishedActivation(
    representativeSlug: string,
    companySlug: string,
    productSlug: string,
  ): Promise<RepresentativeActivation | null> {
    const row = this.rows.find((r) => r.representative.slug === representativeSlug);
    if (!row || row.representative.status !== 'active') return null;

    const activation = row.activations.find(
      (a) => a.product.slug === productSlug && a.status === 'published',
    );
    if (!activation) return null;
    // Same Company-membership check as SupabaseRepresentativeRepository —
    // see that adapter's doc comment for why this is a security requirement,
    // not defense-in-depth.
    if (activation.product.companySlug !== companySlug) return null;

    return { representative: toRepresentative(row.representative), product: activation.product };
  }

  async findOwnActivation(profileId: string, productSlug: string): Promise<OwnCommercialPageActivation | null> {
    const row = this.rows.find((r) => r.representative.profileId === profileId);
    if (!row) return null;

    const activation = row.activations.find((a) => a.product.slug === productSlug);
    if (!activation) return null;

    return { representative: toRepresentative(row.representative), product: activation.product, status: activation.status };
  }

  async isViewerOwner(representativeId: string): Promise<boolean> {
    if (!this.viewerProfileId) return false;
    const row = this.rows.find((r) => r.representative.id === representativeId);
    return row?.representative.profileId === this.viewerProfileId;
  }
}

function toRepresentative(fixture: FixtureRepresentativeRow): Representative {
  return {
    id: fixture.id,
    slug: fixture.slug,
    name: fixture.displayName,
    authorizationId: fixture.authorizationId,
    phone: fixture.phone,
    city: fixture.city,
    avatarUrl: fixture.avatarUrl,
  };
}
