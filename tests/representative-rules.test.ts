import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  formatE164ToBRPhone,
  formatPhoneToE164,
  hasAtLeastTwoWords,
  maskBRPhone,
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

describe('formatE164ToBRPhone', () => {
  it('is the inverse of formatPhoneToE164 for a 9-digit mobile number', () => {
    assert.equal(formatE164ToBRPhone('+5511988887777'), '(11) 98888-7777');
  });

  it('handles an 8-digit landline number', () => {
    assert.equal(formatE164ToBRPhone('+551188887777'), '(11) 8888-7777');
  });

  it('returns an empty string for a value with no +55 prefix', () => {
    assert.equal(formatE164ToBRPhone('+11988887777'), '');
  });

  it('returns an empty string for a malformed value', () => {
    assert.equal(formatE164ToBRPhone('not-a-phone'), '');
  });
});

describe('maskBRPhone', () => {
  it('returns an empty string for no digits at all', () => {
    assert.equal(maskBRPhone(''), '');
  });

  it('opens the DDD group for 1-2 digits, no closing parenthesis yet', () => {
    assert.equal(maskBRPhone('1'), '(1');
    assert.equal(maskBRPhone('11'), '(11');
  });

  it('closes the DDD group once the 3rd digit is typed', () => {
    assert.equal(maskBRPhone('119'), '(11) 9');
  });

  it('keeps growing the subscriber number without a dash while it is 4 digits or fewer', () => {
    assert.equal(maskBRPhone('1198'), '(11) 98');
    assert.equal(maskBRPhone('119888'), '(11) 9888');
  });

  it('inserts the dash once a 5th subscriber digit is typed, splitting the last 4 as the suffix', () => {
    assert.equal(maskBRPhone('1198888'), '(11) 9-8888');
  });

  it('produces the full mask for a complete 11-digit mobile number', () => {
    assert.equal(maskBRPhone('11988887777'), '(11) 98888-7777');
  });

  it('caps at 11 digits, ignoring anything typed past that', () => {
    assert.equal(maskBRPhone('119888877779999'), '(11) 98888-7777');
  });

  it('strips non-digit characters before masking — so re-masking its own output is a no-op', () => {
    assert.equal(maskBRPhone('(11) 98888-7777'), '(11) 98888-7777');
  });

  it('re-masks correctly after a digit is deleted from the middle of an already-masked value', () => {
    // Same 8-digit landline shape formatE164ToBRPhone's own test above covers.
    assert.equal(maskBRPhone('1188887777'), '(11) 8888-7777');
  });
});
