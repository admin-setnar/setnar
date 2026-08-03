import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  getProductComplianceNotice,
  NOT_OFFICIAL_CHANNEL_NOTICE,
  PRODUCT_COMPLIANCE_NOTICE,
} from '@/modules/representatives/domain/product-compliance-notice';

/**
 * No React rendering test infra exists in this project (no
 * @testing-library/react, no jsdom — every existing test in `tests/` asserts
 * against a plain function, per `representative-rules.test.ts` and friends).
 * `ComplianceNotice` is a thin, unconditional render of whatever these two
 * exports return, so the actual risk — the wrong category's text reaching
 * the wrong Product's page — lives entirely in this mapping, not in JSX.
 * Testing it here, the same way every other domain rule in this project is
 * tested, covers that risk without introducing a new test convention.
 */

const ENERGY_SLUGS = ['conexao-green', 'conexao-solar', 'conexao-livre', 'conexao-placas'];
const GENERIC_SLUGS = ['telecom', 'conexao-club'];

describe('PRODUCT_COMPLIANCE_NOTICE', () => {
  it('covers exactly the 7 slugs seeded by 20260803000000_seed_igreen_catalog.sql', () => {
    const expectedSlugs = [...ENERGY_SLUGS, 'green-seguros', ...GENERIC_SLUGS].sort();
    assert.deepEqual(Object.keys(PRODUCT_COMPLIANCE_NOTICE).sort(), expectedSlugs);
  });

  it('gives every energy slug the exact same notice text', () => {
    const [first, ...rest] = ENERGY_SLUGS.map((slug) => PRODUCT_COMPLIANCE_NOTICE[slug]);
    for (const notice of rest) {
      assert.equal(notice, first);
    }
  });

  it('gives telecom and conexao-club the exact same generic notice text', () => {
    assert.equal(PRODUCT_COMPLIANCE_NOTICE.telecom, PRODUCT_COMPLIANCE_NOTICE['conexao-club']);
  });

  it('keeps the three category texts distinct from one another', () => {
    const energy = PRODUCT_COMPLIANCE_NOTICE['conexao-green'];
    const insurance = PRODUCT_COMPLIANCE_NOTICE['green-seguros'];
    const generic = PRODUCT_COMPLIANCE_NOTICE.telecom;
    assert.notEqual(energy, insurance);
    assert.notEqual(energy, generic);
    assert.notEqual(insurance, generic);
  });
});

describe('getProductComplianceNotice', () => {
  it('resolves the energy notice for each of the 4 energy slugs', () => {
    for (const slug of ENERGY_SLUGS) {
      const notice = getProductComplianceNotice(slug);
      assert.ok(notice?.includes('geração compartilhada de energia'));
    }
  });

  it('resolves the insurance notice for green-seguros, citing SUSEP and Tabela FIPE', () => {
    const notice = getProductComplianceNotice('green-seguros');
    assert.ok(notice?.includes('SUSEP'));
    assert.ok(notice?.includes('Tabela FIPE'));
  });

  it('resolves the generic CDC-based notice for telecom and conexao-club', () => {
    for (const slug of GENERIC_SLUGS) {
      const notice = getProductComplianceNotice(slug);
      assert.ok(notice?.includes('Código de Defesa do Consumidor'));
    }
  });

  it('returns null for a slug outside the seeded catalog, never a guessed default', () => {
    assert.equal(getProductComplianceNotice('nao-existe'), null);
  });
});

describe('NOT_OFFICIAL_CHANNEL_NOTICE', () => {
  it('states that Setnar is not an official channel of the represented companies', () => {
    assert.ok(NOT_OFFICIAL_CHANNEL_NOTICE.includes('Não é canal oficial'));
  });

  it('is the same disclaimer text setnar.tenant.ts carries for the marketing footer', () => {
    assert.equal(
      NOT_OFFICIAL_CHANNEL_NOTICE,
      'O Setnar é uma plataforma independente de ferramentas de vendas. Não é canal oficial das empresas cujos produtos seus usuários representam, e toda página publicada identifica de forma clara o representante responsável por ela.',
    );
  });
});
