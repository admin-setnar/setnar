import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

import {
  COMMERCIAL_PAGE_TEMPLATES,
  getCommercialPageTemplate,
} from '../src/modules/representatives/domain/commercial-page-template';

const EXPECTED_SLUGS = [
  'conexao-club',
  'conexao-green',
  'conexao-livre',
  'conexao-placas',
  'conexao-solar',
  'green-seguros',
  'telecom',
] as const;

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('commercial page template registry', () => {
  it('defines exactly the seven catalog products with complete shared content', () => {
    assert.deepEqual(Object.keys(COMMERCIAL_PAGE_TEMPLATES).sort(), [...EXPECTED_SLUGS].sort());

    for (const slug of EXPECTED_SLUGS) {
      const template = getCommercialPageTemplate(slug);
      assert.ok(template, `${slug} should resolve`);
      assert.equal(template.slug, slug);
      assert.ok(template.headline.length > 20);
      assert.ok(template.steps.length >= 4);
      assert.ok(template.offerItems.length >= 3);
      assert.ok(template.faq.length >= 4);
      assert.ok(template.thankYouDescription.length > 20);
      assert.ok(template.footerNotice.length > 20);
    }
  });

  it('fails closed for a product without an approved template', () => {
    assert.equal(getCommercialPageTemplate('produto-desconhecido'), null);
  });

  it('keeps each required interactive product widget isolated', () => {
    assert.equal(COMMERCIAL_PAGE_TEMPLATES['conexao-club'].widget, 'club-categories');
    assert.equal(COMMERCIAL_PAGE_TEMPLATES['conexao-green'].widget, 'green-calculator');
    assert.equal(COMMERCIAL_PAGE_TEMPLATES['conexao-solar'].widget, 'solar-benefits');
    assert.equal(COMMERCIAL_PAGE_TEMPLATES['green-seguros'].widget, 'seguros-coverage');
    assert.equal(COMMERCIAL_PAGE_TEMPLATES.telecom.widget, 'telecom-plans');
  });
});

describe('commercial page composition invariants', () => {
  const publicPage = source('src/app/[productSlug]/page.tsx');
  const previewPage = source('src/app/pre-visualizacao/[productSlug]/page.tsx');
  const composition = source('src/modules/representatives/presentation/commercial-page-content.tsx');
  const footer = source('src/modules/representatives/presentation/commercial-page-sections.tsx');

  it('uses the same CommercialPageContent in public and private preview routes', () => {
    assert.match(publicPage, /<CommercialPageContent/);
    assert.match(previewPage, /<CommercialPageContent/);
  });

  it('renders one common form and one product-specific success experience', () => {
    assert.equal((composition.match(/<LeadForm/g) ?? []).length, 1);
    assert.match(composition, /successDescription=\{template\.thankYouDescription\}/);
    assert.match(composition, /submitLabel=\{template\.leadButton\}/);
  });

  it('keeps canonical privacy and SETNAR authorship visible without analytics placeholders', () => {
    assert.match(footer, /href="\/privacidade"/);
    assert.match(footer, /Página produzida pela SETNAR/);
    assert.doesNotMatch(composition + footer, /GA4_ID|Meta Pixel|fbq\(/i);
  });
});
