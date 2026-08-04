import type {
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
  readonly slug: string;
  readonly displayName: string;
  readonly licenseId: string;
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
      slug: 'joao-silva',
      displayName: 'João Silva',
      licenseId: 'IGREEN-001',
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
      slug: 'maria-suspensa',
      displayName: 'Maria Suspensa',
      licenseId: 'IGREEN-002',
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
  constructor(private readonly rows: readonly FixtureRow[] = DEFAULT_ROWS) {}

  async findPublishedActivation(
    representativeSlug: string,
    productSlug: string,
  ): Promise<RepresentativeActivation | null> {
    const row = this.rows.find((r) => r.representative.slug === representativeSlug);
    if (!row || row.representative.status !== 'active') return null;

    const activation = row.activations.find(
      (a) => a.product.slug === productSlug && a.status === 'published',
    );
    if (!activation) return null;

    return { representative: toRepresentative(row.representative), product: activation.product };
  }
}

function toRepresentative(fixture: FixtureRepresentativeRow): Representative {
  return {
    id: fixture.id,
    slug: fixture.slug,
    name: fixture.displayName,
    licenseId: fixture.licenseId,
    phone: fixture.phone,
    city: fixture.city,
    avatarUrl: fixture.avatarUrl,
  };
}
