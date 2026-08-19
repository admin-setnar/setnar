import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveRepresentativeActivation } from '@/modules/representatives/application/resolve-representative';
import { InMemoryRepresentativeRepository } from '@/modules/representatives/infrastructure/in-memory-representative-repository';
import { resolveCommercialPageMetadata } from '@/modules/representatives/presentation/commercial-page-metadata';

const repository = new InMemoryRepresentativeRepository();

describe('resolveCommercialPageMetadata', () => {
  it('builds canonical/Open Graph/Twitter metadata for a resolved (Representative, Product) pair', async () => {
    const activation = await resolveRepresentativeActivation(
      repository,
      'joao-silva.igreen.setnar.com',
      'conexao-green',
    );
    assert.ok(activation);

    const metadata = resolveCommercialPageMetadata(activation);

    const expectedUrl = 'https://joao-silva.igreen.setnar.com/conexao-green';
    assert.equal(metadata.alternates?.canonical, expectedUrl);
    assert.equal(metadata.title, 'Conexão Green — João Silva');
    assert.ok(String(metadata.description).includes('João Silva'));
    assert.ok(String(metadata.description).includes('Conexão Green'));

    const openGraph = metadata.openGraph as Record<string, unknown>;
    assert.equal(openGraph.url, expectedUrl);
    assert.equal(openGraph.title, 'Conexão Green — João Silva');

    const twitter = metadata.twitter as Record<string, unknown>;
    assert.equal(twitter.card, 'summary_large_image');
    assert.equal(twitter.title, 'Conexão Green — João Silva');
  });

  it('returns an empty object for every unresolvable case — bad host, unpublished, and suspended alike', async () => {
    const cases: ReadonlyArray<[string, string]> = [
      ['setnar.com', 'conexao-green'], // Company tenant host, not a representative
      ['joao-silva.setnar.com', 'conexao-green'], // one-label host — no legacy alias
      ['nao-existe.igreen.setnar.com', 'conexao-green'], // representative does not exist
      ['joao-silva.igreen.setnar.com', 'conexao-solar'], // activated but still draft
      ['maria-suspensa.igreen.setnar.com', 'conexao-green'], // suspended representative
      ['joao-silva.ademicom.setnar.com', 'conexao-green'], // real representative, wrong Company
    ];

    for (const [host, productSlug] of cases) {
      const activation = await resolveRepresentativeActivation(repository, host, productSlug);
      assert.equal(activation, null, `expected ${host}/${productSlug} to be unresolvable`);
      assert.deepEqual(
        resolveCommercialPageMetadata(activation),
        {},
        `expected no representative/product-specific metadata to leak for ${host}/${productSlug}`,
      );
    }
  });
});
