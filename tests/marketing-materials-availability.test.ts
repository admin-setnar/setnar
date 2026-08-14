import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { selectAvailableProductsWithMaterials } from '@/modules/marketing-materials/select-available-materials';
import type { RepresentativeCatalogEntry } from '@/modules/representatives/domain/representative-catalog-repository';

function entry(slug: string, state: RepresentativeCatalogEntry['state']): RepresentativeCatalogEntry {
  return {
    product: { id: slug, slug, name: slug, companySlug: 'igreen' },
    state,
  };
}

describe('selectAvailableProductsWithMaterials (SET-65)', () => {
  it('shows a product only when published, subscription active and profile complete — the same rule /app/paginas already enforces', () => {
    const catalog = [entry('conexao-green', 'published')];
    assert.equal(selectAvailableProductsWithMaterials(catalog, true, true).length, 1);
  });

  it('hides a published product when the subscription is inactive', () => {
    const catalog = [entry('conexao-green', 'published')];
    assert.equal(selectAvailableProductsWithMaterials(catalog, false, true).length, 0);
  });

  it('hides a published product when the professional profile is incomplete', () => {
    const catalog = [entry('conexao-green', 'published')];
    assert.equal(selectAvailableProductsWithMaterials(catalog, true, false).length, 0);
  });

  it('hides draft, unpublished and not_activated products even with an active subscription and complete profile', () => {
    const catalog = [
      entry('conexao-green', 'draft'),
      entry('conexao-club', 'unpublished'),
      entry('conexao-livre', 'not_activated'),
    ];
    assert.equal(selectAvailableProductsWithMaterials(catalog, true, true).length, 0);
  });

  it('never invents a bespoke isActive flag — the decision is entirely derived from state/subscription/profile, no extra field read', () => {
    // A published entry for a product the registry has no materials for
    // (e.g. a future 8th Company product) is correctly excluded — the
    // registry, not a new flag, is what gates "has materials".
    const catalog = [entry('produto-sem-materiais', 'published')];
    assert.equal(selectAvailableProductsWithMaterials(catalog, true, true).length, 0);
  });

  it('returns one entry per available product with materials', () => {
    const catalog = [entry('conexao-green', 'published'), entry('telecom', 'published')];
    const result = selectAvailableProductsWithMaterials(catalog, true, true);
    assert.equal(result.length, 2);
    assert.deepEqual(result.map((e) => e.product.slug).sort(), ['conexao-green', 'telecom']);
  });
});
