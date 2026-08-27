import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

/**
 * SET-84 D4 (docs/plans/SET-84_DIVULGACAO_LEAN_PLAN.md) — `/app/divulgacao`
 * and `DivulgacaoFlow`. Same source-text-assertion style as
 * `tests/authenticated-app-consolidation.test.ts` and
 * `tests/commercial-page-templates.test.ts`: `DivulgacaoFlow` transitively
 * imports the registry (`registry.ts`), which imports the 21 real marketing
 * pieces and their `./fonts` CSS — `node --test` has no CSS loader, so
 * rendering it here would crash at require time. Reading source text avoids
 * that without weakening the contract this file actually checks.
 */
function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const page = source('src/app/app/divulgacao/page.tsx');
const flow = source('src/modules/marketing-materials/presentation/divulgacao-flow.tsx');

describe('/app/divulgacao route (SET-84 D4)', () => {
  it('reuses the same availability rule and catalog as /app/paginas/marketing — no bespoke isActive flag', () => {
    assert.match(page, /selectAvailableProductsWithMaterials/);
    assert.match(page, /getRepresentativeCatalogRepository/);
    assert.match(page, /isRepresentativeProfileComplete/);
  });

  it('never introduces a src/modules/divulgacao domain/application/infrastructure module', () => {
    assert.doesNotMatch(page, /from '@\/modules\/divulgacao/);
    assert.doesNotMatch(flow, /from '@\/modules\/divulgacao/);
  });

  it('resolves the representative from auth.uid via getCurrentUser, never a client-supplied id', () => {
    assert.match(page, /getCurrentUser\(\)/);
    assert.match(page, /findByProfileId\(user\.id\)/);
  });
});

describe('DivulgacaoFlow channel contract (SET-84 D1/D2)', () => {
  it('offers exactly the 4 channels the Issue fixes, mapped to their OriginId', () => {
    assert.match(flow, /key: 'instagram_post'.*origin: 'instagram_post'/);
    assert.match(flow, /key: 'instagram_story'.*origin: 'instagram_story'/);
    assert.match(flow, /key: 'whatsapp'.*origin: 'whatsapp'/);
    assert.match(flow, /key: 'link_qr'.*origin: 'qrcode'/);
  });

  it("the link_qr card's own Copiar link action uses 'direct', distinct from its own QR origin 'qrcode' (D1)", () => {
    assert.match(flow, /COPY_LINK_ORIGIN[\s\S]*?link_qr: 'direct'/);
  });

  it('resolves origin-tagged material props via buildMarketingMaterialPropsForOrigin, not the bare canonical builder', () => {
    assert.match(flow, /buildMarketingMaterialPropsForOrigin/);
    assert.doesNotMatch(flow, /buildMarketingMaterialPropsWithQrCode/);
  });

  it('reads copy from resolveDivulgacaoCopy (D2), never a second/duplicated template set', () => {
    assert.match(flow, /resolveDivulgacaoCopy/);
  });

  it('feature-detects the Web Share API instead of assuming it exists', () => {
    assert.match(flow, /typeof navigator\.share === 'function'/);
  });

  it('never reads window.location for origin — the value only flows in as a prop (§1.2, no re-derivation client-side)', () => {
    assert.doesNotMatch(flow, /window\.location/);
    assert.doesNotMatch(flow, /searchParams/);
  });
});
