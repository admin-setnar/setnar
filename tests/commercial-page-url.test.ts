import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildCommercialPageUrl } from '@/modules/representatives/presentation/commercial-page-url';

describe('buildCommercialPageUrl', () => {
  it('composes <slug>.<rootHost>/<productSlug> from SITE_URL, not a request Host header', () => {
    assert.equal(
      buildCommercialPageUrl({ slug: 'joao-silva' }, { slug: 'conexao-green' }),
      'https://joao-silva.setnar.com/conexao-green',
    );
  });
});
