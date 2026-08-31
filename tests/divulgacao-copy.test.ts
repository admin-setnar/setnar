import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PRODUCT_SLUGS_WITH_MATERIALS } from '@/modules/marketing-materials/material-catalog';
import { resolveDivulgacaoCopy } from '@/modules/marketing-materials/divulgacao-copy';

const params = {
  link: 'https://joao.igreen.setnar.com/conexao-green?src=instagram_post',
  representativeName: 'João Silva',
  representativeId: '203984',
};

describe('resolveDivulgacaoCopy (Variante A)', () => {
  it('has exactly one template per product with materials, no more, no less', () => {
    const withCopy = PRODUCT_SLUGS_WITH_MATERIALS.filter((slug) => resolveDivulgacaoCopy(slug, params) !== null);
    assert.deepEqual(withCopy.sort(), [...PRODUCT_SLUGS_WITH_MATERIALS].sort());
  });

  it('returns null for a slug with no template', () => {
    assert.equal(resolveDivulgacaoCopy('not-a-real-product', params), null);
  });

  it('embeds the link and the representative signature in every product text', () => {
    for (const slug of PRODUCT_SLUGS_WITH_MATERIALS) {
      const copy = resolveDivulgacaoCopy(slug, params);
      assert.ok(copy, `expected a template for ${slug}`);
      assert.match(copy!.text, /https:\/\/joao\.igreen\.setnar\.com\/conexao-green\?src=instagram_post/);
      assert.match(copy!.text, /João Silva \| Licenciado Autorizado iGreen Energy ID 203984/);
    }
  });

  it('produces the same text regardless of which channel supplied the link — copy is per-product, not per-channel', () => {
    const viaInstagram = resolveDivulgacaoCopy('conexao-green', {
      ...params,
      link: 'https://joao.igreen.setnar.com/conexao-green?src=instagram_post',
    });
    const viaWhatsapp = resolveDivulgacaoCopy('conexao-green', {
      ...params,
      link: 'https://joao.igreen.setnar.com/conexao-green?src=instagram_post',
    });
    assert.deepEqual(viaInstagram, viaWhatsapp);
  });

  it('interpolates a different link/representative per call — not a static string', () => {
    const first = resolveDivulgacaoCopy('conexao-green', params);
    const second = resolveDivulgacaoCopy('conexao-green', {
      link: 'https://maria.igreen.setnar.com/conexao-green?src=whatsapp',
      representativeName: 'Maria Souza',
      representativeId: '11223',
    });
    assert.notEqual(first!.text, second!.text);
    assert.match(second!.text, /maria\.igreen\.setnar\.com\/conexao-green\?src=whatsapp/);
    assert.match(second!.text, /Maria Souza \| Licenciado Autorizado iGreen Energy ID 11223/);
  });

  it('only conexao-livre carries an eligibility note — every other product has none', () => {
    const withNote = PRODUCT_SLUGS_WITH_MATERIALS.filter((slug) => resolveDivulgacaoCopy(slug, params)?.note);
    assert.deepEqual(withNote, ['conexao-livre']);
  });

  it("conexao-livre's note calls out Grupo A eligibility, and never leaks into the message text itself", () => {
    const copy = resolveDivulgacaoCopy('conexao-livre', params);
    assert.match(copy!.note!, /Grupo A/);
    assert.doesNotMatch(copy!.text, /Grupo A/);
  });
});
