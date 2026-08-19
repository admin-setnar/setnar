import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildMarketingMaterialProps } from '@/modules/marketing-materials/material-props';

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
});
