import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_REDIRECT_TARGET,
  safeRedirectTarget,
} from '@/modules/auth/presentation/safe-redirect-target';

describe('safeRedirectTarget', () => {
  it('accepts a valid relative path', () => {
    assert.equal(safeRedirectTarget('/app'), '/app');
    assert.equal(safeRedirectTarget('/app/configuracoes'), '/app/configuracoes');
  });

  it('falls back to the default target for an absolute URL', () => {
    assert.equal(safeRedirectTarget('https://site-malicioso.com'), DEFAULT_REDIRECT_TARGET);
    assert.equal(safeRedirectTarget('http://site-malicioso.com'), DEFAULT_REDIRECT_TARGET);
  });

  it('falls back to the default target for a protocol-relative URL', () => {
    assert.equal(safeRedirectTarget('//site-malicioso.com'), DEFAULT_REDIRECT_TARGET);
  });

  it('falls back to the default target for a backslash-prefixed path (protocol-relative in some parsers)', () => {
    assert.equal(safeRedirectTarget('/\\site-malicioso.com'), DEFAULT_REDIRECT_TARGET);
  });

  it('falls back to the default target for null, undefined or empty', () => {
    assert.equal(safeRedirectTarget(null), DEFAULT_REDIRECT_TARGET);
    assert.equal(safeRedirectTarget(undefined), DEFAULT_REDIRECT_TARGET);
    assert.equal(safeRedirectTarget(''), DEFAULT_REDIRECT_TARGET);
  });

  it('falls back to the default target for a path missing the leading slash', () => {
    assert.equal(safeRedirectTarget('app'), DEFAULT_REDIRECT_TARGET);
  });
});
