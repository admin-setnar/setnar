import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { maskBRPhone } from '@/modules/leads/domain/lead-rules';

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

  it('strips non-digit characters from a pasted/autofilled value in a different shape', () => {
    assert.equal(maskBRPhone('11.98888.7777'), '(11) 98888-7777');
  });

  it('re-masks correctly after a digit is deleted from the middle of an already-masked value', () => {
    // Visitor had "(11) 98888-7777" and deleted the leading "9" of the
    // subscriber number, leaving raw digits "1188887777" (10 digits) — the
    // 8-digit landline shape BR_PHONE_PATTERN also accepts.
    assert.equal(maskBRPhone('1188887777'), '(11) 8888-7777');
  });
});
