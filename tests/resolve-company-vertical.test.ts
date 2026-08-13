import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  COMPANY_BRAND_TOKENS,
  resolveCompanyVertical,
} from '@/modules/representatives/domain/company-brand/resolve-company-vertical';
import { IGREEN_TOKENS } from '@/modules/representatives/domain/company-brand/igreen';

/** Brand scope is resolved by Company; no Commercial Page may inherit the
 * SETNAR shell palette through a hard-coded fallback. */

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

  it('overrides semantic surfaces and actions so the SETNAR palette cannot leak in', () => {
    assert.equal(IGREEN_TOKENS['--surface'], '245 250 246');
    assert.equal(IGREEN_TOKENS['--surface-sunken'], '225 247 234');
    assert.equal(IGREEN_TOKENS['--brand'], '0 137 63');
    assert.equal(IGREEN_TOKENS['--ring'], '0 137 63');
    assert.equal(IGREEN_TOKENS['--commercial-sun'], '242 167 11');
  });
});
