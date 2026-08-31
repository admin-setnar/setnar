import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildMarketingMaterialProps, buildMarketingMaterialPropsForOrigin } from '@/modules/marketing-materials/material-props';

const REPRESENTATIVE = {
  slug: 'mariana-souza',
  name: 'Mariana Souza',
  authorizationId: '203984',
  phone: '+5531999999999',
  city: 'Belo Horizonte',
};

const PRODUCT = { slug: 'conexao-green', companySlug: 'igreen' };
const QR = 'data:image/png;base64,fake';

describe('buildMarketingMaterialProps (SET-65)', () => {
  it('maps full representative data to the piece contract', () => {
    const props = buildMarketingMaterialProps(REPRESENTATIVE, PRODUCT, QR);
    assert.equal(props.representativeName, 'Mariana Souza');
    assert.equal(props.representativeId, '203984');
    assert.equal(props.representativePhone, '(31) 99999-9999');
    assert.equal(props.representativeCity, 'Belo Horizonte');
    assert.equal(props.qrCodeDataUrl, QR);
  });

  it('composes publicUrl via buildCommercialPageUrl — <slug>.<companySlug>.<rootHost>/<productSlug>, no manual reconstruction', () => {
    const props = buildMarketingMaterialProps(REPRESENTATIVE, PRODUCT, QR);
    assert.match(props.publicUrl, /^https:\/\/mariana-souza\.igreen\..+\/conexao-green$/);
  });

  it('maps a missing phone to null, never an empty string', () => {
    const props = buildMarketingMaterialProps({ ...REPRESENTATIVE, phone: null }, PRODUCT, QR);
    assert.equal(props.representativePhone, null);
  });

  it('collapses an unparseable legacy phone to null, same as a missing one — every piece treats null as "hide the phone line"', () => {
    const props = buildMarketingMaterialProps({ ...REPRESENTATIVE, phone: 'not-a-valid-e164-phone' }, PRODUCT, QR);
    assert.equal(props.representativePhone, null);
  });

  it('maps a missing city to null', () => {
    const props = buildMarketingMaterialProps({ ...REPRESENTATIVE, city: null }, PRODUCT, QR);
    assert.equal(props.representativeCity, null);
  });

  it('never exposes representativeFirstName or representativeAvatarUrl — confirmed unused by all 21 pieces (plan §2.3)', () => {
    const props = buildMarketingMaterialProps(REPRESENTATIVE, PRODUCT, QR);
    assert.equal('representativeFirstName' in props, false);
    assert.equal('representativeAvatarUrl' in props, false);
  });

  it('accepts an explicit publicUrl override (SET-84 D4) without changing any other field', () => {
    const tagged = 'https://mariana-souza.igreen.setnar.com/conexao-green?src=instagram_post';
    const props = buildMarketingMaterialProps(REPRESENTATIVE, PRODUCT, QR, tagged);
    assert.equal(props.publicUrl, tagged);
    assert.equal(props.representativeName, 'Mariana Souza');
    assert.equal(props.qrCodeDataUrl, QR);
  });
});

describe('buildMarketingMaterialPropsForOrigin (SET-84 D4)', () => {
  it('tags publicUrl with ?src=<origin>, same shape otherwise as buildMarketingMaterialProps', async () => {
    const props = await buildMarketingMaterialPropsForOrigin(REPRESENTATIVE, PRODUCT, 'instagram_post');
    assert.match(props.publicUrl, /^https:\/\/mariana-souza\.igreen\..+\/conexao-green\?src=instagram_post$/);
    assert.equal(props.representativeName, 'Mariana Souza');
    assert.equal(props.representativePhone, '(31) 99999-9999');
  });

  it('generates a QR code for the tagged URL, not the bare canonical one', async () => {
    const tagged = await buildMarketingMaterialPropsForOrigin(REPRESENTATIVE, PRODUCT, 'qrcode');
    const { generateQrCodeDataUrl } = await import('@/shared/lib/generate-qr-code-data-url');
    const expectedQr = await generateQrCodeDataUrl(tagged.publicUrl);
    assert.equal(tagged.qrCodeDataUrl, expectedQr);
  });

  it('produces a different publicUrl per origin for the same representative/product', async () => {
    const post = await buildMarketingMaterialPropsForOrigin(REPRESENTATIVE, PRODUCT, 'instagram_post');
    const whatsapp = await buildMarketingMaterialPropsForOrigin(REPRESENTATIVE, PRODUCT, 'whatsapp');
    assert.notEqual(post.publicUrl, whatsapp.publicUrl);
  });
});
