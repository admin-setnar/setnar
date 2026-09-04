import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

const DOMAIN_MIGRATION_PATH = path.join(
  process.cwd(),
  'supabase/migrations/20260731000000_create_representative_domain.sql',
);
const SEED_MIGRATION_PATH = path.join(
  process.cwd(),
  'supabase/migrations/20260803000000_seed_igreen_catalog.sql',
);
const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase/migrations');

/**
 * The 7 Stage 1 product slugs, read from the prose comment atop `products` in
 * the domain migration — the same single source of truth
 * `tests/route-collision-guard.test.ts` parses, and for the same reason: the
 * list is never re-typed in a second file where it could silently drift.
 *
 * Deliberately duplicated as a local function rather than exported from the
 * other test file: these two guards must stay independently runnable and must
 * not start depending on each other's internals.
 *
 * Stays 7 forever, by design (ADR-095): this comment lives in an
 * already-applied migration that is never edited, and it describes what
 * THAT migration declared — the original Stage 1 set, not the catalog's
 * current total. Products added since (conexao-expansao, ADR-095) are
 * additive migrations, checked separately below, never by editing this
 * function or the comment it reads.
 */
function knownProductSlugs(): string[] {
  const sql = readFileSync(DOMAIN_MIGRATION_PATH, 'utf-8');
  const prose = sql
    .split('\n')
    .map((line) => line.replace(/^--\s?/, ''))
    .join(' ');

  const match = prose.match(/7 Stage 1 slugs \(([^)]+)\)/);
  const capturedSlugs = match?.[1];
  if (!capturedSlugs) {
    throw new Error(
      `Could not find the "7 Stage 1 slugs (...)" comment in ${DOMAIN_MIGRATION_PATH} — ` +
        'has it moved or been reworded? This guard has nothing to check against without it.',
    );
  }

  return capturedSlugs
    .split(',')
    .map((slug) => slug.trim())
    .filter(Boolean);
}

interface SeededProduct {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
}

/**
 * The (id, slug, name) tuples the original seed migration actually inserts,
 * parsed from its `values (...)` list — not from its header comment, which
 * is prose a reader could update without touching the statement below it.
 */
function seededProductsFromOriginalSeed(): SeededProduct[] {
  const sql = readFileSync(SEED_MIGRATION_PATH, 'utf-8');

  const insertIndex = sql.indexOf('insert into public.products');
  if (insertIndex === -1) {
    throw new Error(
      `Could not find the products insert in ${SEED_MIGRATION_PATH} — ` +
        'has the statement been rewritten? This guard has nothing to check without it.',
    );
  }

  const rowPattern = /^\s*\('([0-9a-f-]{36})',\s*'([a-z0-9-]+)',\s*'([^']+)'\)/gm;
  const rows = [...sql.slice(insertIndex).matchAll(rowPattern)];
  if (rows.length === 0) {
    throw new Error(
      `Parsed zero product rows from ${SEED_MIGRATION_PATH}. The values list's ` +
        "formatting changed and this guard stopped checking anything — fix the pattern, don't delete the test.",
    );
  }

  return rows.map((row) => {
    const [matched, id, slug, name] = row;
    if (!id || !slug || !name) {
      throw new Error(`Malformed product row in ${SEED_MIGRATION_PATH}: ${matched}`);
    }
    return { id, slug, name };
  });
}

/**
 * Every catalog migration that adds a product on top of the original 7-row
 * seed, matched by filename convention (`*_add_..._product.sql`) rather
 * than hand-listed — so a future 9th product's migration, following the
 * same convention this one (ADR-095, `20260904170153_add_conexao_expansao_product.sql`)
 * establishes, is picked up here without this test needing another edit.
 */
function additiveCatalogMigrationPaths(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => /_add_.*_product\.sql$/.test(name))
    .sort()
    .map((name) => path.join(MIGRATIONS_DIR, name));
}

