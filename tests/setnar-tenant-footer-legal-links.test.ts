import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { setnarTenant } from '@/modules/tenancy/infrastructure/tenants/setnar.tenant';

/**
 * SET-38: `/termos` e `/privacidade` (`src/app/termos/page.tsx`,
 * `src/app/privacidade/page.tsx`) já existem e respondem — só o tenant os
 * marcava `placeholder: true`, o que faz `Footer`
 * (`src/shared/layout/footer.tsx`) renderizar um `<span aria-disabled>` em
 * vez de um `<a href>` real. Este teste prende o contrato: uma rota real
 * nunca pode voltar a ser marcada como placeholder por engano.
 */
function findLegalLink(label: string) {
  const legalGroup = setnarTenant.marketing.footer.groups.find((group) => group.title === 'Legal');
  assert.ok(legalGroup, 'the footer must have a "Legal" group');
  const link = legalGroup!.links.find((entry) => entry.label === label);
  assert.ok(link, `the "Legal" group must have a "${label}" link`);
  return link!;
}

describe('setnarTenant footer legal links (SET-38)', () => {
  it('"Termos de uso" points at /termos and is not a placeholder', () => {
    const link = findLegalLink('Termos de uso');
    assert.equal(link.href, '/termos');
    assert.equal(link.placeholder, undefined);
  });

  it('"Política de privacidade" points at /privacidade and is not a placeholder', () => {
    const link = findLegalLink('Política de privacidade');
    assert.equal(link.href, '/privacidade');
    assert.equal(link.placeholder, undefined);
  });

  it('"Preços" points at the real #precos section and is not a placeholder (SET-39)', () => {
    const productGroup = setnarTenant.marketing.footer.groups.find((group) => group.title === 'Produto');
    const precos = productGroup?.links.find((entry) => entry.label === 'Preços');

    assert.equal(precos?.href, '#precos');
    assert.equal(precos?.placeholder, undefined);
  });

  it('genuinely unbuilt footer destinations stay placeholders — this fix must not spill over into them', () => {
    const companyGroup = setnarTenant.marketing.footer.groups.find((group) => group.title === 'Empresa');
    const sobre = companyGroup?.links.find((entry) => entry.label === 'Sobre');

    assert.equal(sobre?.placeholder, true);
    for (const social of setnarTenant.marketing.footer.social) {
      assert.equal(social.placeholder, true);
    }
  });
});
