import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { mergeRepresentativeCatalog } from '@/modules/representatives/infrastructure/merge-representative-catalog';

const PRODUCT_A = { id: 'prod-a', slug: 'conexao-green', name: 'Conexão Green' };
const PRODUCT_B = { id: 'prod-b', slug: 'conexao-club', name: 'Conexão Club' };

describe('mergeRepresentativeCatalog', () => {
  it('marks a product with no matching activation as "not_activated"', () => {
    const result = mergeRepresentativeCatalog([PRODUCT_A], []);
    assert.deepEqual(result, [{ product: PRODUCT_A, state: 'not_activated' }]);
  });

  it('carries the activation status through for a matching product', () => {
    const result = mergeRepresentativeCatalog(
      [PRODUCT_A],
      [{ product_id: 'prod-a', status: 'draft' }],
    );
    assert.deepEqual(result, [{ product: PRODUCT_A, state: 'draft' }]);
  });

  it('handles a mix of activated and not-activated products, preserving product order', () => {
    const result = mergeRepresentativeCatalog(
      [PRODUCT_A, PRODUCT_B],
      [{ product_id: 'prod-b', status: 'published' }],
    );
    assert.deepEqual(result, [
      { product: PRODUCT_A, state: 'not_activated' },
      { product: PRODUCT_B, state: 'published' },
    ]);
  });

  it('ignores an activation row for a product not in the products list', () => {
    // Can't actually happen given regra 6 (a Product Activation always
    // references a Product in the same Company), but the merge itself makes
    // no such assumption — it only ever iterates `products`.
    const result = mergeRepresentativeCatalog(
      [PRODUCT_A],
      [{ product_id: 'some-other-company-product', status: 'published' }],
    );
    assert.deepEqual(result, [{ product: PRODUCT_A, state: 'not_activated' }]);
  });

  it('returns an empty array for an empty product list', () => {
    assert.deepEqual(mergeRepresentativeCatalog([], [{ product_id: 'prod-a', status: 'draft' }]), []);
  });

  it('handles unpublished the same way as any other known status', () => {
    const result = mergeRepresentativeCatalog(
      [PRODUCT_A],
      [{ product_id: 'prod-a', status: 'unpublished' }],
    );
    assert.deepEqual(result, [{ product: PRODUCT_A, state: 'unpublished' }]);
  });
});
