import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { RepresentativeProduct } from '@/modules/representatives/domain/representative';
import { InMemoryRepresentativeRepository } from '@/modules/representatives/infrastructure/in-memory-representative-repository';

/**
 * SET-36: `RepresentativeRepository.findOwnActivation`, the private-preview
 * counterpart to `findPublishedActivation`
 * (`tests/resolve-representative.test.ts`). Scoped by the caller's own
 * `profile_id`, in every status — never by `representativeSlug`/host like
 * the public path, and never filtered by `representative.status`, since
 * this is the owner reading their own row, not a public visitor.
 */
const repository = new InMemoryRepresentativeRepository();

describe('findOwnActivation (SET-36)', () => {
  it('resolves the owner\'s own published activation', async () => {
    const result = await repository.findOwnActivation('profile-joao-silva', 'conexao-green');
    assert.ok(result);
    assert.equal(result.representative.slug, 'joao-silva');
    assert.equal(result.product.slug, 'conexao-green');
    assert.equal(result.status, 'published');
  });

  it('resolves the owner\'s own draft activation — the whole point of a preview', async () => {
    const result = await repository.findOwnActivation('profile-joao-silva', 'conexao-solar');
    assert.ok(result);
    assert.equal(result.status, 'draft');
  });

  it('resolves an unpublished activation too', async () => {
    const conexaoGreen: RepresentativeProduct = {
      id: 'product-conexao-green',
      slug: 'conexao-green',
      name: 'Conexão Green',
      companySlug: 'igreen',
    };
    const unpublishedRepo = new InMemoryRepresentativeRepository([
      {
        representative: {
          id: 'rep-ana',
          profileId: 'profile-ana',
          slug: 'ana',
          displayName: 'Ana',
          authorizationId: 'IGREEN-003',
          phone: '+5511988888888',
          city: null,
          avatarUrl: null,
          status: 'active',
        },
        activations: [{ product: conexaoGreen, status: 'unpublished' }],
      },
    ]);

    const result = await unpublishedRepo.findOwnActivation('profile-ana', 'conexao-green');
    assert.ok(result);
    assert.equal(result.status, 'unpublished');
  });

  it('returns null for a product the caller never activated — the "not_activated" case', async () => {
    assert.equal(await repository.findOwnActivation('profile-joao-silva', 'conexao-placas'), null);
  });

  it('returns null for an unknown profileId', async () => {
    assert.equal(await repository.findOwnActivation('profile-does-not-exist', 'conexao-green'), null);
  });

  it('never resolves another representative\'s activation, even for a product they both could plausibly have', async () => {
    // maria-suspensa has a published conexao-green of her own — joao-silva
    // asking for it by profileId must never see HER row, only his own.
    const result = await repository.findOwnActivation('profile-joao-silva', 'conexao-green');
    assert.ok(result);
    assert.equal(result.representative.slug, 'joao-silva', 'must resolve the caller\'s own representative, never someone else\'s');
  });

  it('resolves a suspended representative\'s own activation — never hidden from themselves, unlike the public path', async () => {
    const result = await repository.findOwnActivation('profile-maria-suspensa', 'conexao-green');
    assert.ok(result, 'a suspended representative must still be able to preview their own page');
    assert.equal(result.representative.slug, 'maria-suspensa');
  });
});
