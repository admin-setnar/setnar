import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

const MIGRATION_PATH = path.join(
  process.cwd(),
  'supabase/migrations/20260731000000_create_representative_domain.sql',
);
const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase/migrations');
const APP_DIR = path.join(process.cwd(), 'src/app');

/**
 * Single source of truth for the 7 original Stage 1 product slugs is the
 * prose comment atop `products` in the migration itself — not re-typed
 * here. Parsed, not hand-copied, so this guard can never drift from the
 * schema comment it depends on; if that comment's wording ever changes,
 * this throws instead of silently checking against a stale list.
 *
 * Deliberately duplicated from `tests/catalog-seed.test.ts` rather than
 * shared — see that file's own comment for why these two guards stay
 * independently runnable.
 */
function originalProductSlugs(): string[] {
  const sql = readFileSync(MIGRATION_PATH, 'utf-8');
  const prose = sql
    .split('\n')
    .map((line) => line.replace(/^--\s?/, ''))
    .join(' ');

  const match = prose.match(/7 Stage 1 slugs \(([^)]+)\)/);
  const capturedSlugs = match?.[1];
  if (!capturedSlugs) {
    throw new Error(
      `Could not find the "7 Stage 1 slugs (...)" comment in ${MIGRATION_PATH} — ` +
        'has it moved or been reworded? This guard has nothing to check against without it.',
    );
  }

  return capturedSlugs
    .split(',')
    .map((slug) => slug.trim())
    .filter(Boolean);
}

/**
 * Every product slug added since the original 7, one per additive catalog
 * migration (ADR-095's own filename convention, `*_add_..._product.sql`) —
 * so a future 9th product is covered here without editing this test again.
 * Parses the slug directly out of its `insert into public.products` select
 * list, same shape `tests/catalog-seed.test.ts`'s
 * `seededProductFromAdditiveMigration` parses.
 */
function additiveProductSlugs(): string[] {
  const additiveMigrations = readdirSync(MIGRATIONS_DIR).filter((name) => /_add_.*_product\.sql$/.test(name));

  return additiveMigrations.map((name) => {
    const migrationPath = path.join(MIGRATIONS_DIR, name);
    const sql = readFileSync(migrationPath, 'utf-8');
    const match = sql.match(/insert into public\.products[\s\S]*?select[\s\S]*?'[0-9a-f-]{36}'::uuid,\s*company\.id,\s*'([a-z0-9-]+)'/);
    if (!match?.[1]) {
      throw new Error(`Could not parse a product slug from ${migrationPath} — has its insert shape changed?`);
    }
    return match[1];
  });
}

function knownProductSlugs(): string[] {
  return [...originalProductSlugs(), ...additiveProductSlugs()];
}

describe('root route collision guard', () => {
  it('parses a non-empty slug list from the migration comment, plus every additive catalog migration since (ADR-095)', () => {
    // Sanity check on the parse itself, not a re-assertion of the names —
    // the point is to prove the regexes still match their files' current
    // wording/shape, not to duplicate the list they already contain.
    assert.equal(originalProductSlugs().length, 7);
    assert.ok(additiveProductSlugs().length > 0, 'expected at least the ADR-095 conexao-expansao migration');
  });

  it('has no top-level src/app/ route whose name matches a known product slug', () => {
    const topLevelDirs = readdirSync(APP_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    for (const slug of knownProductSlugs()) {
      assert.ok(
        !topLevelDirs.includes(slug),
        `src/app/${slug}/ exists as a static route — it would silently shadow ` +
          `src/app/[productSlug]/page.tsx for that product, since Next.js always ` +
          'prefers a static segment over a dynamic sibling for the same path, on ' +
          'every host. Rename the static route or the product slug before this ships.',
      );
    }
  });
});
