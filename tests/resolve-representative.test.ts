import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  parseCommercialPresenceHost,
  resolveRepresentativeActivation,
} from '@/modules/representatives/application/resolve-representative';
import { InMemoryRepresentativeRepository } from '@/modules/representatives/infrastructure/in-memory-representative-repository';

const repository = new InMemoryRepresentativeRepository();

describe('parseCommercialPresenceHost', () => {
  it('extracts representativeSlug + companySlug from a valid two-label host', async () => {
    assert.deepEqual(await parseCommercialPresenceHost('joao-silva.igreen.setnar.com'), {
      representativeSlug: 'joao-silva',
      companySlug: 'igreen',
    });
  });

  it('ignores the port, same as tenant resolution does', async () => {
    assert.deepEqual(await parseCommercialPresenceHost('joao-silva.igreen.setnar.com:3000'), {
      representativeSlug: 'joao-silva',
      companySlug: 'igreen',
    });
  });

  it('rejects a one-label host — no legacy alias for <representative>.setnar.com', async () => {
    assert.equal(await parseCommercialPresenceHost('joao-silva.setnar.com'), null);
  });

  it('rejects a three-or-more-label host', async () => {
    assert.equal(await parseCommercialPresenceHost('a.b.c.setnar.com'), null);
  });

  it('never treats the bare Company apex domain as a Commercial Presence host', async () => {
    assert.equal(await parseCommercialPresenceHost('setnar.com'), null);
  });

  it('never treats www as a Commercial Presence host', async () => {
    assert.equal(await parseCommercialPresenceHost('www.setnar.com'), null);
  });

  it('never treats bare localhost as a Commercial Presence host', async () => {
    assert.equal(await parseCommercialPresenceHost('localhost'), null);
    assert.equal(await parseCommercialPresenceHost('localhost:3000'), null);
  });

  it('resolves a two-label host under localhost, for local development', async () => {
    assert.deepEqual(await parseCommercialPresenceHost('joao-silva.igreen.localhost'), {
      representativeSlug: 'joao-silva',
      companySlug: 'igreen',
    });
  });

  it('never treats a Vercel preview deployment host as a Commercial Presence host', async () => {
    assert.equal(await parseCommercialPresenceHost('abc123-my-branch-team.vercel.app'), null);
    assert.equal(
      await parseCommercialPresenceHost('joao-silva.igreen.abc123-my-branch-team.vercel.app'),
      null,
    );
  });

  it('rejects a host whose root is not a known Company tenant', async () => {
    assert.equal(await parseCommercialPresenceHost('joao-silva.igreen.example.com'), null);
  });

  it('rejects a malformed representative label', async () => {
    assert.equal(await parseCommercialPresenceHost('Joao_Silva.igreen.setnar.com'), null);
  });

  it('rejects a malformed company label', async () => {
    assert.equal(await parseCommercialPresenceHost('joao-silva.iGreen_.setnar.com'), null);
  });

  it('rejects a null host', async () => {
    assert.equal(await parseCommercialPresenceHost(null), null);
  });
});

describe('resolveRepresentativeActivation', () => {
  it('resolves the representative and product for a valid host + published activation', async () => {
    const result = await resolveRepresentativeActivation(
      repository,
      'joao-silva.igreen.setnar.com',
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

  it('returns null for the one-label legacy host shape — not a supported alias', async () => {
    assert.equal(
      await resolveRepresentativeActivation(repository, 'joao-silva.setnar.com', 'conexao-green'),
      null,
    );
  });

  it('returns null for a representative slug that does not exist', async () => {
    assert.equal(
      await resolveRepresentativeActivation(repository, 'nao-existe.igreen.setnar.com', 'conexao-green'),
      null,
    );
  });

  it('returns null when the representative exists but has no published activation for that product', async () => {
    // joao-silva activated conexao-solar but it is still 'draft' in the fixture.
    assert.equal(
      await resolveRepresentativeActivation(repository, 'joao-silva.igreen.setnar.com', 'conexao-solar'),
      null,
    );
  });

  it('returns null when the product slug has no activation at all for the representative', async () => {
    assert.equal(
      await resolveRepresentativeActivation(repository, 'joao-silva.igreen.setnar.com', 'conexao-placas'),
      null,
    );
  });

  it('returns null for a suspended representative even with a published activation', async () => {
    assert.equal(
      await resolveRepresentativeActivation(repository, 'maria-suspensa.igreen.setnar.com', 'conexao-green'),
      null,
    );
  });

  it('SECURITY: never resolves a real representative under a Company they do not belong to (Host spoofing)', async () => {
    // joao-silva is real, active, and has a published conexao-green
    // activation — every condition needed to resolve, EXCEPT the Company
    // label. This is the exact scenario the v3.1 investigation flagged:
    // without this check, `joao-silva.ademicom.setnar.com` would resolve
    // João exactly as if he belonged to Ademicon.
    assert.equal(
      await resolveRepresentativeActivation(repository, 'joao-silva.ademicom.setnar.com', 'conexao-green'),
      null,
    );
  });
});
