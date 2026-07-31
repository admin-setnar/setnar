import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  extractRepresentativeSlug,
  resolveRepresentativeActivation,
} from '@/modules/representatives/application/resolve-representative';
import { InMemoryRepresentativeRepository } from '@/modules/representatives/infrastructure/in-memory-representative-repository';

const repository = new InMemoryRepresentativeRepository();

describe('extractRepresentativeSlug', () => {
  it('extracts the subdomain label of a valid representative host', async () => {
    assert.equal(await extractRepresentativeSlug('joao-silva.setnar.com'), 'joao-silva');
  });

  it('ignores the port, same as tenant resolution does', async () => {
    assert.equal(await extractRepresentativeSlug('joao-silva.setnar.com:3000'), 'joao-silva');
  });

  it('never treats the bare Company apex domain as a representative slug', async () => {
    assert.equal(await extractRepresentativeSlug('setnar.com'), null);
  });

  it('never treats www as a representative slug', async () => {
    assert.equal(await extractRepresentativeSlug('www.setnar.com'), null);
  });

  it('never treats bare localhost as a representative slug', async () => {
    assert.equal(await extractRepresentativeSlug('localhost'), null);
    assert.equal(await extractRepresentativeSlug('localhost:3000'), null);
  });

  it('never treats a Vercel preview deployment host as a representative slug', async () => {
    assert.equal(await extractRepresentativeSlug('abc123-my-branch-team.vercel.app'), null);
  });

  it('rejects a host whose parent domain is not a known Company tenant', async () => {
    assert.equal(await extractRepresentativeSlug('joao-silva.example.com'), null);
  });

  it('rejects a null host', async () => {
    assert.equal(await extractRepresentativeSlug(null), null);
  });
});

describe('resolveRepresentativeActivation', () => {
  it('resolves the representative and product for a valid host + published activation', async () => {
    const result = await resolveRepresentativeActivation(
      repository,
      'joao-silva.setnar.com',
      'conexao-green',
    );
    assert.ok(result);
    assert.equal(result.representative.slug, 'joao-silva');
    assert.equal(result.representative.name, 'João Silva');
    assert.equal(result.product.slug, 'conexao-green');
  });

  it('returns null for a Company tenant host, never falling through to representative resolution', async () => {
    assert.equal(await resolveRepresentativeActivation(repository, 'setnar.com', 'conexao-green'), null);
    assert.equal(
      await resolveRepresentativeActivation(repository, 'www.setnar.com', 'conexao-green'),
      null,
    );
    assert.equal(await resolveRepresentativeActivation(repository, 'localhost', 'conexao-green'), null);
  });

  it('returns null for a Vercel preview host', async () => {
    assert.equal(
      await resolveRepresentativeActivation(repository, 'preview-123.vercel.app', 'conexao-green'),
      null,
    );
  });

  it('returns null for a representative slug that does not exist', async () => {
    assert.equal(
      await resolveRepresentativeActivation(repository, 'nao-existe.setnar.com', 'conexao-green'),
      null,
    );
  });

  it('returns null when the representative exists but has no published activation for that product', async () => {
    // joao-silva activated conexao-solar but it is still 'draft' in the fixture.
    assert.equal(
      await resolveRepresentativeActivation(repository, 'joao-silva.setnar.com', 'conexao-solar'),
      null,
    );
  });

  it('returns null when the product slug has no activation at all for the representative', async () => {
    assert.equal(
      await resolveRepresentativeActivation(repository, 'joao-silva.setnar.com', 'conexao-placas'),
      null,
    );
  });

  it('returns null for a suspended representative even with a published activation', async () => {
    assert.equal(
      await resolveRepresentativeActivation(repository, 'maria-suspensa.setnar.com', 'conexao-green'),
      null,
    );
  });
});
