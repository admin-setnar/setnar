import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

/**
 * The 7 Stage 1 product slugs, read from the prose comment atop `products` in
 * the domain migration — the same single source of truth
 * `tests/route-collision-guard.test.ts` parses, and for the same reason: the
 * list is never re-typed in a second file where it could silently drift.
 *
 * Deliberately duplicated as a local function rather than exported from the
 * other test file: these two guards must stay independently runnable and must
 * not start depending on each other's internals.
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
 * The (id, slug, name) tuples the seed migration actually inserts, parsed from
 * its `values (...)` list — not from its header comment, which is prose a
 * reader could update without touching the statement below it.
 */
function seededProducts(): SeededProduct[] {
  const sql = readFileSync(SEED_MIGRATION_PATH, 'utf-8');

  // Only the products insert: the file also inserts one `companies` row, whose
  // tuple has a different shape (no id/slug/name triple) but must never be
  // picked up here by accident.
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

describe('iGreen catalog seed', () => {
  it('seeds exactly the 7 product slugs the domain migration declares', () => {
    // Set equality in both directions, so neither a missing product nor an
    // extra one that the app could never resolve by route slips through.
    const expected = [...knownProductSlugs()].sort();
    const seeded = seededProducts()
      .map((product) => product.slug)
      .sort();

    assert.deepEqual(seeded, expected);
  });

  it('gives every seeded product a distinct literal id and a non-empty name', () => {
    // The ids are a documented contract (see the seed migration's header):
    // a copy-paste duplicate would not be caught by `on conflict
    // (company_id, slug) do nothing`, it would fail as a primary key
    // violation only once someone actually applies the migration.
    const products = seededProducts();
    const ids = new Set(products.map((product) => product.id));

    assert.equal(ids.size, products.length);
    for (const product of products) {
      assert.ok(product.name.trim().length > 0, `product ${product.slug} has an empty name`);
    }
  });
});
