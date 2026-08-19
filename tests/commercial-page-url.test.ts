import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildCommercialPageUrl } from '@/modules/representatives/presentation/commercial-page-url';

describe('buildCommercialPageUrl', () => {
  it('composes <slug>.<companySlug>.<rootHost>/<productSlug> from SITE_URL, not a request Host header', () => {
    assert.equal(
      buildCommercialPageUrl({ slug: 'joao-silva' }, { slug: 'conexao-green', companySlug: 'igreen' }),
      'https://joao-silva.igreen.setnar.com/conexao-green',
    );
  });

  it('uses the product Company, not any hardcoded value', () => {
    assert.equal(
      buildCommercialPageUrl({ slug: 'alberto-henrique' }, { slug: 'plano-x', companySlug: 'ademicom' }),
      'https://alberto-henrique.ademicom.setnar.com/plano-x',
    );
  });
});
