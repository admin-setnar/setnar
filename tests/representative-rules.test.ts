import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  formatPhoneToE164,
  hasAtLeastTwoWords,
} from '@/modules/representatives/domain/representative-rules';

describe('hasAtLeastTwoWords', () => {
  it('accepts a simple first and last name', () => {
    assert.equal(hasAtLeastTwoWords('João Silva'), true);
  });

  it('accepts extra internal whitespace between words', () => {
    assert.equal(hasAtLeastTwoWords('João   Silva'), true);
  });

  it('accepts more than two words', () => {
    assert.equal(hasAtLeastTwoWords('João da Silva Santos'), true);
  });

  it('rejects a single word', () => {
    assert.equal(hasAtLeastTwoWords('João'), false);
  });

  it('rejects an empty string', () => {
    assert.equal(hasAtLeastTwoWords(''), false);
  });

  it('rejects a string that is only whitespace', () => {
    assert.equal(hasAtLeastTwoWords('   '), false);
  });

  it('rejects a single word surrounded by leading/trailing whitespace', () => {
    assert.equal(hasAtLeastTwoWords('  João  '), false);
  });

  it('trims leading/trailing whitespace before counting real words', () => {
    assert.equal(hasAtLeastTwoWords('  João Silva  '), true);
  });
});

describe('formatPhoneToE164', () => {
  it('converts a masked BR phone to E.164, assuming +55', () => {
    assert.equal(formatPhoneToE164('(11) 98888-7777'), '+5511988887777');
  });

  it('strips any non-digit characters before prefixing +55', () => {
    assert.equal(formatPhoneToE164('11 98888-7777'), '+5511988887777');
  });
});
