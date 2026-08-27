import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ORIGIN_IDS } from '@/modules/analytics/domain/origin';
import { resolveDivulgacaoCopy } from '@/modules/marketing-materials/divulgacao-copy';

const params = { productName: 'Conexão Green', link: 'https://joao.igreen.setnar.com/conexao-green?src=instagram_post' };

describe('resolveDivulgacaoCopy (SET-84 D2)', () => {
  it('returns text and cta for instagram_post', () => {
    const copy = resolveDivulgacaoCopy('instagram_post', 'conexao-green', params);
    assert.ok(copy);
    assert.match(copy!.text, /Conexão Green/);
    assert.match(copy!.text, /https:\/\/joao\.igreen\.setnar\.com\/conexao-green\?src=instagram_post/);
    assert.ok(copy!.cta.length > 0);
  });

  it('returns text and cta for instagram_story', () => {
    const copy = resolveDivulgacaoCopy('instagram_story', 'conexao-green', params);
    assert.ok(copy);
    assert.match(copy!.text, /Conexão Green/);
    assert.match(copy!.text, /https:\/\/joao\.igreen\.setnar\.com\/conexao-green\?src=instagram_post/);
  });

  it('returns text and cta for whatsapp', () => {
    const copy = resolveDivulgacaoCopy('whatsapp', 'conexao-green', params);
    assert.ok(copy);
    assert.match(copy!.text, /Conexão Green/);
  });

  it('returns null for qrcode — no social copy, only link/QR', () => {
    assert.equal(resolveDivulgacaoCopy('qrcode', 'conexao-green', params), null);
  });

  it('returns null for direct — no social copy, only link', () => {
    assert.equal(resolveDivulgacaoCopy('direct', 'conexao-green', params), null);
  });

  it('has exactly one entry per social origin (3 of 5 ORIGIN_IDS), matching D2 "4 templates, not 28"', () => {
    const withCopy = ORIGIN_IDS.filter((origin) => resolveDivulgacaoCopy(origin, 'conexao-green', params) !== null);
    assert.deepEqual(withCopy.sort(), ['instagram_post', 'instagram_story', 'whatsapp'].sort());
  });

  it('ignores productSlug — same origin/params produce the same copy regardless of product', () => {
    const a = resolveDivulgacaoCopy('whatsapp', 'conexao-green', params);
    const b = resolveDivulgacaoCopy('whatsapp', 'telecom', params);
    assert.deepEqual(a, b);
  });

  it('interpolates a different productName/link per call — not a static string', () => {
    const first = resolveDivulgacaoCopy('whatsapp', 'conexao-green', params);
    const second = resolveDivulgacaoCopy('whatsapp', 'conexao-green', {
      productName: 'iGreen Telecom',
      link: 'https://joao.igreen.setnar.com/telecom?src=whatsapp',
    });
    assert.notEqual(first!.text, second!.text);
    assert.match(second!.text, /iGreen Telecom/);
    assert.match(second!.text, /telecom\?src=whatsapp/);
  });
});