/**
 * Parses one additive migration's single inserted product. Deliberately a
 * different pattern from the original seed's `values (...)` tuple shape:
 * an additive migration (ADR-095's own template) inserts one literal row
 * via a `select` list — `'<id>'::uuid, company.id, '<slug>', '<name>'` —
 * not a `values` tuple. A single generic pattern trying to cover both
 * shapes at once risks matching the wrong fields (e.g. picking up an id as
 * if it were a slug, since a literal UUID also satisfies `[a-z0-9-]+`) —
 * two shape-specific patterns, each anchored to its own file's real syntax,
 * avoid that instead of trying to be clever with one regex.
 */
function seededProductFromAdditiveMigration(migrationPath: string): SeededProduct {
  const sql = readFileSync(migrationPath, 'utf-8');
  const pattern = /insert into public\.products[\s\S]*?select[\s\S]*?'([0-9a-f-]{36})'::uuid,\s*company\.id,\s*'([a-z0-9-]+)',\s*'([^']+)'/;
  const match = sql.match(pattern);
  if (!match) {
    throw new Error(
      `Could not parse a single (id, slug, name) product row from ${migrationPath} — ` +
        "has its insert shape changed? This guard has nothing to check without it.",
    );
  }
  const [, id, slug, name] = match;
  if (!id || !slug || !name) {
    throw new Error(`Malformed product row in ${migrationPath}: ${match[0]}`);
  }
  return { id, slug, name };
}

function seededProducts(): SeededProduct[] {
  return [...seededProductsFromOriginalSeed(), ...additiveCatalogMigrationPaths().map(seededProductFromAdditiveMigration)];
}

describe('iGreen catalog seed', () => {
  it('seeds the original 7 Stage 1 product slugs the domain migration declares', () => {
    // Set equality in both directions, so neither a missing product nor an
    // extra one that the app could never resolve by route slips through —
    // scoped to the original 7 only; additive products (ADR-095) are
    // checked in their own test below, never folded into this comparison,
    // since knownProductSlugs() intentionally never grows (see its comment).
    const expected = [...knownProductSlugs()].sort();
    const original = seededProductsFromOriginalSeed()
      .map((product) => product.slug)
      .sort();

    assert.deepEqual(original, expected);
  });

  it('adds exactly one new, non-duplicate product per additive catalog migration since the original seed (ADR-095)', () => {
    const additivePaths = additiveCatalogMigrationPaths();
    assert.ok(additivePaths.length > 0, 'expected at least the ADR-095 conexao-expansao migration');

    const known = knownProductSlugs();
    for (const migrationPath of additivePaths) {
      const product = seededProductFromAdditiveMigration(migrationPath);
      assert.ok(
        !known.includes(product.slug),
        `${migrationPath} re-inserts an original Stage 1 slug ("${product.slug}") — additive migrations must add a new slug, never duplicate one`,
      );
    }
  });

  it('includes conexao-expansao (ADR-095), seeded with a distinct literal id and a non-empty name', () => {
    const expansao = seededProducts().find((product) => product.slug === 'conexao-expansao');
    assert.ok(expansao, 'conexao-expansao must be seeded by an additive migration');
    assert.equal(expansao!.name, 'Conexão Expansão');
    assert.match(expansao!.id, /^[0-9a-f-]{36}$/);
  });

  it('gives every seeded product (original + additive) a distinct literal id and a non-empty name', () => {
    // The ids are a documented contract (see the seed migration's header):
    // a copy-paste duplicate would not be caught by `on conflict
    // (company_id, slug) do nothing`, it would fail as a primary key
    // violation only once someone actually applies the migration.
    const products = seededProducts();
    const ids = new Set(products.map((product) => product.id));
    const slugs = new Set(products.map((product) => product.slug));

    assert.equal(ids.size, products.length, 'every product must have a distinct id, across every catalog migration');
    assert.equal(slugs.size, products.length, 'every product must have a distinct slug, across every catalog migration');
    for (const product of products) {
      assert.ok(product.name.trim().length > 0, `product ${product.slug} has an empty name`);
    }
  });
});
