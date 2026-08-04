import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  COMPANY_BRAND_TOKENS,
  resolveCompanyVertical,
} from '@/modules/representatives/domain/company-brand/resolve-company-vertical';
import { IGREEN_TOKENS } from '@/modules/representatives/domain/company-brand/igreen';

/**
 * CP9 prototype (NOT approved by iGreen — README ADR-057,
 * docs/COMMERCIAL_PAGE_CONTENT_PLAN.md §3.3/CP1). The real risk this
 * function guards against is exactly the one DOMAIN_MODEL.md §8.1 warns
 * about: assuming a single Company. These tests exist to keep that
 * assumption from creeping back in as an `if (true)`-style shortcut.
 */

describe('resolveCompanyVertical', () => {
  it('resolves the igreen vertical, with its tokens, for the igreen Company slug', () => {
    const result = resolveCompanyVertical('igreen');
    assert.ok(result);
    assert.equal(result.vertical, 'igreen');
    assert.equal(result.tokens, IGREEN_TOKENS);
  });

  it('returns undefined for any Company slug not in COMPANY_BRAND_TOKENS, never a guess', () => {
    assert.equal(resolveCompanyVertical('some-other-company'), undefined);
    assert.equal(resolveCompanyVertical(''), undefined);
  });

  it('keeps COMPANY_BRAND_TOKENS.igreen wired to IGREEN_TOKENS', () => {
    assert.equal(COMPANY_BRAND_TOKENS.igreen, IGREEN_TOKENS);
  });
});
