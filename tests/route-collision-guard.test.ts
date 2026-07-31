import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

const MIGRATION_PATH = path.join(
  process.cwd(),
  'supabase/migrations/20260731000000_create_representative_domain.sql',
);
const APP_DIR = path.join(process.cwd(), 'src/app');

/**
 * Single source of truth for the 7 Stage 1 product slugs is the prose
 * comment atop `products` in the migration itself — not re-typed here.
 * Parsed, not hand-copied, so this guard can never drift from the schema
 * comment it depends on; if that comment's wording ever changes, this
 * throws instead of silently checking against a stale list.
 */
function knownProductSlugs(): string[] {
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

describe('root route collision guard', () => {
  it('parses a non-empty slug list from the migration comment', () => {
    // Sanity check on the parse itself, not a re-assertion of the 7 names —
    // the point is to prove the regex still matches the comment's current
    // wording, not to duplicate the list it already contains.
    assert.equal(knownProductSlugs().length, 7);
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
