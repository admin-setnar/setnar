import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

/**
 * `product-activation-card.tsx` is a Client Component with hooks, and
 * `page.tsx` transitively imports `'server-only'` modules — same constraint
 * `tests/auth-callback-recovery.test.ts` documents. Assert against the
 * source text instead of rendering.
 */
function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('/app/paginas period filter (SET-37/ADR-082)', () => {
  it('only trusts the literal "30" from ?periodo=, defaulting everything else to 7', () => {
    const page = source('src/app/app/paginas/page.tsx');

    assert.match(page, /searchParams: Promise<\{ periodo\?: string \}>/);
    assert.match(
      page,
      /const periodDays: AnalyticsPeriodDays = periodo === '30' \? 30 : 7;/,
    );
  });

  it('fetches the analytics summary for the signed-in representative and passes it to the hub', () => {
    const page = source('src/app/app/paginas/page.tsx');

    assert.match(page, /analyticsRepository\.listOwnSummaryByProduct\(representative\.id, periodDays\)/);
    assert.match(page, /analyticsByProduct=\{analyticsByProduct\}/);
    assert.match(page, /periodDays=\{periodDays\}/);
  });
});

describe('ProductActivationCard analytics line (SET-37/ADR-065 caution)', () => {
  const card = source('src/modules/representatives/presentation/product-activation-card.tsx');

  it('never renders for a product with no activation row', () => {
    assert.match(card, /state !== 'not_activated' \? \(/);
  });

  it('never claims a message was sent, a sale, or a financial conversion', () => {
    for (const forbidden of [/mensagem enviada/i, /\bvenda\b/i, /convers[aã]o financeira/i]) {
      assert.doesNotMatch(card, forbidden);
    }
  });
});
