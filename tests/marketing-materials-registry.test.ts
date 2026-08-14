import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

import {
  FORMAT_DIMENSIONS,
  FORMAT_LABELS,
  PRODUCT_SLUGS_WITH_MATERIALS,
  formatsForProduct,
  hasMaterialsForProduct,
} from '@/modules/marketing-materials/material-catalog';

const EXPECTED_PRODUCT_SLUGS = [
  'conexao-green',
  'conexao-club',
  'conexao-livre',
  'conexao-placas',
  'conexao-solar',
  'green-seguros',
  'telecom',
];

describe('material-catalog (SET-65)', () => {
  it('covers exactly the 7 seeded iGreen product slugs', () => {
    assert.deepEqual([...PRODUCT_SLUGS_WITH_MATERIALS].sort(), [...EXPECTED_PRODUCT_SLUGS].sort());
  });

  it('carries the correct pixel dimensions per format', () => {
    assert.deepEqual(FORMAT_DIMENSIONS.post, { width: 1080, height: 1080 });
    assert.deepEqual(FORMAT_DIMENSIONS.story, { width: 1080, height: 1920 });
    assert.deepEqual(FORMAT_DIMENSIONS.poster, { width: 794, height: 1123 });
  });

  it('has a human label for every format', () => {
    assert.equal(typeof FORMAT_LABELS.post, 'string');
    assert.equal(typeof FORMAT_LABELS.story, 'string');
    assert.equal(typeof FORMAT_LABELS.poster, 'string');
  });

  it('hasMaterialsForProduct is true only for the 7 seeded slugs', () => {
    for (const slug of EXPECTED_PRODUCT_SLUGS) assert.equal(hasMaterialsForProduct(slug), true);
    assert.equal(hasMaterialsForProduct('produto-inexistente'), false);
  });

  it('formatsForProduct returns all 3 formats for a known product, none for an unknown one', () => {
    assert.deepEqual(formatsForProduct('conexao-green'), ['post', 'story', 'poster']);
    assert.deepEqual(formatsForProduct('produto-inexistente'), []);
  });
});

/**
 * `registry.ts` imports the 21 real pieces, each of which imports its own
 * `./fonts` (a plain `.css` import) — `node --test` has no CSS loader, so
 * importing that module here crashes at require time (confirmed). Same
 * constraint `tests/commercial-page-templates.test.ts` already works around
 * for the Commercial Pages components: read the source as text instead of
 * executing it.
 */
function registrySource(): string {
  return readFileSync(resolve(process.cwd(), 'src/modules/marketing-materials/registry.ts'), 'utf8');
}

describe('MATERIALS_REGISTRY source contract (SET-65)', () => {
  it('wires exactly 21 entries — one per product × format', () => {
    const source = registrySource();
    const entries = source.match(/\{ productSlug: '[^']+', format: '(post|story|poster)', Component: \w+ \}/g) ?? [];
    assert.equal(entries.length, 21);
  });

  it('wires all 7 products, each with post/story/poster', () => {
    const source = registrySource();
    for (const slug of EXPECTED_PRODUCT_SLUGS) {
      for (const format of ['post', 'story', 'poster']) {
        assert.match(
          source,
          new RegExp(`productSlug: '${slug}', format: '${format}'`),
          `${slug}/${format} missing from MATERIALS_REGISTRY`,
        );
      }
    }
  });

  it('never wires a Component as the literal null — every slot points at a real import', () => {
    const source = registrySource();
    const registryBody = source.slice(source.indexOf('MATERIALS_REGISTRY'));
    assert.doesNotMatch(registryBody, /Component: null/);
  });
});
